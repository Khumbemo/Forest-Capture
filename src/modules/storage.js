// src/modules/storage.js

import { db, ensureAuth } from './firebase.js';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { toast } from './ui.js';

// ─── IndexedDB Wrapper ───
const DB_NAME = 'fc_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

export const idb = {
  dbPromise: null,
  init() {
    if (!this.dbPromise) {
      console.log('idb: Opening IndexedDB...');
      this.dbPromise = new Promise((resolve, reject) => {
        // Safety timeout for IndexedDB open
        const t = setTimeout(() => {
          console.warn('idb: Open TIMEOUT after 5s');
          reject(new Error('IndexedDB Timeout'));
        }, 5000);

        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
          console.log('idb: onupgradeneeded triggered');
          e.target.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = (e) => {
          console.log('idb: onsuccess triggered');
          clearTimeout(t);
          resolve(e.target.result);
        };
        request.onerror = (e) => {
          console.error('idb: onerror triggered', e.target.error);
          clearTimeout(t);
          reject(e.target.error);
        };
      });
    }
    return this.dbPromise;
  },
  async get(key) {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn(`idb: get(${key}) failed`, e.message);
      return null;
    }
  },
  async set(key, val) {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(val, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn(`idb: set(${key}) failed`, e.message);
      throw e;
    }
  },
  async remove(key) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};

// ─── IndexedDB survey cache helpers ───
const LS_SURVEYS_KEY = 'fc_surveys_cache';

async function _cacheSurveysToLocal(surveys) {
  try {
    await idb.set(LS_SURVEYS_KEY, JSON.stringify(surveys));
  } catch (e) {
    console.warn('_cacheSurveysToLocal: idb write failed', e);
  }
}

