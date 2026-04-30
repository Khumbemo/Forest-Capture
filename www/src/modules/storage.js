// src/modules/storage.js

import { db, ensureAuth } from './firebase.js';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { toast } from './ui.js';

// ─── IndexedDB Wrapper ───
const DB_NAME = 'fc_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

async function _signSurvey(s) {
  const copy = { ...s };
  delete copy.signature;
  delete copy.isTampered;
  const payloadStr = JSON.stringify(copy);
  
  if (window.crypto && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(payloadStr));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      s.signature = hashHex;
      s.isTampered = false;
    } catch (e) {
      console.warn("Crypto signing failed", e);
    }
  }
  return s;
}

export async function verifySurveySignature(s) {
  if (!s || !s.signature) return s; 
  const copy = { ...s };
  const originalSignature = copy.signature;
  delete copy.signature;
  delete copy.isTampered;
  
  if (window.crypto && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(copy)));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      s.isTampered = (hashHex !== originalSignature);
    } catch (e) {
      console.warn("Crypto verification failed", e);
    }
  }
  return s;
}

export const idb = {
  dbPromise: null,
  init() {
    if (!this.dbPromise) {
      console.log('idb: Opening IndexedDB...');
      this.dbPromise = new Promise((resolve, reject) => {
        // Safety timeout for IndexedDB open
        const t = setTimeout(() => {
          console.warn('idb: Open TIMEOUT after 15s');
          reject(new Error('IndexedDB Timeout'));
        }, 15000);

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
    try {
      const db = await this.init();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn(`idb: remove(${key}) failed`, e.message);
    }
  }
};

// ─── MediaStore: Separate blob storage for photos/audio ───
// Stores binary data (base64 strings) in IndexedDB under prefixed keys,
// keeping heavy blobs OUT of survey documents (which go to Firestore).
// This prevents exceeding Firestore's 1MB document size limit.
const MEDIA_PREFIX = 'media_';

export const MediaStore = {
  /** Save a media blob (base64 data URL) to IndexedDB. Returns the media ID. */
  async save(data) {
    const id = MEDIA_PREFIX + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    await idb.set(id, data);
    return id;
  },

  /** Retrieve a media blob by ID. Returns the base64 string or null. */
  async get(id) {
    if (!id || !id.startsWith(MEDIA_PREFIX)) return null;
    try {
      return await idb.get(id);
    } catch (e) {
      console.warn('MediaStore.get failed:', id, e.message);
      return null;
    }
  },

  /** Delete a media blob by ID. */
  async del(id) {
    if (!id || !id.startsWith(MEDIA_PREFIX)) return;
    try {
      await idb.remove(id);
    } catch (e) {
      console.warn('MediaStore.del failed:', id, e.message);
    }
  },

  /**
   * Resolve a photo/audio entry to a displayable src URL.
   * Priority: Firebase URL > Capacitor localUri > IndexedDB blob (mediaId) > legacy inline data
   */
  async resolveUrl(entry) {
    if (!entry) return '';
    if (entry.url) return entry.url;
    if (entry.localUri) return entry.localUri;
    if (entry.mediaId) {
      const blob = await this.get(entry.mediaId);
      return blob || '';
    }
    // Legacy: inline base64 (kept for backwards compat)
    if (entry.data) return entry.data;
    return '';
  }
};

// ─── IndexedDB survey cache helpers ───

export async function getCurrentUid() {
    return (await getUserRef()).id;
}
async function _getSurveyCacheKey() { return 'fc_surveys_cache_' + await getCurrentUid(); }
async function _getActiveCacheKey() { return 'fc_active_survey_' + await getCurrentUid(); }
async function _getWpsCacheKey()    { return 'fc_waypoints_cache_' + await getCurrentUid(); }

export async function clearUserCache() {
    console.log('storage: clearUserCache (partitioned data)');
    await idb.remove(await _getSurveyCacheKey());
    await idb.remove(await _getActiveCacheKey());
    await idb.remove(await _getWpsCacheKey());
}

async function _cacheSurveysToLocal(surveys) {
  try {
    await idb.set(await _getSurveyCacheKey(), JSON.stringify(surveys));
  } catch (e) {
    console.warn('_cacheSurveysToLocal: idb write failed', e);
  }
}

async function _loadSurveysFromLocal() {
  try {
    const raw = await idb.get(await _getSurveyCacheKey());
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
      console.debug('Firestore call timed out (working offline)');
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

/**
 * withRetry()
 *
 * Wraps an async function with exponential backoff retry logic.
 */
async function withRetry(fn, maxRetries = 3, initialDelay = 1000) {
  let lastErr;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`withRetry: Attempt ${i + 1} failed. Retrying...`, err.message);
      if (i < maxRetries - 1) {
        await new Promise(res => setTimeout(res, initialDelay * Math.pow(2, i)));
      }
    }
  }
  throw lastErr;
}

export const Store = {
  async getSurveys() {
    console.log('Store.getSurveys: start');
    
    // Snappy offline-first priority
    const cached = await _loadSurveysFromLocal();
    if (cached && cached.length > 0) {
      console.log('Store.getSurveys: returning from cache', cached.length);
      return Promise.all(cached.map(verifySurveySignature));
    }

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
        return Promise.all(surveys.map(verifySurveySignature));
      }

      return [];
    } catch(e) {
      console.warn('Store.getSurveys failed', e);
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

    if (localMatch) {
      console.log('Store.getActive: using idb cache for', activeId);
      return await verifySurveySignature(localMatch);
    }

    try {
      const userDocRef = await getUserRef();
      console.log('Store.getActive: fetching survey doc', activeId);
      const sDoc = await withTimeout(getDoc(doc(collection(userDocRef, 'surveys'), activeId)), 5000, { exists: () => false });
      console.log('Store.getActive: doc received');
      if (sDoc.exists()) {
        const data = sDoc.data();
        await _addSurveyToLocalCache(data);
        return await verifySurveySignature(data);
      }
    } catch (e) {
      console.warn('Store.getActive: Firestore failed', e.message);
    }

    return null;
  },

  async setActive(id) {
    console.log('Store.setActive:', id);
    if (!id) {
      await idb.remove(await _getActiveCacheKey());
      return;
    }
    // Write to idb immediately for instant offline access
    await idb.set(await _getActiveCacheKey(), id);
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
    const cached = await idb.get(await _getActiveCacheKey());
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
      if (id) await idb.set(await _getActiveCacheKey(), id);
      return id;
    } catch (e) {
      console.error('Store._syncActiveIdFromFirestore error:', e);
      return (await idb.get(await _getActiveCacheKey())) || null;
    }
  },

  async add(s) {
    console.log('Store.add: Attempting to save survey', s.id);
    s = await _signSurvey(s);
    // Cache to idb IMMEDIATELY so it's always available offline
    await _addSurveyToLocalCache(s);
    try {
      const userDocRef = await getUserRef();
      const surveyDocRef = doc(collection(userDocRef, 'surveys'), s.id);

      // We don't necessarily want to wait for the server acknowledgment if persistence is on.
      // Firestore's setDoc with persistence enabled resolves when written to local cache.
      setDoc(surveyDocRef, s);

      // Update active session locally first
      await idb.set(await _getActiveCacheKey(), s.id);

      // Attempt background Firestore update for activeId
    withRetry(() => setDoc(doc(collection(userDocRef, 'settings'), 'activeId'), { id: s.id })).catch(() => {
      console.warn('Store.add: Background activeId sync failed after retries');
    });

      console.log('Store.add: Survey written to local cache');
      triggerAutoBackup();
      return true;
    } catch (e) {
      console.error('Store.add: Error saving survey:', e);
      toast('Save error: ' + e.message, true);
      throw e; // Re-throw so caller knows it failed
    }
  },

  async update(s) {
    s = await _signSurvey(s);
    // Update idb cache immediately
    await _addSurveyToLocalCache(s);
    try {
      const userDocRef = await getUserRef();
      withRetry(() => setDoc(doc(collection(userDocRef, 'surveys'), s.id), s)).catch(e => {
         console.warn('Store.update: Background sync failed', e.message);
      });
      triggerAutoBackup();
    } catch (e) {
      console.warn('Store.update: Firestore write failed after retries', e.message);
    }
  },

  async del(id) {
    // Remove from idb cache immediately
    await _removeSurveyFromLocalCache(id);
    
    try {
      const userDocRef = await getUserRef();
      if (userDocRef) {
        await deleteDoc(doc(collection(userDocRef, 'surveys'), id));
      }
    } catch (e) {
      console.warn('Store.del: Firestore delete failed (offline?)', e.message);
    }
    
    // Fallback logic for activeId
    const activeId = await this._getActiveId();
    if (activeId === id) {
      const surveys = await this.getSurveys();
      await this.setActive(surveys.length ? surveys[0].id : null);
    }
  },

  async clearAll() {
    // Retrieve surveys before clearing the cache
    const surveys = await this.getSurveys();

    // Clear idb caches immediately
    await clearUserCache();

    try {
      const userDocRef = await getUserRef();
      if (userDocRef) {
        const batch = writeBatch(db);
        surveys.forEach(s => {
           batch.delete(doc(collection(userDocRef, 'surveys'), s.id));
        });
        batch.delete(doc(collection(userDocRef, 'settings'), 'activeId'));
        batch.delete(doc(collection(userDocRef, 'waypoints'), 'data'));
        await batch.commit();
      }
    } catch (e) {
      console.warn('Store.clearAll: Firestore delete failed (offline?)', e.message);
    }
  },

  async getBackupData() {
      const surveys = await this.getSurveys();
      const activeId = await this._getActiveId();
      return { surveys, activeId };
  }
};

