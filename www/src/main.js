// src/main.js

import { $, $$, toast, switchScreen, dismissSplash, showLogin, hideLogin, updateClock, updateOnlineDot, isOnline, updateConnectivityBanner, fcConfirm, fcPrompt } from './modules/ui.js';
import { Store, loadSettings, saveSettings, getTheme, setTheme, getBrightness, setBrightness, resetUserRef, migrateFromLocalStorage, migrateInlineMedia, clearUserCache } from './modules/storage.js';
import { startGPS, fmtCoords, curPos } from './modules/gps.js';
import { fetchWeather } from './modules/weather.js';
import { refreshDataRecords, createNewSurvey, populateSurveySelector } from './modules/survey.js';
import { SYMBOLS } from './modules/symbols.js';
import { initMap, locateMe, setMapLayer, addWaypoint } from './modules/map.js';
import { refreshWpList } from './modules/waypoints.js';
import { addSpeciesEntry, saveQuadrat, refreshQuadratTable, init as initQuadrat } from './modules/quadrat.js';
import { addIntercept, saveTransect, refreshTransectTable, init as initTransect } from './modules/transect.js';
import { autoFillEnv, saveEnv, loadEnvData, estimateCanopy, init as initEnv } from './modules/environment.js';
import { recalcCBI, saveDisturbCBI, loadDistData, loadCBIData, init as initDisturb } from './modules/disturbance.js';
import { refreshPhotos, handlePhotoInput, startRecording, stopRecording, refreshAudio, init as initMedia } from './modules/media.js';
import { refreshNotes, addNote, init as initNotes } from './modules/notes.js';
import { refreshAnalytics } from './modules/analytics.js';
import { refreshPreview, exportSurveyCSV, exportSurveyJSON, exportAllSurveysCSV, exportGPX, generateReport, backupAll, restoreData } from './modules/export.js';
import { initCompareScreen, runComparison, exportComparisonJSON, init as initCompare } from './modules/analytics-compare.js';
import { loadSurveyHistory } from './modules/species-autocomplete.js';
import { initHerbarium, handleHerbariumPhoto, saveHerbarium, init as initHerbariumListeners } from './modules/herbarium.js';
import { init as initGermplasm, refreshGermplasmUI, onScreenEnter as germplasmEnter } from './modules/germplasm.js';
import { ensureAuth, EmailLogin, EmailSignup, AppSignOut } from './modules/firebase.js';

// ===== INIT =====

async function initApp() {
  // Always set up listeners first — MUST work even if auth is slow
  setupEventListeners();

  try {
    await migrateFromLocalStorage();
    // Move any inline base64 photos/audio out of survey docs into MediaStore
    await migrateInlineMedia();
    
    
    toast('Connecting...', false);
    await ensureAuth();

    // Load settings gracefully — don't let offline Firestore kill the init flow
    try {
      await loadAppData();
    } catch (settingsErr) {
      console.warn('App: Settings load failed (offline?), using defaults', settingsErr.message);
      // Apply safe defaults so the app is still usable
      applyTheme('night');
      applyBrightness(100);
    }

    
    const surveys = await Store.getSurveys();

    await populateSurveySelector();

    toast('App Ready', false);
  } catch (e) {
    console.error('App: Init error', e);
    // Show a non-scary message — the app is still usable with cached data
    toast('Working offline — cached data loaded', false);
  }

  // Always dismiss splash after init completes (success or failure)
  dismissSplash();

  startGPS(onGPSUpdate, onGPSError);
  setInterval(updateClock, 1000);
  updateClock();
  window.addEventListener('online', () => {
    updateOnlineDot();
    _updateWelcomeStatus();
  });
  window.addEventListener('offline', () => {
    updateOnlineDot();
    _updateWelcomeStatus();
  });
  setTimeout(updateOnlineDot, 500);
  setTimeout(updateConnectivityBanner, 600);
  setTimeout(_updateWelcomeStatus, 700);

  // Show login if no valid Firebase session exists.
  // The user can always dismiss login with "Continue Offline" and use the app fully.
  const storedUser = JSON.parse(localStorage.getItem('fc_user') || 'null');
  if (!storedUser || !storedUser.uid) {
    localStorage.removeItem('fc_user'); // clear stale anonymous entry
    // Create a temporary anonymous session so the app is immediately usable
    const anonId = 'anon_' + Date.now();
    localStorage.setItem('fc_user', JSON.stringify({ uid: anonId, email: null, anonymous: true, time: Date.now() }));
    // Show login after splash fades, but it's dismissible via "Continue Offline"
    setTimeout(showLogin, 2900);
  }

  // Initial species/intercept entry
  addSpeciesEntry();
  addIntercept();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

async function loadAppData() {
  applyTheme(await getTheme());
  applyBrightness(await getBrightness());
  const settings = await loadSettings();
  Object.entries(settings).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = val;
    else el.value = val;
  });
}

