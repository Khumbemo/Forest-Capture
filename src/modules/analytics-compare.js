/**
 * analytics-compare.js — Forest Capture v3.0
 * ─────────────────────────────────────────────
 * Cross-survey analytics comparison — compare biodiversity indices across
 * multiple surveys or plots side by side.
 *
 * FEATURES
 * ────────
 *  • Select 2–6 surveys to compare
 *  • Side-by-side bar charts: Shannon H′, Simpson λ, Pielou J′, species richness
 *  • Species overlap Venn-style table (shared vs unique species per plot)
 *  • IVI comparison across surveys for a target species
 *  • Export comparison as JSON
 */

import { Store } from './storage.js';
import { toast, $ } from './ui.js';

// ─── State ────────────────────────────────────────────────────────────────────
let _allSurveys      = [];
let _selectedIds     = new Set();
let _comparisonCharts = {}; // Chart.js instances keyed by canvas ID

const MAX_COMPARE = 6;

// Color palette for up to 6 surveys (distinct, accessible)
const SURVEY_COLORS = [
  '#1D9E75', '#D85A30', '#378ADD', '#BA7517', '#534AB7', '#993556'
];

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * initCompareScreen()
 *
 * Load all surveys and render the survey picker + empty charts.
 * Call when the Compare tab becomes active.
 */
export async function initCompareScreen() {
  try {
    _allSurveys = await Store.getSurveys();
  } catch (err) {
    toast('Could not load surveys: ' + err.message, 'error');
    return;
  }

  if (_allSurveys.length < 2) {
    _showEmptyState('You need at least 2 surveys to compare. Create more surveys first.');
    return;
  }

  _renderSurveyPicker();
  _renderEmptyCharts();
}

// ─── Survey picker ────────────────────────────────────────────────────────────

function _renderSurveyPicker() {
  const container = document.getElementById('compareSurveyPicker');
  if (!container) return;

  container.innerHTML = '';

  _allSurveys
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .forEach((survey, i) => {
      const isSelected = _selectedIds.has(survey.id);
      const color      = SURVEY_COLORS[i % SURVEY_COLORS.length];
      const records    = (survey.quadrats?.length || 0) + (survey.transects?.length || 0);

      const chip = document.createElement('button');
      chip.className  = `compare-chip${isSelected ? ' compare-chip--selected' : ''}`;
      chip.dataset.id = survey.id;
      chip.style.setProperty('--chip-color', color);
      chip.innerHTML  = `
        <span class="compare-chip-dot" style="background:${color}"></span>
        <span class="compare-chip-name">${escapeHtml(survey.name)}</span>
        <span class="compare-chip-meta">${records} records</span>
      `;

      chip.addEventListener('click', () => _toggleSurvey(survey.id, chip));
      container.appendChild(chip);
    });

  _updateCompareButton();
}

function _toggleSurvey(id, chipEl) {
  if (_selectedIds.has(id)) {
    _selectedIds.delete(id);
    chipEl.classList.remove('compare-chip--selected');
  } else {
    if (_selectedIds.size >= MAX_COMPARE) {
      toast(`Maximum ${MAX_COMPARE} surveys can be compared at once.`, 'info');
      return;
    }
    _selectedIds.add(id);
    chipEl.classList.add('compare-chip--selected');
  }
  _updateCompareButton();
}

function _updateCompareButton() {
  const btn = document.getElementById('compareRunBtn');
  if (!btn) return;
  const count = _selectedIds.size;
  btn.disabled     = count < 2;
  btn.textContent  = count < 2
    ? `Select at least 2 surveys`
    : `Compare ${count} survey${count > 1 ? 's' : ''}`;
}

// ─── Run comparison ───────────────────────────────────────────────────────────

/**
 * runComparison()
 * Call from your "Compare" button click handler.
 */
export async function runComparison() {
  if (typeof Chart === 'undefined') {
    toast('Analytics engine (Chart.js) is still loading or failed to load. Please check your connection.', 'error');
    return;
  }
  if (_selectedIds.size < 2) return;

  const selected = _allSurveys.filter(s => _selectedIds.has(s.id));
  const data     = selected.map((survey, i) => ({
    survey,
    color:   SURVEY_COLORS[i % SURVEY_COLORS.length],
    indices: _calculateIndices(survey),
  }));

  const results = document.getElementById('compareResults');
  if (results) results.style.display = 'block';

  _renderIndicesChart(data);
  _renderSpeciesRichnessChart(data);
  _renderSimilaritySection(data);
  _renderRichnessANOVA(data);
  _renderSpeciesOverlapTable(data);
  _renderIVIComparison(data);

  // Scroll to results.
  document.getElementById('compareResults')?.scrollIntoView({ behavior: 'smooth' });
}

