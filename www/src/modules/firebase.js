import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js';
import { toast } from './ui.js';


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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with persistent local cache (replaces deprecated enableIndexedDbPersistence)
export let db;
try {
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
    });
} catch (err) {
    // Fallback: if persistence fails (e.g. already initialized), use basic Firestore
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js');
    db = getFirestore(app);
    console.warn('Firestore persistence unavailable:', err.message);
}

// Initialize Storage
export const storage = getStorage(app);

let authPromise = null;

// Utility: resolves with cached/existing authenticated user (does NOT auto sign-in)
// Returns null after timeout so the app can proceed offline if not yet logged in.
export async function ensureAuth() {
    if (auth.currentUser) return auth.currentUser;
    if (authPromise) return authPromise;

    console.log('ensureAuth: checking cached credentials');
    authPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('ensureAuth: Timeout — proceeding offline/unauthenticated');
            authPromise = null;
            resolve(null);
        }, 3000);

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            clearTimeout(timeout);
            unsubscribe();
            authPromise = null;
            if (user) {
                console.log('ensureAuth: Restored session for', user.uid);
                resolve(user);
            } else {
                console.log('ensureAuth: No cached session — login required');
                resolve(null);
            }
        });
    });

    return authPromise;
}

// Sign in an existing user with email + password
export async function EmailLogin(email, pwd) {
    const cred = await signInWithEmailAndPassword(auth, email, pwd);
    console.log('EmailLogin: success', cred.user.uid);
    return cred.user;
}

// Register a new user with email + password
export async function EmailSignup(email, pwd) {
    const cred = await createUserWithEmailAndPassword(auth, email, pwd);
    console.log('EmailSignup: success', cred.user.uid);
    return cred.user;
}