async function _cacheWpsToLocal(wps) {
  try { await idb.set(await _getWpsCacheKey(), JSON.stringify(wps)); }
  catch (e) { console.warn('_cacheWpsToLocal failed', e); }
}

async function _loadWpsFromLocal() {
  try {
    const raw = await idb.get(await _getWpsCacheKey());
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function getWps() {
  // Offline-first: return cached waypoints immediately, sync Firestore in background
  const cached = await _loadWpsFromLocal();
  if (cached && cached.length > 0) {
    // Sync from Firestore in the background without blocking the UI
    _syncWpsFromFirestore();
    return cached;
  }

  // No local cache — try Firestore
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
  return [];
}

/** Background sync: pull waypoints from Firestore and update local cache */
async function _syncWpsFromFirestore() {
  try {
    const userDocRef = await getUserRef();
    const docSnap = await withTimeout(getDoc(doc(collection(userDocRef, 'waypoints'), 'data')), 5000, { exists: () => false });
    if (docSnap.exists()) {
      const wps = docSnap.data().wps || [];
      if (wps.length > 0) await _cacheWpsToLocal(wps);
    }
  } catch (e) {
    console.debug('_syncWpsFromFirestore: background sync failed (offline?)', e.message);
  }
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
  try { await idb.set('fc_app_settings', JSON.stringify(s)); } catch {}
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
      try { await idb.set('fc_app_settings', JSON.stringify(data)); } catch {}
      return data;
    }
  } catch (e) {
    console.warn('loadSettings: Firestore failed, using cache', e.message);
  }
  // Fallback to idb
  try {
    const raw = await idb.get('fc_app_settings');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
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
      try { await idb.set('fc_theme', val); } catch {}
      return val;
    }
  } catch (e) {
    console.warn('getTheme: Firestore failed, using cache', e.message);
  }
  return (await idb.get('fc_theme')) || 'night';
}

