/* firebase-config.js
 *
 * PLACEHOLDER CONFIGURATION — the app runs fully offline in local-only mode with these
 * values untouched. To switch on cloud sync:
 *
 *   1. Create a Firebase project at https://console.firebase.google.com
 *   2. Enable Realtime Database and Anonymous authentication
 *   3. Deploy database.rules.json as your database security rules
 *   4. Paste your web app config below and set FIREBASE_ENABLED to true
 *
 * NEVER commit real keys to a public repository.
 */

export const FIREBASE_ENABLED = false;

export const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};

/* CDN module URLs used only when FIREBASE_ENABLED is true. */
export const FIREBASE_SDK = {
  app: "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js",
  auth: "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js",
  database: "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js",
  storage: "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js"
};
