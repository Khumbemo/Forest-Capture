// src/modules/quadrat.js

import { $, $$, toast, esc } from './ui.js';
import { Store } from './storage.js';
import { fmtCoords, curPos } from './gps.js';

let spCount = 0;
const SPECIES_DB = ["Shorea robusta", "Tectona grandis", "Dalbergia sissoo", "Acacia catechu", "Pinus roxburghii", "Cedrus deodara", "Quercus leucotrichophora", "Rhododendron arboreum", "Alnus nepalensis", "Schima wallichii", "Terminalia tomentosa", "Anogeissus latifolia", "Diospyros melanoxylon", "Madhuca indica", "Butea monosperma", "Bombax ceiba", "Ficus benghalensis", "Ficus religiosa", "Mangifera indica", "Azadirachta indica", "Eucalyptus globulus", "Dendrocalamus strictus", "Bambusa bambos", "Lantana camara", "Eupatorium adenophorum", "Parthenium hysterophorus", "Adina cordifolia", "Lagerstroemia parviflora", "Syzygium cumini", "Emblica officinalis"];

export function addSpeciesEntry() {
  spCount++;
  const d = document.createElement('div');
  d.className = 'species-entry';
  d.innerHTML = `<div class="species-entry-header"><span class="species-entry-num">Species #${spCount}</span><button class="species-remove" type="button">✕</button></div>
<div class="form-group"><label>Species Name</label><input type="text" class="sp-name" placeholder="e.g., Shorea robusta" list="speciesDatalist" /></div>
<div class="form-row"><div class="form-group"><label>Life Stage</label><select class="sp-stage"><option value="tree">Tree</option><option value="sapling">Sapling</option><option value="seedling">Seedling</option></select></div><div class="form-group"><label>Abundance</label><input type="number" class="sp-abundance" min="0" placeholder="Count" /></div></div>
<div class="form-row"><div class="form-group"><label>DBH (cm)</label><input type="number" class="sp-dbh" min="0" step="0.1" /></div><div class="form-group"><label>Height (m)</label><input type="number" class="sp-height" min="0" step="0.1" /></div></div>
<div class="form-row"><div class="form-group"><label>Phenology</label><select class="sp-phenology"><option value="">—</option><option value="flowering">Flowering</option><option value="fruiting">Fruiting</option><option value="leaf-flush">Leaf Flush</option><option value="leaf-fall">Leaf Fall</option><option value="dormant">Dormant</option><option value="vegetative">Vegetative</option></select></div><div class="form-group"><label>Health</label><input type="text" class="sp-health" placeholder="e.g., Healthy" /></div></div>`;
  d.querySelector('.species-remove').addEventListener('click', () => d.remove());
  $('#speciesList').appendChild(d);

  if (!document.getElementById('speciesDatalist')) {
    const dl = document.createElement('datalist');
    dl.id = 'speciesDatalist';
    SPECIES_DB.forEach(s => {
      const o = document.createElement('option');
      o.value = s;
      dl.appendChild(o);
    });
    document.body.appendChild(dl);
  }

  // Smart Search logic
  const inp = d.querySelector('.sp-name');
  inp.addEventListener('input', () => {
      const val = inp.value.toLowerCase();
      if(val.length < 2) return;
      const suggestions = SPECIES_DB.filter(s => s.toLowerCase().includes(val));
      if(suggestions.length === 1 && suggestions[0].toLowerCase() === val) {
          toast(`Species detected: ${suggestions[0]}`);
      }
  });
}

export async function saveQuadrat() {
  const s = await Store.getActive();
  if (!s) { toast('Select survey', true); return; }
  const entries = $$('#speciesList .species-entry');
  if (!entries.length) { toast('Add species', true); return; }

  const q = {
    number: parseInt($('#quadratNumber').value) || 1,
    size: parseFloat($('#quadratSize').value) || 0,
    shape: $('#quadratShape').value,
    gps: $('#quadratGPS').value,
    species: Array.from(entries).map(e => ({
      name: e.querySelector('.sp-name').value.trim(),
      stage: e.querySelector('.sp-stage').value,
      abundance: parseInt(e.querySelector('.sp-abundance').value) || 0,
      dbh: parseFloat(e.querySelector('.sp-dbh').value) || 0,
      height: parseFloat(e.querySelector('.sp-height').value) || 0,
      phenology: e.querySelector('.sp-phenology').value,
      health: e.querySelector('.sp-health').value.trim()
    }))
  };
  if (!s.quadrats) s.quadrats = [];
  s.quadrats.push(q);
  await Store.update(s);
  $('#quadratNumber').value = q.number + 1;
  $('#speciesList').innerHTML = '';
  spCount = 0;
  addSpeciesEntry();
  toast(`Quadrat #${q.number} saved`);
  refreshQuadratTable();
}

export async function refreshQuadratTable() {
  const s = await Store.getActive();
  const tb = $('#quadratTableBody');
  if (!tb) return;
  if (!s || !s.quadrats || !s.quadrats.length) {
    tb.innerHTML = '<tr><td colspan="9" class="table-empty">No data</td></tr>';
    return;
  }
  let r = '';
  s.quadrats.forEach((q, qi) => {
    const sp = q.species && q.species.length ? q.species : [{ name: '—', stage: '—', phenology: '—', abundance: '—', dbh: '—', height: '—' }];
    sp.forEach((x, si) => {
      const first = si === 0;
      const badge = x.stage && x.stage !== '—' ? `<span class="stage-badge ${esc(x.stage)}">${esc(x.stage)}</span>` : '—';
      r += `<tr>${first ? `<td>${q.number}</td><td>${q.size}</td>` : '<td></td><td></td>'}<td class="species-name-cell">${esc(x.name || '—')}</td><td>${badge}</td><td>${x.phenology || '—'}</td><td>${x.abundance || '—'}</td><td>${x.dbh || '—'}</td><td>${x.height || '—'}</td>${first ? `<td class="action-btns"><button data-action="dq" data-i="${qi}">🗑️</button></td>` : '<td></td>'}</tr>`;
    });
  });
  tb.innerHTML = r;
  tb.querySelectorAll('[data-action="dq"]').forEach(b => {
    b.addEventListener('click', async () => {
      const idx = +b.dataset.i;
      const removed = s.quadrats.splice(idx, 1)[0];
      await Store.update(s);
      refreshQuadratTable();
      toast(`Quadrat #${removed.number} deleted`, false, {
          label: 'Undo',
          callback: async () => {
              s.quadrats.splice(idx, 0, removed);
              await Store.update(s);
              refreshQuadratTable();
              toast('Restored');
          }
      });
    });
  });
}
