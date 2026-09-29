export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  preferredStore: string;
  dietaryPreferences: string[];
  partnerEmail?: string;
  /** Stores the person added themselves because Instacart shows them locally (not in the built-in list). */
  customStores?: string[];
  /** Built-in stores the person does not have on Instacart and wants hidden from the pickers. */
  hiddenStores?: string[];
  /** The person turned the Google Drive copy on. Kept on the account so it survives a new browser or cleared site data. */
  driveCopyEnabled?: boolean;
  householdId: string;
  createdAt: string;
}

export interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  joinedAt: string;
}

/** One recipe planned for one day. Lives on the household so everyone sees the same plan. */
export interface PlannedMeal {
  id: string;
  recipeId: string;
  recipeTitle: string;
  heroImage?: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  servings: number;
  addedBy: string;
}

// Everyone in a household shares its recipes and grocery lists.
export interface Household {
  id: string;
  ownerId: string;
  memberIds: string[];
  members: Record<string, HouseholdMember>;
  inviteCode: string;
  mealPlan?: Record<string, PlannedMeal>;
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  id: string;
  name: string;
  amount: number | null;
  unit: string;
  notes?: string;
  category: 'Produce' | 'Dairy & Refrigerated' | 'Meat & Seafood' | 'Pantry & Spices' | 'Bakery' | 'Frozen' | 'Other';
  instacartQuery?: string;
  estimatedPrice?: number;
  isOutOfStock?: boolean;
  substitution?: {
    name: string;
    ratio: string;
    reason: string;
  };
}

export interface RecipeStep {
  stepNumber: number;
  title?: string;
  instruction: string;
  timerSeconds?: number;
  temperature?: string;
  tips?: string;
  stepIngredients?: string[];
}

export interface Recipe {
  id: string;
  /** How many times this recipe was planned or cooked. Counts up when it joins the meal plan or you start cooking. */
  useCount?: number;
  /** When it was last planned or cooked (ISO). */
  lastUsedAt?: string;
  userId?: string;
  householdId?: string;
  title: string;
  description: string;
  source: {
    type: 'link' | 'photo' | 'screenshot' | 'pdf' | 'curated' | 'manual' | 'youtube';
    url?: string;
    sourceName?: string;
    fileName?: string;
    youtubeId?: string;
    /** Set when this recipe was saved from a link someone else shared. */
    sharedBy?: string;
    sharedFromShareId?: string;
  };
  heroImage: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  defaultServings: number;
  cuisine: string;
  difficulty: 'Easy' | 'Intermediate' | 'Advanced';
  tags?: string[];
  ingredients: Ingredient[];
  steps: RecipeStep[];
  nutrition?: {
    calories?: number;
    protein?: string;
    carbs?: string;
    fat?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/** A recipe someone chose to share by link. A snapshot: later edits to the original are not included. */
export interface SharedRecipe {
  id: string;
  fromUid: string;
  fromName: string;
  recipeId: string;
  recipe: Omit<Recipe, 'id' | 'userId' | 'householdId'>;
  createdAt: string;
  updatedAt: string;
}

/**
 * A recipe sent to one person's Heirloom inbox. Only the sender and that recipient can read it, and the
 * recipe itself (SharedRecipe) never contains anyone's email. The title and picture are copied here so the
 * inbox list needs no extra reads.
 */
export interface ShareInvite {
  id: string;
  shareId: string;
  fromUid: string;
  fromName: string;
  toEmail: string;
  recipeTitle: string;
  heroImage: string;
  createdAt: string;
}

export interface GroceryItem {
  id: string;
  listId: string;
  name: string;
  amount: number | null;
  unit: string;
  category: 'Produce' | 'Dairy & Refrigerated' | 'Meat & Seafood' | 'Pantry & Spices' | 'Bakery' | 'Frozen' | 'Other';
  recipeId?: string;
  recipeTitle?: string;
  assignedTo: string; // user name or "Anyone"
  checked: boolean;
  checkedBy?: string;
  checkedAt?: string;
  addedBy: string;
  createdAt: string;
  store?: string;
  estimatedPrice?: number;
  isOutOfStock?: boolean;
  substitution?: {
    name: string;
    ratio: string;
    reason: string;
  };
}

export interface GroceryList {
  id: string;
  householdId: string;
  title: string;
  store?: string;
  inviteCode: string;
  collaborators: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    color: string;
    status?: 'active' | 'pending';
  }[];
  items: GroceryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface StoreOption {
  id: string;
  name: string;
  tagline: string;
  deliveryTime: string;
  minOrder: string;
  color: string;
  iconName: string;
}

export interface PantryItem {
  id: string;
  name: string;
  category: 'Oils & Vinegars' | 'Spices & Seasonings' | 'Baking & Grains' | 'Dairy & Eggs' | 'Aromatics & Produce' | 'Condiments & Sauces' | 'Other';
  inStock: boolean;
  notes?: string;
  lastUpdated?: string;
}