export async function setTheme(t) {
  try { await idb.set('fc_theme', t); } catch {}
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
      try { await idb.set('fc_brightness', String(val)); } catch {}
      return val;
    }
  } catch (e) {
    console.warn('getBrightness: Firestore failed, using cache', e.message);
  }
  const cached = await idb.get('fc_brightness');
  return cached !== undefined && cached !== null ? parseInt(cached, 10) : 100;
}

export async function setBrightness(v) {
  try { await idb.set('fc_brightness', String(v)); } catch {}
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

/**
 * migrateInlineMedia()
 *
 * Moves inline base64 data from survey documents into separate MediaStore entries.
 * This prevents exceeding Firestore's 1MB document size limit.
 * Safe to call multiple times — only migrates entries that still have inline .data.
 */
export async function migrateInlineMedia() {
  const surveys = await _loadSurveysFromLocal();
  let migrated = 0;

  for (const s of surveys) {
    let changed = false;

    // Migrate photos
    if (s.photos) {
      for (const p of s.photos) {
        if (p.data && !p.mediaId) {
          p.mediaId = await MediaStore.save(p.data);
          delete p.data;
          changed = true;
          migrated++;
        }
      }
    }

    // Migrate audio notes
    if (s.audioNotes) {
      for (const a of s.audioNotes) {
        if (a.data && !a.mediaId) {
          a.mediaId = await MediaStore.save(a.data);
          delete a.data;
          changed = true;
          migrated++;
        }
      }
    }

    // Migrate herbarium photos
    if (s.herbariums) {
      for (const h of s.herbariums) {
        if (h.photoUrl && h.photoUrl.startsWith('data:') && !h.mediaId) {
          h.mediaId = await MediaStore.save(h.photoUrl);
          delete h.photoUrl;
          changed = true;
          migrated++;
        }
      }
    }

    if (changed) {
      await _addSurveyToLocalCache(s);
    }
  }

  if (migrated > 0) {
    console.log(`migrateInlineMedia: Migrated ${migrated} media items out of survey documents`);
  }
}

/**
 * triggerAutoBackup()
 * Creates a local snapshot of all survey data and saves it to IndexedDB.
 * Fired automatically during add/update operations to prevent data loss.
 */
export async function triggerAutoBackup() {
  try {
    const backupData = await Store.getBackupData();
    backupData.timestamp = Date.now();
    await idb.set('fc_auto_backup', JSON.stringify(backupData));
    console.log('Automated backup completed.');
  } catch (e) {
    console.warn('Automated backup failed', e);
  }
}
