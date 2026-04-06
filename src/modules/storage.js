// src/modules/storage.js

import { db, ensureAuth } from './firebase.js';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';


// References will be scoped to the authenticated user
async function getUserRef() {
    const user = await ensureAuth();
    return doc(db, 'users', user.uid);
}

export const Store = {
  async getSurveys() {
    const userDocRef = await getUserRef();
    const surveysSnapshot = await getDocs(collection(userDocRef, 'surveys'));
    const surveys = [];
    surveysSnapshot.forEach(doc => {
      surveys.push(doc.data());
    });
    return surveys;
  },

  async getActive() {
    const activeId = await this._getActiveId();
    if (!activeId) return null;
    const userDocRef = await getUserRef();
    const sDoc = await getDoc(doc(collection(userDocRef, 'surveys'), activeId));
    return sDoc.exists() ? sDoc.data() : null;
  },

  async setActive(id) {
    const userDocRef = await getUserRef();
    setDoc(doc(collection(userDocRef, 'settings'), 'activeId'), { id });
  },

  async _getActiveId() {
    const userDocRef = await getUserRef();
    const docSnap = await getDoc(doc(collection(userDocRef, 'settings'), 'activeId'));
    return docSnap.exists() ? docSnap.data().id : null;
  },

  async add(s) {
    const userDocRef = await getUserRef();
    setDoc(doc(collection(userDocRef, 'surveys'), s.id), s);
    await this.setActive(s.id);
  },

  async update(s) {
    const userDocRef = await getUserRef();
    setDoc(doc(collection(userDocRef, 'surveys'), s.id), s);
  },

  async del(id) {
    const userDocRef = await getUserRef();
    deleteDoc(doc(collection(userDocRef, 'surveys'), id));
    
    // Fallback logic for activeId
    const activeId = await this._getActiveId();
    if (activeId === id) {
      const surveys = await this.getSurveys();
      await this.setActive(surveys.length ? surveys[0].id : null);
    }
  },

  async clearAll() {
    const surveys = await this.getSurveys();
    const userDocRef = await getUserRef();
    const batch = writeBatch(db);
    
    surveys.forEach(s => {
       batch.delete(doc(collection(userDocRef, 'surveys'), s.id));
    });
    batch.delete(doc(collection(userDocRef, 'settings'), 'activeId'));
    batch.delete(doc(collection(userDocRef, 'waypoints'), 'data'));
    
    batch.commit(); // Fire and forget
  },

  async _d() {
      const surveys = await this.getSurveys();
      const activeId = await this._getActiveId();
      return { surveys, activeId };
  }
};

export async function getWps() {
  const userDocRef = await getUserRef();
  const docSnap = await getDoc(doc(collection(userDocRef, 'waypoints'), 'data'));
  if (docSnap.exists()) {
    return docSnap.data().wps || [];
  }
  return [];
}

export async function saveWps(wps) {
    const userDocRef = await getUserRef();
    setDoc(doc(collection(userDocRef, 'waypoints'), 'data'), { wps });
}

export async function saveSettings(s) {
  const userDocRef = await getUserRef();
  setDoc(doc(collection(userDocRef, 'settings'), 'app_settings'), s);
}

export async function loadSettings() {
  const userDocRef = await getUserRef();
  const docSnap = await getDoc(doc(collection(userDocRef, 'settings'), 'app_settings'));
  return docSnap.exists() ? docSnap.data() : {};
}

export async function getTheme() {
  const userDocRef = await getUserRef();
  const docSnap = await getDoc(doc(collection(userDocRef, 'settings'), 'theme'));
  return docSnap.exists() ? docSnap.data().value : 'night';
}

export async function setTheme(t) {
  const userDocRef = await getUserRef();
  setDoc(doc(collection(userDocRef, 'settings'), 'theme'), { value: t });
}

export async function getBrightness() {
  const userDocRef = await getUserRef();
  const docSnap = await getDoc(doc(collection(userDocRef, 'settings'), 'brightness'));
  return docSnap.exists() ? docSnap.data().value : 100;
}

export async function setBrightness(v) {
  const userDocRef = await getUserRef();
  setDoc(doc(collection(userDocRef, 'settings'), 'brightness'), { value: v });
}

// MIGRATION UTILITY
// Notice: In the Firebase version, local storage migration shouldn't overwrite cloud data
// blindly, so it's disabled or turned into a cloud push loop if data is found.
export async function migrateFromLocalStorage() {
  // Skipping local storage migration as Firebase provides cross-device state
  console.log('Firebase synced storage mode activated.');
}