async function _loadSurveysFromLocal() {
  try {
    const raw = await idb.get(LS_SURVEYS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('_loadSurveysFromLocal: parse error', e);
    return [];
  }
}

async function _addSurveyToLocalCache(s) {
  const surveys = await _loadSurveysFromLocal();
  const idx = surveys.findIndex(x => x.id === s.id);
  if (idx >= 0) surveys[idx] = s;
  else surveys.push(s);
  await _cacheSurveysToLocal(surveys);
}

async function _removeSurveyFromLocalCache(id) {
  const surveys = (await _loadSurveysFromLocal()).filter(x => x.id !== id);
  await _cacheSurveysToLocal(surveys);
}

// References will be scoped to the authenticated user
let cachedUserRef = null;

/** Reset cached user ref — call on login/logout to avoid cross-user data leaks */
export function resetUserRef() {
    cachedUserRef = null;
}

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
  let timedOut = false;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      console.warn('Firestore call timed out');
      resolve(defaultVal);
    }, timeoutMs);
    promise.then((res) => {
      clearTimeout(timer);
      if (!timedOut) resolve(res);
    }).catch((err) => {
      clearTimeout(timer);
      if (!timedOut) reject(err);
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

      // If Firestore returned results, update the local cache
      if (surveys.length) {
        await _cacheSurveysToLocal(surveys);
        return surveys;
      }

      // Firestore returned nothing — fall back to localStorage cache
      const cached = await _loadSurveysFromLocal();
      if (cached.length) {
        console.log('Store.getSurveys: using idb cache (' + cached.length + ' surveys)');
        return cached;
      }
      return surveys;
    } catch (e) {
      console.error('Store.getSurveys error:', e);
      // Fall back to idb on any error
      const cached = await _loadSurveysFromLocal();
      if (cached.length) {
        console.log('Store.getSurveys: error recovery from idb (' + cached.length + ')');
        return cached;
      }
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
    // Try idb cache first for instant response
    const cached = await _loadSurveysFromLocal();
    const localMatch = cached.find(s => s.id === activeId);

    try {
      const userDocRef = await getUserRef();
      console.log('Store.getActive: fetching survey doc', activeId);
      const sDoc = await withTimeout(getDoc(doc(collection(userDocRef, 'surveys'), activeId)), 5000, { exists: () => false });
      console.log('Store.getActive: doc received');
      if (sDoc.exists()) return sDoc.data();
    } catch (e) {
      console.warn('Store.getActive: Firestore failed, trying cache', e.message);
    }

    // Fallback to idb
    if (localMatch) {
      console.log('Store.getActive: using idb cache for', activeId);
      return localMatch;
    }
    return null;
  },

  async setActive(id) {
    console.log('Store.setActive:', id);
    if (!id) {
      await idb.remove('fc_active_survey');
      return;
    }
    // Write to idb immediately for instant offline access
    await idb.set('fc_active_survey', id);
    try {
      const userDocRef = await getUserRef();
      setDoc(doc(collection(userDocRef, 'settings'), 'activeId'), { id });
      console.log('Store.setActive: success');
    } catch (e) {
      console.error('Store.setActive error:', e);
    }
  },

  async _getActiveId() {
    console.log('Store._getActiveId: start');
    // Fast path: check idb cache first
    const cached = await idb.get('fc_active_survey');
    if (cached) {
      console.log('Store._getActiveId: using idb cache', cached);
      // Sync Firestore in background without blocking UI
      this._syncActiveIdFromFirestore();
      return cached;
    }
    return this._syncActiveIdFromFirestore();
  },

  async _syncActiveIdFromFirestore() {
    console.log('Store._syncActiveIdFromFirestore: start');
    try {
      const userDocRef = await getUserRef();
      const docSnap = await withTimeout(getDoc(doc(collection(userDocRef, 'settings'), 'activeId')), 3000, { exists: () => false });
      console.log('Store._syncActiveIdFromFirestore: doc received');
      const id = docSnap.exists() ? docSnap.data().id : null;
      if (id) await idb.set('fc_active_survey', id);
      return id;
    } catch (e) {
      console.error('Store._syncActiveIdFromFirestore error:', e);
      return (await idb.get('fc_active_survey')) || null;
    }
  },

  async add(s) {
    console.log('Store.add: Attempting to save survey', s.id);
    // Cache to idb IMMEDIATELY so it's always available offline
    await _addSurveyToLocalCache(s);
    try {
      const userDocRef = await getUserRef();
      const surveyDocRef = doc(collection(userDocRef, 'surveys'), s.id);

      // We don't necessarily want to wait for the server acknowledgment if persistence is on.
      // Firestore's setDoc with persistence enabled resolves when written to local cache.
      const p = setDoc(surveyDocRef, s);

      // Update active session locally first
      await idb.set('fc_active_survey', s.id);

      // Attempt background Firestore update for activeId
      setDoc(doc(collection(userDocRef, 'settings'), 'activeId'), { id: s.id }).catch(e => {
        console.warn('Store.add: Background activeId sync failed', e);
      });

      console.log('Store.add: Survey written to local cache');
      return true;
    } catch (e) {
      console.error('Store.add: Error saving survey:', e);
      toast('Save error: ' + e.message, true);
      throw e; // Re-throw so caller knows it failed
    }
  },

  async update(s) {
    // Update idb cache immediately
    await _addSurveyToLocalCache(s);
    try {
      const userDocRef = await getUserRef();
      setDoc(doc(collection(userDocRef, 'surveys'), s.id), s);
    } catch (e) {
      console.warn('Store.update: Firestore write failed (offline?)', e.message);
    }
  },

  async del(id) {
    // Remove from idb cache immediately
    await _removeSurveyFromLocalCache(id);
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
    // Clear idb caches
    await idb.remove(LS_SURVEYS_KEY);
    await idb.remove('fc_active_survey');

    const surveys = await this.getSurveys();
    const userDocRef = await getUserRef();
    const batch = writeBatch(db);
    
    surveys.forEach(s => {
       batch.delete(doc(collection(userDocRef, 'surveys'), s.id));
    });
    batch.delete(doc(collection(userDocRef, 'settings'), 'activeId'));
    batch.delete(doc(collection(userDocRef, 'waypoints'), 'data'));
    
    batch.commit();
  },

  async getBackupData() {
      const surveys = await this.getSurveys();
      const activeId = await this._getActiveId();
      return { surveys, activeId };
  }
};

const LS_WPS_KEY = 'fc_waypoints_cache';

async function _cacheWpsToLocal(wps) {
  try { await idb.set(LS_WPS_KEY, JSON.stringify(wps)); }
  catch (e) { console.warn('_cacheWpsToLocal failed', e); }
}

