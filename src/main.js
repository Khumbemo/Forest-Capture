// src/main.js

import { $, $$, toast, switchScreen, dismissSplash, showLogin, hideLogin, updateClock, updateOnlineDot, isOnline, updateConnectivityBanner } from './modules/ui.js';
import { Store, loadSettings, saveSettings, getTheme, setTheme, getBrightness, setBrightness, resetUserRef, migrateFromLocalStorage, migrateInlineMedia } from './modules/storage.js';
import { startGPS, fmtCoords, curPos } from './modules/gps.js';
import { fetchWeather } from './modules/weather.js';
import { refreshDataRecords, createNewSurvey, populateSurveySelector } from './modules/survey.js';
import { SYMBOLS } from './modules/symbols.js';
import { initMap, locateMe, setMapLayer, addWaypoint } from './modules/map.js';
import { refreshWpList } from './modules/waypoints.js';
import { addSpeciesEntry, saveQuadrat, refreshQuadratTable } from './modules/quadrat.js';
import { addIntercept, saveTransect, refreshTransectTable } from './modules/transect.js';
import { autoFillEnv, saveEnv, loadEnvData, estimateCanopy } from './modules/environment.js';
import { recalcCBI, saveDisturbCBI, loadDistData, loadCBIData } from './modules/disturbance.js';
import { refreshPhotos, handlePhotoInput, startRecording, stopRecording, refreshAudio } from './modules/media.js';
import { refreshNotes, addNote } from './modules/notes.js';
import { refreshAnalytics } from './modules/analytics.js';
import { refreshPreview, exportSurveyCSV, exportSurveyJSON, exportAllSurveysCSV, exportGPX, generateReport, backupAll, restoreData } from './modules/export.js';
import { initCompareScreen, runComparison, exportComparisonJSON } from './modules/analytics-compare.js';
import { loadSurveyHistory } from './modules/species-autocomplete.js';
import { initHerbarium, handleHerbariumPhoto, saveHerbarium } from './modules/herbarium.js';
import { ensureAuth, EmailLogin, EmailSignup } from './modules/firebase.js';

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
  screenExport: refreshPreview
};

