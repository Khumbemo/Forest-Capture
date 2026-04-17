// src/modules/ui.js
import { t } from './i18n.js';
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let toastT;
export function toast(m, e, action = null) {
  const el = $('#toast');
  if (!el) return;
  // FIX #6: Always clear previous content (including stale action buttons)
  // before rebuilding, to prevent button accumulation on repeated calls.
  el.innerHTML = '';
  const textNode = document.createTextNode(m);
  el.appendChild(textNode);
  if (action) {
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.style.marginLeft = '12px';
    btn.style.background = 'var(--emerald)';
    btn.style.color = 'var(--text-inverse)';
    btn.style.border = 'none';
    btn.style.borderRadius = '4px';
    btn.style.padding = '2px 8px';
    btn.style.cursor = 'pointer';
    btn.onclick = (event) => {
      event.stopPropagation();
      action.callback();
      el.classList.remove('show');
    };
    el.appendChild(btn);
  }
  el.classList.toggle('error', !!e);
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 5000);
}

export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export const ICONS = {
  online: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><circle cx="12" cy="20" r="1.5" fill="currentColor" stroke="none"></circle></svg>',
  offline: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>',
  sync: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>'
};

export function setHeaderWeatherIcon(iconKeyOrStr) {
  const el = $('#headerWeatherIcon');
  if (el) {
    if (ICONS[iconKeyOrStr]) {
      el.innerHTML = ICONS[iconKeyOrStr];
    } else {
      el.innerHTML = iconKeyOrStr;
    }
  }
}

export function isOnline() {
  return navigator.onLine;
}

export function updateOnlineDot() {
  const d = $('#onlineDot');
  const online = navigator.onLine;
  if (d) {
    online ? d.classList.remove('offline') : d.classList.add('offline');
  }
  setHeaderWeatherIcon(online ? 'online' : 'offline');
  updateConnectivityBanner();
}

export function updateConnectivityBanner() {
  const online = navigator.onLine;
  let banner = $('#connectivityBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'connectivityBanner';
    // FIX #5: Was '#globalHeader' — correct ID is 'appHeader'.
    // Insert banner immediately after the app header so it appears at the top.
    const header = $('#appHeader');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    } else {
      document.body.prepend(banner);
    }
  }
  if (online) {
    banner.className = 'connectivity-banner online';
    banner.innerHTML = `<span class="conn-dot online"></span> ${t('Online — GPS & weather auto-fill active')}`;
  } else {
    banner.className = 'connectivity-banner offline';
    banner.innerHTML = `<span class="conn-dot offline"></span> ${t('Offline — Manual entry mode')}`;
  }
}

export function updateClock() {
  const n = new Date();
  const ct = $('#clockTime');
  const cd = $('#clockDate');
  if (ct) ct.textContent = n.toLocaleTimeString('en-IN', { hour12: false });
  if (cd) cd.textContent = n.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// FIX #4: Root screens — the 3 main bottom-nav targets.
const ROOT_SCREENS = ['screenDashboard', 'screenToolbar', 'screenData'];

export function switchScreen(id, callbacks = {}, updateHistory = true) {
  const curScreen = document.querySelector('.screen.active');
  const curId = curScreen ? curScreen.id : null;

  if (curId === id) {
    if (callbacks[id]) callbacks[id]();
    return;
  }

  if (updateHistory) {
    if (!history.state || history.state.screen !== id) {
      history.pushState({ screen: id }, '', `#${id}`);
    }
  }

  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === id));
  $$('.tb-btn[data-screen]').forEach(b => b.classList.toggle('active', b.dataset.screen === id));

  $$('.screen').forEach(s => {
    if (s.id === id) {
      s.classList.add('active');
      // Slide animation between root screens only
      if (ROOT_SCREENS.includes(curId) && ROOT_SCREENS.includes(id)) {
        const from = ROOT_SCREENS.indexOf(curId), to = ROOT_SCREENS.indexOf(id);
        const dir = to > from ? 'slide-in-right' : 'slide-in-left';
        s.classList.add(dir);
        setTimeout(() => s.classList.remove(dir), 220);
      }
    } else {
      s.classList.remove('active', 'slide-in-right', 'slide-in-left');
    }
  });

  // FIX #4: Show back button for non-root (tool) screens so users can
  // navigate back without relying on a non-existent hardware button.
  const backBtn = $('#btnHeaderBack');
  const isRoot = ROOT_SCREENS.includes(id);
  if (backBtn) {
    backBtn.style.display = isRoot ? 'none' : 'inline-flex';
  }

  const isSmall = /Mobi|Android/i.test(navigator.userAgent);
  window.scrollTo({ top: 0, behavior: isSmall ? 'auto' : 'smooth' });

  if (callbacks[id]) callbacks[id]();
}

/**
 * Wire the browser/hardware back gesture to switchScreen.
 * Call this once from main.js at startup.
 * FIX #4: Ensures popstate (browser Back) navigates within the SPA.
 */
export function initHistoryNavigation() {
  window.addEventListener('popstate', (e) => {
    const target = e.state && e.state.screen ? e.state.screen : 'screenDashboard';
    switchScreen(target, {}, false); // false = don't push another history entry
  });
}

