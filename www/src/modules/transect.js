// src/modules/transect.js

import { $, $$, toast, esc, fcConfirm } from './ui.js';
import { Store, loadSettings } from './storage.js';
import { attachAutocomplete } from './species-autocomplete.js';
import { fillGPSField } from './gps.js';
import { toMetric, toImperial, getLocalISO } from './utils.js';

let intCount = 0;

export function addIntercept() {
  intCount++;
  const d = document.createElement('div');
  d.className = 'species-entry';
  const inputId = `transect-intname-${intCount}`;
  d.innerHTML = `<div class="species-entry-header"><span class="species-entry-num">Intercept #${intCount}</span><button class="species-remove" type="button">✕</button></div>
<div class="form-group"><label>Species / Feature</label><input type="text" class="int-name" id="${inputId}" placeholder="Species name or substrate" /></div>
<div class="form-row"><div class="form-group"><label>Life Form</label><select class="int-lifeform"><option value="">—</option><option value="tree">Tree</option><option value="shrub">Shrub</option><option value="herb">Herb</option><option value="grass">Grass</option><option value="liana">Liana</option><option value="epiphyte">Epiphyte</option><option value="moss-lichen">Moss/Lichen</option><option value="fern">Fern</option></select></div><div class="form-group"><label>Intercept Type</label><select class="int-type"><option value="canopy">Canopy</option><option value="basal">Basal</option><option value="foliar">Foliar</option></select></div></div>
<div class="form-row"><div class="form-group"><label>Start Distance (<span class="unit-dist">m</span>)</label><input type="number" class="int-start" min="0" step="0.01" placeholder="Canfield start" title="Where species intercept begins along the tape" /></div><div class="form-group"><label>End Distance (<span class="unit-dist">m</span>)</label><input type="number" class="int-end" min="0" step="0.01" placeholder="Canfield end" title="Where species intercept ends along the tape" /></div></div>
<div class="form-row"><div class="form-group"><label>Distance (<span class="unit-dist">m</span>)</label><input type="number" class="int-dist" min="0" step="0.1" placeholder="Position along line" title="Point position along the transect" /></div><div class="form-group"><label>Cover %</label><input type="number" class="int-cover" min="0" max="100" placeholder="0–100" /></div></div>
<div class="form-row"><div class="form-group"><label>Height (<span class="unit-dist">m</span>)</label><input type="number" class="int-height" min="0" step="0.1" /></div><div class="form-group"><label>DBH (<span class="unit-diam">cm</span>)</label><input type="number" class="int-dbh" min="0" step="0.1" placeholder="Belt transect" title="For belt transect tree surveys" /></div></div>
<div class="form-row"><div class="form-group"><label>Abundance</label><input type="number" class="int-abundance" min="0" placeholder="Count" title="Number of individuals (belt transect)" /></div><div class="form-group"><label>Stratum</label><select class="int-stratum"><option value="">—</option><option value="canopy">Canopy</option><option value="sub-canopy">Sub-canopy</option><option value="shrub">Shrub layer</option><option value="herb">Herb layer</option><option value="ground">Ground cover</option></select></div></div>
<div class="form-row"><div class="form-group"><label>Substrate</label><select class="int-substrate"><option value="">—</option><option value="soil">Bare Soil</option><option value="litter">Litter</option><option value="rock">Rock</option><option value="moss">Moss</option><option value="water">Water</option><option value="wood">Dead Wood</option></select></div><div class="form-group"><label>Perp. Distance (<span class="unit-dist">m</span>)</label><input type="number" class="int-perp" min="0" step="0.1" placeholder="For distance sampling" title="Perpendicular distance from the line to observation (distance sampling)" /></div></div>
<div class="form-group"><label>Notes</label><input type="text" class="int-notes" placeholder="e.g., damaged, flowering, seedling cluster" /></div>`;
  d.querySelector('.species-remove').addEventListener('click', () => d.remove());
  $('#interceptList').appendChild(d);

  attachAutocomplete(inputId);
}

