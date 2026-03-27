// src/modules/ui.js

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let toastT;
export function toast(m, e) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = m;
  el.classList.toggle('error', !!e);
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 2500);
}

export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function setHeaderWeatherIcon(icon) {
  const el = $('#headerWeatherIcon');
  if (el) el.textContent = icon;
}

export function updateOnlineDot() {
  const d = $('#onlineDot');
  const online = navigator.onLine;
  if (d) {
    online ? d.classList.remove('offline') : d.classList.add('offline');
  }
  setHeaderWeatherIcon(online ? '📡' : '∅');
}

export function updateClock() {
  const n = new Date();
  const ct = $('#clockTime');
  const cd = $('#clockDate');
  if (ct) ct.textContent = n.toLocaleTimeString('en-IN', { hour12: false });
  if (cd) cd.textContent = n.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function switchScreen(id, callbacks = {}) {
  const curScreen = document.querySelector('.screen.active');
  const curId = curScreen ? curScreen.id : null;
  const FC_FLOW = ['screenDashboard', 'screenToolbar', 'screenData'];

  $$('.screen').forEach(s => s.classList.remove('active', 'slide-in-right', 'slide-in-left'));
  $$('.nav-btn').forEach(b => b.classList.remove('active'));
  $$('.tb-btn[data-screen]').forEach(b => b.classList.remove('active'));

  const t = document.getElementById(id);
  if (t) {
    t.classList.add('active');
    if (FC_FLOW.includes(curId) && FC_FLOW.includes(id) && curId !== id) {
      const from = FC_FLOW.indexOf(curId), to = FC_FLOW.indexOf(id);
      const dir = to > from ? 'slide-in-right' : 'slide-in-left';
      t.classList.add(dir);
      setTimeout(() => t.classList.remove(dir), 220);
    }
  }

  const nb = document.querySelector(`.nav-btn[data-screen="${id}"]`); if (nb) nb.classList.add('active');
  const tb = document.querySelector(`.tb-btn[data-screen="${id}"]`); if (tb) tb.classList.add('active');

  const backBtn = $('#btnHeaderBack');
  const title = $('.header-title');
  if (id === 'screenDashboard' || id === 'screenToolbar' || id === 'screenData') {
    if (backBtn) backBtn.style.display = 'none';
    if (title) title.style.marginLeft = '0';
  } else {
    if (backBtn) backBtn.style.display = 'block';
    if (title) title.style.marginLeft = '4px';
  }

  const isSmall = /Mobi|Android/i.test(navigator.userAgent);
  window.scrollTo({ top: 0, behavior: isSmall ? 'auto' : 'smooth' });

  if (callbacks[id]) callbacks[id]();
}

export function dismissSplash(callback) {
  const splash = $('#splashScreen');
  if (splash) {
    splash.classList.add('hide');
    setTimeout(() => {
      if (splash.parentNode) splash.remove();
      if (callback) callback();
    }, 800);
  }
}

export function showLogin() {
  const ls = $('#loginScreen');
  if (ls) {
    ls.classList.remove('hidden');
    ls.style.display = 'flex';
  }
}

export function hideLogin() {
  const ls = $('#loginScreen');
  if (ls) {
    ls.style.display = 'none';
    ls.classList.add('hidden');
  }
}

export { $, $$ };
