// src/modules/survey.js

import { $, $$, toast, esc } from './ui.js';
import { Store } from './storage.js';
import { fmtCoords, curPos } from './gps.js';

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
        allRecords.push({ type: 'quadrat', icon: 'Q', label: `Quadrat #${q.number || qi + 1}`, detail: `${q.species ? q.species.length : 0} species · ${q.size || '—'}m²`, survey: svName, date: svDate, sortDate: svDate || '0000-00-00', surveyId: sv.id });
      });
    }
    // Transects
    if (sv.transects && sv.transects.length) {
      sv.transects.forEach((t, ti) => {
        allRecords.push({ type: 'transect', icon: 'T', label: `Transect #${t.number || ti + 1}`, detail: `${t.length || '—'}m × ${t.width || '—'}m · ${t.intercepts ? t.intercepts.length : 0} intercepts`, survey: svName, date: svDate, sortDate: svDate || '0000-00-00', surveyId: sv.id });
      });
    }
    // Environment
    if (sv.environment) {
      allRecords.push({ type: 'environment', icon: 'E', label: 'Environment Data', detail: `Elev: ${sv.environment.elevation || '—'}m · Slope: ${sv.environment.slope || '—'}° · ${sv.environment.weather || '—'}`, survey: svName, date: svDate, sortDate: svDate || '0000-00-00', surveyId: sv.id });
    }
    // Disturbance
    if (sv.disturbance) {
      const dTypes = [];
      if (sv.disturbance.grazing && sv.disturbance.grazing.present) dTypes.push('Grazing');
      if (sv.disturbance.logging && sv.disturbance.logging.present) dTypes.push('Logging');
      if (sv.disturbance.fire && sv.disturbance.fire.present) dTypes.push('Fire');
      if (sv.disturbance.human && sv.disturbance.human.present) dTypes.push('Human');
      allRecords.push({ type: 'disturbance', icon: 'D', label: 'Disturbance & CBI', detail: dTypes.length ? dTypes.join(', ') : 'No disturbance recorded', survey: svName, date: svDate, sortDate: svDate || '0000-00-00', surveyId: sv.id });
    }
    // Notes
    if (sv.notes && sv.notes.length) {
      sv.notes.forEach(n => {
        const noteDate = n.time ? n.time.split('T')[0] : svDate;
        const noteTime = n.time ? new Date(n.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
        allRecords.push({ type: 'notes', icon: 'N', label: `Note: ${n.category || 'General'}`, detail: n.text ? n.text.substring(0, 60) + '…' : '', survey: svName, date: noteDate, sortDate: noteDate || '0000-00-00', time: noteTime, surveyId: sv.id });
      });
    }
    // Photos
    if (sv.photos && sv.photos.length) {
      allRecords.push({ type: 'photos', icon: 'P', label: `${sv.photos.length} Photo${sv.photos.length > 1 ? 's' : ''}`, detail: 'Attached to survey', survey: svName, date: svDate, sortDate: svDate || '0000-00-00', surveyId: sv.id });
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
      card.innerHTML = `
        <div class="data-record-icon type-${r.type}">${r.icon}</div>
        <div class="data-record-body">
          <div class="data-record-title">${esc(r.label)}</div>
          <div class="data-record-meta">${esc(r.survey)} · ${esc(r.detail)}</div>
        </div>
      `;
      card.addEventListener('click', async () => {
        await Store.setActive(card.dataset.sid);
        await populateSurveySelector();
        toast('Survey selected — Session updated', false);
      });
      groupDiv.appendChild(card);
    });
    fragment.appendChild(groupDiv);
  });
  list.innerHTML = '';
  list.appendChild(fragment);
}

export async function createNewSurvey() {
  const nameInput = $('#surveyName');
  const name = nameInput.value.trim();
  if (!name) { toast('Name required', true); return false; }

  const nameLower = name.toLowerCase();
  if (nameLower.includes('mock test')) {
    await generateMockSurvey();
    return true;
  }

  try {
    const sv = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      name,
      location: $('#surveyLocation').value.trim(),
      investigator: $('#surveyInvestigator').value.trim(),
      date: $('#surveyDate').value,
      quadrats: [], transects: [], environment: null, disturbance: null, cbi: null, photos: [], notes: [], audioNotes: [], waypoints: []
    };
    if ($('#surveyAutoGPS').checked && curPos.lat) {
      const fmt = document.getElementById('settingCoordFormat')?.value || 'dd';
      sv.gpsCoords = fmtCoords(curPos.lat, curPos.lng, fmt);
      sv.location = sv.location || sv.gpsCoords;
    }
    await Store.add(sv);
    $('#modalNewSurvey').classList.remove('show');
    $('#surveyName').value = '';
    $('#surveyLocation').value = '';
    $('#surveyInvestigator').value = '';
    toast(`"${name}" created`);
    await populateSurveySelector();
    refreshDataRecords();
    return true;
  } catch (err) {
      console.error('createNewSurvey error:', err);
      toast('Creation failed: ' + err.message, true);
      return false;
  }
}

async function generateMockSurvey() {
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
        },
        {
          number: 3,
          size: 100,
          species: [
            { name: "Picea mariana", abundance: 9, dbh: 16.2 },
            { name: "Pinus banksiana", abundance: 7, dbh: 24.5 },
            { name: "Populus tremuloides", abundance: 4, dbh: 20.1 }
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
      ]
    };

    console.log('Generating mock survey...', survey);
    await Store.add(survey);
    await Store.setActive(mockId);

    $('#modalNewSurvey').classList.remove('show');
    $('#surveyName').value = '';
    toast("Mock Survey Generated!");

    await populateSurveySelector();
    if (typeof refreshDataRecords === 'function') refreshDataRecords();

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
