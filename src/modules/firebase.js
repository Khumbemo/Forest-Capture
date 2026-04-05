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

// Utility to ensure user is logged in before database operations
export async function ensureAuth() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                // If not logged in, force anonymous login
                signInAnonymously(auth)
                    .then((cred) => resolve(cred.user))
                    .catch(reject);
            }
        });
    });
}