async function updateBars() {
  try {
    const s = await Store.getActive();
    const n = s ? s.name : 'No survey';
    ['quadratSurveyName', 'envSurveyName', 'distSurveyName', 'photoSurveyName', 'exportSurveyName', 'analyticsSurveyName', 'transectSurveyName', 'herbSurveyName'].forEach(id => {
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

  $$('.nav-btn').forEach(b => {
    b.onclick = (e) => {
      e.preventDefault();
      switchScreen(b.dataset.screen, screenCallbacks);
    };
  });
  $$('.stat-card[data-tool]').forEach(b => b.addEventListener('click', () => switchScreen(b.dataset.tool, screenCallbacks)));

  // Survey Selector
  $('#surveySelector')?.addEventListener('change', async (e) => {
    const id = e.target.value;
    if (id) {
      await Store.setActive(id);
      await updateBars();
      toast('Survey switched');
    }
  });

  // Login — Firebase Email Auth
  function setLoginError(msg) {
    const el = document.getElementById('loginError');
    if (el) el.textContent = msg;
  }

  $('#btnSignIn')?.addEventListener('click', async () => {
    const email = $('#loginEmail')?.value.trim();
    const pwd   = $('#loginPassword')?.value;
    if (!email || !pwd) { setLoginError('Please enter your email and password.'); return; }
    setLoginError('');
    $('#btnSignIn').disabled = true;
    $('#btnSignIn').textContent = 'Signing in…';
    try {
      resetUserRef();
      const user = await EmailLogin(email, pwd);
      localStorage.setItem('fc_user', JSON.stringify({ uid: user.uid, email: user.email, time: Date.now() }));
      hideLogin();
      toast(`Welcome back, ${user.email}`);
      // Reload to ensure all modules (Store, GPS, etc.) re-initialize with new UID
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
    const email = $('#loginEmail')?.value.trim();
    const pwd   = $('#loginPassword')?.value;
    if (!email || !pwd) { setLoginError('Please enter your email and password.'); return; }
    if (pwd.length < 6)  { setLoginError('Password must be at least 6 characters.'); return; }
    setLoginError('');
    $('#btnRegister').disabled = true;
    $('#btnRegister').textContent = 'Creating…';
    try {
      resetUserRef();
      const user = await EmailSignup(email, pwd);
      localStorage.setItem('fc_user', JSON.stringify({ uid: user.uid, email: user.email, time: Date.now() }));
      hideLogin();
      toast(`Account created! Welcome, ${user.email}`);
      // Reload to ensure all modules (Store, GPS, etc.) re-initialize with new UID
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
      const n = prompt('Waypoint name:');
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

  const fillGPSField = (inputId, includeAlt = false) => {
    import('./modules/gps.js').then(gps => {
      if (gps.curPos.lat) {
        if (gps.curPos.acc && gps.curPos.acc > 10) {
          if (!confirm(`Warning: GPS accuracy is too low (${Math.round(gps.curPos.acc)}m). Do you want to proceed and save this coordinate?`)) {
            return;
          }
        }
        let val = fmtCoords(gps.curPos.lat, gps.curPos.lng, $('#settingCoordFormat')?.value);
        if (includeAlt && gps.curPos.alt !== null) val += ` (${Math.round(gps.curPos.alt)}m)`;
        $(inputId).value = val;
        toast('GPS filled');
      } else {
        toast('No GPS signal', true);
      }
    });
  };

  // Quadrat
  $('#btnAddSpecies')?.addEventListener('click', addSpeciesEntry);
  $('#btnQuadratGPS')?.addEventListener('click', () => fillGPSField('#quadratGPS'));
  $('#btnSaveQuadrat')?.addEventListener('click', async () => {
      await saveQuadrat();
  });

  // Transect
  $('#btnAddIntercept')?.addEventListener('click', addIntercept);
  $('#btnTransectStartGPS')?.addEventListener('click', () => fillGPSField('#transectStartGPS'));
  $('#btnTransectEndGPS')?.addEventListener('click', () => fillGPSField('#transectEndGPS'));
  $('#btnSaveTransect')?.addEventListener('click', async () => {
      await saveTransect();
  });

  // Environment
  $('#btnAutoFillEnv')?.addEventListener('click', autoFillEnv);
  $('#btnSaveEnv')?.addEventListener('click', async () => {
      await saveEnv();
  });
  $('#canopyPhotoInput')?.addEventListener('change', e => {
      if(e.target.files[0]) estimateCanopy(e.target.files[0]);
  });

  // Disturbance
  const dToggles = [{ cb: 'distGrazingPresent', grp: 'grazingSeverityGroup', sl: 'distGrazingSeverity', dsp: 'distGrazingSeverityVal' }, { cb: 'distLoggingPresent', grp: 'loggingSeverityGroup', sl: 'distLoggingSeverity', dsp: 'distLoggingSeverityVal' }, { cb: 'distFirePresent', grp: 'fireSeverityGroup', sl: 'distFireSeverity', dsp: 'distFireSeverityVal' }, { cb: 'distHumanPresent', grp: 'humanSeverityGroup', sl: 'distHumanSeverity', dsp: 'distHumanSeverityVal' }];
  dToggles.forEach(t => {
    const c = document.getElementById(t.cb), g = document.getElementById(t.grp), s = document.getElementById(t.sl), d = document.getElementById(t.dsp);
    if (!c || !g || !s || !d) return;
    c.addEventListener('change', () => g.classList.toggle('visible', c.checked));
    s.addEventListener('input', () => { d.textContent = s.value; });
  });
  $$('.cbi-select').forEach(s => s.addEventListener('change', recalcCBI));
  $('#btnSaveDisturbCBI')?.addEventListener('click', async () => {
      await saveDisturbCBI();
  });

  // Media
  $('#photoInput')?.addEventListener('change', e => {
      if(e.target.files[0]) handlePhotoInput(e.target.files[0]);
  });
  $('#btnStartRecording')?.addEventListener('click', () => {
      startRecording(() => {
          $('#recordingStatus').textContent = '🔴 Recording...';
          $('#btnStartRecording').disabled = true;
          $('#btnStopRecording').disabled = false;
      });
  });
  $('#btnStopRecording')?.addEventListener('click', () => {
      stopRecording(() => {
          $('#recordingStatus').textContent = 'Saved';
          $('#btnStartRecording').disabled = false;
          $('#btnStopRecording').disabled = true;
      });
  });

  // Herbarium
  $('#herbPhotoInput')?.addEventListener('change', e => {
      handleHerbariumPhoto(e.target.files[0]);
  });
  $('#btnSaveHerbarium')?.addEventListener('click', () => {
      saveHerbarium(false);
  });
  $('#btnExportHerbarium')?.addEventListener('click', () => {
      saveHerbarium(true);
  });
  $('#btnHerbGPS')?.addEventListener('click', () => fillGPSField('#herbGPS', true));

  // Notes
  $('#btnGeocodeNotes')?.addEventListener('click', () => {
      import('./modules/gps.js').then(async (gps) => {
          if (!gps.curPos.lat) { toast('No GPS', true); return; }
          toast('Fetching location...');
          const loc = await gps.reverseGeocode(gps.curPos.lat, gps.curPos.lng);
          if (loc) {
              const el = $('#noteContent');
              el.value = (el.value + (el.value ? '\n\n' : '') + 'Location: ' + loc).trim();
              toast('Location auto-filled');
          } else {
              toast('Failed to reverse geocode', true);
          }
      });
  });
  $('#btnAddNote')?.addEventListener('click', async () => {
      await addNote();
  });

  // Analytics Compare
  $('#compareRunBtn')?.addEventListener('click', runComparison);
  $('#compareExportBtn')?.addEventListener('click', exportComparisonJSON);

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
      if (confirm(`Delete current survey "${s.name}" permanently?`)) {
          await Store.del(s.id);
          await updateBars();
          switchScreen('screenDashboard', screenCallbacks);
          toast('Survey deleted');
      }
  });
  $('#btnClearAll')?.addEventListener('click', async () => { if(confirm('Delete ALL surveys?')) { await Store.clearAll(); location.reload(); } });
  $('#btnClearAllSettings')?.addEventListener('click', async () => { if(confirm('Delete ALL?')) { await Store.clearAll(); location.reload(); } });

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