function friendlyAuthError(code) {
  const map = {
    'auth/invalid-email':            'Invalid email address.',
    'auth/user-not-found':           'No account with that email. Please Register first.',
    'auth/wrong-password':           'Incorrect password.',
    'auth/invalid-credential':       'Incorrect email or password.',
    'auth/email-already-in-use':     'This email is already registered. Try Sign In.',
    'auth/weak-password':            'Password must be at least 6 characters.',
    'auth/network-request-failed':   'No internet connection. Please try again.',
    'auth/too-many-requests':        'Too many attempts. Please wait a moment.',
  };
  return map[code] || 'Authentication error. Please try again.';
}

function applyTheme(t) {
  if (t === 'night') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  $$('.theme-card').forEach(c => c.classList.toggle('active-theme', c.dataset.theme === t));
}

function applyBrightness(v) {
  document.documentElement.style.setProperty('--brightness', v / 100);
  if ($('#brightnessValue')) $('#brightnessValue').textContent = v + '%';
  if ($('#brightnessSlider')) $('#brightnessSlider').value = v;
}

function onGPSUpdate(pos) {
  const fmt = fmtCoords(pos.lat, pos.lng, $('#settingCoordFormat')?.value || 'dd');
  if ($('#teleCoords')) $('#teleCoords').textContent = fmt;
  if ($('#teleLocation')) $('#teleLocation').textContent = `${SYMBOLS.precision}${Math.round(pos.acc)}${SYMBOLS.elevation} Precision`;
  if ($('#teleAlt') && pos.alt !== null) $('#teleAlt').textContent = `${Math.round(pos.alt)} ${SYMBOLS.elevation}`;
  if ($('#gpsOptionCoords')) $('#gpsOptionCoords').textContent = fmt;
  if ($('#gpsOptionAcc')) $('#gpsOptionAcc').textContent = pos.acc ? `${SYMBOLS.precision}${Math.round(pos.acc)} m` : `${SYMBOLS.precision}--- m`;
  if ($('#gpsOptionAlt')) $('#gpsOptionAlt').textContent = pos.alt !== null ? `${Math.round(pos.alt)} m` : `--- m`;
  if ($('#gpsOptionStatus')) $('#gpsOptionStatus').textContent = 'ACTIVE';
  // Update UTM field
  const utmFmt = fmtCoords(pos.lat, pos.lng, 'utm');
  if ($('#gpsOptionUTM')) $('#gpsOptionUTM').textContent = utmFmt;

  // Hide manual input if we truly have a GPS fix (denoted by acc > 0, since manual is 0)
  if ($('#gpsOfflineManualInput') && pos.acc !== 0) {
    $('#gpsOfflineManualInput').style.display = 'none';
  }

  // ─── AUTO-FILL GPS FIELDS WHEN SIGNAL IS AVAILABLE ───
  // Auto-fill coordinate inputs across all forms if they are empty or were auto-filled previously
  autoFillGPSField('#quadratGPS', fmt);
  autoFillGPSField('#transectStartGPS', fmt);
  autoFillGPSField('#herbGPS', pos.alt !== null
    ? fmt + ` (${Math.round(pos.alt)}m)`
    : fmt);
  // Auto-fill waypoint lat/lng fields
  autoFillGPSField('#waypointLat', pos.lat.toFixed(6));
  autoFillGPSField('#waypointLng', pos.lng.toFixed(6));
  // Auto-fill survey location input if it's empty
  if ($('#surveyLocation') && !$('#surveyLocation').value.trim()) {
    $('#surveyLocation').dataset.autoFilled = 'true';
    $('#surveyLocation').value = fmt;
  }

  // Mark GPS-equipped buttons with a green indicator
  _setGPSButtonState(true);

  fetchWeather(pos.lat, pos.lng, w => {
    if (w) {
      if ($('#teleTemp')) $('#teleTemp').textContent = `${w.temp}${SYMBOLS.temperature}`;
      if ($('#teleWeatherDesc')) $('#teleWeatherDesc').textContent = w.desc;
      if ($('#teleHumidity')) $('#teleHumidity').textContent = `${w.humidity}%`;
      if ($('#teleWind')) $('#teleWind').textContent = `Wind: ${w.wind} km/h`;
    } else {
      // Fallback for offline or error
      if ($('#teleTemp')) $('#teleTemp').textContent = 'Offline';
    }
  });
}

