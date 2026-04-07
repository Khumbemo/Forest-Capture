// src/modules/transect.js

import { $, $$, toast, esc } from './ui.js';
import { Store } from './storage.js';
import { attachAutocomplete } from './species-autocomplete.js';

let intCount = 0;

export function addIntercept() {
  intCount++;
  const d = document.createElement('div');
  d.className = 'species-entry';
  const inputId = `transect-intname-${intCount}`;
  d.innerHTML = `<div class="species-entry-header"><span class="species-entry-num">Intercept #${intCount}</span><button class="species-remove" type="button">✕</button></div>
<div class="form-group"><label>Species</label><input type="text" class="int-name" id="${inputId}" placeholder="Species name" /></div>
<div class="form-row"><div class="form-group"><label>Distance (m)</label><input type="number" class="int-dist" min="0" step="0.1" /></div><div class="form-group"><label>Cover %</label><input type="number" class="int-cover" min="0" max="100" /></div></div>
<div class="form-row"><div class="form-group"><label>Height (m)</label><input type="number" class="int-height" min="0" step="0.1" /></div><div class="form-group"><label>Stratum</label><select class="int-stratum"><option value="">—</option><option value="canopy">Canopy</option><option value="sub-canopy">Sub-canopy</option><option value="shrub">Shrub layer</option><option value="herb">Herb layer</option><option value="ground">Ground cover</option></select></div></div>`;
  d.querySelector('.species-remove').addEventListener('click', () => d.remove());
  $('#interceptList').appendChild(d);

  attachAutocomplete(inputId);
}

export async function saveTransect() {
  const s = await Store.getActive();
  if (!s) { toast('Select survey', true); return; }
  const t = {
    number: parseInt($('#transectNumber').value) || 1,
    length: parseFloat($('#transectLength').value) || 0,
    width: parseFloat($('#transectWidth').value) || 0,
    bearing: parseFloat($('#transectBearing').value) || 0,
    startGPS: $('#transectStartGPS').value,
    endGPS: $('#transectEndGPS').value,
    intercepts: Array.from($$('#interceptList .species-entry')).map(e => ({
      name: e.querySelector('.int-name').value.trim(),
      distance: parseFloat(e.querySelector('.int-dist').value) || 0,
      cover: parseFloat(e.querySelector('.int-cover').value) || 0,
      height: parseFloat(e.querySelector('.int-height').value) || 0,
      stratum: e.querySelector('.int-stratum').value
    }))
  };
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
  if (!s || !s.transects || !s.transects.length) {
    tb.innerHTML = '<tr><td colspan="7" class="table-empty">No data</td></tr>';
    return;
  }
  let r = '';
  s.transects.forEach((t, ti) => {
    const ints = t.intercepts && t.intercepts.length ? t.intercepts : [{ name: '—', distance: '—', cover: '—' }];
    ints.forEach((n, ni) => {
      r += `<tr>${ni === 0 ? `<td>${t.number}</td><td>${t.length}</td><td>${t.width}</td>` : '<td></td><td></td><td></td>'}<td class="species-name-cell">${esc(n.name || '—')}</td><td>${n.distance || '—'}</td><td>${n.cover || '—'}</td>${ni === 0 ? `<td class="action-btns"><button data-action="et" data-i="${ti}" title="Edit">✏️</button><button data-action="del-t" data-i="${ti}" title="Delete">🗑️</button></td>` : '<td></td>'}</tr>`;
    });
  });
  tb.innerHTML = r;

  // Edit handler
  tb.querySelectorAll('[data-action="et"]').forEach(b => {
    b.onclick = async () => {
      const idx = +b.dataset.i;
      const t = s.transects[idx];
      $('#transectNumber').value = t.number;
      $('#transectLength').value = t.length;
      $('#transectWidth').value = t.width;
      $('#transectBearing').value = t.bearing;
      $('#transectStartGPS').value = t.startGPS;
      $('#transectEndGPS').value = t.endGPS;
      $('#interceptList').innerHTML = '';
      intCount = 0;
      t.intercepts.forEach(int => {
        addIntercept();
        const last = $('#interceptList').lastElementChild;
        last.querySelector('.int-name').value = int.name;
        last.querySelector('.int-dist').value = int.distance;
        last.querySelector('.int-cover').value = int.cover;
        last.querySelector('.int-height').value = int.height || 0;
        last.querySelector('.int-stratum').value = int.stratum || '';
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
      if (!confirm(`Delete Transect #${s.transects[idx].number}?`)) return;
      s.transects.splice(idx, 1);
      await Store.update(s);
      refreshTransectTable();
      toast('Transect deleted');
    };
  });
}
