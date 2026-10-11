// src/modules/edit-data.js
//
// "Edit Data" tool: a single, generic editor for every record the app
// has recorded, whatever its shape — quadrats, transects, environment,
// disturbance, notes, herbarium vouchers, germplasm entries, and the
// survey's own metadata. Existing screens (Quadrat, Transect, ...) only
// let you edit through their own specific form; this tool instead reads
// a record's own fields and renders one, so it never needs updating when
// a record type gains or loses a field.

import { $, toast, esc, fcConfirm } from './ui.js';
import { Store } from './storage.js';
import { refreshDataRecords } from './survey.js';

const TYPE_META = {
  survey:      { icon: 'S', label: 'Survey Info' },
  quadrat:     { icon: 'Q', label: 'Quadrat' },
  transect:    { icon: 'T', label: 'Transect' },
  environment: { icon: 'E', label: 'Environment Data' },
  disturbance: { icon: 'D', label: 'Disturbance & CBI' },
  notes:       { icon: 'N', label: 'Note' },
  herbarium:   { icon: 'H', label: 'Herbarium Voucher' },
  germplasm:   { icon: 'G', label: 'Germplasm Record' }
};

// Keys shown read-only (identity/derived fields) rather than as inputs —
// editing these would break cross-references or get silently overwritten
// on the next save anyway.
const READONLY_KEYS = new Set(['id', 'uid', 'signature', 'isTampered', 'createdAt', 'deviceTimezone', 'utcOffsetMinutes']);

let _records = [];
let _current = null; // { type, surveyId, index }, survey, record

function _titleCase(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
}

function _isDateKey(key, val) {
  return /date/i.test(key) && typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val);
}

/**
 * Flattens every survey's editable content into one list of record
 * references. Each ref carries enough (type, surveyId, index) to look
 * the record back up and write it back with Store.update().
 */
async function _loadRecords() {
  const surveys = await Store.getSurveys();
  const out = [];

  surveys.forEach(sv => {
    const svName = sv.name || 'Unnamed';
    const svDate = sv.date || '';

    out.push({ type: 'survey', surveyId: sv.id, label: svName, detail: `${sv.location || 'No location'} · ${svDate || 'Undated'}`, survey: svName, sortDate: svDate || '9999-99-99' });

    (sv.quadrats || []).forEach((q, i) => {
      out.push({ type: 'quadrat', surveyId: sv.id, index: i, label: `Quadrat #${q.number ?? i + 1}`, detail: `${q.species ? q.species.length : 0} species`, survey: svName, sortDate: svDate });
    });
    (sv.transects || []).forEach((tr, i) => {
      out.push({ type: 'transect', surveyId: sv.id, index: i, label: `Transect #${tr.number ?? i + 1}`, detail: `${tr.intercepts ? tr.intercepts.length : 0} intercepts`, survey: svName, sortDate: svDate });
    });
    if (sv.environment) {
      out.push({ type: 'environment', surveyId: sv.id, label: 'Environment Data', detail: 'Tap to edit', survey: svName, sortDate: svDate });
    }
    if (sv.disturbance) {
      out.push({ type: 'disturbance', surveyId: sv.id, label: 'Disturbance & CBI', detail: 'Tap to edit', survey: svName, sortDate: svDate });
    }
    (sv.notes || []).forEach((n, i) => {
      out.push({ type: 'notes', surveyId: sv.id, index: i, label: `Note: ${n.category || 'General'}`, detail: (n.text || '').slice(0, 60), survey: svName, sortDate: n.time ? n.time.split('T')[0] : svDate });
    });
    (sv.herbariums || []).forEach((h, i) => {
      out.push({ type: 'herbarium', surveyId: sv.id, index: i, label: `Voucher: ${h.collectionNo || 'Unassigned'}`, detail: h.speciesScientific || 'Unknown species', survey: svName, sortDate: svDate });
    });
    (sv.germplasm || []).forEach((g, i) => {
      out.push({ type: 'germplasm', surveyId: sv.id, index: i, label: `Germplasm (${g.bodyId ? g.bodyId.toUpperCase() : 'Entry'})`, detail: g.speciesScientific || 'Unknown species', survey: svName, sortDate: svDate });
    });
  });

  out.sort((a, b) => (b.sortDate || '').localeCompare(a.sortDate || ''));
  return out;
}

function _matchesFilter(rec, filter) {
  return filter === 'all' || rec.type === filter;
}

