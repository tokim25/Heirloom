# Heirloom Kitchen - Known Issues & Troubleshooting Guide

This document tracks known issues, root causes, and available solutions or workarounds.

---

### 1. Google Drive copy pauses after about an hour

- **Symptom:** Profile or the Drive screen says the Drive copy is paused.
- **Cause:** Google access tokens obtained in the browser expire after about an hour and cannot be refreshed client-side. Your cookbook itself is unaffected; it lives in Firestore and keeps syncing.
- **Resolution:** Tap **Reconnect Google Drive**. A server-side refresh token flow (planned) will remove this step.

---

### 2. Custom Domain Firebase Auth: `auth/unauthorized-domain`

- **Symptom:** When accessing `heirloom.tonykim.io` and attempting to log in with Google, Firebase throws `auth/unauthorized-domain`.
- **Cause:** Firebase Authentication enforces an authorized domain whitelist to protect against phishing.
- **Resolution:**
  1. Go to the [Firebase Console](https://console.firebase.google.com/).
  2. Select project `nth-imagery-298121` or your configured Firebase project.
  3. Navigate to **Authentication > Settings > Authorized domains**.
  4. Add `heirloom.tonykim.io` to the list.
  5. In Google Cloud OAuth consent settings, use the user-facing app name **Heirloom** and add Privacy Policy and Terms URLs to avoid project-domain warning panels during consent.

---

### 3. Gemini API Quotas & Intermittent Rate Limits (HTTP 429 / Resource Exhausted)

- **Symptom:** During high-traffic bursts or when scanning complex recipes with Gemini AI, the app may display an error message about token quotas or model overload.
- **Resolution:**
  1. Heirloom includes curated recipe fallbacks and local storage persistence so the cookbook remains accessible offline.
  2. The server handles rate-limit retries automatically. Wait a few moments and retry importing.

---

### 4. Hands-Free Voice Control Platform Support

- **Symptom:** The voice guide icon is dimmed or voice commands do not register.
- **Cause:** Voice dictation relies on the standard W3C Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
- **Resolution:**
  1. Use Google Chrome, Microsoft Edge, or Safari on iOS 14.5+.
  2. Ensure microphone permissions are granted in browser settings.

---

### 5. Instacart

- **Current behavior:** Heirloom opens Instacart store and item search links. It does not yet create an Instacart shopping list in one step.
- **Planned:** Instacart Developer Platform integration (`POST /idp/v1/products/products_link`), which returns one Instacart page with every item ready to add to the cart at your preferred store.
- **Security note:** Heirloom never requests or stores payment information; checkout always happens on Instacart.
