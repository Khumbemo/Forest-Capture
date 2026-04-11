import { $, $$, toast, esc, fcConfirm } from './ui.js';
import { Store } from './storage.js';
import { fillGPSField } from './gps.js';
import { attachAutocomplete } from './species-autocomplete.js';

let spCount = 0;

export function addSpeciesEntry() {
  spCount++;
  const d = document.createElement('div');
  d.className = 'species-entry';
  const inputId = `quadrat-spname-${spCount}`;
  d.innerHTML = `<div class="species-entry-header"><span class="species-entry-num">Species #${spCount}</span><button class="species-remove" type="button">✕</button></div>
<div class="form-group"><label>Species Name</label><input type="text" class="sp-name" id="${inputId}" placeholder="e.g., Shorea robusta" /></div>
<div class="form-row"><div class="form-group"><label>Life Stage</label><select class="sp-stage"><option value="tree">Tree</option><option value="sapling">Sapling</option><option value="seedling">Seedling</option><option value="climber">Climber</option><option value="shrub">Shrub</option><option value="herb">Herb</option></select></div><div class="form-group"><label>Abundance</label><input type="number" class="sp-abundance" min="0" placeholder="Count" /></div></div>
<div class="form-row"><div class="form-group"><label>DBH (cm)</label><input type="number" class="sp-dbh" min="0" step="0.1" placeholder="Diameter" /></div><div class="form-group"><label>GBH (cm)</label><input type="number" class="sp-gbh" min="0" step="0.1" placeholder="Girth" /></div></div>
<div class="form-row"><div class="form-group"><label>Height (m)</label><input type="number" class="sp-height" min="0" step="0.1" /></div><div class="form-group"><label>Crown Class</label><select class="sp-crown"><option value="">—</option><option value="dominant">Dominant</option><option value="codominant">Co-dominant</option><option value="intermediate">Intermediate</option><option value="suppressed">Suppressed</option></select></div></div>
<div class="form-row"><div class="form-group"><label>Phenology</label><select class="sp-phenology"><option value="">—</option><option value="flowering">Flowering</option><option value="fruiting">Fruiting</option><option value="leaf-flush">Leaf Flush</option><option value="leaf-fall">Leaf Fall</option><option value="dormant">Dormant</option><option value="vegetative">Vegetative</option></select></div><div class="form-group"><label>Health</label><select class="sp-health"><option value="">—</option><option value="healthy">Healthy</option><option value="stressed">Stressed</option><option value="diseased">Diseased</option><option value="dead-standing">Dead Standing</option><option value="fallen">Fallen</option><option value="cut-stump">Cut Stump</option></select></div></div>`;
  d.querySelector('.species-remove').addEventListener('click', () => d.remove());
  $('#speciesList').appendChild(d);

  attachAutocomplete(inputId);
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
    vegType: $('#quadratVegType') ? $('#quadratVegType').value : '',
    gps: $('#quadratGPS').value,
    corners: {
      nw: $('#quadratNW')?.value || null,
      ne: $('#quadratNE')?.value || null,
      se: $('#quadratSE')?.value || null,
      sw: $('#quadratSW')?.value || null
    },
    species: Array.from(entries).map(e => ({
      name: e.querySelector('.sp-name').value.trim(),
      stage: e.querySelector('.sp-stage').value,
      abundance: parseInt(e.querySelector('.sp-abundance').value) || 0,
      dbh: parseFloat(e.querySelector('.sp-dbh').value) || 0,
      gbh: parseFloat(e.querySelector('.sp-gbh').value) || 0,
      height: parseFloat(e.querySelector('.sp-height').value) || 0,
      crownClass: e.querySelector('.sp-crown').value,
      phenology: e.querySelector('.sp-phenology').value,
      health: e.querySelector('.sp-health').value
    }))
  };

  // Automated QA Validation
  for (const sp of q.species) {
    if (sp.dbh > 0 && (sp.dbh < 0.1 || sp.dbh > 500)) {
      if (!await fcConfirm(`Warning: Species '${sp.name || 'Unknown'}' has an outlier DBH (${sp.dbh}cm). Scale: 0.1-500cm. Proceed?`)) return;
    }
    if (sp.height > 0 && (sp.height < 0.1 || sp.height > 150)) {
      if (!await fcConfirm(`Warning: Species '${sp.name || 'Unknown'}' has an outlier height (${sp.height}m). Scale: 0.1-150m. Proceed?`)) return;
    }
  }

  if (!s.quadrats) s.quadrats = [];

  const editIdx = $('#btnSaveQuadrat').dataset.editIdx;
  if (editIdx !== undefined && editIdx !== "") {
      s.quadrats[parseInt(editIdx)] = q;
      toast(`Quadrat #${q.number} updated`);
      delete $('#btnSaveQuadrat').dataset.editIdx;
      $('#btnSaveQuadrat').textContent = 'Save Quadrat Data';
  } else {
      s.quadrats.push(q);
      toast(`Quadrat #${q.number} saved`);
      $('#quadratNumber').value = q.number + 1;
  }

  await Store.update(s);
  $('#speciesList').innerHTML = '';
  spCount = 0;
  addSpeciesEntry();
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
      const qNum = esc(q.number);
      const qSize = esc(q.size);
      const spName = esc(x.name || '—');
      const phen = esc(x.phenology || '—');
      const abun = esc(x.abundance || '—');
      const dbh = esc(x.dbh || '—');
      const hgt = esc(x.height || '—');
      
      r += `<tr>${first ? `<td>${qNum}</td><td>${qSize}</td>` : '<td></td><td></td>'}<td class="species-name-cell">${spName}</td><td>${badge}</td><td>${phen}</td><td>${abun}</td><td>${dbh}</td><td>${hgt}</td>${first ? `<td class="action-btns"><button data-action="eq" data-i="${qi}" title="Edit">✏️</button><button data-action="dq" data-i="${qi}" title="Delete">🗑️</button></td>` : '<td></td>'}</tr>`;
    });
  });
  tb.innerHTML = r;

  // Edit handler
  tb.querySelectorAll('[data-action="eq"]').forEach(b => {
      b.onclick = async () => {
          const idx = +b.dataset.i;
          const q = s.quadrats[idx];
          $('#quadratNumber').value = q.number;
          $('#quadratSize').value = q.size;
          $('#quadratShape').value = q.shape;
          if (q.vegType && $('#quadratVegType')) $('#quadratVegType').value = q.vegType;
          $('#quadratGPS').value = q.gps;
          if (q.corners) {
            if ($('#quadratNW')) $('#quadratNW').value = q.corners.nw || '';
            if ($('#quadratNE')) $('#quadratNE').value = q.corners.ne || '';
            if ($('#quadratSE')) $('#quadratSE').value = q.corners.se || '';
            if ($('#quadratSW')) $('#quadratSW').value = q.corners.sw || '';
          }
          $('#speciesList').innerHTML = '';
          spCount = 0;
          q.species.forEach(sp => {
              addSpeciesEntry();
              const last = $('#speciesList').lastElementChild;
              last.querySelector('.sp-name').value = sp.name;
              last.querySelector('.sp-stage').value = sp.stage;
              last.querySelector('.sp-abundance').value = sp.abundance;
              last.querySelector('.sp-dbh').value = sp.dbh;
              last.querySelector('.sp-gbh').value = sp.gbh || 0;
              last.querySelector('.sp-height').value = sp.height;
              last.querySelector('.sp-crown').value = sp.crownClass || '';
              last.querySelector('.sp-phenology').value = sp.phenology;
              last.querySelector('.sp-health').value = sp.health || '';
          });
          $('#btnSaveQuadrat').textContent = 'Update Quadrat Data';
          $('#btnSaveQuadrat').dataset.editIdx = idx;
          $('#screenQuadrat').scrollTo({ top: 0, behavior: 'smooth' });
          toast('Quadrat loaded for editing');
      };
  });

  // Delete handler
  tb.querySelectorAll('[data-action="dq"]').forEach(b => {
    b.onclick = async () => {
      const idx = +b.dataset.i;
      if (!await fcConfirm(`Delete Quadrat #${s.quadrats[idx].number}?`)) return;
      s.quadrats.splice(idx, 1);
      await Store.update(s);
      refreshQuadratTable();
      toast('Quadrat deleted');
    };
  });
}

export function init() {
  $('#btnAddSpecies')?.addEventListener('click', addSpeciesEntry);
  $('#btnQuadratGPS')?.addEventListener('click', () => fillGPSField('#quadratGPS'));
  $('#btnSaveQuadrat')?.addEventListener('click', async () => {
    await saveQuadrat();
  });
}
