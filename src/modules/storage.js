// src/modules/storage.js

import { db, ensureAuth } from './firebase.js';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { toast } from './ui.js';

// References will be scoped to the authenticated user
let cachedUserRef = null;
async function getUserRef() {
    if (cachedUserRef) return cachedUserRef;

    console.log('getUserRef: start');
    const user = await ensureAuth();
    let uid = 'anonymous';
    if (user) {
        console.log('getUserRef: user found', user.uid);
        uid = user.uid;
    } else {
        // Handle unauthenticated state (likely offline or timeout)
        const localUser = JSON.parse(localStorage.getItem('fc_user') || '{}');
        uid = localUser.uid || 'anonymous';
        console.warn('getUserRef: using local/anonymous user', uid);
    }
    cachedUserRef = doc(db, 'users', uid);
    return cachedUserRef;
}

async function withTimeout(promise, timeoutMs, defaultVal = null) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn('Firestore call timed out');
      resolve(defaultVal);
    }, timeoutMs);
    promise.then((res) => {
      clearTimeout(timer);
      resolve(res);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export const Store = {
  async getSurveys() {
    console.log('Store.getSurveys: start');
    try {
      const userDocRef = await getUserRef();
      console.log('Store.getSurveys: got user ref, fetching collection...');
      const surveysSnapshot = await withTimeout(getDocs(collection(userDocRef, 'surveys')), 5000, null);

      const surveys = [];
      if (surveysSnapshot && typeof surveysSnapshot.forEach === 'function') {
        surveysSnapshot.forEach(doc => {
          surveys.push(doc.data());
        });
      } else {
        console.warn('Store.getSurveys: snapshot empty or timed out');
      }
      return surveys;
    } catch (e) {
      console.error('Store.getSurveys error:', e);
      return [];
    }
  },

  async getActive() {
    console.log('Store.getActive: start');
    const activeId = await this._getActiveId();
    if (!activeId) {
       console.log('Store.getActive: no activeId');
       return null;
    }
    const userDocRef = await getUserRef();
    console.log('Store.getActive: fetching survey doc', activeId);
    const sDoc = await withTimeout(getDoc(doc(collection(userDocRef, 'surveys'), activeId)), 5000, { exists: () => false });
    console.log('Store.getActive: doc received');
    return sDoc.exists() ? sDoc.data() : null;
  },

  async setActive(id) {
    console.log('Store.setActive:', id);
    if (!id) return;
    try {
      const userDocRef = await getUserRef();
      await setDoc(doc(collection(userDocRef, 'settings'), 'activeId'), { id });
      console.log('Store.setActive: success');
    } catch (e) {
      console.error('Store.setActive error:', e);
    }
  },

  async _getActiveId() {
    console.log('Store._getActiveId: start');
    try {
      const userDocRef = await getUserRef();
      console.log('Store._getActiveId: fetching activeId doc');
      const docSnap = await withTimeout(getDoc(doc(collection(userDocRef, 'settings'), 'activeId')), 3000, { exists: () => false });
      console.log('Store._getActiveId: doc received');
      return docSnap.exists() ? docSnap.data().id : null;
    } catch (e) {
      console.error('Store._getActiveId error:', e);
      return null;
    }
  },

  async add(s) {
    console.log('Store.add: Attempting to save survey', s.id);
    try {
      const userDocRef = await getUserRef();
      const surveyDocRef = doc(collection(userDocRef, 'surveys'), s.id);

      // We don't necessarily want to wait for the server acknowledgment if persistence is on.
      // Firestore's setDoc with persistence enabled resolves when written to local cache.
      await setDoc(surveyDocRef, s);
      console.log('Store.add: Survey written to local cache');

      // Update active session
      await this.setActive(s.id);
      return true;
    } catch (e) {
      console.error('Store.add: Error saving survey:', e);
      toast('Save error: ' + e.message, true);
      throw e; // Re-throw so caller knows it failed
    }
  },

  async update(s) {
    const userDocRef = await getUserRef();
    await setDoc(doc(collection(userDocRef, 'surveys'), s.id), s);
  },

  async del(id) {
    const userDocRef = await getUserRef();
    await deleteDoc(doc(collection(userDocRef, 'surveys'), id));
    
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
    
    await batch.commit();
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
    await setDoc(doc(collection(userDocRef, 'waypoints'), 'data'), { wps });
}

export async function saveSettings(s) {
  const userDocRef = await getUserRef();
  await setDoc(doc(collection(userDocRef, 'settings'), 'app_settings'), s);
}

export async function loadSettings() {
  console.log('loadSettings: start');
  const userDocRef = await getUserRef();
  console.log('loadSettings: fetching doc');
  const docSnap = await withTimeout(getDoc(doc(collection(userDocRef, 'settings'), 'app_settings')), 3000, { exists: () => false });
  console.log('loadSettings: done');
  return docSnap.exists() ? docSnap.data() : {};
}

export async function getTheme() {
  console.log('getTheme: start');
  const userDocRef = await getUserRef();
  console.log('getTheme: fetching doc');
  const docSnap = await withTimeout(getDoc(doc(collection(userDocRef, 'settings'), 'theme')), 3000, { exists: () => false });
  console.log('getTheme: done');
  return docSnap.exists() ? docSnap.data().value : 'night';
}

export async function setTheme(t) {
  const userDocRef = await getUserRef();
  await setDoc(doc(collection(userDocRef, 'settings'), 'theme'), { value: t });
}

export async function getBrightness() {
  console.log('getBrightness: start');
  const userDocRef = await getUserRef();
  console.log('getBrightness: fetching doc');
  const docSnap = await withTimeout(getDoc(doc(collection(userDocRef, 'settings'), 'brightness')), 3000, { exists: () => false });
  console.log('getBrightness: done');
  return docSnap.exists() ? docSnap.data().value : 100;
}

export async function setBrightness(v) {
  const userDocRef = await getUserRef();
  await setDoc(doc(collection(userDocRef, 'settings'), 'brightness'), { value: v });
}

// MIGRATION UTILITY
// Notice: In the Firebase version, local storage migration shouldn't overwrite cloud data
// blindly, so it's disabled or turned into a cloud push loop if data is found.
export async function migrateFromLocalStorage() {
  // Skipping local storage migration as Firebase provides cross-device state
  console.log('Firebase synced storage mode activated.');
}
