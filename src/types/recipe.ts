export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  preferredStore: string;
  dietaryPreferences: string[];
  partnerEmail?: string;
  householdId: string;
  createdAt: string;
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