// ─── Index calculations (Shannon, Simpson, Pielou, richness) ─────────────────

function _calculateIndices(survey) {
  // Aggregate all species counts across all quadrats.
  const specieCounts = new Map();

  for (const quadrat of (survey.quadrats || [])) {
    for (const sp of (quadrat.species || [])) {
      const key = sp.name?.toLowerCase().trim();
      if (!key || key === '—') continue;
      specieCounts.set(key, {
        name:   sp.name,
        n:      (specieCounts.get(key)?.n || 0) + (parseInt(sp.abundance) || 0),
        quadrats: new Set([...(specieCounts.get(key)?.quadrats || []), quadrat.id || quadrat.number]),
      });
    }
  }

  const N       = [...specieCounts.values()].reduce((s, v) => s + v.n, 0);
  const S       = specieCounts.size;
  const nQuads  = survey.quadrats?.length || 1;

  if (N === 0 || S === 0) {
    return { H: 0, D: 0, J: 0, S, N, species: [] };
  }

  // Shannon H′ = -Σ(pᵢ × ln(pᵢ))
  let H = 0;
  for (const { n } of specieCounts.values()) {
    const p = n / N;
    H -= p * Math.log(p);
  }

  // Simpson λ (finite sample) = Σ[n(n-1)] / [N(N-1)]
  let sumNiNi1 = 0;
  for (const { n } of specieCounts.values()) {
    sumNiNi1 += n * (n - 1);
  }
  const D = N > 1 ? sumNiNi1 / (N * (N - 1)) : 0;

  // Pielou J′ = H′ / ln(S)
  const J = S > 1 ? H / Math.log(S) : 1;

  // Species list for overlap table.
  const species = [...specieCounts.entries()].map(([key, v]) => ({
    key,
    name:  v.name,
    relFreq: v.quadrats.size / nQuads,
  }));

  return {
    H: parseFloat(H.toFixed(3)),
    D: parseFloat((D > 0 ? 1 / D : 0).toFixed(3)),
    J: parseFloat(J.toFixed(3)),
    S,
    N,
    species,
  };
}

// ─── Chart: indices side by side ─────────────────────────────────────────────

