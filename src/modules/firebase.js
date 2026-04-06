import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
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

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Storage
export const storage = getStorage(app);

// Enable Offline Persistence for Firestore (Crucial for Option A)
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.error('Firebase persistence failed: Multiple tabs open');
    } else if (err.code == 'unimplemented') {
        console.error('Firebase persistence not supported by browser');
    }
});

let authPromise = null;

// Utility to ensure user is logged in before database operations
export async function ensureAuth() {
    if (auth.currentUser) return auth.currentUser;
    if (authPromise) return authPromise;

    console.log('ensureAuth: check status');
    authPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('ensureAuth: Timeout, continuing anyway for offline use');
            authPromise = null;
            resolve(null);
        }, 3000); // Shortened to 3s

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            clearTimeout(timeout);
            unsubscribe();
            authPromise = null;
            if (user) {
                console.log('ensureAuth: User exists', user.uid);
                resolve(user);
            } else {
                console.log('ensureAuth: No user, signing in anonymously...');
                signInAnonymously(auth)
                    .then((cred) => {
                        console.log('ensureAuth: Anonymous sign-in success', cred.user.uid);
                        resolve(cred.user);
                    })
                    .catch((err) => {
                        console.error('ensureAuth: Sign-in error', err);
                        resolve(null); // Fallback to offline
                    });
            }
        });
    });

    return authPromise;
}