/**
 * Auto-fill a GPS text input. Only fills if the field is empty or was previously
 * auto-filled (tracked via data-auto-filled attribute). This allows manual overrides
 * to be preserved.
 */
function autoFillGPSField(selector, value) {
  const el = $(selector);
  if (!el) return;
  // Only auto-fill if field is empty OR was auto-filled before (not manually edited)
  if (!el.value.trim() || el.dataset.autoFilled === 'true') {
    el.value = value;
    el.dataset.autoFilled = 'true';
  }
}

/**
 * Visual feedback: update GPS fill buttons to show whether GPS signal is active.
 * When GPS is active, buttons show a green pulse; when not, they show a grey state.
 */
function _setGPSButtonState(hasSignal) {
  const gpsBtns = ['#btnQuadratGPS', '#btnTransectStartGPS', '#btnTransectEndGPS', '#btnHerbGPS', '#btnWaypointGPS'];
  gpsBtns.forEach(sel => {
    const btn = $(sel);
    if (!btn) return;
    if (hasSignal) {
      btn.classList.add('gps-active');
      btn.title = 'GPS Active — tap to fill';
    } else {
      btn.classList.remove('gps-active');
      btn.title = 'No GPS signal — enter manually';
    }
  });
}

function onGPSError(msg) {
  if ($('#gpsOptionStatus')) $('#gpsOptionStatus').textContent = msg;
  _setGPSButtonState(false);
  
  // Show manual GPS override input
  if ($('#gpsOfflineManualInput')) {
    $('#gpsOfflineManualInput').style.display = 'block';
  }
}

/**
 * Updates the dashboard welcome subtitle to reflect the current connectivity status.
 */
function _updateWelcomeStatus() {
  const subtitle = $('.welcome-subtitle');
  if (!subtitle) return;
  if (navigator.onLine) {
    subtitle.textContent = 'Online · GPS auto-fill enabled · Session active';
    subtitle.style.color = '';
  } else {
    subtitle.textContent = 'Offline · Manual entry mode · Data saved locally';
    subtitle.style.color = 'var(--amber)';
  }
}

const screenCallbacks = {
  screenDashboard: () => { updateBars(); },
  screenToolbar: () => { updateBars(); }, // Added callback for Toolbar to refresh data
  screenData: refreshDataRecords,
  screenMap: () => { setTimeout(initMap, 100); refreshWpList(); },
  screenQuadrat: refreshQuadratTable,
  screenTransect: refreshTransectTable,
  screenEnvironment: loadEnvData,
  screenDisturbCBI: () => { loadDistData(); loadCBIData(); },
  screenPhotos: () => { refreshPhotos(); refreshNotes(); refreshAudio(); },
  screenAnalytics: () => {
    Store.getActive().then(s => refreshAnalytics(s));
    initCompareScreen();
  },
  screenHerbarium: initHerbarium,
  screenGermplasm: germplasmEnter,
  screenExport: refreshPreview
};

