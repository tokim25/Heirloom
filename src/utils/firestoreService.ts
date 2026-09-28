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
  FieldPath,
  Unsubscribe,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { Recipe, GroceryList, GroceryItem, Household, User } from '../types/recipe.ts';
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

  async deleteRecipe(hid: string, id: string) {
    await deleteDoc(doc(recipesCol(hid), id));
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
