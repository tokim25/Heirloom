import { db } from './firebase.ts';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  writeBatch,
  arrayUnion,
  increment,
  query,
  where,
  FieldPath,
  Unsubscribe,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { Recipe, GroceryList, GroceryItem, Household, PlannedMeal, StockItem, ShareInvite, SharedRecipe, User } from '../types/recipe.ts';
import { generateShareId, sanitizeRecipeForShare } from './shareLink.ts';
import { generateInviteCode, normalizeInviteCode } from './invite.ts';

export { formatInviteCode, normalizeInviteCode } from './invite.ts';

/*
 * Data model (Firestore is the only source of truth):
 *   users/{uid}                          profile, incl. the household the user belongs to
 *   households/{hid}                     members + invite code
 *   households/{hid}/recipes/{recipeId}  shared cookbook
 *   households/{hid}/lists/{listId}      grocery list; items stored as a map keyed by item id
 *                                        so partners can check items off concurrently
 *   invites/{code}                       invite code -> household lookup
 */

type StoredGroceryList = Omit<GroceryList, 'items' | 'inviteCode' | 'collaborators'> & {
  items: Record<string, GroceryItem>;
};

const DEFAULT_STORE = 'Whole Foods Market';

const now = () => new Date().toISOString();
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const userRef = (uid: string) => doc(db, 'users', uid);
const householdRef = (hid: string) => doc(db, 'households', hid);
const recipesCol = (hid: string) => collection(db, 'households', hid, 'recipes');
const listsCol = (hid: string) => collection(db, 'households', hid, 'lists');
const inviteRef = (code: string) => doc(db, 'invites', code);
const shareRef = (id: string) => doc(db, 'shares', id);
const shareInviteRef = (id: string) => doc(db, 'shareInvites', id);

const memberFromUser = (user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  joinedAt: now(),
});

const toGroceryList = (stored: StoredGroceryList): GroceryList => ({
  ...stored,
  inviteCode: '',
  collaborators: [],
  items: Object.values(stored.items || {}).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
});

const itemField = (itemId: string, field?: keyof GroceryItem) =>
  field ? new FieldPath('items', itemId, field) : new FieldPath('items', itemId);

async function createHousehold(hid: string, user: User) {
  const code = generateInviteCode();
  const household: Household = {
    id: hid,
    ownerId: user.id,
    memberIds: [user.id],
    members: { [user.id]: memberFromUser(user) },
    inviteCode: code,
    createdAt: now(),
    updatedAt: now(),
  };
  await setDoc(householdRef(hid), household);
  await setDoc(inviteRef(code), { householdId: hid, createdBy: user.id, createdAt: now() });
}