export async function saveTransect() {
  const s = await Store.getActive();
  if (!s) { toast('Select survey', true); return; }
  const sysSettings = await loadSettings();
  const isImperial = sysSettings.settingUnitSystem === 'imperial';
  const t = {
    number: parseInt($('#transectNumber').value) || 1,
    type: $('#transectType')?.value || 'belt',
    length: isImperial ? (toMetric(parseFloat($('#transectLength').value), 'dist') || 0) : (parseFloat($('#transectLength').value) || 0),
    width: isImperial ? (toMetric(parseFloat($('#transectWidth').value), 'dist') || 0) : (parseFloat($('#transectWidth').value) || 0),
    bearing: parseFloat($('#transectBearing').value) || 0,
    slope: parseFloat($('#transectSlope')?.value) || 0,
    measDate: $('#transectDate')?.value || new Date().toISOString().split('T')[0],
    recordedAt: getLocalISO(),
    observer: $('#transectObserver')?.value.trim() || '',
    startGPS: $('#transectStartGPS').value,
    endGPS: $('#transectEndGPS').value,
    intercepts: Array.from($$('#interceptList .species-entry')).map(e => ({
      name: e.querySelector('.int-name').value.trim(),
      lifeForm: e.querySelector('.int-lifeform')?.value || '',
      interceptType: e.querySelector('.int-type')?.value || 'canopy',
      startDist: isImperial ? (toMetric(parseFloat(e.querySelector('.int-start')?.value), 'dist') || 0) : (parseFloat(e.querySelector('.int-start')?.value) || 0),
      endDist: isImperial ? (toMetric(parseFloat(e.querySelector('.int-end')?.value), 'dist') || 0) : (parseFloat(e.querySelector('.int-end')?.value) || 0),
      distance: isImperial ? (toMetric(parseFloat(e.querySelector('.int-dist').value), 'dist') || 0) : (parseFloat(e.querySelector('.int-dist').value) || 0),
      cover: Math.max(0, Math.min(100, parseFloat(e.querySelector('.int-cover').value) || 0)),
      height: isImperial ? (toMetric(parseFloat(e.querySelector('.int-height').value), 'dist') || 0) : (parseFloat(e.querySelector('.int-height').value) || 0),
      dbh: isImperial ? (toMetric(parseFloat(e.querySelector('.int-dbh')?.value), 'diam') || 0) : (parseFloat(e.querySelector('.int-dbh')?.value) || 0),
      abundance: parseInt(e.querySelector('.int-abundance')?.value) || 0,
      stratum: e.querySelector('.int-stratum').value,
      substrate: e.querySelector('.int-substrate')?.value || '',
      perpDistance: isImperial ? (toMetric(parseFloat(e.querySelector('.int-perp')?.value), 'dist') || 0) : (parseFloat(e.querySelector('.int-perp')?.value) || 0),
      notes: e.querySelector('.int-notes')?.value.trim() || ''
    }))
  };

  // Automated QA Validation
  for (const int of t.intercepts) {
    if (int.cover > 100) {
      if (!await fcConfirm(`Warning: Intercept '${int.name || 'Unknown'}' has a cover percentage > 100%. Are you sure this is correct?`)) return;
    }
    if (int.height > 150) {
      if (!await fcConfirm(`Warning: Intercept '${int.name || 'Unknown'}' has an unusually large height (${int.height}m). Are you sure this is correct?`)) return;
    }
    // Canfield validation: end must be >= start
    if (int.startDist > 0 && int.endDist > 0 && int.endDist < int.startDist) {
      if (!await fcConfirm(`Warning: Intercept '${int.name || 'Unknown'}' has end distance (${int.endDist}m) before start distance (${int.startDist}m). Proceed?`)) return;
    }
    // Canfield: intercept must not exceed transect length
    if (t.length > 0 && int.endDist > t.length) {
      if (!await fcConfirm(`Warning: Intercept '${int.name || 'Unknown'}' end distance (${int.endDist}m) exceeds transect length (${t.length}m). Proceed?`)) return;
    }
  }

  if (!s.transects) s.transects = [];

  const editIdx = $('#btnSaveTransect').dataset.editIdx;
  if (editIdx !== undefined && editIdx !== "") {
    s.transects[parseInt(editIdx)] = t;
    toast(`Transect #${t.number} updated`);
    delete $('#btnSaveTransect').dataset.editIdx;
    $('#btnSaveTransect').textContent = 'Save Transect';
  } else {
    s.transects.push(t);
    toast(`Transect #${t.number} saved`);
    $('#transectNumber').value = t.number + 1;
  }

  await Store.update(s);
  $('#interceptList').innerHTML = '';
  intCount = 0;
  addIntercept();
  refreshTransectTable();
}

