import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';


// Web configuration synthesized from Android google-services.json
const firebaseConfig = {
    apiKey: "AIzaSyCY075qQvmxxDmoCRdes8d-WPLAhtM_Gec",
    authDomain: "forest-capture-5e683.firebaseapp.com",
    projectId: "forest-capture-5e683",
    storageBucket: "forest-capture-5e683.firebasestorage.app",
    messagingSenderId: "604543983189",
    // We are using the mobile App ID as a fallback. 
    // If it causes an issue, the user will need to supply the 'web' specific appId
    appId: "1:604543983189:android:3914a0519b408e1d76fedc" 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);

// Enable Offline Persistence for Firestore (Crucial for Option A)
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.error('Firebase persistence failed: Multiple tabs open');
    } else if (err.code == 'unimplemented') {
        console.error('Firebase persistence not supported by browser');
    }
});

let authPromiseCache = null;

// Utility to ensure user is logged in before database operations
export async function ensureAuth() {
    if (authPromiseCache) return authPromiseCache;

    authPromiseCache = new Promise((resolve, reject) => {
        let authResolved = false;
        
        // Global timeout in case onAuthStateChanged hangs completely due to IDB locks
        const globalTimeoutId = setTimeout(() => {
            if (!authResolved) {
                authResolved = true;
                console.warn('ensureAuth timed out entirely, falling back to offline mode user');
                resolve({ uid: 'offline_user_default' });
            }
        }, 2500);

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (authResolved) {
                unsubscribe();
                return;
            }
            unsubscribe();
            if (user) {
                authResolved = true;
                clearTimeout(globalTimeoutId);
                resolve(user);
            } else {
                // If not logged in, force anonymous login
                signInAnonymously(auth)
                    .then((cred) => {
                        if (!authResolved) {
                            authResolved = true;
                            clearTimeout(globalTimeoutId);
                            resolve(cred.user);
                        }
                    })
                    .catch((err) => {
                        if (!authResolved) {
                            authResolved = true;
                            clearTimeout(globalTimeoutId);
                            console.warn('Anonymous auth failed, falling back to offline mode user', err);
                            resolve({ uid: 'offline_user_default' });
                        }
                    });
            }
        });
    });

    return authPromiseCache;
}


