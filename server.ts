import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import dns from 'dns/promises';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Recipe } from './src/types/recipe.ts';
import { RECIPE_JSON_SCHEMA, RecipeParseError, normalizeParsedRecipe } from './src/utils/recipeSchema.ts';
import {
  BLOCK_PAGE_MARKERS,
  YOUTUBE_ID,
  extractPageData,
  extractYouTubeDescription,
  isPrivateAddress,
} from './src/utils/pageExtract.ts';
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
// GEMINI RECIPE PARSING (LINK, YOUTUBE, PDF, PHOTO, TEXT)
// ==========================================

// Verified model aliases. Each attempt has its own timeout so the whole request stays inside
// the function's maxDuration (60s in vercel.json).
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const GEMINI_ATTEMPT_TIMEOUT_MS = 24000;

async function callGeminiWithFallback(params: { contents: any; config?: any }) {
  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_ATTEMPT_TIMEOUT_MS);
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: { ...params.config, abortSignal: controller.signal },
      });
      if (response?.text) return response;
    } catch (err: any) {
      console.warn(`[Gemini] ${model} failed:`, err?.status || err?.name || err?.message);
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('The AI service is unavailable right now.');
}

type ImportFailureCode = 'blocked' | 'video_unreadable' | 'no_recipe';

class ImportError extends Error {
  constructor(message: string, readonly code: ImportFailureCode) {
    super(message);
  }
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchPage(url: string): Promise<{ html: string } | { blocked: true }> {
  try {
    const res = await fetchPublicUrl(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { blocked: true };
    const html = await res.text();
    if (BLOCK_PAGE_MARKERS.some((marker) => html.includes(marker))) return { blocked: true };
    return { html };
  } catch (err) {
    if (err instanceof UserFacingError) throw err;
    return { blocked: true };
  }
}

const SYSTEM_INSTRUCTION = `You are a careful recipe transcriber. Convert the provided source into structured recipe data.

Hard rules:
1. Use ONLY information that is present in the source. Never invent, guess or "improve" ingredients, quantities, times, temperatures or steps.
2. If the source does not contain an actual recipe (no ingredients and no method), set foundRecipe to false.
3. If a quantity, unit, time or serving count is not stated, use 0 (or an empty string). Do not estimate.
4. Ingredient names are clean item names; put preparation like "diced" in notes. Assign the closest supermarket category.
5. Break the method into short sequential steps with one action each. Set timerSeconds only for steps that involve waiting (for example 5 minutes = 300).
6. Keep the source's wording and measurements where possible; convert only to make units standard (cups, tbsp, tsp, g, oz, lb, clove).`;

app.post('/api/recipes/parse', async (req: Request, res: Response) => {
  try {
    const { url, fileData, mimeType, fileName, rawText } = req.body;

    if (!url && !fileData && !rawText) {
      return res.status(400).json({ error: 'Provide a link, a photo or PDF, or the recipe text.' });
    }
    if (fileData && !/^(image\/|application\/pdf$)/.test(String(mimeType || ''))) {
      return res.status(400).json({ error: 'Only photos and PDFs can be uploaded.' });
    }

    const parts: any[] = [];
    let sourceContext = '';
    let heroImage = '';
    let youtubeFallbackText = '';
    let source: Recipe['source'] = { type: 'manual', sourceName: 'Pasted text' };

    if (fileData) {
      parts.push({ inlineData: { mimeType, data: String(fileData).replace(/^data:[^;]+;base64,/, '') } });
      sourceContext = `The attached ${mimeType === 'application/pdf' ? 'PDF' : 'photo'} (${fileName || 'upload'}) contains the recipe.`;
      source = {
        type: mimeType === 'application/pdf' ? 'pdf' : 'photo',
        fileName: fileName || undefined,
        sourceName: fileName || 'Uploaded recipe',
      };
    } else if (url) {
      const pageUrl = (await assertPublicUrl(url)).toString();
      const host = new URL(pageUrl).hostname.replace(/^www\./, '');
      const youtubeId = pageUrl.match(YOUTUBE_ID)?.[1];

      if (youtubeId) {
        let title = '';
        let author = '';
        let description = '';
        try {
          const oembed = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(pageUrl)}&format=json`, {
            signal: AbortSignal.timeout(5000),
          });
          if (oembed.ok) {
            const data = await oembed.json();
            title = data.title || '';
            author = data.author_name || '';
          }
        } catch {
          // Title is optional context.
        }
        // Creators often put the full recipe in the description; grab it as a second source.
        const page = await fetchPage(`https://www.youtube.com/watch?v=${youtubeId}`);
        if ('html' in page) description = extractYouTubeDescription(page.html);

        parts.push({ fileData: { fileUri: `https://www.youtube.com/watch?v=${youtubeId}` } });
        sourceContext = `The attached video is a cooking video${title ? ` titled "${title}"` : ''}${author ? ` by ${author}` : ''}. Transcribe the recipe from what is shown and said in the video.${
          description ? `\nVideo description (may list the ingredients):\n${description.slice(0, 4000)}` : ''
        }`;
        heroImage = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
        source = {
          type: 'youtube',
          url: pageUrl,
          youtubeId,
          sourceName: author ? `YouTube (${author})` : 'YouTube',
        };
        youtubeFallbackText = description.length > 200 ? description : '';
      } else {
        const page = await fetchPage(pageUrl);
        if ('blocked' in page) {
          throw new ImportError(
            `${host} would not let Heirloom read that page. Open it, copy the recipe, and paste it on the Notes / Text tab.`,
            'blocked'
          );
        }
        const data = extractPageData(page.html, pageUrl);
        heroImage = data.image;
        sourceContext = data.ldRecipe
          ? `Structured recipe data from the page (Schema.org):\n${JSON.stringify(data.ldRecipe, null, 2).slice(0, 8000)}`
          : `Text extracted from the page ${pageUrl}:\n${data.text}`;
        source = { type: 'link', url: pageUrl, sourceName: host };
      }
    } else {
      sourceContext = `Recipe text:\n${String(rawText).slice(0, 20000)}`;
    }

    const generate = (contentParts: any[]) =>
      callGeminiWithFallback({
        contents: [...contentParts, { text: `${SYSTEM_INSTRUCTION}\n\nSource:\n${sourceContext}` }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: RECIPE_JSON_SCHEMA,
          temperature: 0.1,
        },
      });

    let response;
    try {
      response = await generate(parts);
    } catch (err) {
      if (source.type !== 'youtube') throw err;
      if (!youtubeFallbackText) {
        throw new ImportError(
          'Heirloom could not watch that video (it may be private, age-restricted or very long). Paste the recipe from the description on the Notes / Text tab.',
          'video_unreadable'
        );
      }
      sourceContext = `Video description:\n${youtubeFallbackText.slice(0, 4000)}`;
      response = await generate([]);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      throw new ImportError('The AI response could not be read. Try again.', 'no_recipe');
    }

    let fields;
    try {
      fields = normalizeParsedRecipe(parsed);
    } catch (err) {
      if (err instanceof RecipeParseError) {
        throw new ImportError(
          source.type === 'youtube'
            ? 'No recipe was found in that video. If the creator lists it in the description, paste it on the Notes / Text tab.'
            : err.message,
          'no_recipe'
        );
      }
      throw err;
    }

    const now = new Date().toISOString();
    const recipe: Recipe = {
      ...fields,
      id: `recipe-${crypto.randomUUID()}`,
      source,
      heroImage,
      createdAt: now,
      updatedAt: now,
    };
    return res.json({ recipe });
  } catch (error: unknown) {
    if (error instanceof ImportError) {
      return res.status(422).json({ error: error.message, code: error.code });
    }
    if (error instanceof UserFacingError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error parsing recipe with Gemini:', error);
    const message = error instanceof Error ? error.message : '';
    const busy = /503|429|high demand|UNAVAILABLE|abort/i.test(message);
    return res.status(busy ? 503 : 500).json({
      error: busy
        ? 'The AI is busy or took too long. Try again in a moment.'
        : 'Something went wrong reading that recipe. Try again, or paste the recipe text instead.',
    });
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
