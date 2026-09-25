import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { Recipe, GroceryList, GroceryItem, User } from './src/types/recipe.ts';

dotenv.config();

const app = express();
const PORT = 3000;

// Allow large payloads for high-res photo and PDF uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Google Gemini SDK
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Paths for persistence
const DATA_DIR = path.resolve(process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/data' : 'data'));
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const RECIPES_FILE = path.join(DATA_DIR, 'recipes.json');
const LISTS_FILE = path.join(DATA_DIR, 'grocery-lists.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Real-time SSE active connections map: listId -> Set of Response objects
const sseClients = new Map<string, Set<Response>>();
const globalSseClients = new Set<Response>();

// Default seed recipes with culinary photography
const DEFAULT_RECIPES: Recipe[] = [
  {
    id: 'salmon-skillet-01',
    title: 'Crispy Skillet Salmon with Meyer Lemon Herb Butter',
    description: 'Crispy skin salmon fillets pan-seared to golden perfection, basted with frothy browned butter, garlic, capers, fresh dill, and Meyer lemon zest.',
    source: {
      type: 'curated',
      sourceName: 'Artisan Kitchen Collection',
    },
    heroImage: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=80',
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    totalTimeMinutes: 25,
    defaultServings: 2,
    cuisine: 'Coastal Mediterranean',
    difficulty: 'Intermediate',
    nutrition: {
      calories: 490,
      protein: '38g',
      carbs: '2g',
      fat: '34g',
    },
    ingredients: [
      { id: 'ing-1', name: 'Fresh Salmon Fillets (skin-on)', amount: 2, unit: 'fillets (6 oz each)', notes: 'pat very dry with paper towels', category: 'Meat & Seafood', instacartQuery: 'Fresh Atlantic Salmon Fillet' },
      { id: 'ing-2', name: 'Kosher Salt & Fresh Cracked Black Pepper', amount: 1, unit: 'tsp', notes: 'for seasoning generously', category: 'Pantry & Spices', instacartQuery: 'Diamond Crystal Kosher Salt' },
      { id: 'ing-3', name: 'Extra Virgin Olive Oil', amount: 1.5, unit: 'tbsp', notes: 'high smoke point olive oil', category: 'Pantry & Spices', instacartQuery: 'Extra Virgin Olive Oil' },
      { id: 'ing-4', name: 'Unsalted European Butter', amount: 3, unit: 'tbsp', notes: 'cubed, cold', category: 'Dairy & Refrigerated', instacartQuery: 'Kerrygold Unsalted Butter' },
      { id: 'ing-5', name: 'Garlic Cloves', amount: 3, unit: 'cloves', notes: 'gently smashed', category: 'Produce', instacartQuery: 'Organic Garlic Bulbs' },
      { id: 'ing-6', name: 'Fresh Dill & Flat-Leaf Parsley', amount: 2, unit: 'tbsp', notes: 'finely chopped', category: 'Produce', instacartQuery: 'Fresh Organic Dill' },
      { id: 'ing-7', name: 'Meyer Lemon (or standard lemon)', amount: 1, unit: 'lemon', notes: 'zested and sliced into rounds', category: 'Produce', instacartQuery: 'Organic Meyer Lemons' },
      { id: 'ing-8', name: 'Capers in Brine', amount: 1, unit: 'tbsp', notes: 'drained', category: 'Pantry & Spices', instacartQuery: 'Non-Pareil Capers' },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Prep & Dry Fillets',
        instruction: 'Thoroughly pat the salmon skin and flesh dry with paper towels. Score skin lightly with 3 shallow slits. Season skin and flesh generously with kosher salt and black pepper.',
        tips: 'Moisture is the enemy of crispy skin! Ensure the skin is completely dry.',
        stepIngredients: ['Fresh Salmon Fillets (skin-on)', 'Kosher Salt & Fresh Cracked Black Pepper'],
      },
      {
        stepNumber: 2,
        title: 'Preheat Skillet',
        instruction: 'Heat a heavy stainless steel or cast-iron skillet over medium-high heat for 2 minutes. Add olive oil and swirl to coat the surface until it shimmers.',
        timerSeconds: 120,
        temperature: 'Medium-High',
        tips: 'Pan must be smoking hot before fish touches the oil to avoid sticking.',
        stepIngredients: ['Extra Virgin Olive Oil'],
      },
      {
        stepNumber: 3,
        title: 'Crisp the Skin',
        instruction: 'Carefully lay salmon skin-side down, away from you. Press each fillet gently with a spatula for 15 seconds to prevent curling. Lower heat to medium and sear without moving for 5 minutes until skin is golden and crispy.',
        timerSeconds: 300,
        temperature: 'Medium',
        tips: 'Resist the urge to nudge or flip early. The fish will release naturally once crisp.',
      },
      {
        stepNumber: 4,
        title: 'Flip & Brown Butter Baste',
        instruction: 'Flip salmon. Add cubed butter, smashed garlic, lemon slices, and drained capers into pan. Tilt pan slightly and spoon the foaming butter over the salmon repeatedly for 2-3 minutes until opaque and tender.',
        timerSeconds: 180,
        temperature: 'Medium-Low',
        stepIngredients: ['Unsalted European Butter', 'Garlic Cloves', 'Meyer Lemon', 'Capers in Brine'],
        tips: 'Basting cooks the fish through gently while infusing aromatic browned butter.',
      },
      {
        stepNumber: 5,
        title: 'Rest & Garnish',
        instruction: 'Transfer salmon to warm plates, skin-side up. Spoon the lemon-caper butter pan sauce over top and finish with fresh chopped dill and fresh cracked pepper. Serve immediately.',
        stepIngredients: ['Fresh Dill & Flat-Leaf Parsley'],
        tips: 'Serve with steamed asparagus or warm crusty sourdough.',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tuscan-kale-stew-02',
    title: 'Tuscan White Bean & Lacinato Kale Stew with Parmesan Broth',
    description: 'A comforting, rustic Italian soup simmering creamy cannellini beans, tender dinosaur kale, sweet Italian mirepoix, and a rich savory Parmesan rind.',
    source: {
      type: 'curated',
      sourceName: 'Florentine Farmhouse Traditions',
    },
    heroImage: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=1200&q=80',
    prepTimeMinutes: 15,
    cookTimeMinutes: 30,
    totalTimeMinutes: 45,
    defaultServings: 4,
    cuisine: 'Italian Rustic',
    difficulty: 'Easy',
    nutrition: {
      calories: 320,
      protein: '16g',
      carbs: '44g',
      fat: '9g',
    },
    ingredients: [
      { id: 'ing-11', name: 'Cannellini Beans (canned or soaked)', amount: 2, unit: 'cans (15 oz)', notes: 'rinsed and drained, reserve half mashed', category: 'Pantry & Spices', instacartQuery: 'Organic Cannellini White Kidney Beans' },
      { id: 'ing-12', name: 'Lacinato / Tuscan Kale', amount: 1, unit: 'bunch', notes: 'stems removed, chopped into bite-sized ribbons', category: 'Produce', instacartQuery: 'Organic Lacinato Tuscan Kale' },
      { id: 'ing-13', name: 'Yellow Onion', amount: 1, unit: 'medium', notes: 'finely diced', category: 'Produce', instacartQuery: 'Yellow Onions' },
      { id: 'ing-14', name: 'Carrots', amount: 2, unit: 'medium', notes: 'peeled and diced', category: 'Produce', instacartQuery: 'Organic Whole Carrots' },
      { id: 'ing-15', name: 'Celery Ribs', amount: 2, unit: 'stalks', notes: 'diced', category: 'Produce', instacartQuery: 'Fresh Celery' },
      { id: 'ing-16', name: 'Garlic Cloves', amount: 4, unit: 'cloves', notes: 'minced', category: 'Produce', instacartQuery: 'Garlic Bulbs' },
      { id: 'ing-17', name: 'Vegetable or Chicken Broth', amount: 4, unit: 'cups', notes: 'low sodium', category: 'Pantry & Spices', instacartQuery: 'Low Sodium Vegetable Broth' },
      { id: 'ing-18', name: 'Parmigiano-Reggiano Rind', amount: 1, unit: 'rind (2 inch)', notes: 'or 1/2 cup grated parmesan', category: 'Dairy & Refrigerated', instacartQuery: 'Parmigiano Reggiano Cheese Wedge' },
      { id: 'ing-19', name: 'Extra Virgin Olive Oil', amount: 3, unit: 'tbsp', notes: 'plus extra for drizzling', category: 'Pantry & Spices', instacartQuery: 'Cold Pressed Extra Virgin Olive Oil' },
      { id: 'ing-20', name: 'Crushed Red Pepper Flakes', amount: 0.5, unit: 'tsp', notes: 'to taste', category: 'Pantry & Spices', instacartQuery: 'Red Chili Flakes' },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Sauté Aromatics (Soffritto)',
        instruction: 'In a large heavy-bottomed Dutch oven, heat olive oil over medium heat. Add diced onion, carrots, and celery with a pinch of salt. Cook gently until vegetables soften and onions are translucent, about 8 minutes. Stir in garlic and red pepper flakes for 1 minute.',
        timerSeconds: 480,
        temperature: 'Medium',
        stepIngredients: ['Extra Virgin Olive Oil', 'Yellow Onion', 'Carrots', 'Celery Ribs', 'Garlic Cloves', 'Crushed Red Pepper Flakes'],
      },
      {
        stepNumber: 2,
        title: 'Simmer Broth & Beans',
        instruction: 'Pour in broth. Add whole cannellini beans, the mashed beans (to naturally thicken), and the Parmesan rind. Bring to a lively boil, then reduce heat to gentle simmer for 15 minutes.',
        timerSeconds: 900,
        temperature: 'Medium-Low',
        stepIngredients: ['Cannellini Beans', 'Vegetable or Chicken Broth', 'Parmigiano-Reggiano Rind'],
        tips: 'Mashing 1 cup of beans with a fork creates an ultra-velvety broth without heavy cream.',
      },
      {
        stepNumber: 3,
        title: 'Wilt the Kale',
        instruction: 'Add chopped Tuscan kale ribbons into the simmering broth. Stir well and cook until kale is tender and vibrant dark green, about 5 to 7 minutes.',
        timerSeconds: 360,
        temperature: 'Low',
        stepIngredients: ['Lacinato / Tuscan Kale'],
      },
      {
        stepNumber: 4,
        title: 'Season & Serve',
        instruction: 'Remove the Parmesan rind. Season to taste with fresh lemon juice, black pepper, and sea salt. Ladle into warm shallow bowls, finishing with generous drizzle of peppery olive oil and freshly grated parmesan.',
        tips: 'Serve with grilled garlic-rubbed country bread.',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'biang-biang-noodles-03',
    title: 'Hand-Pulled Garlic Chili Crisp Biang Biang Noodles',
    description: 'Wide, chewy hand-stretched ribbon noodles tossed with sizzling aromatic scallion oil, toasted Sichuan peppercorn, black vinegar, and fiery chili flakes.',
    source: {
      type: 'curated',
      sourceName: "Xi'an Night Market Special",
    },
    heroImage: 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=1200&q=80',
    prepTimeMinutes: 30,
    cookTimeMinutes: 10,
    totalTimeMinutes: 40,
    defaultServings: 2,
    cuisine: 'Northern Chinese',
    difficulty: 'Intermediate',
    nutrition: {
      calories: 520,
      protein: '14g',
      carbs: '82g',
      fat: '16g',
    },
    ingredients: [
      { id: 'ing-21', name: 'High-Gluten All-Purpose Flour', amount: 2, unit: 'cups (250g)', notes: 'or unbleached bread flour', category: 'Pantry & Spices', instacartQuery: 'King Arthur Unbleached Bread Flour' },
      { id: 'ing-22', name: 'Lukewarm Water', amount: 0.6, unit: 'cup (140ml)', notes: 'with 1/2 tsp salt dissolved', category: 'Pantry & Spices', instacartQuery: 'Pure Bottled Water' },
      { id: 'ing-23', name: 'Neutral Oil (Canola or Avocado)', amount: 3, unit: 'tbsp', notes: 'for coating dough & hot oil pour', category: 'Pantry & Spices', instacartQuery: 'Avocado Cooking Oil' },
      { id: 'ing-24', name: 'Garlic', amount: 4, unit: 'cloves', notes: 'finely minced', category: 'Produce', instacartQuery: 'Garlic' },
      { id: 'ing-25', name: 'Scallions / Green Onions', amount: 3, unit: 'stalks', notes: 'thinly sliced', category: 'Produce', instacartQuery: 'Organic Green Scallions' },
      { id: 'ing-26', name: 'Chinese Chili Flakes / Gochugaru', amount: 1.5, unit: 'tbsp', notes: 'coarse ground, fragrant', category: 'Pantry & Spices', instacartQuery: 'Sichuan Chili Powder' },
      { id: 'ing-27', name: 'Chinkiang Black Vinegar', amount: 2, unit: 'tbsp', notes: 'or dark rice vinegar', category: 'Pantry & Spices', instacartQuery: 'Chinkiang Black Vinegar' },
      { id: 'ing-28', name: 'Light Soy Sauce', amount: 2, unit: 'tbsp', notes: 'aged soy sauce', category: 'Pantry & Spices', instacartQuery: 'Lee Kum Kee Premium Soy Sauce' },
      { id: 'ing-29', name: 'Baby Bok Choy', amount: 4, unit: 'heads', notes: 'halved lengthwise', category: 'Produce', instacartQuery: 'Baby Bok Choy' },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Knead & Rest Dough',
        instruction: 'Mix flour and salted water until a shaggy dough forms. Knead on counter for 8 minutes until smooth and elastic. Divide into 6 logs, brush lightly with oil, cover with plastic wrap, and rest for 30 minutes at room temperature.',
        timerSeconds: 1800,
        tips: 'Resting relaxes gluten so the noodles pull without snapping.',
        stepIngredients: ['High-Gluten All-Purpose Flour', 'Lukewarm Water', 'Neutral Oil'],
      },
      {
        stepNumber: 2,
        title: 'Flatten & Pull Noodles',
        instruction: 'Press a dough log flat with a rolling pin. Press a chopstick lengthwise along the center to form an indent guide. Hold both ends, slap rhythmically against the countertop ("biang biang!"), stretching to 3 feet long. Rip down the center crease to make two ribbons.',
        tips: 'Pull gently and slap in a rhythmic swinging motion.',
      },
      {
        stepNumber: 3,
        title: 'Boil Noodles & Greens',
        instruction: 'Bring a large pot of water to a rolling boil. Drop fresh noodles and halved bok choy in. Cook for 90 seconds until chewy and translucent (al dente). Drain immediately and transfer to wide serving bowls.',
        timerSeconds: 90,
        temperature: 'Boiling',
        stepIngredients: ['Baby Bok Choy'],
      },
      {
        stepNumber: 4,
        title: 'Mound Aromatics',
        instruction: 'Top hot noodles with minced garlic, sliced scallions, Chinese chili flakes, black vinegar, and soy sauce right in the center pile.',
        stepIngredients: ['Garlic', 'Scallions / Green Onions', 'Chinese Chili Flakes', 'Chinkiang Black Vinegar', 'Light Soy Sauce'],
      },
      {
        stepNumber: 5,
        title: 'Sizzling Hot Oil Splash',
        instruction: 'Heat neutral oil in a small pan until shimmering and lightly smoking. Carefully pour the scalding hot oil directly over the minced garlic and chili pile. It will sizzle dramatically, toasting the aromatics. Toss vigorously with chopsticks and enjoy!',
        timerSeconds: 60,
        temperature: 'Hot Oil (375°F / 190°C)',
        tips: 'The sizzling oil blooms the raw garlic and chili instantly without burning them.',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Helper functions for persistent files
function loadData<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error loading data from ${file}:`, err);
  }
  return fallback;
}

function saveData<T>(file: string, data: T) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error saving data to ${file}:`, err);
  }
}

// In-memory state with persistence
let recipes: Recipe[] = loadData(RECIPES_FILE, DEFAULT_RECIPES);
let groceryLists: GroceryList[] = loadData(LISTS_FILE, [
  {
    id: 'list-dinner-weekly',
    householdId: 'household-tokim-kitchen',
    title: 'Weekly Fresh & Produce',
    store: 'Whole Foods Market',
    inviteCode: 'MISE-7482',
    collaborators: [
      { id: 'user-tokim', name: 'Tokim', email: 'Tokim25@gmail.com', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80', color: '#1C1917' },
      { id: 'user-alex', name: 'Alex (Partner)', email: 'alex@family.kitchen', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80', color: '#0284C7' },
    ],
    items: [
      {
        id: 'item-101',
        listId: 'list-dinner-weekly',
        name: 'Fresh Atlantic Salmon Fillets',
        amount: 2,
        unit: 'fillets',
        category: 'Meat & Seafood',
        recipeTitle: 'Crispy Skillet Salmon',
        assignedTo: 'Tokim',
        checked: false,
        addedBy: 'Tokim',
        createdAt: new Date().toISOString(),
        store: 'Whole Foods Market',
        estimatedPrice: 14.99,
        instacartQuery: 'Fresh Atlantic Salmon Fillet',
      },
      {
        id: 'item-102',
        listId: 'list-dinner-weekly',
        name: 'Organic Meyer Lemons',
        amount: 3,
        unit: 'lemons',
        category: 'Produce',
        recipeTitle: 'Crispy Skillet Salmon',
        assignedTo: 'Alex (Partner)',
        checked: true,
        checkedBy: 'Alex (Partner)',
        checkedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        addedBy: 'Tokim',
        createdAt: new Date().toISOString(),
        store: 'Whole Foods Market',
        estimatedPrice: 3.49,
        instacartQuery: 'Organic Meyer Lemons',
      },
      {
        id: 'item-103',
        listId: 'list-dinner-weekly',
        name: 'Organic Lacinato Tuscan Kale',
        amount: 1,
        unit: 'bunch',
        category: 'Produce',
        recipeTitle: 'Tuscan White Bean Stew',
        assignedTo: 'Anyone',
        checked: false,
        addedBy: 'Alex (Partner)',
        createdAt: new Date().toISOString(),
        store: 'Whole Foods Market',
        estimatedPrice: 2.99,
        instacartQuery: 'Organic Tuscan Kale',
      },
      {
        id: 'item-104',
        listId: 'list-dinner-weekly',
        name: 'Fresh Organic Tarragon',
        amount: 1,
        unit: 'pack',
        category: 'Produce',
        recipeTitle: 'Crispy Skillet Salmon',
        assignedTo: 'Tokim',
        checked: false,
        addedBy: 'Tokim',
        createdAt: new Date().toISOString(),
        store: 'Whole Foods Market',
        estimatedPrice: 3.99,
        isOutOfStock: true,
        substitution: {
          name: 'Fresh Chervil or Dried Tarragon',
          ratio: '1/3 amount of dried or 1:1 fresh chervil',
          reason: 'Provides matching anise-herbaceous aroma in buttery pan sauce',
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]);

let users: User[] = loadData(USERS_FILE, [
  {
    id: 'user-tokim',
    email: 'Tokim25@gmail.com',
    name: 'Tokim',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    preferredStore: 'Whole Foods Market',
    dietaryPreferences: ['Dairy-Conscious', 'High-Protein'],
    partnerEmail: 'alex@family.kitchen',
    householdId: 'household-tokim-kitchen',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-alex',
    email: 'alex@family.kitchen',
    name: 'Alex (Partner)',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    preferredStore: 'Trader Joe\'s',
    dietaryPreferences: ['Organic'],
    partnerEmail: 'Tokim25@gmail.com',
    householdId: 'household-tokim-kitchen',
    createdAt: new Date().toISOString(),
  },
]);

// Helper to broadcast SSE updates to all subscribers of a list and global subscribers
function broadcastListUpdate(listId: string, event: { type: string; payload: unknown; user?: string; userName?: string; message?: string; item?: unknown; listId?: string; itemId?: string }) {
  const dataString = `data: ${JSON.stringify({ ...event, listId, timestamp: new Date().toISOString() })}\n\n`;

  // Broadcast to specific list clients
  const clients = sseClients.get(listId);
  if (clients && clients.size > 0) {
    for (const res of clients) {
      try {
        res.write(dataString);
      } catch {
        clients.delete(res);
      }
    }
  }

  // Broadcast to global grocery stream clients
  for (const res of globalSseClients) {
    try {
      res.write(dataString);
    } catch {
      globalSseClients.delete(res);
    }
  }
}

// ==========================================
// AUTH & PROFILE ENDPOINTS
// ==========================================

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email } = req.body;
  const user = users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase().trim());
  if (user) {
    return res.json({ token: `token-${user.id}`, user });
  }
  // Default to primary user if email matches or falls back
  const primary = users[0];
  return res.json({ token: `token-${primary.id}`, user: primary });
});

app.post('/api/auth/signup', (req: Request, res: Response) => {
  const { name, email, preferredStore, dietaryPreferences, partnerEmail } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  if (existing) {
    return res.json({ token: `token-${existing.id}`, user: existing });
  }

  const newUser: User = {
    id: `user-${Date.now()}`,
    name,
    email: email.trim(),
    preferredStore: preferredStore || 'Whole Foods Market',
    dietaryPreferences: dietaryPreferences || [],
    partnerEmail: partnerEmail || '',
    householdId: `household-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveData(USERS_FILE, users);

  return res.status(201).json({ token: `token-${newUser.id}`, user: newUser });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer token-')) {
    const userId = authHeader.replace('Bearer token-', '');
    const user = users.find((u) => u.id === userId);
    if (user) return res.json({ user });
  }
  // Return default Tokim user
  return res.json({ user: users[0] });
});

app.put('/api/auth/profile', (req: Request, res: Response) => {
  const { id, name, preferredStore, dietaryPreferences, partnerEmail, avatarUrl } = req.body;
  const index = users.findIndex((u) => u.id === id);
  if (index !== -1) {
    users[index] = {
      ...users[index],
      name: name ?? users[index].name,
      preferredStore: preferredStore ?? users[index].preferredStore,
      dietaryPreferences: dietaryPreferences ?? users[index].dietaryPreferences,
      partnerEmail: partnerEmail ?? users[index].partnerEmail,
      avatarUrl: avatarUrl ?? users[index].avatarUrl,
    };
    saveData(USERS_FILE, users);
    return res.json({ user: users[index] });
  }
  return res.status(404).json({ error: 'User not found' });
});

// ==========================================
// RECIPES ENDPOINTS
// ==========================================

app.get('/api/recipes', (_req: Request, res: Response) => {
  return res.json({ recipes });
});

app.post('/api/recipes', (req: Request, res: Response) => {
  const recipeData = req.body;
  if (!recipeData.title) {
    return res.status(400).json({ error: 'Recipe title is required' });
  }
  const newRecipe: Recipe = {
    ...recipeData,
    id: recipeData.id || `recipe-${Date.now()}`,
    createdAt: recipeData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  recipes.unshift(newRecipe);
  saveData(RECIPES_FILE, recipes);
  return res.status(201).json({ recipe: newRecipe });
});

app.put('/api/recipes/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = recipes.findIndex((r) => r.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Recipe not found' });
  }
  recipes[idx] = {
    ...recipes[idx],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  saveData(RECIPES_FILE, recipes);
  return res.json({ recipe: recipes[idx] });
});

app.delete('/api/recipes/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  recipes = recipes.filter((r) => r.id !== id);
  saveData(RECIPES_FILE, recipes);
  return res.json({ success: true });
});

// ==========================================
// GEMINI RECIPE PARSING (LINK, PDF, PHOTO, SCREENSHOT)
// ==========================================

app.post('/api/recipes/parse', async (req: Request, res: Response) => {
  try {
    const { url, fileData, mimeType, fileName, rawText } = req.body;

    if (!url && !fileData && !rawText) {
      return res.status(400).json({ error: 'Please provide a URL, photo/PDF file, or raw text.' });
    }

    let promptContext = '';
    const parts: any[] = [];
    let isYouTube = false;
    let youtubeVideoId: string | null = null;
    let youtubeTitle = '';
    let youtubeAuthor = '';

    if (fileData && mimeType) {
      // Clean base64 string
      const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
      promptContext = `Analyze this attached recipe document/photo/screenshot (${fileName || 'uploaded recipe'}). `;
    } else if (url) {
      let webPageText = '';

      // Check if URL is YouTube Video or Shorts
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/i);
      if (ytMatch && ytMatch[1]) {
        isYouTube = true;
        youtubeVideoId = ytMatch[1];
        try {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
            signal: AbortSignal.timeout(5000),
          });
          if (oembedRes.ok) {
            const oembedData = await oembedRes.json();
            youtubeTitle = oembedData.title || '';
            youtubeAuthor = oembedData.author_name || '';
          }
        } catch (e) {
          console.warn('YouTube oembed fetch error:', e);
        }
      }

      try {
        const fetchRes = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          webPageText = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .slice(0, 15000);
        }
      } catch (err) {
        console.warn('URL direct fetch error or timed out, relying on URL prompt context:', err);
      }

      if (isYouTube) {
        promptContext = `The user shared a YouTube recipe video or YouTube Short:
URL: ${url}
Video ID: ${youtubeVideoId}
Title: ${youtubeTitle || 'Cooking Video'}
Creator: ${youtubeAuthor || 'Chef'}
Extracted page details/description: ${webPageText.slice(0, 4000)}

Please reconstruct the complete, authentic recipe showcased in this YouTube video/Short. Infer exact measurements, culinary techniques, temperatures, and timing.`;
      } else {
        promptContext = `The user wants to import this recipe from URL: ${url}. \n`;
        if (webPageText) {
          promptContext += `Here is extracted text from the page:\n${webPageText}\n`;
        }
      }
    } else if (rawText) {
      promptContext = `Here is recipe text or notes:\n${rawText}\n`;
    }

    const systemInstruction = `You are an elite culinary editor and minimalist cookbook curator.
Your task is to standardize any recipe into a pristine, structured step-by-step format suitable for an Apple/Airbnb-grade cookbook and Instagram Stories cooking mode.
Rules:
1. Standardize ingredients into precise quantities, standard units (cups, tbsp, tsp, grams, oz, lb, cloves, etc.), clean item names, notes (diced, chilled, etc.), and supermarket categories ('Produce', 'Dairy & Refrigerated', 'Meat & Seafood', 'Pantry & Spices', 'Bakery', 'Frozen', 'Other').
2. Provide concise instacartQuery for each ingredient suitable for an Instacart grocery search (e.g. "Fresh Atlantic Salmon Fillet", "Organic Meyer Lemons").
3. Break the recipe down into bite-sized, sequential steps suitable for Instagram Stories (one action per step).
4. For every step that involves waiting, boiling, baking, simmering, resting, or chilling, calculate 'timerSeconds' (e.g. 5 minutes = 300, 15 minutes = 900).
5. Specify 'stepIngredients' - the exact subset of ingredient names needed for that specific step.
6. Provide an inspiring, authentic food photography Unsplash URL for 'heroImage' that matches the dish, or pick a high-res culinary image.

You MUST respond strictly with valid JSON conforming to this schema:
{
  "title": string,
  "description": string,
  "heroImage": string,
  "prepTimeMinutes": number,
  "cookTimeMinutes": number,
  "totalTimeMinutes": number,
  "defaultServings": number,
  "cuisine": string,
  "difficulty": "Easy" | "Intermediate" | "Advanced",
  "nutrition": {
    "calories": number,
    "protein": string,
    "carbs": string,
    "fat": string
  },
  "ingredients": [
    {
      "id": string,
      "name": string,
      "amount": number,
      "unit": string,
      "notes": string,
      "category": string,
      "instacartQuery": string,
      "estimatedPrice": number
    }
  ],
  "steps": [
    {
      "stepNumber": number,
      "title": string,
      "instruction": string,
      "timerSeconds": number (optional, only if timed),
      "temperature": string (optional, e.g. "375°F / 190°C"),
      "tips": string (optional),
      "stepIngredients": string[] (subset of ingredient names used here)
    }
  ]
}`;

    parts.push({ text: `${systemInstruction}\n\nInput Recipe Source:\n${promptContext}` });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts } as any,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const outputText = response.text || '{}';
    const parsedRecipe = JSON.parse(outputText);

    // Sanitize recipe ID and dates
    const recipe: Recipe = {
      ...parsedRecipe,
      id: `recipe-${Date.now()}`,
      source: {
        type: isYouTube ? 'youtube' : url ? 'link' : fileData ? (mimeType.includes('pdf') ? 'pdf' : 'photo') : 'manual',
        url: url || undefined,
        fileName: fileName || undefined,
        youtubeId: youtubeVideoId || undefined,
        sourceName: isYouTube ? (youtubeAuthor ? `YouTube (${youtubeAuthor})` : 'YouTube / YouTube Shorts') : url ? new URL(url).hostname.replace('www.', '') : fileName || 'Imported Recipe',
      },
      heroImage: (isYouTube && youtubeVideoId)
        ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`
        : (parsedRecipe.heroImage || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Ensure ingredient IDs
    recipe.ingredients = (recipe.ingredients || []).map((ing, i) => ({
      ...ing,
      id: ing.id || `ing-${Date.now()}-${i}`,
      category: ing.category || 'Produce',
    }));

    return res.json({ recipe });
  } catch (error: unknown) {
    console.error('Error parsing recipe with Gemini:', error);
    const msg = error instanceof Error ? error.message : 'Unknown parsing error';
    return res.status(500).json({ error: `Failed to parse recipe: ${msg}` });
  }
});

// ==========================================
// GEMINI SMART INGREDIENT SUBSTITUTION
// ==========================================

app.post('/api/recipes/substitute', async (req: Request, res: Response) => {
  try {
    const { ingredientName, unit, amount, recipeContext, storeName } = req.body;
    if (!ingredientName) {
      return res.status(400).json({ error: 'ingredientName is required' });
    }

    const prompt = `You are an expert culinary chef. The following ingredient is out of stock at ${storeName || 'the grocery store'}:
Ingredient: ${amount ? amount : ''} ${unit ? unit : ''} ${ingredientName}
Recipe Context: ${recipeContext || 'Savory home cooking'}

Suggest 2 to 3 smart culinary substitutions that a home cook can use or buy on Instacart instead.
For each substitution provide:
1. "name": clear grocery item name
2. "ratio": exact measurement conversion (e.g., "Use 1 tsp dried for every 1 tbsp fresh", or "1:1 direct swap")
3. "reason": culinary explanation of why it works and any flavor or texture nuance
4. "instacartQuery": product search query on Instacart

Respond strictly in JSON array format:
[
  {
    "name": string,
    "ratio": string,
    "reason": string,
    "instacartQuery": string
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const suggestions = JSON.parse(response.text || '[]');
    return res.json({ substitutions: suggestions });
  } catch (err: unknown) {
    console.error('Error generating substitutions:', err);
    // Graceful fallback
    return res.json({
      substitutions: [
        {
          name: 'Pantry Alternative',
          ratio: '1:1 ratio',
          reason: 'Standard culinary substitution based on taste profile.',
          instacartQuery: req.body.ingredientName,
        },
      ],
    });
  }
});

// ==========================================
// INSTACART INTEGRATION ENDPOINTS
// ==========================================

app.post('/api/instacart/cart', (req: Request, res: Response) => {
  const { storeId, storeName, items } = req.body;

  // Build simulated Instacart shopping cart with deep links
  const processedItems = (items || []).map((item: unknown) => {
    const it = item as { name: string; amount?: number; unit?: string; instacartQuery?: string; estimatedPrice?: number; isOutOfStock?: boolean };
    const query = it.instacartQuery || it.name;
    const directUrl = `https://www.instacart.com/store/s?k=${encodeURIComponent(query)}`;

    // Randomize some item as out of stock if requested to demonstrate substitution engine
    const outOfStock = it.isOutOfStock || false;

    return {
      ...it,
      store: storeName || 'Whole Foods Market',
      estimatedPrice: it.estimatedPrice || (Math.round((2.49 + Math.random() * 6) * 100) / 100),
      isOutOfStock: outOfStock,
      directUrl,
    };
  });

  const totalPrice = processedItems.reduce((acc: number, item: { estimatedPrice: number }) => acc + (item.estimatedPrice || 0), 0);
  const outOfStockCount = processedItems.filter((i: { isOutOfStock: boolean }) => i.isOutOfStock).length;

  return res.json({
    storeId: storeId || 'whole-foods',
    storeName: storeName || 'Whole Foods Market',
    cartUrl: 'https://www.instacart.com/store/partner_recipes',
    items: processedItems,
    totalPrice: Math.round(totalPrice * 100) / 100,
    outOfStockCount,
  });
});

// ==========================================
// COLLABORATIVE GROCERY LISTS & REAL-TIME SSE
// ==========================================

// Handlers for both /api/groceries and /api/grocery-lists
const handleGetGroceryLists = (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  return res.json({ lists: groceryLists });
};
app.get('/api/groceries', handleGetGroceryLists);
app.get('/api/grocery-lists', handleGetGroceryLists);

// Global SSE events feed for all list updates
app.get('/api/groceries/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  globalSseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    globalSseClients.delete(res);
  });
});

// Create new list
const handleCreateList = (req: Request, res: Response) => {
  const { title, store, user } = req.body;
  const newList: GroceryList = {
    id: `list-${Date.now()}`,
    householdId: user?.householdId || 'household-tokim-kitchen',
    title: title || 'New Kitchen List',
    store: store || 'Whole Foods Market',
    inviteCode: `MISE-${Math.floor(1000 + Math.random() * 9000)}`,
    collaborators: user
      ? [{ id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, color: '#1C1917' }]
      : [{ id: 'user-tokim', name: 'Tokim', email: 'Tokim25@gmail.com', color: '#1C1917' }],
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  groceryLists.push(newList);
  saveData(LISTS_FILE, groceryLists);
  return res.status(201).json({ list: newList });
};
app.post('/api/groceries', handleCreateList);
app.post('/api/grocery-lists', handleCreateList);

// Join list via invite code
const handleJoinList = (req: Request, res: Response) => {
  const { inviteCode, user } = req.body;
  if (!inviteCode) {
    return res.status(400).json({ error: 'Invite code is required' });
  }

  const list = groceryLists.find((l) => l.inviteCode.toUpperCase() === inviteCode.trim().toUpperCase());
  if (!list) {
    return res.status(404).json({ error: 'Invalid invite code or list not found.' });
  }

  if (user && !list.collaborators.some((c) => c.email === user.email)) {
    list.collaborators.push({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      color: '#0284C7',
    });
    list.updatedAt = new Date().toISOString();
    saveData(LISTS_FILE, groceryLists);
    broadcastListUpdate(list.id, {
      type: 'COLLABORATOR_JOINED',
      payload: list,
      user: user.name,
      message: `${user.name} joined the grocery list`,
    });
  }

  return res.json({ list });
};
app.post('/api/groceries/join', handleJoinList);
app.post('/api/grocery-lists/join', handleJoinList);

// Add items to list (single or bulk from recipe)
const handleAddItems = (req: Request, res: Response) => {
  const { listId } = req.params;
  const { items, addedBy } = req.body;

  const list = groceryLists.find((l) => l.id === listId);
  if (!list) {
    return res.status(404).json({ error: 'List not found' });
  }

  const newItems: GroceryItem[] = (Array.isArray(items) ? items : [items]).map((it, idx) => ({
    id: it.id || `item-${Date.now()}-${idx}`,
    listId,
    name: it.name,
    amount: it.amount ?? null,
    unit: it.unit || '',
    category: it.category || 'Produce',
    recipeId: it.recipeId,
    recipeTitle: it.recipeTitle,
    assignedTo: it.assignedTo || 'Anyone',
    checked: false,
    addedBy: addedBy || 'Tokim',
    createdAt: new Date().toISOString(),
    store: list.store,
    estimatedPrice: it.estimatedPrice || (Math.round((2.5 + Math.random() * 5) * 100) / 100),
    instacartQuery: it.instacartQuery || it.name,
  }));

  list.items.push(...newItems);
  list.updatedAt = new Date().toISOString();
  saveData(LISTS_FILE, groceryLists);

  // Real-time broadcast to all connected devices/partners
  broadcastListUpdate(listId, {
    type: 'ITEM_ADDED',
    payload: newItems,
    item: newItems[0],
    user: addedBy || 'Tokim',
    message: `${addedBy || 'Tokim'} added ${newItems.length} item${newItems.length > 1 ? 's' : ''} to ${list.title}`,
  });

  return res.status(201).json({ items: newItems, item: newItems[0], list });
};
app.post('/api/groceries/:listId/items', handleAddItems);
app.post('/api/grocery-lists/:listId/items', handleAddItems);
app.post('/api/groceries/:listId/items/bulk', handleAddItems);
app.post('/api/grocery-lists/:listId/items/bulk', handleAddItems);

// Update grocery item (check/uncheck, assign, set substitution)
const handlePatchItem = (req: Request, res: Response) => {
  const { listId, itemId } = req.params;
  const { checked, assignedTo, userName, substitution } = req.body;

  const list = groceryLists.find((l) => l.id === listId);
  if (!list) {
    return res.status(404).json({ error: 'List not found' });
  }

  const item = list.items.find((i) => i.id === itemId);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  if (typeof checked === 'boolean') {
    item.checked = checked;
    if (checked) {
      item.checkedBy = userName || 'Tokim';
      item.checkedAt = new Date().toISOString();
    } else {
      item.checkedBy = undefined;
      item.checkedAt = undefined;
    }
  }

  if (assignedTo !== undefined) {
    item.assignedTo = assignedTo;
  }

  if (substitution !== undefined) {
    item.substitution = substitution;
  }

  list.updatedAt = new Date().toISOString();
  saveData(LISTS_FILE, groceryLists);

  // Broadcast real-time update
  const actionText = checked !== undefined
    ? (checked ? `checked off "${item.name}"` : `unchecked "${item.name}"`)
    : assignedTo !== undefined
    ? `assigned "${item.name}" to ${assignedTo}`
    : `updated "${item.name}"`;

  broadcastListUpdate(listId, {
    type: 'ITEM_UPDATED',
    payload: { listId, item, userName: userName || 'Tokim' },
    item,
    user: userName || 'Tokim',
    userName: userName || 'Tokim',
    message: `${userName || 'Tokim'} ${actionText}`,
  });

  return res.json({ item, list });
};
app.patch('/api/groceries/:listId/items/:itemId', handlePatchItem);
app.patch('/api/grocery-lists/:listId/items/:itemId', handlePatchItem);

// Delete grocery item
const handleDeleteItem = (req: Request, res: Response) => {
  const { listId, itemId } = req.params;
  const list = groceryLists.find((l) => l.id === listId);
  if (!list) {
    return res.status(404).json({ error: 'List not found' });
  }

  const removedItem = list.items.find((i) => i.id === itemId);
  list.items = list.items.filter((i) => i.id !== itemId);
  list.updatedAt = new Date().toISOString();
  saveData(LISTS_FILE, groceryLists);

  broadcastListUpdate(listId, {
    type: 'ITEM_DELETED',
    payload: { listId, itemId },
    itemId,
    user: req.query.userName as string || 'Collaborator',
    message: removedItem ? `Removed "${removedItem.name}"` : 'Item removed',
  });

  return res.json({ success: true, list });
};
app.delete('/api/groceries/:listId/items/:itemId', handleDeleteItem);
app.delete('/api/grocery-lists/:listId/items/:itemId', handleDeleteItem);

// Clear checked items
const handleClearCompleted = (req: Request, res: Response) => {
  const { listId } = req.params;
  const list = groceryLists.find((l) => l.id === listId);
  if (!list) {
    return res.status(404).json({ error: 'List not found' });
  }

  const count = list.items.filter((i) => i.checked).length;
  list.items = list.items.filter((i) => !i.checked);
  list.updatedAt = new Date().toISOString();
  saveData(LISTS_FILE, groceryLists);

  broadcastListUpdate(listId, {
    type: 'COMPLETED_CLEARED',
    payload: { listId },
    message: `Cleared ${count} completed items`,
  });

  return res.json({ success: true, list });
};
app.delete('/api/groceries/:listId/completed', handleClearCompleted);
app.delete('/api/grocery-lists/:listId/clear-completed', handleClearCompleted);

// Server-Sent Events (SSE) for Real-Time Multi-Device Collaboration on specific list
app.get('/api/grocery-lists/:listId/events', (req: Request, res: Response) => {
  const { listId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  if (!sseClients.has(listId)) {
    sseClients.set(listId, new Set());
  }
  const clientSet = sseClients.get(listId)!;
  clientSet.add(res);

  // Send initial connection handshake
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', listId, timestamp: new Date().toISOString() })}\n\n`);

  // Periodic heartbeat every 20 seconds to prevent timeout
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clientSet.delete(res);
    if (clientSet.size === 0) {
      sseClients.delete(listId);
    }
  });
});

// ==========================================
// GEMINI AI CULINARY & GROCERY CHAT ASSISTANT
// ==========================================

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const systemInstruction = `You are the Mise Kitchen Studio Executive Culinary Assistant powered by Google Gemini.
Your role is built on a rigorous culinary Information & Data Architecture:
1. Help home cooks find, generate, and organize delicious recipes across four core dimensions:
   - INGREDIENTS: Hero proteins/elements (Fish & Seafood, Poultry, Meat & Pork, Pasta & Grains, Vegetarian), key produce, and pantry staples.
   - PREP TIME: Explicit active hands-on preparation time (e.g. express prep ≤ 15 mins vs involved prep).
   - COOK TIME & TOTAL TIME: Accurate split between active prep time, passive cook time (simmering, roasting), and total time (≤ 25m Quick, 25-45m Moderate, 45m+ Slow Cook).
   - CUISINE: Regional culinary traditions (Italian, Japanese, Mexican, Mediterranean, French, Thai, etc.) and dietary tags (e.g. "Gluten-Free", "High-Protein", "One-Pan").
2. Fix, standardize, and reformat messy recipes, confusing measurements, or unorganized steps into clear culinary instructions.
3. Assist with grocery planning: categorize shopping lists by supermarket aisle (Produce, Dairy & Refrigerated, Meat & Seafood, Pantry & Spices, Bakery, etc.), suggest substitutions for missing items, and organize meal plans.
4. Scale portions, explain culinary techniques (e.g. emulsification, braising, tempering chocolate, searing), and provide baking advice.

INTERACTIVE EMBED FORMATS:
- If the user asks for a recipe or you provide a complete recipe, include a structured JSON block labeled \`\`\`recipe-json
{
  "title": "Recipe Title",
  "description": "Short appetizing description",
  "cuisine": "Cuisine name (e.g., Italian, Mediterranean, Japanese)",
  "difficulty": "Easy" | "Intermediate" | "Advanced",
  "prepTimeMinutes": number (active hands-on prep time in minutes),
  "cookTimeMinutes": number (cooking/baking/simmering time in minutes),
  "totalTimeMinutes": number (total elapsed time in minutes),
  "defaultServings": number,
  "heroImage": "https://images.unsplash.com/photo-... (valid high-res food photo)",
  "tags": ["Tag1", "Tag2"],
  "ingredients": [
    { "name": "Item", "amount": number, "unit": "cup"|"tbsp"|"g"|etc, "category": "Produce"|"Dairy & Refrigerated"|"Meat & Seafood"|"Pantry & Spices"|"Bakery"|"Other", "notes": "" }
  ],
  "steps": [
    { "stepNumber": 1, "title": "Prep Step", "instruction": "Clear instructions...", "timerSeconds": 0, "temperature": "350°F (optional)", "tips": "" }
  ]
}
\`\`\`
The Mise UI will automatically parse this and render an instant "Save to Cookbook" and "Cook in Stories Mode" button for the user!

- If you suggest items to add to their shopping list, you may also output a JSON block labeled \`\`\`grocery-json
[
  { "name": "Organic Meyer Lemons", "amount": 3, "unit": "whole", "category": "Produce" }
]
\`\`\`
The Mise UI will display a 1-click "Add Items to Grocery List" card!

Keep conversational responses elegant, concise, warm, and helpful. Always respond in markdown.`;

    // Map conversation to Gemini content objects
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // Inject contextual info if provided (e.g. active recipe or grocery list)
    if (context && contents.length > 0) {
      const contextPrefix = `[Kitchen Context: ${JSON.stringify(context)}]\n\n`;
      const lastUserMsg = contents[contents.length - 1];
      if (lastUserMsg.role === 'user') {
        lastUserMsg.parts[0].text = `${contextPrefix}${lastUserMsg.parts[0].text}`;
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || "I'm here to help with your recipes and shopping lists! What would you like to cook today?";
    res.json({ reply });
  } catch (err: unknown) {
    console.error('Chat with Gemini error:', err);
    res.status(500).json({ error: 'Failed to chat with Gemini assistant' });
  }
});

// ==========================================
// VITE MIDDLEWARE & STATIC SERVING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Heirloom Kitchen server running at http://0.0.0.0:${PORT}`);
  });
  server.on('error', (err: any) => {
    console.error(`Server error on port ${PORT}:`, err);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export { app };
