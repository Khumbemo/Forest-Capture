// src/modules/transect.js

import { $, $$, toast, esc } from './ui.js';
import { Store } from './storage.js';

let intCount = 0;

export function addIntercept() {
  intCount++;
  const d = document.createElement('div');
  d.className = 'species-entry';
  d.innerHTML = `<div class="species-entry-header"><span class="species-entry-num">Intercept #${intCount}</span><button class="species-remove" type="button">✕</button></div>
<div class="form-group"><label>Species</label><input type="text" class="int-name" placeholder="Species name" list="speciesDatalist" /></div>
<div class="form-row"><div class="form-group"><label>Distance (m)</label><input type="number" class="int-dist" min="0" step="0.1" /></div><div class="form-group"><label>Cover %</label><input type="number" class="int-cover" min="0" max="100" /></div></div>`;
  d.querySelector('.species-remove').addEventListener('click', () => d.remove());
  $('#interceptList').appendChild(d);
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
      cover: parseFloat(e.querySelector('.int-cover').value) || 0
    }))
  };
  if (!s.transects) s.transects = [];
  s.transects.push(t);
  await Store.update(s);
  $('#transectNumber').value = t.number + 1;
  $('#interceptList').innerHTML = '';
  intCount = 0;
  addIntercept();
  toast(`Transect #${t.number} saved`);
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
      r += `<tr>${ni === 0 ? `<td>${t.number}</td><td>${t.length}</td><td>${t.width}</td>` : '<td></td><td></td><td></td>'}<td class="species-name-cell">${esc(n.name || '—')}</td><td>${n.distance || '—'}</td><td>${n.cover || '—'}</td>${ni === 0 ? `<td class="action-btns"><button data-action="del-t" data-i="${ti}">🗑️</button></td>` : '<td></td>'}</tr>`;
    });
  });
  tb.innerHTML = r;
  tb.querySelectorAll('[data-action="del-t"]').forEach(b => {
    b.addEventListener('click', async () => {
      if (confirm('Delete?')) {
        s.transects.splice(+b.dataset.i, 1);
        await Store.update(s);
        refreshTransectTable();
        toast('Deleted');
      }
    });
  });
}
