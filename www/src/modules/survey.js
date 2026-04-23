// src/modules/survey.js

import { $, $$, toast, esc, switchScreen } from './ui.js';
import { Store } from './storage.js';
import { fmtCoords, curPos } from './gps.js';
import { getLocalISO, getDeviceTimezone, getUTCOffsetMinutes } from './utils.js';

/**
 * Populates the survey selector dropdown with all available surveys.
 */
export async function populateSurveySelector() {
  const selector = $('#surveySelector');
  if (!selector) return;

  const surveys = await Store.getSurveys();
  const activeId = await Store._getActiveId();
  console.log('Populating selector, surveys found:', surveys.length);

  let html = '<option value="">Select a survey...</option>';
  surveys.forEach(s => {
    const selected = activeId === s.id ? 'selected' : '';
    html += `<option value="${s.id}" ${selected}>${esc(s.name)}</option>`;
  });
  selector.innerHTML = html;
}

export async function refreshDataRecords() {
  const surveys = await Store.getSurveys();
  const list = $('#dataRecordsList');
  if (!list) return;
  const filterType = $('#dataFilterType') ? $('#dataFilterType').value : 'all';

  let allRecords = [];
  surveys.forEach(sv => {
    const svName = sv.name || 'Unnamed';
    const svDate = sv.date || '';
    // Quadrats
    if (sv.quadrats && sv.quadrats.length) {
      sv.quadrats.forEach((q, qi) => {
        allRecords.push({ type: 'quadrat', icon: 'Q', label: `Quadrat #${q.number || qi + 1}`, detail: `${q.species ? q.species.length : 0} species · ${q.size ? q.size + 'm²' : 'Area unspecified'}`, survey: svName, date: svDate, sortDate: svDate || '0000-00-00', surveyId: sv.id, isTampered: sv.isTampered });
      });
    }
    // Transects
    if (sv.transects && sv.transects.length) {
      sv.transects.forEach((t, ti) => {
        const dimStr = (t.length && t.width) ? `${t.length}m × ${t.width}m` : 'Dimensions unspecified';
        allRecords.push({ type: 'transect', icon: 'T', label: `Transect #${t.number || ti + 1}`, detail: `${dimStr} · ${t.intercepts ? t.intercepts.length : 0} intercepts`, survey: svName, date: svDate, sortDate: svDate || '0000-00-00', surveyId: sv.id, isTampered: sv.isTampered });
      });
    }
    // Environment
    if (sv.environment) {
      const envDetails = [];
      if (sv.environment.elevation) envDetails.push(`Elev: ${sv.environment.elevation}m`);
      if (sv.environment.slope) envDetails.push(`Slope: ${sv.environment.slope}°`);
      if (sv.environment.weather) envDetails.push(sv.environment.weather);
      const envDetailStr = envDetails.length ? envDetails.join(' · ') : 'No data specified';
      allRecords.push({ type: 'environment', icon: 'E', label: 'Environment Data', detail: envDetailStr, survey: svName, date: svDate, sortDate: svDate || '0000-00-00', surveyId: sv.id, isTampered: sv.isTampered });
    }
    // Disturbance
    if (sv.disturbance) {
      const dTypes = [];
      const isPresent = (field) => field && (field.present === true || field.present === 'true');
      if (isPresent(sv.disturbance.grazing)) dTypes.push('Grazing');
      if (isPresent(sv.disturbance.logging)) dTypes.push('Logging');
      if (isPresent(sv.disturbance.fire)) dTypes.push('Fire');
      if (isPresent(sv.disturbance.human)) dTypes.push('Human');
      if (isPresent(sv.disturbance.biotic)) dTypes.push('Biotic');
      if (isPresent(sv.disturbance.abiotic)) dTypes.push('Abiotic');
      allRecords.push({ type: 'disturbance', icon: 'D', label: 'Disturbance & CBI', detail: dTypes.length ? dTypes.join(', ') : 'No disturbance recorded', survey: svName, date: svDate, sortDate: svDate || '0000-00-00', surveyId: sv.id, isTampered: sv.isTampered });
    }
    // Notes
    if (sv.notes && sv.notes.length) {
      sv.notes.forEach(n => {
        const noteDate = n.time ? n.time.split('T')[0] : svDate;
        const noteTime = n.time ? new Date(n.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
        allRecords.push({ type: 'notes', icon: 'N', label: `Note: ${n.category || 'General'}`, detail: n.text ? n.text.substring(0, 60) + '…' : '', survey: svName, date: noteDate, sortDate: noteDate || '0000-00-00', time: noteTime, surveyId: sv.id, isTampered: sv.isTampered });
      });
    }
    // Photos
    if (sv.photos && sv.photos.length) {
      allRecords.push({ type: 'photos', icon: 'P', label: `${sv.photos.length} Photo${sv.photos.length > 1 ? 's' : ''}`, detail: 'Attached to survey', survey: svName, date: svDate, sortDate: svDate || '0000-00-00', surveyId: sv.id, isTampered: sv.isTampered });
    }
    // Herbariums
    if (sv.herbariums && sv.herbariums.length) {
      sv.herbariums.forEach((h, hi) => {
        allRecords.push({ type: 'herbarium', icon: 'H', label: `Herbarium Voucher: ${h.collectionNo || 'Unassigned'}`, detail: `${h.speciesScientific || 'Unknown Species'} · ${h.family || 'Unknown Family'}`, survey: svName, date: svDate, sortDate: svDate || '0000-00-00', surveyId: sv.id, isTampered: sv.isTampered });
      });
    }
    // Germplasm
    if (sv.germplasm && sv.germplasm.length) {
      sv.germplasm.forEach((g, gi) => {
        allRecords.push({ type: 'germplasm', icon: 'G', label: `Germplasm Record (${g.bodyId ? g.bodyId.toUpperCase() : 'Entry'})`, detail: `${g.speciesScientific || 'Unknown Species'} · ${g.collectionDate || g.acquisitionDate || g.samplingDate || 'Undated'}`, survey: svName, date: svDate, sortDate: svDate || '0000-00-00', surveyId: sv.id, isTampered: sv.isTampered });
      });
    }
  });

  if (filterType !== 'all') allRecords = allRecords.filter(r => r.type === filterType);

  if (!allRecords.length) {
    list.innerHTML = '<div class="data-records-empty"><p>No recorded data</p></div>';
    return;
  }

  allRecords.sort((a, b) => (b.sortDate || '').localeCompare(a.sortDate || ''));

  const groups = {};
  allRecords.forEach(r => {
    const dateKey = r.date || 'Undated';
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(r);
  });

  const fragment = document.createDocumentFragment();
  Object.entries(groups).forEach(([dateKey, records]) => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'data-date-group';
    const displayDate = dateKey !== 'Undated' ? new Date(dateKey + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : dateKey;
    groupDiv.innerHTML = `<div class="data-date-label">${displayDate}</div>`;

    records.forEach(r => {
      const card = document.createElement('div');
      card.className = 'data-record-card';
      card.dataset.sid = r.surveyId;
      
      const tamperBadge = r.isTampered ? `<span style="font-size:0.6rem; background:var(--red); padding:2px 4px; border-radius:4px; margin-left:8px;">TAMPERED</span>` : '';

      card.innerHTML = `
        <div class="data-record-icon type-${r.type}">${r.icon}</div>
        <div class="data-record-body">
          <div class="data-record-title">${esc(r.label)}${tamperBadge}</div>
          <div class="data-record-meta">${esc(r.survey)} · ${esc(r.detail)}</div>
        </div>
      `;
      card.addEventListener('click', async () => {
        await Store.setActive(card.dataset.sid);
        await populateSurveySelector();
        toast('Survey selected — Session updated', false);
        
        // Navigate to the respective screen
        let tgt = '';
        if (r.type === 'quadrat') tgt = 'screenQuadrat';
        else if (r.type === 'transect') tgt = 'screenTransect';
        else if (r.type === 'environment') tgt = 'screenEnvironment';
        else if (r.type === 'disturbance') tgt = 'screenDisturbCBI';
        else if (r.type === 'notes' || r.type === 'photos') tgt = 'screenPhotos';
        else if (r.type === 'herbarium') tgt = 'screenHerbarium';
        else if (r.type === 'germplasm') tgt = 'screenGermplasm';
        
        if (tgt && typeof switchScreen === 'function') switchScreen(tgt);
      });
      groupDiv.appendChild(card);
    });
    fragment.appendChild(groupDiv);
  });
  list.innerHTML = '';
  list.appendChild(fragment);
}

export async function createNewSurvey() {
  console.log('createNewSurvey: Starting');
  const nameInput = $('#surveyName');
  if (!nameInput) {
    console.error('createNewSurvey: surveyName input not found');
    return false;
  }
  const name = nameInput.value.trim();
  if (!name) {
    toast('Name required', true);
    return false;
  }

  const nameLower = name.toLowerCase();
  if (nameLower.includes('mock test')) {
    console.log('createNewSurvey: Generating mock survey');
    await generateMockSurvey();
    return true;
  }

  try {
    const sv = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
      name,
      location: ($('#surveyLocation') ? $('#surveyLocation').value.trim() : ''),
      investigator: ($('#surveyInvestigator') ? $('#surveyInvestigator').value.trim() : ''),
      date: ($('#surveyDate') ? $('#surveyDate').value : new Date().toISOString().split('T')[0]),
      createdAt: getLocalISO(),
      deviceTimezone: getDeviceTimezone(),
      utcOffsetMinutes: getUTCOffsetMinutes(),
      quadrats: [],
      transects: [],
      environment: null,
      disturbance: null,
      cbi: null,
      photos: [],
      notes: [],
      audioNotes: [],
      waypoints: [],
      taxonomyPack: ($('#surveyTaxonomyPack') ? $('#surveyTaxonomyPack').value : '')
    };

    if ($('#surveyAutoGPS') && $('#surveyAutoGPS').checked && curPos.lat) {
      const fmtEl = document.getElementById('settingCoordFormat');
      const fmt = fmtEl ? fmtEl.value : 'dd';
      sv.gpsCoords = fmtCoords(curPos.lat, curPos.lng, fmt);
      sv.location = sv.location || sv.gpsCoords;
    }

    console.log('createNewSurvey: Adding survey to Store', sv);
    await Store.add(sv);

    console.log('createNewSurvey: Survey added successfully');
    $('#modalNewSurvey').classList.remove('show');

    // Clear inputs safely
    ['surveyName', 'surveyLocation', 'surveyInvestigator'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    toast(`"${name}" created`);

    // Auto-select the newly created survey
    await Store.setActive(sv.id);

    // Download Taxonomy Pack
    if (sv.taxonomyPack) {
      try {
         const packRes = await fetch(`./data/taxonomy/${sv.taxonomyPack}.json`);
         if (packRes.ok) {
            const packData = await packRes.json();
            const { idb } = await import('./storage.js');
            await idb.set(`taxpack_${sv.taxonomyPack}`, JSON.stringify(packData));
            toast(`Downloaded ${sv.taxonomyPack} offline dictionary`);
         }
      } catch(e) {
         console.warn('Taxonomy pack download failed', e);
         toast('Taxonomy download failed (offline?)', true);
      }
    }

    // Refresh UI without blocking
    populateSurveySelector().catch(e => console.warn('Refresh selector failed', e));
    refreshDataRecords().catch(e => console.warn('Refresh records failed', e));

    return true;
  } catch (err) {
      console.error('createNewSurvey error:', err);
      toast('Creation failed: ' + err.message, true);
      return false;
  }
}

async function generateMockSurvey() {
  console.log('generateMockSurvey: start');
  try {
    const mockId = 'mock_' + Date.now().toString(36);
    const survey = {
      id: mockId,
      name: "Mock Test 2024 (Boreal Forest)",
      location: "Algonquin Park, ON",
      investigator: "Dr. Forest AI",
      date: new Date().toISOString().split('T')[0],
      quadrats: [
        {
          number: 1,
          size: 100, // 10x10m
          species: [
            { name: "Picea mariana", abundance: 12, dbh: 15.5 },
            { name: "Abies balsamea", abundance: 8, dbh: 12.2 },
            { name: "Pinus banksiana", abundance: 3, dbh: 22.0 }
          ]
        },
        {
          number: 2,
          size: 100,
          species: [
            { name: "Picea mariana", abundance: 15, dbh: 14.8 },
            { name: "Abies balsamea", abundance: 10, dbh: 11.5 },
            { name: "Betula papyrifera", abundance: 5, dbh: 18.2 }
          ]
        }
      ],
      environment: {
        elevation: 450,
        slope: 12,
        aspect: "North",
        topography: "Ridge",
        weather: "Sunny"
      },
      disturbance: {
        grazing: { present: false },
        logging: { present: true, severity: "Low" },
        fire: { present: false },
        human: { present: true }
      },
      notes: [
        { category: "Habitat", text: "Healthy moss layer, signs of recent selective logging.", time: new Date().toISOString() }
      ],
      transects: [], photos: [], audioNotes: [], waypoints: []
    };

    console.log('generateMockSurvey: Adding to store');
    await Store.add(survey);
    console.log('generateMockSurvey: Set active');
    await Store.setActive(mockId);

    const modal = $('#modalNewSurvey');
    if (modal) modal.classList.remove('show');

    const nameInput = $('#surveyName');
    if (nameInput) nameInput.value = '';

    toast("Mock Survey Generated!");

    populateSurveySelector().catch(e => console.warn(e));
    refreshDataRecords().catch(e => console.warn(e));

    // Trigger analytics refresh if UI module is available
    try {
      const { refreshAnalytics } = await import('./analytics.js');
      refreshAnalytics(survey);
    } catch (ae) {
      console.warn('Analytics refresh failed during mock generation', ae);
    }
  } catch (e) {
    console.error('Failed to generate mock survey', e);
    toast('Mock generation failed: ' + e.message, true);
  }
}
// _getLocalISOString replaced by shared getLocalISO() in utils.js
