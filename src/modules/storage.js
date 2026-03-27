// src/modules/storage.js

const DB_NAME = 'ForestCaptureDB';
const DB_VERSION = 1;
const SURVEY_STORE = 'surveys';
const SETTINGS_STORE = 'settings';
const WP_STORE = 'waypoints';

let db = null;

async function initDB() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SURVEY_STORE)) db.createObjectStore(SURVEY_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE);
      if (!db.objectStoreNames.contains(WP_STORE)) db.createObjectStore(WP_STORE, { keyPath: 'time' }); // Use timestamp as key
    };
    request.onsuccess = (e) => { db = e.target.result; resolve(db); };
    request.onerror = (e) => reject('IndexedDB Error: ' + e.target.error);
  });
}

async function getFromDB(store, key) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromDB(store) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToDB(store, key, val) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    if (key === null) s.put(val);
    else s.put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteFromDB(store, key) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const request = tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
}

export const Store = {
  async getSurveys() {
    return await getAllFromDB(SURVEY_STORE);
  },
  async getActive() {
    const activeId = await getFromDB(SETTINGS_STORE, 'activeId');
    if (!activeId) return null;
    return await getFromDB(SURVEY_STORE, activeId);
  },
  async setActive(id) {
    await saveToDB(SETTINGS_STORE, 'activeId', id);
  },
  async add(s) {
    await saveToDB(SURVEY_STORE, null, s);
    await saveToDB(SETTINGS_STORE, 'activeId', s.id);
  },
  async update(s) {
    await saveToDB(SURVEY_STORE, null, s);
  },
  async del(id) {
    await deleteFromDB(SURVEY_STORE, id);
    const activeId = await getFromDB(SETTINGS_STORE, 'activeId');
    if (activeId === id) {
      const surveys = await this.getSurveys();
      await saveToDB(SETTINGS_STORE, 'activeId', surveys.length ? surveys[0].id : null);
    }
  },
  async clearAll() {
    const db = await initDB();
    const tx = db.transaction([SURVEY_STORE, SETTINGS_STORE, WP_STORE], 'readwrite');
    tx.objectStore(SURVEY_STORE).clear();
    tx.objectStore(SETTINGS_STORE).clear();
    tx.objectStore(WP_STORE).clear();
    return new Promise(resolve => tx.oncomplete = () => resolve());
  },
  // Export-friendly dump
  async _d() {
      const surveys = await this.getSurveys();
      const activeId = await getFromDB(SETTINGS_STORE, 'activeId');
      return { surveys, activeId };
  }
};

export async function getWps() {
  const w = await getAllFromDB(WP_STORE);
  return Array.isArray(w) ? w : [];
}

export async function saveWps(wps) {
    const db = await initDB();
    const tx = db.transaction(WP_STORE, 'readwrite');
    const s = tx.objectStore(WP_STORE);
    s.clear();
    wps.forEach(wp => s.add(wp));
    return new Promise(resolve => tx.oncomplete = () => resolve());
}

export async function saveSettings(s) {
  await saveToDB(SETTINGS_STORE, 'app_settings', s);
}

export async function loadSettings() {
  return await getFromDB(SETTINGS_STORE, 'app_settings') || {};
}

export async function getTheme() {
  return await getFromDB(SETTINGS_STORE, 'theme') || 'night';
}

export async function setTheme(t) {
  await saveToDB(SETTINGS_STORE, 'theme', t);
}

export async function getBrightness() {
  return await getFromDB(SETTINGS_STORE, 'brightness') || 100;
}

export async function setBrightness(v) {
  await saveToDB(SETTINGS_STORE, 'brightness', v);
}

// MIGRATION UTILITY
export async function migrateFromLocalStorage() {
    const OLD_SK = 'forest_survey_data';
    const OLD_WP_K = 'forest_wps';
    const OLD_THEME_K = 'forest_survey_theme';
    const OLD_BRT_K = 'forest_brightness';
    const OLD_SETTINGS_K = 'forest_settings';

    const rawData = localStorage.getItem(OLD_SK);
    if (rawData) {
        try {
            const data = JSON.parse(rawData);
            const surveys = Array.isArray(data) ? data : (data.surveys || []);
            const activeId = data.activeId || (surveys.length ? surveys[0].id : null);
            for (const s of surveys) {
                await saveToDB(SURVEY_STORE, null, s);
            }
            if (activeId) await saveToDB(SETTINGS_STORE, 'activeId', activeId);
            localStorage.removeItem(OLD_SK);
        } catch(e) {}
    }

    const rawWps = localStorage.getItem(OLD_WP_K);
    if (rawWps) {
        try {
            const wps = JSON.parse(rawWps);
            if (Array.isArray(wps)) {
                for (const wp of wps) await saveToDB(WP_STORE, null, wp);
            }
            localStorage.removeItem(OLD_WP_K);
        } catch(e) {}
    }

    const theme = localStorage.getItem(OLD_THEME_K);
    if (theme) {
        await setTheme(theme);
        localStorage.removeItem(OLD_THEME_K);
    }

    const brt = localStorage.getItem(OLD_BRT_K);
    if (brt) {
        await setBrightness(parseInt(brt));
        localStorage.removeItem(OLD_BRT_K);
    }

    const settings = localStorage.getItem(OLD_SETTINGS_K);
    if (settings) {
        try {
            await saveSettings(JSON.parse(settings));
            localStorage.removeItem(OLD_SETTINGS_K);
        } catch(e) {}
    }
}