export async function renderEditDataList() {
  _current = null;
  _records = await _loadRecords();

  const listEl = $('#editDataList');
  const formView = $('#editDataFormView');
  const listView = $('#editDataListView');
  if (formView) formView.style.display = 'none';
  if (listView) listView.style.display = '';
  if (!listEl) return;

  const filter = $('#editDataFilterType') ? $('#editDataFilterType').value : 'all';
  const filtered = _records.filter(r => _matchesFilter(r, filter));

  if (!filtered.length) {
    listEl.innerHTML = '<div class="empty-state small"><p>No recorded data yet</p><p style="font-size:.8rem;">Use any tool to record something, then come back here to edit it.</p></div>';
    return;
  }

  listEl.innerHTML = filtered.map((r, i) => {
    const meta = TYPE_META[r.type];
    return `<div class="data-record-card" data-i="${i}">
      <div class="data-record-icon type-${r.type}">${meta.icon}</div>
      <div class="data-record-body">
        <div class="data-record-title">${esc(r.label)}</div>
        <div class="data-record-meta">${esc(r.survey)} · ${esc(r.detail || '')}</div>
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.data-record-card').forEach(card => {
    card.addEventListener('click', () => {
      const rec = filtered[parseInt(card.dataset.i, 10)];
      if (rec) openEditRecord(rec);
    });
  });
}

function _getTarget(survey, ref) {
  switch (ref.type) {
    case 'survey': return survey;
    case 'quadrat': return survey.quadrats?.[ref.index];
    case 'transect': return survey.transects?.[ref.index];
    case 'environment': return survey.environment;
    case 'disturbance': return survey.disturbance;
    case 'notes': return survey.notes?.[ref.index];
    case 'herbarium': return survey.herbariums?.[ref.index];
    case 'germplasm': return survey.germplasm?.[ref.index];
    default: return null;
  }
}

export async function openEditRecord(ref) {
  const surveys = await Store.getSurveys();
  const survey = surveys.find(s => s.id === ref.surveyId);
  if (!survey) { toast('Survey not found', true); return; }
  const target = _getTarget(survey, ref);
  if (!target) { toast('Record not found', true); return; }

  _current = { ...ref, survey, target };

  const listView = $('#editDataListView');
  const formView = $('#editDataFormView');
  if (listView) listView.style.display = 'none';
  if (formView) formView.style.display = '';

  const meta = TYPE_META[ref.type];
  const titleEl = $('#editDataFormTitle');
  if (titleEl) titleEl.textContent = `${meta.label}${ref.type !== 'survey' ? ' — ' + survey.name : ''}`;

  const fieldsEl = $('#editDataFormFields');
  if (!fieldsEl) return;

  fieldsEl.innerHTML = Object.entries(target).map(([key, val]) => {
    const fieldId = `editField_${key}`;
    const label = _titleCase(key);

    if (READONLY_KEYS.has(key)) {
      return `<div class="form-group"><label>${esc(label)}</label><input type="text" value="${esc(String(val))}" disabled style="opacity:.55;" /></div>`;
    }
    if (typeof val === 'boolean') {
      return `<div class="form-group"><label style="display:flex;align-items:center;gap:8px;text-transform:none;"><input type="checkbox" id="${fieldId}" data-key="${key}" data-kind="boolean" ${val ? 'checked' : ''} style="width:18px;height:18px;" /> ${esc(label)}</label></div>`;
    }
    if (typeof val === 'number') {
      return `<div class="form-group"><label for="${fieldId}">${esc(label)}</label><input type="number" step="any" id="${fieldId}" data-key="${key}" data-kind="number" value="${val}" /></div>`;
    }
    if (val !== null && typeof val === 'object') {
      return `<div class="form-group"><label for="${fieldId}">${esc(label)} <span style="opacity:.6;font-weight:400;text-transform:none;">(structured data — edit as JSON)</span></label><textarea id="${fieldId}" data-key="${key}" data-kind="json" rows="4">${esc(JSON.stringify(val, null, 2))}</textarea></div>`;
    }
    if (_isDateKey(key, val)) {
      return `<div class="form-group"><label for="${fieldId}">${esc(label)}</label><input type="date" id="${fieldId}" data-key="${key}" data-kind="string" value="${esc(val.slice(0, 10))}" /></div>`;
    }
    const isLong = key === 'text' || (typeof val === 'string' && val.length > 80);
    if (isLong) {
      return `<div class="form-group"><label for="${fieldId}">${esc(label)}</label><textarea id="${fieldId}" data-key="${key}" data-kind="string" rows="3">${esc(val ?? '')}</textarea></div>`;
    }
    return `<div class="form-group"><label for="${fieldId}">${esc(label)}</label><input type="text" id="${fieldId}" data-key="${key}" data-kind="string" value="${esc(val ?? '')}" /></div>`;
  }).join('');
}

export async function saveEditRecord() {
  if (!_current) return;
  const fieldsEl = $('#editDataFormFields');
  if (!fieldsEl) return;

  const updates = {};
  const inputs = fieldsEl.querySelectorAll('[data-key]');
  for (const el of inputs) {
    const key = el.dataset.key;
    const kind = el.dataset.kind;
    try {
      if (kind === 'boolean') updates[key] = el.checked;
      else if (kind === 'number') updates[key] = el.value === '' ? null : parseFloat(el.value);
      else if (kind === 'json') updates[key] = JSON.parse(el.value);
      else updates[key] = el.value;
    } catch {
      toast(`"${_titleCase(key)}" isn't valid JSON — fix it before saving`, true);
      return;
    }
  }

  Object.assign(_current.target, updates);

  await Store.update(_current.survey);
  toast('Saved');
  refreshDataRecords().catch(() => {});
  renderEditDataList();
}

export async function deleteEditRecord() {
  if (!_current) return;
  const ok = await fcConfirm('Delete this record? This cannot be undone.');
  if (!ok) return;

  const { type, index, survey } = _current;
  switch (type) {
    case 'quadrat': survey.quadrats.splice(index, 1); break;
    case 'transect': survey.transects.splice(index, 1); break;
    case 'environment': survey.environment = null; break;
    case 'disturbance': survey.disturbance = null; break;
    case 'notes': survey.notes.splice(index, 1); break;
    case 'herbarium': survey.herbariums.splice(index, 1); break;
    case 'germplasm': survey.germplasm.splice(index, 1); break;
    case 'survey':
      toast('Delete the whole survey from the Tools screen instead', true);
      return;
  }

  await Store.update(survey);
  toast('Deleted');
  refreshDataRecords().catch(() => {});
  renderEditDataList();
}

export function cancelEditRecord() {
  renderEditDataList();
}

export function init() {
  $('#editDataFilterType')?.addEventListener('change', renderEditDataList);
  $('#btnEditDataSave')?.addEventListener('click', saveEditRecord);
  $('#btnEditDataDelete')?.addEventListener('click', deleteEditRecord);
  $('#btnEditDataCancel')?.addEventListener('click', cancelEditRecord);
}
