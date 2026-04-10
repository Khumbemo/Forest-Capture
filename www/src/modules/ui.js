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
    const header = $('#globalHeader');  // FIXED: was appHeader
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

export function switchScreen(id, callbacks = {}, updateHistory = true) {
  const curScreen = document.querySelector('.screen.active');
  const curId = curScreen ? curScreen.id : null;

  if (curId === id) {
      if (callbacks[id]) callbacks[id]();
      return;
  }

  const FC_FLOW = ['screenDashboard', 'screenToolbar', 'screenData'];

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
    // Phone system will handle back, so we keep back btn hidden globally
    if (backBtn) backBtn.style.display = 'none';
    if (title) title.style.marginLeft = '0';
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