export async function refreshTransectTable() {
  const s = await Store.getActive();
  const tb = $('#transectTableBody');
  if (!tb) return;
  const sysSettings = await loadSettings();
  const isImperial = sysSettings.settingUnitSystem === 'imperial';
  if (!s || !s.transects || !s.transects.length) {
    tb.innerHTML = '<tr><td colspan="7" class="table-empty">No data</td></tr>';
    return;
  }
  let r = '';
  s.transects.forEach((t, ti) => {
    const ints = t.intercepts && t.intercepts.length ? t.intercepts : [{ name: '—', distance: '—', cover: '—' }];
    ints.forEach((n, ni) => {
      r += `<tr>${ni === 0 ? `<td>${t.number}</td><td>${t.length}</td><td>${t.width}</td>` : '<td></td><td></td><td></td>'}<td class="species-name-cell">${esc(n.name || '—')}</td><td>${n.distance || n.startDist || '—'}</td><td>${n.cover || '—'}</td>${ni === 0 ? `<td class="action-btns"><button data-action="et" data-i="${ti}" title="Edit">✏️</button><button data-action="del-t" data-i="${ti}" title="Delete">🗑️</button></td>` : '<td></td>'}</tr>`;
    });
  });
  tb.innerHTML = r;

  // Edit handler
  tb.querySelectorAll('[data-action="et"]').forEach(b => {
    b.onclick = async () => {
      const idx = +b.dataset.i;
      const t = s.transects[idx];
      $('#transectNumber').value = t.number;
      if ($('#transectType')) $('#transectType').value = t.type || 'belt';
      $('#transectLength').value = isImperial ? toImperial(t.length, 'dist') : t.length;
      $('#transectWidth').value = isImperial ? toImperial(t.width, 'dist') : t.width;
      $('#transectBearing').value = t.bearing;
      if ($('#transectSlope')) $('#transectSlope').value = t.slope || 0;
      if ($('#transectDate') && t.measDate) $('#transectDate').value = t.measDate;
      if ($('#transectObserver')) $('#transectObserver').value = t.observer || '';
      $('#transectStartGPS').value = t.startGPS;
      $('#transectEndGPS').value = t.endGPS;
      $('#interceptList').innerHTML = '';
      intCount = 0;
      t.intercepts.forEach(int => {
        addIntercept();
        const last = $('#interceptList').lastElementChild;
        last.querySelector('.int-name').value = int.name;
        if (last.querySelector('.int-lifeform')) last.querySelector('.int-lifeform').value = int.lifeForm || '';
        if (last.querySelector('.int-type')) last.querySelector('.int-type').value = int.interceptType || 'canopy';
        if (last.querySelector('.int-start')) last.querySelector('.int-start').value = isImperial ? toImperial(int.startDist, 'dist') : (int.startDist || 0);
        if (last.querySelector('.int-end')) last.querySelector('.int-end').value = isImperial ? toImperial(int.endDist, 'dist') : (int.endDist || 0);
        last.querySelector('.int-dist').value = isImperial ? toImperial(int.distance, 'dist') : int.distance;
        last.querySelector('.int-cover').value = int.cover;
        last.querySelector('.int-height').value = isImperial ? toImperial(int.height, 'dist') : (int.height || 0);
        if (last.querySelector('.int-dbh')) last.querySelector('.int-dbh').value = isImperial ? toImperial(int.dbh, 'diam') : (int.dbh || 0);
        if (last.querySelector('.int-abundance')) last.querySelector('.int-abundance').value = int.abundance || 0;
        last.querySelector('.int-stratum').value = int.stratum || '';
        if (last.querySelector('.int-substrate')) last.querySelector('.int-substrate').value = int.substrate || '';
        if (last.querySelector('.int-perp')) last.querySelector('.int-perp').value = isImperial ? toImperial(int.perpDistance, 'dist') : (int.perpDistance || 0);
        if (last.querySelector('.int-notes')) last.querySelector('.int-notes').value = int.notes || '';
      });
      $('#btnSaveTransect').textContent = 'Update Transect';
      $('#btnSaveTransect').dataset.editIdx = idx;
      $('#screenTransect').scrollTo({ top: 0, behavior: 'smooth' });
      toast('Transect loaded for editing');
    };
  });

  // Delete handler
  tb.querySelectorAll('[data-action="del-t"]').forEach(b => {
    b.onclick = async () => {
      const idx = +b.dataset.i;
      if (!await fcConfirm(`Delete Transect #${s.transects[idx].number}?`)) return;
      s.transects.splice(idx, 1);
      await Store.update(s);
      refreshTransectTable();
      toast('Transect deleted');
    };
  });
}

export function init() {
  $('#btnAddIntercept')?.addEventListener('click', addIntercept);
  $('#btnTransectStartGPS')?.addEventListener('click', () => fillGPSField('#transectStartGPS'));
  $('#btnTransectEndGPS')?.addEventListener('click', () => fillGPSField('#transectEndGPS'));
  $('#btnSaveTransect')?.addEventListener('click', async () => {
    await saveTransect();
  });

  // CWD mode: adapt intercept labels when "Coarse Woody Debris" is selected
  $('#transectType')?.addEventListener('change', (e) => {
    const isCWD = e.target.value === 'cwd';
    const list = $('#interceptList');
    if (!list) return;
    // Update existing intercept entries
    list.querySelectorAll('.species-entry').forEach(entry => {
      _applyCWDLabels(entry, isCWD);
    });
  });
}

/**
 * Swap intercept labels between standard and CWD mode
 */
function _applyCWDLabels(entry, isCWD) {
  try {
    const labels = entry.querySelectorAll('label');
    labels.forEach(l => {
      const txt = l.textContent.trim();
      if (isCWD) {
        if (txt.startsWith('Species')) l.textContent = 'Feature / Log ID';
        if (txt.startsWith('Life Form')) l.textContent = 'Wood Type';
        if (txt.startsWith('Cover')) l.textContent = 'Decay Class (1-5)';
        if (txt.startsWith('Height')) l.textContent = 'Log Diameter (cm)';
      } else {
        if (txt.startsWith('Feature')) l.textContent = 'Species / Feature';
        if (txt.startsWith('Wood Type')) l.textContent = 'Life Form';
        if (txt.startsWith('Decay Class')) l.textContent = 'Cover %';
        if (txt.startsWith('Log Diameter')) l.textContent = 'Height (m)';
      }
    });
  } catch (_) { /* safety net */ }
}