function _renderIndicesChart(data) {
  const canvas = document.getElementById('compareIndicesChart');
  if (!canvas) return;
  _destroyChart('compareIndicesChart');

  const labels   = ["Shannon H′", "1/λ (reciprocal)", "Pielou J′"];
  const datasets = data.map(({ survey, color, indices }) => ({
    label:           survey.name,
    data:            [indices.H, indices.D, indices.J],
    backgroundColor: color + 'CC',
    borderColor:     color,
    borderWidth:     1,
    borderRadius:    4,
  }));

  _comparisonCharts['compareIndicesChart'] = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Biodiversity indices', font: { size: 14, weight: '500' } },
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(3)}`
          }
        }
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Index value' } },
        x: { grid: { display: false } },
      }
    }
  });
}

// ─── Chart: species richness ──────────────────────────────────────────────────

function _renderSpeciesRichnessChart(data) {
  const canvas = document.getElementById('compareRichnessChart');
  if (!canvas) return;
  _destroyChart('compareRichnessChart');

  _comparisonCharts['compareRichnessChart'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels:   data.map(d => _truncate(d.survey.name, 20)),
      datasets: [{
        label:           'Species richness (S)',
        data:            data.map(d => d.indices.S),
        backgroundColor: data.map(d => d.color + 'CC'),
        borderColor:     data.map(d => d.color),
        borderWidth:     1,
        borderRadius:    4,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Species richness per survey', font: { size: 14, weight: '500' } },
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: 'Species (S)' } },
        x: { grid: { display: false } },
      }
    }
  });
}

// ─── Table: species overlap ───────────────────────────────────────────────────

function _renderSpeciesOverlapTable(data) {
  const container = document.getElementById('compareOverlapTable');
  if (!container) return;

  // Build a union of all species keys.
  const allSpeciesMap = new Map(); // key → canonical name
  data.forEach(({ indices }) => {
    indices.species.forEach(sp => {
      if (!allSpeciesMap.has(sp.key)) allSpeciesMap.set(sp.key, sp.name);
    });
  });

  const allSpecies = [...allSpeciesMap.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));

  // Count how many surveys each species appears in.
  const speciesSurveyCount = new Map();
  allSpecies.forEach(([key]) => {
    const count = data.filter(d => d.indices.species.some(sp => sp.key === key)).length;
    speciesSurveyCount.set(key, count);
  });

  // Sort: shared species first, then unique.
  allSpecies.sort(([keyA], [keyB]) =>
    speciesSurveyCount.get(keyB) - speciesSurveyCount.get(keyA)
  );

  const headerCells = data.map(({ survey, color }) =>
    `<th style="color:${color}">${escapeHtml(_truncate(survey.name, 14))}</th>`
  ).join('');

  const rows = allSpecies.map(([key, name]) => {
    const surveyCount = speciesSurveyCount.get(key);
    const cells = data.map(({ indices }) => {
      const sp = indices.species.find(s => s.key === key);
      return sp
        ? `<td class="overlap-present" title="Rel. freq: ${(sp.relFreq * 100).toFixed(0)}%">✓</td>`
        : `<td class="overlap-absent">—</td>`;
    }).join('');

    const sharedClass = surveyCount === data.length ? 'overlap-row--shared' : '';
    return `<tr class="${sharedClass}">
      <td class="overlap-name">${escapeHtml(name)}</td>
      ${cells}
      <td class="overlap-count">${surveyCount}/${data.length}</td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="compare-section-title">Species overlap</div>
    <div class="compare-table-wrap">
      <table class="overlap-table">
        <thead>
          <tr>
            <th>Species</th>
            ${headerCells}
            <th>In surveys</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="overlap-legend">Highlighted rows: species present in all selected surveys</p>
  `;
}

// ─── IVI comparison for a target species ─────────────────────────────────────

function _renderIVIComparison(data) {
  const container = document.getElementById('compareIVISection');
  if (!container) return;

  // Find all species present in at least one survey.
  const allSpeciesNames = [...new Set(
    data.flatMap(d => d.indices.species.map(sp => sp.name))
  )].sort();

  if (allSpeciesNames.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <div class="compare-section-title">IVI by species</div>
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
      <select id="compareIVISpeciesSelect" style="flex:1;font-size:13px">
        ${allSpeciesNames.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}
      </select>
    </div>
    <canvas id="compareIVIChart"></canvas>
  `;

  const select = document.getElementById('compareIVISpeciesSelect');
  select.addEventListener('change', () => _updateIVIChart(data, select.value));
  _updateIVIChart(data, allSpeciesNames[0]);
}

function _updateIVIChart(data, targetSpecies) {
  const canvas = document.getElementById('compareIVIChart');
  if (!canvas) return;
  _destroyChart('compareIVIChart');

  const iviValues = data.map(({ survey, indices }) => {
    return _calculateIVIForSpecies(survey, targetSpecies, indices.N);
  });

  _comparisonCharts['compareIVIChart'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels:   data.map(d => _truncate(d.survey.name, 20)),
      datasets: [{
        label:           `IVI — ${targetSpecies}`,
        data:            iviValues,
        backgroundColor: data.map(d => d.color + 'CC'),
        borderColor:     data.map(d => d.color),
        borderWidth: 1, borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: false },
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` IVI: ${ctx.parsed.y.toFixed(1)}` } }
      },
      scales: {
        y: { beginAtZero: true, max: 300,
             title: { display: true, text: 'IVI (max 300)' } },
        x: { grid: { display: false } },
      }
    }
  });
}

// ─── Similarity & Stats (Jaccard, Bray-Curtis, ANOVA) ─────────────────────────

function _renderSimilaritySection(data) {
  const container = document.getElementById('compareOverlapTable'); 
  // I'll append it before the overlap table
  if (!container) return;
  
  const simDiv = document.createElement('div');
  simDiv.className = 'compare-similarity-wrap';
  
  let html = '<div class="compare-section-title">Community Similarity Matrix</div><div class="compare-table-wrap"><table class="similarity-table"><thead><tr><th>Survey pairs</th><th>Jaccard</th><th>Bray-Curtis</th></tr></thead><tbody>';
  
  for (let i = 0; i < data.length; i++) {
    for (let j = i + 1; j < data.length; j++) {
      const s1 = data[i], s2 = data[j];
      const jaccard = _calcJaccard(s1, s2);
      const bray = _calcBrayCurtis(s1, s2);
      html += `<tr><td>${_truncate(s1.survey.name,12)} vs ${_truncate(s2.survey.name,12)}</td><td>${jaccard.toFixed(3)}</td><td>${bray.toFixed(3)}</td></tr>`;
    }
  }
  html += '</tbody></table></div>';
  simDiv.innerHTML = html;
  container.parentElement.insertBefore(simDiv, container);
}

