// src/modules/ui.js

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let toastT;
export function toast(m, e, action = null) {
  const el = $('#toast');
  if (!el) return;
  el.innerHTML = m;
  if(action) {
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

export function setHeaderWeatherIcon(icon) {
  const el = $('#headerWeatherIcon');
  if (el) el.textContent = icon;
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
  setHeaderWeatherIcon(online ? '📡' : '∅');
  updateConnectivityBanner();
}

export function updateConnectivityBanner() {
  const online = navigator.onLine;
  let banner = $('#connectivityBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'connectivityBanner';
    const header = $('#appHeader');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    } else {
      document.body.appendChild(banner);
    }
  }
  if (online) {
    banner.className = 'connectivity-banner online';
    banner.innerHTML = '<span class="conn-dot online"></span> Online — GPS & weather auto-fill active';
  } else {
    banner.className = 'connectivity-banner offline';
    banner.innerHTML = '<span class="conn-dot offline"></span> Offline — Manual entry mode';
  }
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

  // Allow callback even if same screen (fixes unresponsive creation buttons)
  if (curId === id) {
      if (callbacks[id]) callbacks[id]();
      return;
  }

  const FC_FLOW = ['screenDashboard', 'screenToolbar', 'screenData'];

  // Direct class manipulation for reliability
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === id));
  $$('.tb-btn[data-screen]').forEach(b => b.classList.toggle('active', b.dataset.screen === id));

  $$('.screen').forEach(s => {
    if (s.id === id) {
      s.classList.add('active');
      if (FC_FLOW.includes(curId) && FC_FLOW.includes(id)) {
        const from = FC_FLOW.indexOf(curId), to = FC_FLOW.indexOf(id);
        const dir = to > from ? 'slide-in-right' : 'slide-in-left';
        s.classList.add(dir);
        setTimeout(() => s.classList.remove(dir), 220);
      }
    } else {
      s.classList.remove('active', 'slide-in-right', 'slide-in-left');
    }
  });

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
  } else {
    if (callback) callback();
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
