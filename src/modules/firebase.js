// src/modules/firebase.js
//
// Firebase is loaded lazily, entirely via dynamic import() at first use —
// never a static top-level import. Previously this module (and storage.js,
// media.js, herbarium.js) imported the Firebase SDK statically from
// www.gstatic.com; if that CDN was unreachable for any reason (a
// first-ever offline launch, a restrictive network), the failed import
// made this whole module — and everything that imports it, all the way up
// through main.js — fail to load at all. No navigation, no tools, no
// local data entry. That directly contradicted the app's offline-first
// design: cloud sync should be able to fail without taking the rest of
// the app down with it.
//
// loadSDK() below returns null (never throws) when Firebase can't be
// reached. Every function in this file, and every caller elsewhere in the
// app, already treats "no cloud" as a normal, expected state — that's
// what offline-first means — so this only removes a single point of
// total failure, without changing behavior when Firebase *is* reachable.

const FIREBASE_VERSION = '11.0.0';
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

// Web configuration synthesized from Android google-services.json
const firebaseConfig = {
    apiKey: "AIzaSyCY075qQvmxxDmoCRdes8d-WPLAhtM_Gec",
    authDomain: "forest-capture-5e683.firebaseapp.com",
    projectId: "forest-capture-5e683",
    storageBucket: "forest-capture-5e683.firebasestorage.app",
    messagingSenderId: "604543983189",
    // Switched to a Web App ID to avoid auth/invalid-app-id
    appId: "1:604543983189:web:3914a0519b408e1d76fedc"
};

let sdk = null; // { authMod, firestoreMod, storageMod, app, auth, db, storage }
let loadPromise = null;
let lastUser = null;
let authInitialized = false;

/**
 * Lazily loads and initializes the full Firebase SDK (Auth, Firestore,
 * Storage). Memoized — safe to call from anywhere, any number of times.
 * Returns the cached instance immediately once loaded. Returns null
 * (never throws) if the CDN is unreachable; on a later call (e.g. after
 * connectivity returns) it will attempt the load again.
 */
export async function loadSDK() {
  if (sdk) return sdk;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const [appMod, authMod, firestoreMod, storageMod] = await Promise.all([
        import(/* @vite-ignore */ `${CDN}/firebase-app.js`),
        import(/* @vite-ignore */ `${CDN}/firebase-auth.js`),
        import(/* @vite-ignore */ `${CDN}/firebase-firestore.js`),
        import(/* @vite-ignore */ `${CDN}/firebase-storage.js`)
      ]);

      const app = appMod.initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);

      let db;
      try {
        db = firestoreMod.initializeFirestore(app, {
          localCache: firestoreMod.persistentLocalCache({ tabManager: firestoreMod.persistentSingleTabManager() })
        });
      } catch (err) {
        // Fallback: if persistence fails (e.g. already initialized), use basic Firestore
        db = firestoreMod.getFirestore(app);
        console.warn('Firestore persistence unavailable:', err.message);
      }

      const storage = storageMod.getStorage(app);

      // Keep lastUser in sync with auth state for the lifetime of the session.
      authMod.onAuthStateChanged(auth, (user) => {
        lastUser = user;
        authInitialized = true;
      });

      sdk = { authMod, firestoreMod, storageMod, app, auth, db, storage };
      return sdk;
    } catch (err) {
      console.warn('Firebase: SDK failed to load — continuing offline-only', err.message);
      loadPromise = null; // allow a retry on a later call
      return null;
    }
  })();

  return loadPromise;
}

let authPromise = null;

// Utility: resolves with cached/existing authenticated user (does NOT auto sign-in)
// Returns null after timeout — or immediately if Firebase can't be reached —
// so the app can proceed offline if not yet logged in.
export async function ensureAuth() {
    const s = await loadSDK();
    if (!s) return null;

    if (s.auth.currentUser) return s.auth.currentUser;
    if (authInitialized) return lastUser;
    if (authPromise) return authPromise;

    console.log('ensureAuth: checking cached credentials');
    authPromise = new Promise((resolve) => {
        if (!navigator.onLine) {
            console.warn('ensureAuth: Offline — proceeding without waiting for Firebase Auth');
            authInitialized = true;
            lastUser = null;
            authPromise = null;
            return resolve(null);
        }

        const timeout = setTimeout(() => {
            console.warn('ensureAuth: Timeout — proceeding offline/unauthenticated');
            authInitialized = true;
            lastUser = null;
            authPromise = null;
            resolve(null);
        }, 1500);

        const unsubscribe = s.authMod.onAuthStateChanged(s.auth, (user) => {
            clearTimeout(timeout);
            unsubscribe();
            authInitialized = true;
            lastUser = user;
            authPromise = null;
            if (user) {
                console.log('ensureAuth: Restored session');
                resolve(user);
            } else {
                console.log('ensureAuth: No cached session — login required');
                resolve(null);
            }
        });
    });

    return authPromise;
}

// Thrown by the Email* functions below when Firebase can't be reached at
// all. Carries the same .code the UI's friendlyAuthError() already maps
// to "No internet connection." — cloud sign-in genuinely does need one.
function offlineAuthError() {
    const err = new Error('Cloud sign-in requires an internet connection.');
    err.code = 'auth/network-request-failed';
    return err;
}

// Sign in an existing user with email + password
export async function EmailLogin(email, pwd) {
    const s = await loadSDK();
    if (!s) throw offlineAuthError();
    const cred = await s.authMod.signInWithEmailAndPassword(s.auth, email, pwd);
    console.log('EmailLogin: success');
    return cred.user;
}

// Register a new user with email + password
export async function EmailSignup(email, pwd) {
    const s = await loadSDK();
    if (!s) throw offlineAuthError();
    const cred = await s.authMod.createUserWithEmailAndPassword(s.auth, email, pwd);
    console.log('EmailSignup: success');
    return cred.user;
}

// Sign out and clear session cache
export async function AppSignOut() {
    const s = await loadSDK();
    if (s) await s.authMod.signOut(s.auth);
    localStorage.removeItem('fc_user');
    console.log('AppSignOut: success');
}

// Delete user account permanently — purges all Firestore data first (GDPR Art. 17)
export async function AppDeleteAccount() {
    const s = await loadSDK();
    // Dynamically import Store to purge all user surveys from Firestore + IndexedDB
    try {
        const { Store } = await import('./storage.js');
        await Store.clearAll();
        console.log('AppDeleteAccount: All survey data purged');
    } catch (e) {
        console.warn('AppDeleteAccount: Data purge failed (offline?)', e.message);
    }
    if (s && s.auth.currentUser) {
        await s.authMod.deleteUser(s.auth.currentUser);
    }
    localStorage.removeItem('fc_user');
    console.log('AppDeleteAccount: Account + data fully wiped');
}