export const firestoreService = {
  /**
   * Loads (or creates) the signed-in user's profile and makes sure their household exists.
   * Profile fields the user has saved are never overwritten here.
   */
  async ensureProfile(fbUser: FirebaseUser): Promise<User> {
    const snap = await getDoc(userRef(fbUser.uid));
    const identity = {
      id: fbUser.uid,
      email: fbUser.email || '',
      name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Heirloom Cook',
      avatarUrl: fbUser.photoURL || undefined,
    };

    let profile: User;
    if (snap.exists()) {
      profile = { ...(snap.data() as User), ...identity };
      await updateDoc(userRef(fbUser.uid), { ...identity, updatedAt: now() });
    } else {
      profile = {
        ...identity,
        preferredStore: localStorage.getItem('heirloom_preferred_store') || DEFAULT_STORE,
        dietaryPreferences: [],
        partnerEmail: '',
        householdId: `household-${fbUser.uid}`,
        createdAt: now(),
      };
      await setDoc(userRef(fbUser.uid), { ...profile, updatedAt: now() });
    }

    const ownHouseholdId = `household-${fbUser.uid}`;
    const householdSnap = await getDoc(householdRef(profile.householdId)).catch(() => null);
    if (!householdSnap?.exists()) {
      if (profile.householdId === ownHouseholdId) {
        await createHousehold(ownHouseholdId, profile);
      } else {
        // The household we pointed at is gone or we were removed; fall back to our own.
        const ownSnap = await getDoc(householdRef(ownHouseholdId)).catch(() => null);
        if (!ownSnap?.exists()) await createHousehold(ownHouseholdId, profile);
        profile = { ...profile, householdId: ownHouseholdId };
        await updateDoc(userRef(fbUser.uid), { householdId: ownHouseholdId, updatedAt: now() });
      }
    }
    return profile;
  },

  subscribeProfile(uid: string, onUpdate: (user: User) => void): Unsubscribe {
    return onSnapshot(userRef(uid), (snap) => {
      if (snap.exists()) onUpdate(snap.data() as User);
    });
  },

  async updateProfile(uid: string, updates: Partial<User>) {
    const { id: _id, householdId: _hid, ...safeUpdates } = updates;
    await updateDoc(userRef(uid), { ...safeUpdates, updatedAt: now() });
  },

  subscribeHousehold(hid: string, onUpdate: (household: Household) => void, onError: (err: Error) => void): Unsubscribe {
    return onSnapshot(
      householdRef(hid),
      (snap) => {
        if (snap.exists()) onUpdate(snap.data() as Household);
      },
      onError
    );
  },

  /**
   * Joins the household behind an invite code and brings the user's existing recipes along.
   */
  async joinHousehold(user: User, rawCode: string): Promise<string> {
    const code = normalizeInviteCode(rawCode);
    if (code.length !== 8) throw new Error('Invite codes look like HEIR-ABCD-EFGH. Check the code and try again.');

    const invite = await getDoc(inviteRef(code));
    if (!invite.exists()) throw new Error('That invite code was not found. Ask for a fresh code and try again.');
    const targetHid = invite.data().householdId as string;
    if (targetHid === user.householdId) return targetHid;

    await updateDoc(householdRef(targetHid), {
      memberIds: arrayUnion(user.id),
      [`members.${user.id}`]: memberFromUser(user),
      joinCode: code,
      updatedAt: now(),
    });

    // Copy the user's recipes into the shared cookbook so nothing is left behind.
    const oldRecipes = await getDocs(recipesCol(user.householdId)).catch(() => null);
    if (oldRecipes && !oldRecipes.empty) {
      const batch = writeBatch(db);
      oldRecipes.forEach((d) => {
        batch.set(doc(recipesCol(targetHid), d.id), { ...d.data(), householdId: targetHid, updatedAt: now() });
      });
      await batch.commit();
    }

    await updateDoc(userRef(user.id), { householdId: targetHid, updatedAt: now() });
    return targetHid;
  },

  // ---- Recipes ----

  subscribeRecipes(hid: string, onUpdate: (recipes: Recipe[]) => void, onError: (err: Error) => void): Unsubscribe {
    return onSnapshot(
      recipesCol(hid),
      (snap) => onUpdate(snap.docs.map((d) => d.data() as Recipe)),
      onError
    );
  },

  async saveRecipe(hid: string, recipe: Recipe, userId?: string): Promise<Recipe> {
    const saved: Recipe = {
      ...recipe,
      householdId: hid,
      userId: recipe.userId || userId,
      createdAt: recipe.createdAt || now(),
      updatedAt: now(),
    };
    await setDoc(doc(recipesCol(hid), recipe.id), saved);
    return saved;
  },

  /** Counts a use (+1) or takes one back (-1) without rewriting the rest of the recipe. */
  async adjustRecipeUse(hid: string, recipeId: string, delta: 1 | -1, lastUsedAt?: string) {
    const changes: Record<string, unknown> = { useCount: increment(delta) };
    if (lastUsedAt) changes.lastUsedAt = lastUsedAt;
    await updateDoc(doc(recipesCol(hid), recipeId), changes);
  },

  async deleteRecipe(hid: string, id: string) {
    await deleteDoc(doc(recipesCol(hid), id));
  },

  // ---- Sharing a recipe by link ----

  /** The share this person already made for one of their recipes, if any. */
  async findOwnShare(uid: string, recipeId: string): Promise<SharedRecipe | null> {
    const snap = await getDocs(query(collection(db, 'shares'), where('fromUid', '==', uid), where('recipeId', '==', recipeId)));
    return snap.empty ? null : (snap.docs[0].data() as SharedRecipe);
  },

  async createShare(user: Pick<User, 'id' | 'name'>, recipe: Recipe): Promise<SharedRecipe> {
    const share: SharedRecipe = {
      id: generateShareId(),
      fromUid: user.id,
      fromName: user.name,
      recipeId: recipe.id,
      recipe: sanitizeRecipeForShare(recipe),
      createdAt: now(),
      updatedAt: now(),
    };
    await setDoc(shareRef(share.id), share);
    return share;
  },

  /** Replaces the shared snapshot with the recipe as it is now. The link stays the same. */
  async refreshShare(share: SharedRecipe, recipe: Recipe): Promise<SharedRecipe> {
    const next: SharedRecipe = { ...share, recipe: sanitizeRecipeForShare(recipe), updatedAt: now() };
    await setDoc(shareRef(share.id), next);
    return next;
  },

  async getShare(id: string): Promise<SharedRecipe | null> {
    const snap = await getDoc(shareRef(id));
    return snap.exists() ? (snap.data() as SharedRecipe) : null;
  },

  async deleteShare(id: string) {
    // Remove the invites first so nobody's inbox keeps a row for a recipe that is no longer shared.
    const invites = await getDocs(query(collection(db, 'shareInvites'), where('fromUid', '==', (await this.getShare(id))?.fromUid ?? ''), where('shareId', '==', id)));
    await Promise.all(invites.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(shareRef(id));
  },

  // ---- Meal plan (a map on the household document, so partners see it live) ----

  async planMeal(hid: string, meal: PlannedMeal) {
    await updateDoc(householdRef(hid), new FieldPath('mealPlan', meal.id), meal, 'updatedAt', now());
  },

  async moveMeal(hid: string, mealId: string, updates: Partial<Pick<PlannedMeal, 'date' | 'servings' | 'slot' | 'kind'>>) {
    const args: unknown[] = [];
    (Object.keys(updates) as (keyof typeof updates)[]).forEach((key) => args.push(new FieldPath('mealPlan', mealId, key), updates[key]));
    args.push('updatedAt', now());
    const [first, firstValue, ...rest] = args;
    await updateDoc(householdRef(hid), first as FieldPath, firstValue, ...rest);
  },

  /** Moves several meals to new days in one write, so a partner never sees the plan half-shifted. */
  async moveMealDates(hid: string, moves: { id: string; date: string }[]) {
    if (moves.length === 0) return;
    const args: unknown[] = [];
    moves.forEach((m) => args.push(new FieldPath('mealPlan', m.id, 'date'), m.date));
    args.push('updatedAt', now());
    const [first, firstValue, ...rest] = args;
    await updateDoc(householdRef(hid), first as FieldPath, firstValue, ...rest);
  },

  async unplanMeal(hid: string, mealId: string) {
    await updateDoc(householdRef(hid), new FieldPath('mealPlan', mealId), deleteField(), 'updatedAt', now());
  },

  // ---- Fridge and freezer (a map on the household document, like the meal plan) ----

  async addStockItem(hid: string, item: StockItem) {
    await updateDoc(householdRef(hid), new FieldPath('stockItems', item.id), item, 'updatedAt', now());
  },

  /** A null mealId clears the link. */
  async updateStockItem(hid: string, id: string, updates: Pick<StockItem, 'name' | 'place'> & { mealId: string | null }) {
    await updateDoc(
      householdRef(hid),
      new FieldPath('stockItems', id, 'name'), updates.name,
      new FieldPath('stockItems', id, 'place'), updates.place,
      new FieldPath('stockItems', id, 'mealId'), updates.mealId ?? deleteField(),
      'updatedAt', now()
    );
  },

  async removeStockItem(hid: string, id: string) {
    await updateDoc(householdRef(hid), new FieldPath('stockItems', id), deleteField(), 'updatedAt', now());
  },

  // ---- Sending a shared recipe to someone's inbox ----

  async sendShareInvite(share: SharedRecipe, toEmail: string): Promise<ShareInvite> {
    const ref = doc(collection(db, 'shareInvites'));
    const invite: ShareInvite = {
      id: ref.id,
      shareId: share.id,
      fromUid: share.fromUid,
      fromName: share.fromName,
      toEmail,
      recipeTitle: share.recipe.title,
      heroImage: share.recipe.heroImage || '',
      createdAt: now(),
    };
    await setDoc(ref, invite);
    return invite;
  },

  /** Who the sender has sent a share to. */
  async listInvitesForShare(uid: string, shareId: string): Promise<ShareInvite[]> {
    const snap = await getDocs(query(collection(db, 'shareInvites'), where('fromUid', '==', uid), where('shareId', '==', shareId)));
    return snap.docs.map((d) => d.data() as ShareInvite).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  /** Used by the sender to unsend, and by the recipient to dismiss. */
  async removeInvite(id: string) {
    await deleteDoc(shareInviteRef(id));
  },

  /** Live inbox for one email address. */
  subscribeInbox(email: string, onUpdate: (invites: ShareInvite[]) => void, onError: (err: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, 'shareInvites'), where('toEmail', '==', email)),
      (snap) => onUpdate(snap.docs.map((d) => d.data() as ShareInvite).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      onError
    );
  },

  /** After saving a shared recipe, drop the matching inbox rows. */
  async dismissInvitesForShare(email: string, shareId: string) {
    const snap = await getDocs(query(collection(db, 'shareInvites'), where('toEmail', '==', email), where('shareId', '==', shareId)));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  },

  // ---- Grocery lists ----

  subscribeGroceryLists(hid: string, onUpdate: (lists: GroceryList[]) => void, onError: (err: Error) => void): Unsubscribe {
    return onSnapshot(
      listsCol(hid),
      (snap) => {
        const lists = snap.docs.map((d) => toGroceryList(d.data() as StoredGroceryList));
        lists.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        onUpdate(lists);
      },
      onError
    );
  },

  async createGroceryList(hid: string, title: string, store: string): Promise<string> {
    const id = newId('list');
    const list: StoredGroceryList = {
      id,
      householdId: hid,
      title: title || 'Groceries',
      store: store || DEFAULT_STORE,
      items: {},
      createdAt: now(),
      updatedAt: now(),
    };
    await setDoc(doc(listsCol(hid), id), list);
    return id;
  },

  async deleteGroceryList(hid: string, listId: string) {
    await deleteDoc(doc(listsCol(hid), listId));
  },

  async addGroceryItems(hid: string, listId: string, items: Omit<GroceryItem, 'id' | 'listId' | 'createdAt' | 'checked'>[]) {
    if (items.length === 0) return;
    const args: unknown[] = [];
    items.forEach((item) => {
      const id = newId('item');
      args.push(itemField(id), { ...item, id, listId, checked: false, createdAt: now() });
    });
    args.push('updatedAt', now());
    const [first, firstValue, ...rest] = args;
    await updateDoc(doc(listsCol(hid), listId), first as FieldPath, firstValue, ...rest);
  },

  async updateGroceryItem(hid: string, listId: string, itemId: string, updates: Partial<GroceryItem>) {
    const args: unknown[] = [];
    (Object.keys(updates) as (keyof GroceryItem)[]).forEach((key) => {
      if (key === 'id' || key === 'listId') return;
      const value = updates[key];
      args.push(itemField(itemId, key), value === undefined ? deleteField() : value);
    });
    if (args.length === 0) return;
    args.push('updatedAt', now());
    const [first, firstValue, ...rest] = args;
    await updateDoc(doc(listsCol(hid), listId), first as FieldPath, firstValue, ...rest);
  },

  async deleteGroceryItems(hid: string, listId: string, itemIds: string[]) {
    if (itemIds.length === 0) return;
    const args: unknown[] = [];
    itemIds.forEach((id) => args.push(itemField(id), deleteField()));
    args.push('updatedAt', now());
    const [first, firstValue, ...rest] = args;
    await updateDoc(doc(listsCol(hid), listId), first as FieldPath, firstValue, ...rest);
  },
};
