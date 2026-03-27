// src/main.js

import { $, $$, toast, switchScreen, dismissSplash, showLogin, hideLogin, updateClock, updateOnlineDot } from './modules/ui.js';
import { Store, loadSettings, saveSettings, getTheme, setTheme, getBrightness, setBrightness, migrateFromLocalStorage } from './modules/storage.js';
import { startGPS, fmtCoords } from './modules/gps.js';
import { fetchWeather } from './modules/weather.js';
import { refreshDataRecords, createNewSurvey } from './modules/survey.js';
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

// ===== INIT =====
async function initApp() {
  try {
    await migrateFromLocalStorage();
    await loadAppData();
    setupEventListeners();
  } catch (e) {
    console.error('App: Init error', e);
  }
  startGPS(onGPSUpdate, onGPSError);
  setInterval(updateClock, 1000);
  updateClock();
  window.addEventListener('online', updateOnlineDot);
  window.addEventListener('offline', updateOnlineDot);
  setTimeout(updateOnlineDot, 500);

  const u = localStorage.getItem('fc_user');
  setTimeout(() => {
    dismissSplash(() => {
      if (!u) showLogin();
    });
  }, 2500);

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
  if ($('#gpsOptionAcc')) $('#gpsOptionAcc').textContent = pos.acc ? `${SYMBOLS.precision}${Math.round(pos.acc)} ${SYMBOLS.elevation}` : `${SYMBOLS.precision}--- ${SYMBOLS.elevation}`;
  if ($('#gpsOptionAlt')) $('#gpsOptionAlt').textContent = pos.alt !== null ? `${Math.round(pos.alt)} ${SYMBOLS.elevation}` : `--- ${SYMBOLS.elevation}`;
  if ($('#gpsOptionStatus')) $('#gpsOptionStatus').textContent = 'ACTIVE';

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

function onGPSError(msg) {
  if ($('#gpsOptionStatus')) $('#gpsOptionStatus').textContent = msg;
}

const screenCallbacks = {
  screenDashboard: () => { updateBars(); },
  screenData: refreshDataRecords,
  screenMap: () => { setTimeout(initMap, 100); refreshWpList(); },
  screenQuadrat: refreshQuadratTable,
  screenTransect: refreshTransectTable,
  screenEnvironment: loadEnvData,
  screenDisturbCBI: () => { loadDistData(); loadCBIData(); },
  screenPhotos: () => { refreshPhotos(); refreshNotes(); refreshAudio(); },
  screenAnalytics: () => refreshAnalytics(Store.getActive()),
  screenExport: refreshPreview
};

async function updateBars() {
  const s = await Store.getActive();
  const n = s ? s.name : 'No survey';
  ['quadratSurveyName', 'envSurveyName', 'distSurveyName', 'cbiSurveyName', 'photoSurveyName', 'exportSurveyName', 'analyticsSurveyName', 'transectSurveyName'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = n;
  });
}

