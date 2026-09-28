# Heirloom — Preserve the recipe. Share the table.

> A minimalist, Apple & Airbnb-inspired digital cookbook and family recipe archive. Curate recipes from web links, YouTube videos, YouTube Shorts, PDFs, cookbook photos, or handwritten clippings. Scale servings dynamically with fractions and unit conversions (Imperial/Metric), cook step-by-step with hands-free voice navigation and an Instagram Stories-style auto-timer mode, prepare Instacart shopping handoffs across your favorite supermarkets with intelligent AI substitutions, and collaborate on real-time shared grocery lists with your partner or family.

---

## 🌐 Custom Domain & Production URL

Once pushed to Git, the app is configured for:
**`https://heirloom.tonykim.io`**

### DNS Configuration

Add the following DNS record in your domain registrar / DNS provider (e.g. Cloudflare, Namecheap, Google Domains, Route53):

| Type | Name / Host | Target / Value | Proxy / TTL |
| :--- | :--- | :--- | :--- |
| **CNAME** | `heirloom` | `cname.vercel-dns.com` *(if using Vercel)*<br>`tokim25.github.io` *(if using GitHub Pages)* | DNS Only / Auto |

*Note: A `CNAME` file containing `heirloom.tonykim.io` is bundled in `/public/CNAME` and at the root `/CNAME` to ensure custom domain routing persists across deployments.*

---

## ✨ Features

- **Multi-Source Recipe Import**:
  - **YouTube & YouTube Shorts**: Extracts culinary techniques, precise timing, and ingredient lists from cooking videos.
  - **Web Link / Blog**: Instant extraction of standardized instructions, ingredient categories, and times.
  - **Photos, Screenshots & PDFs**: Vision OCR & structuring for handwritten cards, cookbook pages, and magazine recipes.
- **Dynamic Servings Scaling & Unit Conversions**:
  - Automatically recalculates all ingredient proportions into readable fractions (`1/2`, `1 1/4`, `2 1/3`).
  - Toggle between **US Imperial** (cups, tbsp, oz, lbs) and **Metric** (grams, milliliters, kilograms).
  - In-app **Culinary Converter** for temperature (°F ⇄ °C) and ingredient-specific volume-to-weight (e.g., flour vs sugar density).
- **Instagram Stories-Style Cooking Mode**:
  - Fullscreen immersive story interface with top segmented progress indicators.
  - Advance or rewind by tapping screen halves, using keyboard arrow keys, or swiping.
  - Built-in per-step countdown kitchen timers with audio alarms, "+1 min" adjustments, and background ambient ticks.
  - Temperature highlights with conversion tooltips.
  - Confetti celebration upon recipe completion.
- **Shop on Instacart (manual, fast)**:
  - The shopping screen lists only what you still need, grouped by store aisle, with a one-tap Instacart search for each item at your chosen store (Whole Foods, Trader Joe's, Safeway, Kroger, Wegmans, Sprouts, Costco, H Mart).
  - Tick an item once it is in your Instacart cart; that checks it off the shared list for everyone in the household.
  - Adding a recipe combines repeats (1 lb + 2 lb of beef becomes 3 lb) instead of listing them twice. AI suggests a swap when an item is out of stock. Copy or share the list, grouped by aisle.
  - Heirloom cannot fill an Instacart cart in one step: that needs Instacart's Developer Platform API, whose program is currently closed to new applicants.
- **Shared Household**:
  - Invite a partner or family member with one code. Everyone in the household shares the cookbook and grocery lists.
  - Grocery lists update live on every device; checking an item off plays a chime for everyone else.
- **Share a recipe with anyone on Heirloom**:
  - **Share** on a recipe creates a private link. A signed-in Heirloom user who opens it sees a preview and can save their own copy. Nothing is shared until you create the link, and you can stop sharing at any time.
  - The copy is a snapshot: later edits are not shared unless you choose **Update the shared copy**. Saved recipes remember who shared them.
- **Sync & Google Drive Copy**:
  - Firestore is the single source of truth. Recipes and lists sync across devices and stay readable offline.
  - Optional Google Drive copy: one `Heirloom Recipes.json` file in your Drive, kept up to date while you use the app.
- **Sentry Telemetry**:
  - Client-side error tracking.

---

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS v4, Lucide Icons, Canvas Confetti
- **Backend**: Stateless Express AI proxy on Vercel. Every `/api` call requires a Firebase ID token.
- **AI & Vision Engine**: `@google/genai` (Gemini 2.5 Flash)
- **Database & Sync**: Firebase Auth + Firestore (offline cache, household-scoped security rules in `firestore.rules`)
- **Monitoring & Crash Reporting**: `@sentry/react`

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### 1. Clone the repository

```bash
git clone https://github.com/tokim25/Heirloom.git
cd Heirloom
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Setup environment variables

Copy `.env.example` to `.env.local` and add your keys:

```bash
cp .env.example .env.local
```

Required keys:
- `GEMINI_API_KEY`: Google Gemini API key for recipe parsing and smart culinary substitutions.
- `VITE_FIREBASE_AUTH_DOMAIN`: production only, set to `heirloom.tonykim.io` (see below).
- `VITE_SENTRY_DSN`: Sentry DSN for error telemetry (optional).

### Deploy Firestore security rules

The app stores everything in Firestore under `users/`, `households/` and `invites/`. Deploy the rules before shipping:

```bash
npx firebase-tools deploy --only firestore:rules --project nth-imagery-298121
```

### Same-origin Google sign-in (iOS Safari and the installed app)

1. In Google Cloud Console > APIs & Services > Credentials, open the OAuth web client used by Firebase and add `https://heirloom.tonykim.io/__/auth/handler` to **Authorized redirect URIs**.
2. In Vercel, set `VITE_FIREBASE_AUTH_DOMAIN=heirloom.tonykim.io` and redeploy. `vercel.json` already proxies `/__/auth/*` to Firebase.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Verify changes

Before opening a pull request or handing work to another agent, run:

```bash
npm run lint
npm run build
npm run test
```

---

## 📋 Git Workflow & GitHub Issue Tracking

1. **Bug Reports**: Open an issue using the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) or submit directly through the in-app Sentry bug modal.
2. **Feature Requests**: Submit ideas using the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md).
3. **Known Issues**: Review [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for current troubleshooting notes and expected workarounds.

---

## 📄 License

Apache-2.0