export function dismissSplash(callback) {
  const splash = $('#splashScreen');
  if (splash) {
    splash.classList.add('hide');
    setTimeout(() => {
      if (splash.parentNode) splash.remove();
      if (callback) callback();
    }, 800);
  } else {
    if (callback) callback();
  }
}

export function showLogin() {
  // Don't show login if user has already dismissed it this session
  if (sessionStorage.getItem('fc_login_dismissed')) return;
  const ls = $('#loginScreen');
  if (ls) {
    ls.classList.remove('hidden');
    ls.style.display = 'flex';
  }
}

export function hideLogin() {
  const ls = $('#loginScreen');
  if (ls) {
    // Mark as dismissed for this session so it doesn't keep popping up
    sessionStorage.setItem('fc_login_dismissed', '1');
    ls.style.transition = 'opacity 0.3s ease';
    ls.style.opacity = '0';
    setTimeout(() => {
      ls.style.display = 'none';
      ls.classList.add('hidden');
      ls.style.opacity = '';
      ls.style.transition = '';
    }, 300);
  }
}

// ─── Custom Modal Dialogs (replace native confirm/prompt/alert) ───

function _createModalOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'fc-modal-overlay';
  return overlay;
}

function _createModalBox(message, type = 'confirm') {
  const modal = document.createElement('div');
  modal.className = 'fc-modal';
  const iconMap = { confirm: '⚠️', prompt: '✏️', alert: 'ℹ️', delete: '🗑️' };
  const icon = iconMap[type] || iconMap.confirm;
  modal.innerHTML = `<div class="fc-modal-icon">${icon}</div><div class="fc-modal-body"><p class="fc-modal-message"></p></div><div class="fc-modal-actions"></div>`;
  modal.querySelector('.fc-modal-message').textContent = message;
  return modal;
}

/**
 * Branded replacement for window.confirm(). Returns Promise<boolean>.
 */
export function fcConfirm(message) {
  return new Promise((resolve) => {
    const overlay = _createModalOverlay();
    const isDelete = /delete|clear|wipe|remove/i.test(message);
    const modal = _createModalBox(message, isDelete ? 'delete' : 'confirm');
    const actions = modal.querySelector('.fc-modal-actions');

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'fc-modal-btn fc-modal-cancel';
    cancelBtn.textContent = t('Cancel');

    const okBtn = document.createElement('button');
    okBtn.className = `fc-modal-btn fc-modal-ok${isDelete ? ' fc-modal-danger' : ''}`;
    okBtn.textContent = isDelete ? t('Delete') : t('Confirm');

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => { overlay.classList.add('show'); okBtn.focus(); });

    const cleanup = (result) => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    cancelBtn.onclick = () => cleanup(false);
    okBtn.onclick = () => cleanup(true);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', handler); }
    });
  });
}

/**
 * Branded replacement for window.prompt(). Returns Promise<string|null>.
 */
export function fcPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = _createModalOverlay();
    const modal = _createModalBox(message, 'prompt');
    const body = modal.querySelector('.fc-modal-body');
    const actions = modal.querySelector('.fc-modal-actions');

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'fc-modal-input';
    input.value = defaultValue;
    body.appendChild(input);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'fc-modal-btn fc-modal-cancel';
    cancelBtn.textContent = t('Cancel');

    const okBtn = document.createElement('button');
    okBtn.className = 'fc-modal-btn fc-modal-ok';
    okBtn.textContent = t('OK');

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => { overlay.classList.add('show'); input.focus(); input.select(); });

    const cleanup = (result) => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    cancelBtn.onclick = () => cleanup(null);
    okBtn.onclick = () => cleanup(input.value);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') cleanup(input.value);
      if (e.key === 'Escape') cleanup(null);
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
  });
}

/**
 * Branded replacement for window.alert(). Returns Promise<void>.
 */
export function fcAlert(message) {
  return new Promise((resolve) => {
    const overlay = _createModalOverlay();
    const modal = _createModalBox(message, 'alert');
    const actions = modal.querySelector('.fc-modal-actions');

    const okBtn = document.createElement('button');
    okBtn.className = 'fc-modal-btn fc-modal-ok';
    okBtn.textContent = t('OK');

    actions.appendChild(okBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => { overlay.classList.add('show'); okBtn.focus(); });

    const cleanup = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve();
    };

    okBtn.onclick = cleanup;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Enter' || e.key === 'Escape') { cleanup(); document.removeEventListener('keydown', handler); }
    });
  });
}

export function applyUnitSystem(sys) {
  const isImperial = sys === 'imperial';
  $$('.unit-dist').forEach(el => { el.textContent = isImperial ? 'ft' : 'm'; });
  $$('.unit-diam').forEach(el => { el.textContent = isImperial ? 'in' : 'cm'; });
  $$('.unit-area').forEach(el => { el.textContent = isImperial ? 'sq ft' : 'm²'; });
  $$('.unit-temp').forEach(el => { el.textContent = isImperial ? '°F' : '°C'; });
}

export { $, $$ };
