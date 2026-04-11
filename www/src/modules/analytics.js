// src/modules/analytics.js

import { $, esc } from './ui.js';

export function refreshAnalytics(s) {
  if (!s || !s.quadrats || !s.quadrats.length) {
    const ids = ['analyticRichness', 'analyticShannon', 'analyticSimpson', 'analyticSimpsonDiv', 'analyticEvenness', 'analyticMargalef', 'analyticFisher', 'analyticChao1', 'analyticTotalN'];
    ids.forEach(id => { if ($( '#' + id)) $( '#' + id).textContent = id === 'analyticRichness' || id === 'analyticTotalN' || id === 'analyticChao1' ? '0' : '0.000'; });
    if ($('#analyticBasalTotal')) $('#analyticBasalTotal').textContent = '0.000 m²';
    if ($('#analyticBasalHa')) $('#analyticBasalHa').textContent = '0.000 m²/ha';
    if ($('#iviTableBody')) $('#iviTableBody').innerHTML = '<tr><td colspan="8" class="table-empty">No data</td></tr>';
    if ($('#dbhChart')) $('#dbhChart').innerHTML = '<div class="chart-empty">No DBH data</div>';
    if ($('#speciesAccumChart')) $('#speciesAccumChart').innerHTML = '<div class="chart-empty">No data</div>';
    return;
  }

  const speciesMap = {};
  const totalArea = s.quadrats.reduce((a, q) => a + (parseFloat(q.size) || 0), 0) / 10000;
  let totalN = 0;

  s.quadrats.forEach((q, qi) => {
    if (q.species) q.species.forEach(sp => {
      if (!sp.name) return;
      const k = sp.name;
      if (!speciesMap[k]) speciesMap[k] = { abundance: 0, dbhSum: 0, dbhCount: 0, basalArea: 0, quadrats: new Set() };
      const abundance = parseInt(sp.abundance) || 0;
      speciesMap[k].abundance += abundance;
      totalN += abundance;
      if (parseFloat(sp.dbh) > 0) {
        speciesMap[k].dbhSum += parseFloat(sp.dbh);
        speciesMap[k].dbhCount++;
        // Basal area: per-stem BA = π × (DBH_cm / 200)² in m², then multiply by stem count
        // This is correct when all stems in this entry share the same DBH.
        // For mixed-DBH entries, each should be a separate species entry.
        const stemBA = Math.PI * Math.pow(parseFloat(sp.dbh) / 200, 2);
        speciesMap[k].basalArea += stemBA * (abundance || 1);
      }
      speciesMap[k].quadrats.add(qi);
    });
  });

  const speciesList = Object.keys(speciesMap).filter(k => speciesMap[k].abundance > 0);
  const S = speciesList.length;

  // Shannon-Wiener
  let H = 0;
  if (totalN > 0) {
    speciesList.forEach(k => {
      const pi = speciesMap[k].abundance / totalN;
      if (pi > 0) H -= pi * Math.log(pi);
    });
  }

  // Simpson
  // Simpson λ (finite sample) = Σ[n(n-1)] / [N(N-1)]
  // When N ≤ 1, D = 0 (no dominance measurable with a single individual)
  let D = 0;
  if (totalN > 1) {
    speciesList.forEach(k => {
      const n = speciesMap[k].abundance;
      D += n * (n - 1);
    });
    D = D / (totalN * (totalN - 1));
  }

  // Pielou Evenness J' = H'/ln(S)
  // When S = 1, J' = 1 by convention (single species = perfectly "even")
  const E = S > 1 && totalN > 0 ? H / Math.log(S) : (S === 1 && totalN > 0 ? 1 : 0);

  // Basal area total
  let totalBA = 0;
  speciesList.forEach(k => totalBA += speciesMap[k].basalArea);

  // Margalef's richness index: d = (S - 1) / ln(N)
  const margalef = (S > 0 && totalN > 1) ? (S - 1) / Math.log(totalN) : 0;

  // ─── Fisher's alpha ───
  // Solve: S = α × ln(1 + N/α) using Newton-Raphson iteration
  // The function f(α) = α × ln(1 + N/α) - S = 0
  // Derivative f'(α) = ln(1 + N/α) - N/(α + N)
  let fisherAlpha = 0;
  if (S > 0 && totalN > S) {
    // Initial guess: start with Margalef as approximation
    let alpha = margalef > 0 ? margalef : 1;
    for (let iter = 0; iter < 100; iter++) {
      const ratio = totalN / alpha;
      const lnTerm = Math.log(1 + ratio);
      const f = alpha * lnTerm - S;
      const fPrime = lnTerm - totalN / (alpha + totalN);
      if (Math.abs(fPrime) < 1e-15) break;
      const delta = f / fPrime;
      alpha -= delta;
      if (alpha <= 0) alpha = 0.01; // prevent negative
      if (Math.abs(delta) < 1e-8) break;
    }
    fisherAlpha = alpha;
  }

  // ─── Chao1 nonparametric richness estimator ───
  // Chao1 = S_obs + f1²/(2·f2)
  // where f1 = number of singletons (species with exactly 1 individual)
  //       f2 = number of doubletons (species with exactly 2 individuals)
  // Bias-corrected form when f2 = 0: Chao1 = S_obs + f1·(f1-1)/2
  let f1 = 0, f2 = 0;
  speciesList.forEach(k => {
    const n = speciesMap[k].abundance;
    if (n === 1) f1++;
    if (n === 2) f2++;
  });
  let chao1 = S;
  if (f2 > 0) {
    chao1 = S + (f1 * f1) / (2 * f2);
  } else if (f1 > 0) {
    // Bias-corrected form when no doubletons exist
    chao1 = S + f1 * (f1 - 1) / 2;
  }

  if ($('#analyticRichness')) $('#analyticRichness').textContent = S;
  if ($('#analyticShannon')) $('#analyticShannon').textContent = totalN > 0 ? H.toFixed(3) : '0.000';
  if ($('#analyticSimpson')) $('#analyticSimpson').textContent = D.toFixed(3);
  if ($('#analyticSimpsonDiv')) $('#analyticSimpsonDiv').textContent = D > 0 ? (1 / D).toFixed(3) : '0.000';
  if ($('#analyticEvenness')) $('#analyticEvenness').textContent = E.toFixed(3);
  if ($('#analyticMargalef')) $('#analyticMargalef').textContent = margalef.toFixed(3);
  if ($('#analyticFisher')) $('#analyticFisher').textContent = fisherAlpha.toFixed(3);
  if ($('#analyticChao1')) $('#analyticChao1').textContent = chao1.toFixed(1);
  if ($('#analyticTotalN')) $('#analyticTotalN').textContent = totalN;
  if ($('#analyticBasalTotal')) $('#analyticBasalTotal').textContent = totalBA.toFixed(4) + ' m²';
  if ($('#analyticBasalHa')) $('#analyticBasalHa').textContent = (totalArea > 0 ? (totalBA / totalArea).toFixed(3) : '—') + ' m²/ha';

  // IVI Table
  const nQuad = s.quadrats.length;
  let iviData = [];
  speciesList.forEach(k => {
    const d2 = speciesMap[k];
    const density = totalArea > 0 ? d2.abundance / totalArea : d2.abundance;
    const freq = d2.quadrats.size / nQuad;
    const dom = totalArea > 0 ? d2.basalArea / totalArea : d2.basalArea;
    iviData.push({ name: k, density, freq, dom, abundance: d2.abundance, basalArea: d2.basalArea });
  });

  const totalDensity = iviData.reduce((a, x) => a + x.density, 0);
  const totalFreq = iviData.reduce((a, x) => a + x.freq, 0);
  const totalDom = iviData.reduce((a, x) => a + x.dom, 0);

  iviData.forEach(x => {
    x.relDensity = totalDensity ? (x.density / totalDensity) * 100 : 0;
    x.relFreq = totalFreq ? (x.freq / totalFreq) * 100 : 0;
    x.relDom = totalDom ? (x.dom / totalDom) * 100 : 0;
    x.ivi = x.relDensity + x.relFreq + x.relDom;
  });
  iviData.sort((a, b) => b.ivi - a.ivi);

  if ($('#iviTableBody')) {
    $('#iviTableBody').innerHTML = iviData.map(x => `<tr>
      <td class="species-name-cell">${esc(x.name)}</td>
      <td>${x.density.toFixed(1)}</td>
      <td>${x.relDensity.toFixed(1)}%</td>
      <td>${(x.freq * 100).toFixed(1)}%</td>
      <td>${x.relFreq.toFixed(1)}%</td>
      <td>${x.basalArea.toFixed(4)}</td>
      <td>${x.relDom.toFixed(1)}%</td>
      <td class="ivi-species-highlight">${x.ivi.toFixed(1)}</td>
    </tr>`).join('');
  }

  // DBH Class Distribution
  const dbhClasses = { '0-10': 0, '10-20': 0, '20-30': 0, '30-40': 0, '40-50': 0, '50-60': 0, '60+': 0 };
  s.quadrats.forEach(q => {
    if (q.species) q.species.forEach(sp => {
      const dbh = parseFloat(sp.dbh);
      if (dbh > 0) {
        const cnt = parseInt(sp.abundance) || 1;
        if (dbh < 10) dbhClasses['0-10'] += cnt;
        else if (dbh < 20) dbhClasses['10-20'] += cnt;
        else if (dbh < 30) dbhClasses['20-30'] += cnt;
        else if (dbh < 40) dbhClasses['30-40'] += cnt;
        else if (dbh < 50) dbhClasses['40-50'] += cnt;
        else if (dbh < 60) dbhClasses['50-60'] += cnt;
        else dbhClasses['60+'] += cnt;
      }
    });
  });
  const maxDBH = Math.max(...Object.values(dbhClasses), 1);
  if ($('#dbhChart')) {
    $('#dbhChart').innerHTML = Object.entries(dbhClasses).map(([k, v]) => `<div class="bar-col">
      <div class="bar-val">${v}</div>
      <div class="bar-fill" style="height:${(v / maxDBH) * 140}px;"></div>
      <div class="bar-label">${k}</div>
    </div>`).join('');
  }

  // Randomized Rarefaction Curve (100 permutations)
  if ($('#speciesAccumChart')) {
    const numQuads = s.quadrats.length;
    const rarefactionData = new Array(numQuads).fill(0);
    const permutations = 100;

    for (let p = 0; p < permutations; p++) {
      // Shuffle indices
      const indices = Array.from({ length: numQuads }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      const seenInPerm = new Set();
      for (let k = 0; k < numQuads; k++) {
        const qIdx = indices[k];
        const q = s.quadrats[qIdx];
        if (q.species) q.species.forEach(sp => { if (sp.name) seenInPerm.add(sp.name); });
        rarefactionData[k] += seenInPerm.size;
      }
    }

    const points = rarefactionData.map((sum, i) => ({
      x: i + 1,
      y: sum / permutations
    }));

    const maxY = Math.max(...points.map(p => p.y), 1);
    $('#speciesAccumChart').innerHTML = points.map(p => `<div class="bar-col">
      <div class="bar-val">${p.y.toFixed(1)}</div>
      <div class="bar-fill" style="height:${(p.y / maxY) * 140}px;background:linear-gradient(180deg,var(--cyan),var(--emerald));"></div>
      <div class="bar-label">Q${p.x}</div>
    </div>`).join('');
  }
}
