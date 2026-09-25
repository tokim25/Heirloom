# Heirloom — Preserve the recipe. Share the table.

> A minimalist, Apple & Airbnb-inspired digital cookbook and family recipe archive. Curate recipes from web links, YouTube videos, YouTube Shorts, PDFs, cookbook photos, or handwritten clippings. Scale servings dynamically with fractions and unit conversions (Imperial/Metric), cook step-by-step with hands-free voice navigation and an Instagram Stories-style auto-timer mode, automatically populate Instacart shopping carts across your favorite supermarkets with intelligent AI substitutions, and collaborate on real-time shared grocery lists with your partner or family.

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
- **Instacart Integration & Smart Out-of-Stock Substitutions**:
  - Connects to your favorite stores: *Whole Foods Market, Trader Joe's, Safeway, Kroger, Wegmans, and Sprouts*.
  - Direct cart population with direct product links.
  - Smart culinary AI substitutions when items are out of stock (exact substitution ratios and culinary reasoning).
- **Multi-User Real-time Grocery Lists & Family Task Division**:
  - Divide grocery shopping tasks between partners ("Tokim", "Alex", "Anyone") to avoid duplicate purchases.
  - Organized by supermarket aisles (Produce, Dairy, Meat & Seafood, Pantry, Bakery, etc.).
  - Real-time Server-Sent Events (SSE) and Firebase Firestore synchronization with instant audio chimes and partner activity banners when items are checked off.
- **Persistence & Cloud Sync**:
  - Backed by Firebase Firestore for cross-device synchronization and persistent cloud storage.
- **Sentry Telemetry & Bug Tracking**:
  - Client-side error tracking and in-app bug reporting modal capturing diagnostic breadcrumbs, browser metadata, and direct submission to Sentry & GitHub Issues.

---

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS v4, Lucide Icons, Canvas Confetti
- **Backend / Proxy**: Node.js, Express, Server-Sent Events (SSE)
- **AI & Vision Engine**: `@google/genai` (Gemini 2.5 Flash)
- **Database & Sync**: Firebase Firestore & SSE real-time broadcast
- **Monitoring & Crash Reporting**: `@sentry/react`

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or bun

### 1. Clone the repository

```bash
git clone https://github.com/Tokim25/heirloom.git
cd heirloom
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup environment variables

Copy `.env.example` to `.env.local` and add your keys:

```bash
cp .env.example .env.local
```

Required keys:
- `GEMINI_API_KEY`: Google Gemini API key for recipe parsing and smart culinary substitutions.
- `VITE_SENTRY_DSN`: Sentry DSN for error telemetry (optional).

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📋 Git Workflow & GitHub Issue Tracking

1. **Bug Reports**: Open an issue using the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) or submit directly through the in-app Sentry bug modal.
2. **Feature Requests**: Submit ideas using the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md).

---

## 📄 License

Apache-2.0
