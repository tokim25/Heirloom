# Heirloom Kitchen - Known Issues & Troubleshooting Guide

This document tracks known issues, root causes, and available solutions or workarounds.

---

### 1. Google Drive Vault: "Request had insufficient authentication scopes"

- **Symptom:** When clicking "Google Drive Vault" or attempting to create a cloud snapshot, an error banner appears stating: `Request had insufficient authentication scopes.`
- **Cause:** Standard Google Sign-In only issues basic identity scopes (`openid`, `email`, `profile`). Accessing Google Drive requires the incremental `https://www.googleapis.com/auth/drive.file` permission. If the user previously signed in without granting Google Drive access, the existing session token lacks the Drive permission.
- **Resolution:**
  1. Click the **Authorize Drive Scope** button directly in the error banner to launch the Google consent popup and approve Drive access.
  2. Verify that the **Google Drive API** is enabled in your Google Cloud Console project.
  3. Use **Local JSON Backup & Restore** in the vault dialog to export or restore recipes as a `.json` file without OAuth credentials.

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

### 5. Instacart Cart Checkout Flow

- **Security note:** Heirloom never requests or stores payment information. Instacart actions generate direct links to Instacart's official domain so checkout and payment remain secure.
- **Current behavior:** Heirloom creates store and item search handoff links. It does not create, manage, or verify a live Instacart cart.
- **Resolution / workaround:**
  1. Tap **Open Store** to launch the selected store on Instacart.
  2. Tap **Find Item** beside individual ingredients to search directly on Instacart.
  3. Use **Copy List** as a fallback checklist if Instacart search results vary by store, region, or session.
