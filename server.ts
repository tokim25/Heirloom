import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import dns from 'dns/promises';
import net from 'net';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Recipe } from './src/types/recipe.ts';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

// This server is a stateless AI proxy. All recipes, grocery lists and profiles live in
// Firestore; nothing is stored here (Vercel functions have no durable disk or shared memory).
const app = express();
const PORT = 3000;

// Vercel caps request bodies at 4.5 MB; the client compresses images to stay under it.
app.use(express.json({ limit: '4.5mb' }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ==========================================
// AUTH: verify Firebase ID tokens
// ==========================================

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const firebaseJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

interface AuthedRequest extends Request {
  uid?: string;
}

async function requireFirebaseUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Sign in with Google to use this feature.' });
  }
  try {
    const { payload } = await jwtVerify(token, firebaseJwks, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    if (!payload.sub) throw new Error('Token has no subject');
    req.uid = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session expired. Sign in again and retry.' });
  }
}

app.use('/api', requireFirebaseUser);

// ==========================================
// URL SAFETY: only fetch public http(s) pages
// ==========================================

class UserFacingError extends Error {}

const isPrivateAddress = (address: string) => {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const lower = address.toLowerCase();
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') ||
    lower.startsWith('fe80') || lower.startsWith('::ffff:');
};

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UserFacingError('That does not look like a valid link. Paste the full address starting with https://');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UserFacingError('Only http and https links can be imported.');
  }
  const { address } = await dns.lookup(parsed.hostname).catch(() => ({ address: '' }));
  if (!address || isPrivateAddress(address)) {
    throw new UserFacingError('That link could not be reached.');
  }
  return parsed;
}

// Follows redirects by hand so every hop is re-checked against private addresses.
async function fetchPublicUrl(rawUrl: string, init: RequestInit): Promise<globalThis.Response> {
  let current = rawUrl;
  for (let hop = 0; hop < 5; hop += 1) {
    const safeUrl = await assertPublicUrl(current);
    const res = await fetch(safeUrl, { ...init, redirect: 'manual' });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, safeUrl).toString();
      continue;
    }
    return res;
  }
  throw new UserFacingError('That link redirected too many times.');
}

// ==========================================
// GEMINI RECIPE PARSING (LINK, PDF, PHOTO, SCREENSHOT)
// ==========================================