async function updateBars() {
  try {
    const s = await Store.getActive();
    const n = s ? s.name : 'No survey';
    ['quadratSurveyName', 'envSurveyName', 'distSurveyName', 'photoSurveyName', 'exportSurveyName', 'analyticsSurveyName', 'transectSurveyName', 'herbSurveyName', 'germSurveyName'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = n;
    });
    await populateSurveySelector();
  } catch (e) {
    console.error('updateBars error:', e);
  }
}

function setupEventListeners() {
  // Global Hardware Back Button (Popstate) Hook
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.screen) {
      switchScreen(e.state.screen, screenCallbacks, false);
    } else {
      // Default to dashboard
      switchScreen('screenDashboard', screenCallbacks, false);
    }
  });

  // Global Swipe Gestures for Fluid Navigation
  let touchStartX = 0;
  let touchEndX = 0;
  
  document.addEventListener('touchstart', e => {
    // Only capture 1 touch
    if (e.changedTouches.length === 1) {
      touchStartX = e.changedTouches[0].screenX;
    }
  }, { passive: true });
  
  document.addEventListener('touchend', e => {
    if (e.changedTouches.length === 1) {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }
  }, { passive: true });

  const handleSwipe = () => {
    const swipeDist = touchEndX - touchStartX;
    if (Math.abs(swipeDist) < 60) return; // Threshold of 60px

    const FC_FLOW = ['screenDashboard', 'screenToolbar', 'screenData'];
    const curScreen = document.querySelector('.screen.active');
    // Only allow swipe if we are in one of the main flow screens
    if (!curScreen || !FC_FLOW.includes(curScreen.id)) return;

    let idx = FC_FLOW.indexOf(curScreen.id);
    if (swipeDist < 0 && idx < FC_FLOW.length - 1) {
      // Swipe left -> Next screen (e.g. Home to Tools)
      switchScreen(FC_FLOW[idx + 1], screenCallbacks);
    } else if (swipeDist > 0 && idx > 0) {
      // Swipe right -> Prev screen (e.g. Tools to Home)
      switchScreen(FC_FLOW[idx - 1], screenCallbacks);
    }
  };

  // Use event delegation for nav buttons in footer to be more resilient
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (btn && btn.dataset.screen) {
      e.preventDefault();
      switchScreen(btn.dataset.screen, screenCallbacks);
    }
  });

  // Use event delegation for tool cards in the Grid
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.stat-card[data-tool]');
    if (card) {
      const screenId = card.getAttribute('data-tool');
      if (screenId) switchScreen(screenId, screenCallbacks);
    }
  });

  $('#btnToolOfflineMap')?.addEventListener('click', () => {
    switchScreen('screenMap');
    // Give it a tiny delay to allow the map screen and panel to initialize if it's the first time
    setTimeout(() => {
        const panelBody = $('#offlinePanelBody');
        if (panelBody && panelBody.style.display === 'none') {
            $('#offlinePanelToggle')?.click();
        }
    }, 100);
  });

  // Survey Selector
  $('#surveySelector')?.addEventListener('change', async (e) => {
    const id = e.target.value;
    if (id) {
      await Store.setActive(id);
      await updateBars();
      toast('Survey switched');
    }
  });

  // Login — Firebase Email Auth with client-side rate limiting
  let _authAttempts = 0;
  let _authLockoutUntil = 0;
  const AUTH_MAX_ATTEMPTS = 5;
  const AUTH_LOCKOUT_MS = 30000; // 30 seconds

  function setLoginError(msg) {
    const el = document.getElementById('loginError');
    if (el) el.textContent = msg;
  }

  function _checkAuthRateLimit() {
    if (Date.now() < _authLockoutUntil) {
      const secs = Math.ceil((_authLockoutUntil - Date.now()) / 1000);
      setLoginError(`Too many attempts. Please wait ${secs}s.`);
      return false;
    }
    if (_authAttempts >= AUTH_MAX_ATTEMPTS) {
      _authLockoutUntil = Date.now() + AUTH_LOCKOUT_MS;
      _authAttempts = 0;
      setLoginError('Too many attempts. Please wait 30 seconds.');
      return false;
    }
    return true;
  }

  $('#btnSignIn')?.addEventListener('click', async () => {
    if (!_checkAuthRateLimit()) return;
    const email = $('#loginEmail')?.value.trim();
    const pwd   = $('#loginPassword')?.value;
    if (!email || !pwd) { setLoginError('Please enter your email and password.'); return; }
    setLoginError('');
    _authAttempts++;
    $('#btnSignIn').disabled = true;
    $('#btnSignIn').textContent = 'Signing in…';
    try {
      resetUserRef();
      const user = await EmailLogin(email, pwd);
      _authAttempts = 0; // Reset on success
      localStorage.setItem('fc_user', JSON.stringify({ uid: user.uid, email: user.email, time: Date.now() }));
      hideLogin();
      toast(`Welcome back, ${user.email}`);
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      console.error('Sign-in error:', err);
      setLoginError(friendlyAuthError(err.code));
    } finally {
      $('#btnSignIn').disabled = false;
      $('#btnSignIn').textContent = 'Sign In';
    }
  });

  $('#btnRegister')?.addEventListener('click', async () => {
    if (!_checkAuthRateLimit()) return;
    const email = $('#loginEmail')?.value.trim();
    const pwd   = $('#loginPassword')?.value;
    if (!email || !pwd) { setLoginError('Please enter your email and password.'); return; }
    if (pwd.length < 6)  { setLoginError('Password must be at least 6 characters.'); return; }
    setLoginError('');
    _authAttempts++;
    $('#btnRegister').disabled = true;
    $('#btnRegister').textContent = 'Creating…';
    try {
      resetUserRef();
      const user = await EmailSignup(email, pwd);
      _authAttempts = 0; // Reset on success
      localStorage.setItem('fc_user', JSON.stringify({ uid: user.uid, email: user.email, time: Date.now() }));
      hideLogin();
      toast(`Account created! Welcome, ${user.email}`);
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      console.error('Register error:', err);
      setLoginError(friendlyAuthError(err.code));
    } finally {
      $('#btnRegister').disabled = false;
      $('#btnRegister').textContent = 'Register';
    }
  });

  // Skip Login / Continue Offline
  $('#btnSkipLogin')?.addEventListener('click', () => {
    // Ensure anonymous session exists
    const stored = JSON.parse(localStorage.getItem('fc_user') || 'null');
    if (!stored || !stored.uid) {
      const anonId = 'anon_' + Date.now();
      localStorage.setItem('fc_user', JSON.stringify({ uid: anonId, email: null, anonymous: true, time: Date.now() }));
    }
    hideLogin();
    toast('Working offline — data saved locally');
  });

  // Manual GP Override
  $('#btnSaveManualGPS')?.addEventListener('click', () => {
    const lat = parseFloat($('#gpsManualLat').value);
    const lng = parseFloat($('#gpsManualLng').value);
    if (isNaN(lat) || isNaN(lng)) return toast('Please enter valid coordinates');
    curPos.lat = lat;
    curPos.lng = lng;
    curPos.acc = 0; // manual override indicator
    curPos.alt = null;
    onGPSUpdate(curPos);
    toast('Global manual GPS override active');
  });

  // Survey
  $('#btnNewSurvey')?.addEventListener('click', () => {
    $('#surveyDate').value = new Date().toISOString().split('T')[0];
    $('#modalNewSurvey').classList.add('show');
    $('#surveyName').focus();
  });
  $('#btnCancelSurvey')?.addEventListener('click', () => $('#modalNewSurvey').classList.remove('show'));
  $('#btnSaveSurvey')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled) return;

      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Creating...';

      try {
          const success = await createNewSurvey();
          if (success) {
              await updateBars();
              switchScreen('screenToolbar', screenCallbacks);
          }
      } catch (err) {
          console.error('Create survey error:', err);
          toast('Failed to create survey', true);
      } finally {
          btn.disabled = false;
          btn.textContent = originalText;
      }
  });

  // Data filter
  $('#dataFilterType')?.addEventListener('change', refreshDataRecords);

  // Survey timer
  let surveyTimerInterval = null, surveyTimerStart = null;
  $('#btnSurveyTimer')?.addEventListener('click', () => {
    if (surveyTimerInterval) {
      clearInterval(surveyTimerInterval);
      surveyTimerInterval = null;
      const elapsed = Math.round((Date.now() - surveyTimerStart) / 1000);
      const m = Math.floor(elapsed / 60), s = elapsed % 60;
      toast(`Timer stopped — ${m}m ${s}s elapsed`);
      $('#btnSurveyTimer').textContent = '⏱️ Timer';
      $('#btnSurveyTimer').classList.remove('btn-danger');
    } else {
      surveyTimerStart = Date.now();
      surveyTimerInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - surveyTimerStart) / 1000);
        const m = Math.floor(elapsed / 60), s = elapsed % 60;
        $('#btnSurveyTimer').textContent = `⏱️ ${m}:${String(s).padStart(2,'0')}`;
      }, 1000);
      $('#btnSurveyTimer').classList.add('btn-danger');
      toast('Survey timer started');
    }
  });

  // Map
  $('#btnLocateMe')?.addEventListener('click', locateMe);
  $('#btnAddWaypoint')?.addEventListener('click', async () => {
      const n = await fcPrompt('Waypoint name:');
      if(n) await addWaypoint(n, 'plot');
  });
  // Save Waypoint button (explicit form submit button)
  $('#btnSaveWaypointManual')?.addEventListener('click', async () => {
      const n = $('#waypointName').value.trim();
      if(!n) { toast('Enter waypoint name', true); return; }
      const manualLat = parseFloat($('#waypointLat')?.value);
      const manualLng = parseFloat($('#waypointLng')?.value);
      const lat = !isNaN(manualLat) ? manualLat : null;
      const lng = !isNaN(manualLng) ? manualLng : null;
      await addWaypoint(n, $('#waypointType').value, $('#waypointNotes').value.trim(), lat, lng);
      $('#waypointName').value = ''; $('#waypointNotes').value = '';
      if ($('#waypointLat')) $('#waypointLat').value = '';
      if ($('#waypointLng')) $('#waypointLng').value = '';
      await refreshWpList();
      toast('Waypoint saved');
  });

  // GPS auto-fill button for waypoint lat/lng fields
  $('#btnWaypointGPS')?.addEventListener('click', () => {
      import('./modules/gps.js').then(gps => {
          if (gps.curPos.lat) {
              if ($('#waypointLat')) $('#waypointLat').value = gps.curPos.lat.toFixed(6);
              if ($('#waypointLng')) $('#waypointLng').value = gps.curPos.lng.toFixed(6);
              toast('GPS coordinates filled');
          } else {
              toast('No GPS signal — enter coordinates manually', true);
          }
      });
  });
  $('#btnMapSatellite')?.addEventListener('click', () => setMapLayer('sat'));
  $('#btnMapTerrain')?.addEventListener('click', () => setMapLayer('ter'));
  $('#btnMapHybrid')?.addEventListener('click', () => setMapLayer('hyb'));

  // Quadrat
  initQuadrat();

  // Transect
  initTransect();

  // Environment
  initEnv();

  // Disturbance
  initDisturb();

  // Media
  initMedia();

  // Herbarium
  initHerbariumListeners();

  // Notes
  initNotes();

  // Germplasm
  initGermplasm();

  // Analytics Compare
  initCompare();

  // Export
  $('#btnExportCSV')?.addEventListener('click', exportSurveyCSV);
  $('#btnExportJSON')?.addEventListener('click', exportSurveyJSON);
  $('#btnExportAllCSV')?.addEventListener('click', exportAllSurveysCSV);
  $('#btnExportGPX')?.addEventListener('click', exportGPX);
  $('#btnExportReport')?.addEventListener('click', generateReport);
  $('#btnBackupAll')?.addEventListener('click', backupAll);
  $('#btnBackupAllSettings')?.addEventListener('click', backupAll);
  $('#restoreInput')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try { await restoreData(file); } catch (err) { toast(err.message, true); }
    finally { e.target.value = ''; }
  });
  $('#restoreInputSettings')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try { await restoreData(file); } catch (err) { toast(err.message, true); }
    finally { e.target.value = ''; }
  });
  $('#btnDeleteCurrentSurvey')?.addEventListener('click', async () => {
      const s = await Store.getActive();
      if (!s) { toast('No active survey to delete'); return; }
      if (await fcConfirm(`Delete current survey "${s.name}" permanently?`)) {
          await Store.del(s.id);
          await updateBars();
          switchScreen('screenDashboard', screenCallbacks);
          toast('Survey deleted');
      }
  });
  $('#btnClearAll')?.addEventListener('click', async () => { if(await fcConfirm('Delete ALL surveys?')) { await Store.clearAll(); location.reload(); } });
  $('#btnClearAllSettings')?.addEventListener('click', async () => { if(await fcConfirm('Delete ALL data?')) { await Store.clearAll(); location.reload(); } });

  // Sign out
  $('#btnSignOutApp')?.addEventListener('click', async () => {
      if (await fcConfirm('Sign out? This securely wipes your local cache.')) {
          toast('Clearing local cache...');
          await clearUserCache();
          resetUserRef();
          await AppSignOut();
          location.reload();
      }
  });

  // Settings
  if ($('#btnSettings')) $('#btnSettings').addEventListener('click', () => {
    $('#settingsOverlay').classList.add('show');
    $('#settingsPanel').classList.add('show');
  });
  if ($('#btnSettingsClose')) $('#btnSettingsClose').addEventListener('click', () => {
    $('#settingsOverlay').classList.remove('show');
    $('#settingsPanel').classList.remove('show');
  });
  if ($('#settingsOverlay')) $('#settingsOverlay').addEventListener('click', () => {
    $('#settingsOverlay').classList.remove('show');
    $('#settingsPanel').classList.remove('show');
  });

  $$('.theme-card').forEach(c => {
    c.addEventListener('click', async () => {
      await setTheme(c.dataset.theme);
      applyTheme(c.dataset.theme);
      toast('Theme: ' + c.dataset.theme);
    });
  });

  if ($('#brightnessSlider')) $('#brightnessSlider').addEventListener('input', async e => {
    await setBrightness(+e.target.value);
    applyBrightness(+e.target.value);
  });

  $$('.settings-tab').forEach(b => b.addEventListener('click', () => {
    $$('.settings-tab').forEach(t => t.classList.remove('active'));
    $$('.settings-tab-pane').forEach(p => p.style.display = 'none');
    b.classList.add('active');
    const target = document.getElementById(b.dataset.tab);
    if(target) {
        target.style.display = 'block';
        target.classList.remove('hidden');
    }
  }));

  $$('#settingsPanel select, #settingsPanel input').forEach(el => el.addEventListener('change', async () => {
    const s = await loadSettings();
    if (el.id) {
      if (el.type === 'checkbox') s[el.id] = el.checked;
      else s[el.id] = el.value;
    }
    saveSettings(s);
  }));

  // Help accordion
  document.addEventListener('click', e => {
    const title = e.target.closest('.help-item-title');
    if (!title) return;
    const item = title.closest('.help-item');
    if (item) item.classList.toggle('open');
  });
}
