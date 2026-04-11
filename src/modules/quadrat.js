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
<div class="form-row"><div class="form-group"><label>Life Stage</label><select class="sp-stage"><option value="tree">Tree</option><option value="sapling">Sapling</option><option value="seedling">Seedling</option><option value="climber">Climber</option><option value="shrub">Shrub</option><option value="herb">Herb</option></select></div><div class="form-group"><label>Tree Status</label><select class="sp-status"><option value="live">Live</option><option value="dead-standing">Dead Standing</option><option value="dead-fallen">Dead Fallen</option><option value="stump">Stump</option></select></div></div>
<div class="form-row"><div class="form-group"><label>Abundance</label><input type="number" class="sp-abundance" min="0" placeholder="Count" /></div><div class="form-group"><label>Stem Count</label><input type="number" class="sp-stems" min="1" placeholder="Stems" title="Number of stems per individual (multi-stemmed trees)" /></div></div>
<div class="form-row"><div class="form-group"><label>DBH (cm)</label><input type="number" class="sp-dbh" min="0" step="0.1" placeholder="Diameter" /></div><div class="form-group"><label>GBH (cm)</label><input type="number" class="sp-gbh" min="0" step="0.1" placeholder="Girth" /></div></div>
<div class="form-row"><div class="form-group"><label>DBH Meas. Height (m)</label><input type="number" class="sp-dbh-height" min="0" step="0.1" value="1.3" title="Standard: 1.3m. Adjust for buttressed trees." /></div><div class="form-group"><label>Crown Diameter (m)</label><input type="number" class="sp-crown-diam" min="0" step="0.1" placeholder="Avg. of 2 axes" /></div></div>
<div class="form-row"><div class="form-group"><label>Height (m)</label><input type="number" class="sp-height" min="0" step="0.1" /></div><div class="form-group"><label>Crown Class</label><select class="sp-crown"><option value="">—</option><option value="dominant">Dominant</option><option value="codominant">Co-dominant</option><option value="intermediate">Intermediate</option><option value="suppressed">Suppressed</option></select></div></div>
<div class="form-row"><div class="form-group"><label>Distance from Center (m)</label><input type="number" class="sp-distance" min="0" step="0.1" placeholder="e.g., 5.2" title="Distance from plot center for re-measurement" /></div><div class="form-group"><label>Azimuth (°)</label><input type="number" class="sp-azimuth" min="0" max="360" step="1" placeholder="0–360" title="Bearing from plot center" /></div></div>
<div class="form-row"><div class="form-group"><label>Phenology</label><select class="sp-phenology"><option value="">—</option><option value="flowering">Flowering</option><option value="fruiting">Fruiting</option><option value="leaf-flush">Leaf Flush</option><option value="leaf-fall">Leaf Fall</option><option value="dormant">Dormant</option><option value="vegetative">Vegetative</option></select></div><div class="form-group"><label>Health</label><select class="sp-health"><option value="">—</option><option value="healthy">Healthy</option><option value="stressed">Stressed</option><option value="diseased">Diseased</option><option value="dead-standing">Dead Standing</option><option value="fallen">Fallen</option><option value="cut-stump">Cut Stump</option></select></div></div>
<div class="form-row"><div class="form-group"><label>Bark Condition</label><select class="sp-bark"><option value="">—</option><option value="intact">Intact</option><option value="partially-missing">Partially Missing</option><option value="mostly-missing">Mostly Missing</option><option value="absent">Absent</option></select></div><div class="form-group"><label>Decay Class (Dead only)</label><select class="sp-decay"><option value="">—</option><option value="1">1 — Recently Dead</option><option value="2">2 — Loose Bark</option><option value="3">3 — Soft Sapwood</option><option value="4">4 — Heartwood Decay</option><option value="5">5 — Fully Decomposed</option></select></div></div>`;
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
    measDate: $('#quadratDate')?.value || new Date().toISOString().split('T')[0],
    observer: $('#quadratObserver')?.value.trim() || '',
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
      status: e.querySelector('.sp-status')?.value || 'live',
      abundance: parseInt(e.querySelector('.sp-abundance').value) || 0,
      stems: parseInt(e.querySelector('.sp-stems')?.value) || 1,
      dbh: parseFloat(e.querySelector('.sp-dbh').value) || 0,
      gbh: parseFloat(e.querySelector('.sp-gbh').value) || 0,
      dbhMeasHeight: parseFloat(e.querySelector('.sp-dbh-height')?.value) || 1.3,
      crownDiameter: parseFloat(e.querySelector('.sp-crown-diam')?.value) || 0,
      height: parseFloat(e.querySelector('.sp-height').value) || 0,
      crownClass: e.querySelector('.sp-crown').value,
      distance: parseFloat(e.querySelector('.sp-distance')?.value) || 0,
      azimuth: parseFloat(e.querySelector('.sp-azimuth')?.value) || 0,
      phenology: e.querySelector('.sp-phenology').value,
      health: e.querySelector('.sp-health').value,
      bark: e.querySelector('.sp-bark')?.value || '',
      decayClass: parseInt(e.querySelector('.sp-decay')?.value) || 0
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
          if (q.measDate && $('#quadratDate')) $('#quadratDate').value = q.measDate;
          if (q.observer && $('#quadratObserver')) $('#quadratObserver').value = q.observer;
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
              if (last.querySelector('.sp-status')) last.querySelector('.sp-status').value = sp.status || 'live';
              last.querySelector('.sp-abundance').value = sp.abundance;
              if (last.querySelector('.sp-stems')) last.querySelector('.sp-stems').value = sp.stems || 1;
              last.querySelector('.sp-dbh').value = sp.dbh;
              last.querySelector('.sp-gbh').value = sp.gbh || 0;
              if (last.querySelector('.sp-dbh-height')) last.querySelector('.sp-dbh-height').value = sp.dbhMeasHeight || 1.3;
              if (last.querySelector('.sp-crown-diam')) last.querySelector('.sp-crown-diam').value = sp.crownDiameter || 0;
              last.querySelector('.sp-height').value = sp.height;
              last.querySelector('.sp-crown').value = sp.crownClass || '';
              if (last.querySelector('.sp-distance')) last.querySelector('.sp-distance').value = sp.distance || 0;
              if (last.querySelector('.sp-azimuth')) last.querySelector('.sp-azimuth').value = sp.azimuth || 0;
              last.querySelector('.sp-phenology').value = sp.phenology;
              last.querySelector('.sp-health').value = sp.health || '';
              if (last.querySelector('.sp-bark')) last.querySelector('.sp-bark').value = sp.bark || '';
              if (last.querySelector('.sp-decay')) last.querySelector('.sp-decay').value = sp.decayClass || '';
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
