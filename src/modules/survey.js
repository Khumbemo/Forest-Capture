// src/modules/survey.js

import { $, $$, toast, esc, switchScreen } from './ui.js';
import { Store, getWps, saveWps } from './storage.js';
import { fmtCoords, curPos } from './gps.js';

export function refreshDataRecords() {
  const surveys = Store.getSurveys();
  const list = $('#dataRecordsList');
  if (!list) return;
  const filterType = $('#dataFilterType') ? $('#dataFilterType').value : 'all';

  let allRecords = [];
  surveys.forEach(sv => {
    const svName = sv.name || 'Unnamed';
    const svDate = sv.date || '';
    if (sv.quadrats) {
      sv.quadrats.forEach((q, qi) => {
        allRecords.push({ type: 'quadrat', icon: 'Q', label: `Quadrat #${q.number || qi + 1}`, detail: `${q.species ? q.species.length : 0} species`, survey: svName, date: svDate, sortDate: svDate || '0000-00-00', surveyId: sv.id });
      });
    }
    // More record types can be added here
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

  let html = '';
  Object.entries(groups).forEach(([dateKey, records]) => {
    html += `<div class="data-date-group"><div class="data-date-label">${dateKey}</div>`;
    records.forEach(r => {
      html += `<div class="data-record-card" data-sid="${r.surveyId}">
        <div class="data-record-icon type-${r.type}">${r.icon}</div>
        <div class="data-record-body">
          <div class="data-record-title">${esc(r.label)}</div>
          <div class="data-record-meta">${esc(r.survey)} · ${esc(r.detail)}</div>
        </div>
      </div>`;
    });
    html += '</div>';
  });
  list.innerHTML = html;

  list.querySelectorAll('.data-record-card').forEach(c => {
    c.addEventListener('click', () => {
      Store.setActive(c.dataset.sid);
      switchScreen('screenToolbar');
      toast('Survey selected');
    });
  });
}

export function createNewSurvey() {
  const name = $('#surveyName').value.trim();
  if (!name) { toast('Name required', true); return; }
  const sv = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
    name,
    location: $('#surveyLocation').value.trim(),
    investigator: $('#surveyInvestigator').value.trim(),
    date: $('#surveyDate').value,
    quadrats: [], transects: [], environment: null, disturbance: null, cbi: null, photos: [], notes: [], audioNotes: [], waypoints: []
  };
  if ($('#surveyAutoGPS').checked && curPos.lat) {
    sv.gpsCoords = fmtCoords(curPos.lat, curPos.lng);
    sv.location = sv.location || sv.gpsCoords;
  }
  Store.add(sv);
  $('#modalNewSurvey').classList.remove('show');
  toast(`"${name}" created`);
  refreshDataRecords();
}