// Helper: Call Gemini with automatic model fallback and retries on 503/429
async function callGeminiWithFallback(params: {
  contents: any;
  config?: any;
}) {
  const models = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      console.warn(`[Gemini] Model ${model} failed, attempting next model:`, err?.status || err?.message);
      lastError = err;
      continue;
    }
  }
  throw lastError || new Error('All AI culinary models are currently unavailable.');
}

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
      await assertPublicUrl(url);
      let webPageText = '';
      let isCloudflareBlocked = false;
      let ldJsonRecipe: any = null;

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
        const fetchRes = await fetchPublicUrl(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (fetchRes.ok) {
          const html = await fetchRes.text();

          // Check if response is a Cloudflare anti-bot challenge or block page
          if (
            html.includes('Attention Required! | Cloudflare') ||
            html.includes('Sorry, you have been blocked') ||
            html.includes('cf-browser-verification') ||
            html.includes('<title>Just a moment...</title>')
          ) {
            isCloudflareBlocked = true;
          } else {
            // Check for Schema.org Recipe in JSON-LD
            const ldMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
            if (ldMatches) {
              for (const m of ldMatches) {
                try {
                  const jsonStr = m.replace(/<script[^>]*>|<\/script>/gi, '').trim();
                  const parsed = JSON.parse(jsonStr);
                  if (parsed['@type'] === 'Recipe') {
                    ldJsonRecipe = parsed;
                    break;
                  }
                  if (Array.isArray(parsed['@graph'])) {
                    const found = parsed['@graph'].find((g: any) => g['@type'] === 'Recipe');
                    if (found) {
                      ldJsonRecipe = found;
                      break;
                    }
                  }
                } catch {
                  // ignore JSON parse errors in script tags
                }
              }
            }

            webPageText = html
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .slice(0, 15000);
          }
        } else {
          isCloudflareBlocked = true;
        }
      } catch (err) {
        console.warn('URL direct fetch error or timed out, relying on URL prompt context:', err);
        isCloudflareBlocked = true;
      }

      if (isYouTube) {
        promptContext = `The user shared a YouTube recipe video or YouTube Short:
URL: ${url}
Video ID: ${youtubeVideoId}
Title: ${youtubeTitle || 'Cooking Video'}
Creator: ${youtubeAuthor || 'Chef'}
Extracted page details/description: ${webPageText.slice(0, 4000)}

Please reconstruct the complete, authentic recipe showcased in this YouTube video/Short. Infer exact measurements, culinary techniques, temperatures, and timing.`;
      } else if (isCloudflareBlocked) {
        // Handle Cloudflare-protected sites like Maangchi by extracting URL slug and reconstructing authentic recipe
        let host = 'website';
        let dishName = '';
        try {
          const urlObj = new URL(url);
          host = urlObj.hostname.replace('www.', '');
          const pathSlug = urlObj.pathname.split('/').filter(Boolean).pop() || '';
          dishName = pathSlug.replace(/[-_]+/g, ' ').replace(/\.html?$/i, '');
        } catch {
          dishName = url;
        }

        const authorName = host.includes('maangchi') ? 'Maangchi (the renowned Korean culinary expert)' : host;
        promptContext = `The user wants to import this exact recipe from URL: ${url}.
The target website (${host}) protects its pages behind a Cloudflare bot verification wall.
The requested dish is "${dishName}" created by ${authorName}.
Using your authoritative knowledge of canonical published recipes, reconstruct this complete, authentic recipe exactly as created and published by ${authorName}.
Ensure exact authentic measurements, ingredients (including authentic seasonings and garnishes), prep & cook times, servings, difficulty, aisle categories, Instacart search queries, and sequential step-by-step instructions with timers.`;
      } else if (ldJsonRecipe) {
        promptContext = `The user wants to import this recipe from URL: ${url}.
Here is structured Recipe data extracted from the page (Schema.org JSON-LD):
${JSON.stringify(ldJsonRecipe, null, 2).slice(0, 8000)}
Standardize this into the required schema.`;
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

    const response = await callGeminiWithFallback({
      contents: parts,
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
        sourceName: isYouTube
          ? (youtubeAuthor ? `YouTube (${youtubeAuthor})` : 'YouTube / YouTube Shorts')
          : url
          ? new URL(url).hostname.replace('www.', '')
          : fileName || 'Imported Recipe',
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
    if (error instanceof UserFacingError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error parsing recipe with Gemini:', error);
    const rawMsg = error instanceof Error ? error.message : 'Unknown parsing error';
    const cleanMsg = rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')
      ? 'Our culinary AI is temporarily experiencing high demand. Please try again in a few moments.'
      : rawMsg;
    return res.status(500).json({ error: cleanMsg });
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

    const response = await callGeminiWithFallback({
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
// GEMINI AI CULINARY & GROCERY CHAT ASSISTANT
// ==========================================

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const systemInstruction = `You are the Heirloom Culinary Assistant powered by Google Gemini.
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
The Heirloom UI will automatically parse this and render an instant "Save to Cookbook" and "Cook in Stories Mode" button for the user!

- If you suggest items to add to their shopping list, you may also output a JSON block labeled \`\`\`grocery-json
[
  { "name": "Organic Meyer Lemons", "amount": 3, "unit": "whole", "category": "Produce" }
]
\`\`\`
The Heirloom UI will display a 1-click "Add Items to Grocery List" card!

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

    const response = await callGeminiWithFallback({
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