function setupEventListeners() {
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => switchScreen(b.dataset.screen, screenCallbacks)));
  $$('.stat-card[data-tool]').forEach(b => b.addEventListener('click', () => switchScreen(b.dataset.tool, screenCallbacks)));
  if ($('#btnHeaderBack')) $('#btnHeaderBack').addEventListener('click', () => switchScreen('screenToolbar', screenCallbacks));

  // Login
  $('#btnSignIn')?.addEventListener('click', () => {
    const e = $('#loginEmail').value.trim();
    const p = $('#loginPassword').value;
    if (!e || !p) { alert('Please enter email and password.'); return; }
    localStorage.setItem('fc_user', JSON.stringify({ email: e, time: Date.now() }));
    hideLogin();
  });
  $('#btnGuestLogin')?.addEventListener('click', () => {
    localStorage.setItem('fc_user', JSON.stringify({ guest: true, time: Date.now() }));
    hideLogin();
  });

  // Survey
  $('#btnNewSurvey')?.addEventListener('click', () => {
    $('#surveyDate').value = new Date().toISOString().split('T')[0];
    $('#modalNewSurvey').classList.add('show');
  });
  $('#btnCancelSurvey')?.addEventListener('click', () => $('#modalNewSurvey').classList.remove('show'));
  $('#btnSaveSurvey')?.addEventListener('click', async () => {
      await createNewSurvey();
      await updateBars();
  });

  // Map
  $('#btnLocateMe')?.addEventListener('click', locateMe);
  $('#btnAddWaypoint')?.addEventListener('click', async () => {
      const n = prompt('Waypoint name:');
      if(n) await addWaypoint(n, 'plot');
  });
  $('#btnAddWaypointManual')?.addEventListener('click', async () => {
      const n = $('#waypointName').value.trim();
      if(!n) { toast('Enter name', true); return; }
      await addWaypoint(n, $('#waypointType').value, $('#waypointNotes').value.trim());
      $('#waypointName').value = ''; $('#waypointNotes').value = '';
      await refreshWpList();
  });
  $('#btnMapSatellite')?.addEventListener('click', () => setMapLayer('sat'));
  $('#btnMapTerrain')?.addEventListener('click', () => setMapLayer('ter'));
  $('#btnMapHybrid')?.addEventListener('click', () => setMapLayer('hyb'));

  // Quadrat
  $('#btnAddSpecies')?.addEventListener('click', addSpeciesEntry);
  $('#btnQuadratGPS')?.addEventListener('click', () => {
    import('./modules/gps.js').then(gps => {
        if (gps.curPos.lat) {
            $('#quadratGPS').value = fmtCoords(gps.curPos.lat, gps.curPos.lng, $('#settingCoordFormat')?.value);
            toast('GPS filled');
        } else toast('No GPS', true);
    });
  });
  $('#btnSaveQuadrat')?.addEventListener('click', async () => {
      await saveQuadrat();
      switchScreen('screenToolbar', screenCallbacks);
  });

  // Transect
  $('#btnAddIntercept')?.addEventListener('click', addIntercept);
  $('#btnTransectStartGPS')?.addEventListener('click', () => {
      import('./modules/gps.js').then(gps => {
          if (gps.curPos.lat) $('#transectStartGPS').value = fmtCoords(gps.curPos.lat, gps.curPos.lng, $('#settingCoordFormat')?.value);
      });
  });
  $('#btnTransectEndGPS')?.addEventListener('click', () => {
      import('./modules/gps.js').then(gps => {
          if (gps.curPos.lat) $('#transectEndGPS').value = fmtCoords(gps.curPos.lat, gps.curPos.lng, $('#settingCoordFormat')?.value);
      });
  });
  $('#btnSaveTransect')?.addEventListener('click', async () => {
      await saveTransect();
      switchScreen('screenToolbar', screenCallbacks);
  });

  // Environment
  $('#btnAutoFillEnv')?.addEventListener('click', autoFillEnv);
  $('#btnSaveEnv')?.addEventListener('click', async () => {
      await saveEnv();
      switchScreen('screenToolbar', screenCallbacks);
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
      switchScreen('screenToolbar', screenCallbacks);
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

  // Notes
  $('#btnAddNote')?.addEventListener('click', async () => {
      await addNote();
      switchScreen('screenToolbar', screenCallbacks);
  });

  // Export
  $('#btnExportCSV')?.addEventListener('click', exportSurveyCSV);
  $('#btnExportJSON')?.addEventListener('click', exportSurveyJSON);
  $('#btnExportAllCSV')?.addEventListener('click', exportAllSurveysCSV);
  $('#btnExportGPX')?.addEventListener('click', exportGPX);
  $('#btnExportReport')?.addEventListener('click', generateReport);
  $('#btnBackupAll')?.addEventListener('click', backupAll);
  $('#btnBackupAllSettings')?.addEventListener('click', backupAll);
  $('#restoreInput')?.addEventListener('change', e => restoreData(e.target.files[0]));
  $('#restoreInputSettings')?.addEventListener('change', e => restoreData(e.target.files[0]));
  $('#btnClearAll')?.addEventListener('click', async () => { if(confirm('Delete ALL?')) { await Store.clearAll(); location.reload(); } });
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
}