async function _loadWpsFromLocal() {
  try {
    const raw = await idb.get(LS_WPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export async function getWps() {
  try {
    const userDocRef = await getUserRef();
    const docSnap = await withTimeout(getDoc(doc(collection(userDocRef, 'waypoints'), 'data')), 5000, { exists: () => false });
    if (docSnap.exists()) {
      const wps = docSnap.data().wps || [];
      await _cacheWpsToLocal(wps);
      return wps;
    }
  } catch (e) {
    console.warn('getWps: Firestore failed, using cache', e.message);
  }
  return await _loadWpsFromLocal();
}

export async function saveWps(wps) {
    // Cache immediately for offline access
    await _cacheWpsToLocal(wps);
    try {
      const userDocRef = await getUserRef();
      setDoc(doc(collection(userDocRef, 'waypoints'), 'data'), { wps });
    } catch (e) {
      console.warn('saveWps: Firestore write failed (offline?)', e.message);
    }
}

export async function saveSettings(s) {
  // Cache locally for offline access
  try { await idb.set('fc_app_settings', JSON.stringify(s)); } catch (_) {}
  try {
    const userDocRef = await getUserRef();
    await setDoc(doc(collection(userDocRef, 'settings'), 'app_settings'), s);
  } catch (e) {
    console.warn('saveSettings: Firestore write failed (offline?)', e.message);
  }
}

export async function loadSettings() {
  console.log('loadSettings: start');
  try {
    const userDocRef = await getUserRef();
    console.log('loadSettings: fetching doc');
    const docSnap = await withTimeout(getDoc(doc(collection(userDocRef, 'settings'), 'app_settings')), 3000, { exists: () => false });
    console.log('loadSettings: done');
    if (docSnap.exists()) {
      const data = docSnap.data();
      try { await idb.set('fc_app_settings', JSON.stringify(data)); } catch (_) {}
      return data;
    }
  } catch (e) {
    console.warn('loadSettings: Firestore failed, using cache', e.message);
  }
  // Fallback to idb
  try {
    const raw = await idb.get('fc_app_settings');
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}

export async function getTheme() {
  console.log('getTheme: start');
  try {
    const userDocRef = await getUserRef();
    console.log('getTheme: fetching doc');
    const docSnap = await withTimeout(getDoc(doc(collection(userDocRef, 'settings'), 'theme')), 3000, { exists: () => false });
    console.log('getTheme: done');
    if (docSnap.exists()) {
      const val = docSnap.data().value;
      try { await idb.set('fc_theme', val); } catch (_) {}
      return val;
    }
  } catch (e) {
    console.warn('getTheme: Firestore failed, using cache', e.message);
  }
  return (await idb.get('fc_theme')) || 'night';
}

export async function setTheme(t) {
  try { await idb.set('fc_theme', t); } catch (_) {}
  try {
    const userDocRef = await getUserRef();
    setDoc(doc(collection(userDocRef, 'settings'), 'theme'), { value: t });
  } catch (e) {
    console.warn('setTheme: Firestore write failed', e.message);
  }
}

export async function getBrightness() {
  console.log('getBrightness: start');
  try {
    const userDocRef = await getUserRef();
    console.log('getBrightness: fetching doc');
    const docSnap = await withTimeout(getDoc(doc(collection(userDocRef, 'settings'), 'brightness')), 3000, { exists: () => false });
    console.log('getBrightness: done');
    if (docSnap.exists()) {
      const val = docSnap.data().value;
      try { await idb.set('fc_brightness', String(val)); } catch (_) {}
      return val;
    }
  } catch (e) {
    console.warn('getBrightness: Firestore failed, using cache', e.message);
  }
  const cached = await idb.get('fc_brightness');
  return cached !== undefined && cached !== null ? parseInt(cached, 10) : 100;
}

export async function setBrightness(v) {
  try { await idb.set('fc_brightness', String(v)); } catch (_) {}
  try {
    const userDocRef = await getUserRef();
    setDoc(doc(collection(userDocRef, 'settings'), 'brightness'), { value: v });
  } catch (e) {
    console.warn('setBrightness: Firestore write failed', e.message);
  }
}

// MIGRATION UTILITY
export async function migrateFromLocalStorage() {
  console.log('migrateFromLocalStorage: Migrating from localStorage to IndexedDB...');
  const keys = ['fc_surveys_cache', 'fc_active_survey', 'fc_waypoints_cache', 'fc_app_settings', 'fc_theme', 'fc_brightness'];
  let migrated = false;
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v !== null) {
      await idb.set(k, v);
      // Clean up localStorage after migration
      localStorage.removeItem(k);
      migrated = true;
    }
  }
  if (migrated) {
    console.log('Migration to IndexedDB complete.');
  } else {
    console.log('No legacy localStorage data found to migrate.');
  }
}
