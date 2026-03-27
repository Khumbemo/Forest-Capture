// src/modules/storage.js

const SK = 'forest_survey_data';

export const Store = {
  _d() {
    const empty = { surveys: [], activeId: null };
    try {
      const raw = localStorage.getItem(SK);
      if (raw == null || raw === '') return empty;
      const d = JSON.parse(raw);
      if (Array.isArray(d)) {
        localStorage.setItem(SK, JSON.stringify(empty));
        return empty;
      }
      if (!d || typeof d !== 'object') {
        localStorage.setItem(SK, JSON.stringify(empty));
        return empty;
      }
      let fixed = false;
      if (!Array.isArray(d.surveys)) {
        d.surveys = [];
        fixed = true;
      }
      if (!('activeId' in d)) {
        d.activeId = null;
        fixed = true;
      }
      if (fixed) this._s(d);
      return d;
    } catch (err) {
      localStorage.setItem(SK, JSON.stringify(empty));
      return empty;
    }
  },
  _s(d) {
    localStorage.setItem(SK, JSON.stringify(d));
  },
  getSurveys() {
    return this._d().surveys;
  },
  getActive() {
    const d = this._d();
    return d.surveys.find(s => s.id === d.activeId) || null;
  },
  setActive(id) {
    const d = this._d();
    d.activeId = id;
    this._s(d);
  },
  add(s) {
    const d = this._d();
    d.surveys.push(s);
    d.activeId = s.id;
    this._s(d);
  },
  update(s) {
    const d = this._d();
    const i = d.surveys.findIndex(x => x.id === s.id);
    if (i >= 0) d.surveys[i] = s;
    this._s(d);
  },
  del(id) {
    const d = this._d();
    d.surveys = d.surveys.filter(s => s.id !== id);
    if (d.activeId === id) d.activeId = d.surveys.length ? d.surveys[0].id : null;
    this._s(d);
  },
  clearAll() {
    localStorage.removeItem(SK);
    localStorage.removeItem('forest_wps');
  }
};

export function getWps() {
  try {
    const w = JSON.parse(localStorage.getItem('forest_wps') || '[]');
    return Array.isArray(w) ? w : [];
  } catch (err) {
    return [];
  }
}

export function saveWps(w) {
  localStorage.setItem('forest_wps', JSON.stringify(w));
}

export const SETTINGS_KEY = 'forest_settings';
export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

export const TK = 'forest_survey_theme';
export function getTheme() {
  return localStorage.getItem(TK) || 'night';
}
export function setTheme(t) {
  localStorage.setItem(TK, t);
}

export const BK = 'forest_brightness';
export function getBrightness() {
  return parseInt(localStorage.getItem(BK)) || 100;
}
export function setBrightness(v) {
  localStorage.setItem(BK, v);
}