function _calcJaccard(d1, d2) {
  const set1 = new Set(d1.indices.species.map(s => s.key));
  const set2 = new Set(d2.indices.species.map(s => s.key));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size ? intersection.size / union.size : 0;
}

function _calcBrayCurtis(d1, d2) {
  const m1 = new Map(d1.indices.species.map(s => [s.key, s.n || 0]));
  const m2 = new Map(d2.indices.species.map(s => [s.key, s.n || 0]));
  const allKeys = new Set([...m1.keys(), ...m2.keys()]);
  
  let sumMin = 0, sumTotal = 0;
  allKeys.forEach(k => {
    const v1 = m1.get(k) || 0;
    const v2 = m2.get(k) || 0;
    sumMin += Math.min(v1, v2);
    sumTotal += v1 + v2;
  });
  return sumTotal ? 1 - (2 * sumMin / sumTotal) : 0;
}

function _renderRichnessANOVA(data) {
  const container = document.getElementById('compareIVISection');
  if (!container) return;

  const validData = data.filter(d => d.survey.quadrats && d.survey.quadrats.length > 2);
  if (validData.length < 2) return;

  // Calculate richness per quadrat for each survey
  const samples = validData.map(d => d.survey.quadrats.map(q => {
    const seen = new Set();
    if (q.species) q.species.forEach(sp => { if (sp.name) seen.add(sp.name); });
    return seen.size;
  }));

  const N = samples.reduce((acc, s) => acc + s.length, 0);
  const K = samples.length;
  const grandMean = samples.flat().reduce((a, b) => a + b, 0) / N;

  let ssw = 0; // sum of squares within
  let ssb = 0; // sum of squares between
  samples.forEach(s => {
    const mean = s.reduce((a, b) => a + b, 0) / s.length;
    ssb += s.length * Math.pow(mean - grandMean, 2);
    s.forEach(val => ssw += Math.pow(val - mean, 2));
  });

  const dfb = K - 1;
  const dfw = N - K;
  const msb = ssb / dfb;
  const msw = ssw / dfw;
  const fValue = msw ? msb / msw : 0;

  const anovaHTML = `
    <div class="compare-anova-card">
      <div class="compare-section-title">Statistical Significance (Richness ANOVA)</div>
      <div class="anova-stats">
        <div class="anova-stat"><span>F-Value:</span> <strong>${fValue.toFixed(2)}</strong></div>
        <div class="anova-stat"><span>df:</span> <strong>${dfb}, ${dfw}</strong></div>
      </div>
      <p class="anova-note">Compares species richness variance across plots between selected surveys.</p>
    </div>
  `;
  const div = document.createElement('div');
  div.innerHTML = anovaHTML;
  container.parentElement.insertBefore(div, container);
}

// ─── Export comparison ────────────────────────────────────────────────────────

export function exportComparisonJSON() {
  if (_selectedIds.size < 2) { toast('Select surveys to compare first.', 'info'); return; }

  const selected = _allSurveys.filter(s => _selectedIds.has(s.id));
  const output   = {
    exportedAt: new Date().toISOString(),
    surveys: selected.map(survey => ({
      id:      survey.id,
      name:    survey.name,
      indices: _calculateIndices(survey),
    }))
  };

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `fc-comparison-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _destroyChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const existing = _comparisonCharts[canvasId] || (typeof Chart !== 'undefined' ? Chart.getChart(canvas) : null);
  if (existing) { existing.destroy(); delete _comparisonCharts[canvasId]; }
}

function _showEmptyState(message) {
  const container = document.getElementById('compareSurveyPicker');
  if (container) container.innerHTML = `<p class="compare-empty">${escapeHtml(message)}</p>`;
}

function _truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _renderEmptyCharts() {
  const results = document.getElementById('compareResults');
  if (results) results.style.display = 'none';
}

export function init() {
  $('#compareRunBtn')?.addEventListener('click', runComparison);
  $('#compareExportBtn')?.addEventListener('click', exportComparisonJSON);
}
