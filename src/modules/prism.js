// src/modules/prism.js — Variable-Radius Point Sampling (Prism Sweep)

import { $, $$, toast, esc, fcConfirm } from './ui.js';
import { Store } from './storage.js';
import { fillGPSField } from './gps.js';
import { attachAutocomplete } from './species-autocomplete.js';
import { getLocalISO } from './utils.js';

let tallyCount = 0;

export function addPrismTally() {
  tallyCount++;
  const d = document.createElement('div');
  d.className = 'species-entry';
  const inputId = `prism-spname-${tallyCount}`;
  d.innerHTML = `<div class="species-entry-header"><span class="species-entry-num">Tree #${tallyCount}</span><button class="species-remove" type="button">✕</button></div>
<div class="form-group"><label>Species</label><input type="text" class="prism-sp" id="${inputId}" placeholder="e.g., Shorea robusta" /></div>
<div class="form-row"><div class="form-group"><label>DBH (<span class="unit-diam">cm</span>)</label><input type="number" class="prism-dbh" min="0" step="0.1" placeholder="Optional for V-BAR" /></div><div class="form-group"><label>Status</label><select class="prism-status"><option value="live">Live</option><option value="dead">Dead</option></select></div></div>`;
  d.querySelector('.species-remove').addEventListener('click', () => d.remove());
  $('#prismTallyList').appendChild(d);
  attachAutocomplete(inputId);
}

export async function savePrismPoint() {
  const s = await Store.getActive();
  if (!s) { toast('Select survey', true); return; }
  const entries = $$('#prismTallyList .species-entry');
  if (!entries.length) { toast('Add at least one tree tally', true); return; }

  const baf = parseFloat($('#prismBAF').value) || 4;
  const point = {
    number: parseInt($('#prismPointNumber').value) || 1,
    baf: baf,
    measDate: $('#prismDate')?.value || new Date().toISOString().split('T')[0],
    recordedAt: getLocalISO(),
    observer: $('#prismObserver')?.value.trim() || '',
    gps: $('#prismGPS')?.value || '',
    tallies: Array.from(entries).map(e => ({
      species: e.querySelector('.prism-sp').value.trim(),
      dbh: parseFloat(e.querySelector('.prism-dbh')?.value) || 0,
      status: e.querySelector('.prism-status')?.value || 'live'
    }))
  };

  // Calculate BA/ha = tally count × BAF
  point.treeCount = point.tallies.length;
  point.basalAreaPerHa = point.treeCount * baf;

  if (!s.prismPoints) s.prismPoints = [];

  const editIdx = $('#btnSavePrism').dataset.editIdx;
  if (editIdx !== undefined && editIdx !== "") {
    s.prismPoints[parseInt(editIdx)] = point;
    toast(`Prism Point #${point.number} updated`);
    delete $('#btnSavePrism').dataset.editIdx;
    $('#btnSavePrism').textContent = 'Save Prism Point';
  } else {
    s.prismPoints.push(point);
    toast(`Prism Point #${point.number} saved — BA/ha: ${point.basalAreaPerHa} m²/ha`);
    $('#prismPointNumber').value = point.number + 1;
  }

  await Store.update(s);
  $('#prismTallyList').innerHTML = '';
  tallyCount = 0;
  addPrismTally();
  refreshPrismTable();
}

export async function refreshPrismTable() {
  const s = await Store.getActive();
  const tb = $('#prismTableBody');
  if (!tb) return;
  if (!s || !s.prismPoints || !s.prismPoints.length) {
    tb.innerHTML = '<tr><td colspan="5" class="table-empty">No prism data</td></tr>';
    return;
  }
  let r = '';
  s.prismPoints.forEach((p, pi) => {
    r += `<tr><td>${p.number}</td><td>${p.baf}</td><td>${p.treeCount}</td><td>${p.basalAreaPerHa} m²/ha</td><td class="action-btns"><button data-action="ep" data-i="${pi}" title="Edit">✏️</button><button data-action="dp" data-i="${pi}" title="Delete">🗑️</button></td></tr>`;
  });
  tb.innerHTML = r;

  // Edit handler
  tb.querySelectorAll('[data-action="ep"]').forEach(b => {
    b.onclick = async () => {
      const idx = +b.dataset.i;
      const p = s.prismPoints[idx];
      $('#prismBAF').value = p.baf;
      $('#prismPointNumber').value = p.number;
      if ($('#prismDate') && p.measDate) $('#prismDate').value = p.measDate;
      if ($('#prismObserver')) $('#prismObserver').value = p.observer || '';
      if ($('#prismGPS')) $('#prismGPS').value = p.gps || '';
      $('#prismTallyList').innerHTML = '';
      tallyCount = 0;
      p.tallies.forEach(t => {
        addPrismTally();
        const last = $('#prismTallyList').lastElementChild;
        last.querySelector('.prism-sp').value = t.species;
        last.querySelector('.prism-dbh').value = t.dbh || 0;
        if (last.querySelector('.prism-status')) last.querySelector('.prism-status').value = t.status || 'live';
      });
      $('#btnSavePrism').textContent = 'Update Prism Point';
      $('#btnSavePrism').dataset.editIdx = idx;
      $('#screenPrism').scrollTo({ top: 0, behavior: 'smooth' });
      toast('Prism point loaded for editing');
    };
  });

  // Delete handler
  tb.querySelectorAll('[data-action="dp"]').forEach(b => {
    b.onclick = async () => {
      const idx = +b.dataset.i;
      if (!await fcConfirm(`Delete Prism Point #${s.prismPoints[idx].number}?`)) return;
      s.prismPoints.splice(idx, 1);
      await Store.update(s);
      refreshPrismTable();
      toast('Prism point deleted');
    };
  });
}

export function init() {
  $('#btnAddPrismTally')?.addEventListener('click', addPrismTally);
  $('#btnPrismGPS')?.addEventListener('click', () => fillGPSField('#prismGPS'));
  $('#btnSavePrism')?.addEventListener('click', async () => {
    await savePrismPoint();
  });
}
