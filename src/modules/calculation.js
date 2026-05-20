// src/modules/calculation.js

import { $, toast } from './ui.js';
import { Store } from './storage.js';

export function init() {
  const btnRun = $('#btnRunCalculations');
  const btnExport = $('#btnExportCalculations');
  
  if (btnRun) {
    btnRun.addEventListener('click', async () => {
      await runCalculations();
    });
  }

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      exportCalculations();
    });
  }
}

let lastCalcResults = null;

async function runCalculations() {
  const survey = await Store.getActive();
  if (!survey) {
    toast('No active survey selected', true);
    return;
  }

  let totalQuadratSpeciesCount = 0;
  let totalQuadratCover = 0;
  let quadratCount = 0;
  const speciesAbundanceMap = new Map(); // name -> total abundance

  // Aggregate Quadrat Data
  if (survey.quadrats && survey.quadrats.length > 0) {
    quadratCount = survey.quadrats.length;
    survey.quadrats.forEach(q => {
      if (q.species) {
        q.species.forEach(sp => {
          if (sp.name && sp.name !== '—') {
            totalQuadratCover += (sp.cover || 0);
            const count = sp.abundance || 1;
            totalQuadratSpeciesCount += count;
            speciesAbundanceMap.set(sp.name, (speciesAbundanceMap.get(sp.name) || 0) + count);
          }
        });
      }
    });
  }

  // Calculate Indices
  let simpsonD = 0;
  let shannonH = 0;
  const speciesRichness = speciesAbundanceMap.size;
  const N = totalQuadratSpeciesCount;

  if (N > 1 && speciesRichness > 0) {
    let sumNn_1 = 0;
    speciesAbundanceMap.forEach((count, name) => {
      // Simpson: sum( n(n-1) ) / N(N-1)
      sumNn_1 += count * (count - 1);
      
      // Shannon: -sum( p_i * ln(p_i) )
      const pi = count / N;
      if (pi > 0) {
        shannonH -= (pi * Math.log(pi));
      }
    });
    
    simpsonD = 1 - (sumNn_1 / (N * (N - 1)));
  }

  const avgCover = quadratCount > 0 ? (totalQuadratCover / quadratCount) : 0;

  // Aggregate Transect Data
  let totalIntercepts = 0;
  let totalTransectLength = 0;
  if (survey.transects && survey.transects.length > 0) {
    survey.transects.forEach(t => {
      totalTransectLength += (t.length || 0);
      if (t.intercepts) {
        totalIntercepts += t.intercepts.length;
      }
    });
  }

  // Display results
  if ($('#calcSimpson')) $('#calcSimpson').textContent = simpsonD.toFixed(3);
  if ($('#calcShannon')) $('#calcShannon').textContent = shannonH.toFixed(3);
  if ($('#calcRichness')) $('#calcRichness').textContent = speciesRichness.toString();
  if ($('#calcAvgCover')) $('#calcAvgCover').textContent = avgCover.toFixed(1) + '%';
  if ($('#calcIntercepts')) $('#calcIntercepts').textContent = totalIntercepts.toString();
  if ($('#calcTransectLength')) $('#calcTransectLength').textContent = totalTransectLength.toFixed(1) + 'm';

  $('#calcResults').style.display = 'block';
  
  // Store for export
  lastCalcResults = {
    surveyName: survey.name || 'Unnamed',
    simpsonD: simpsonD.toFixed(3),
    shannonH: shannonH.toFixed(3),
    speciesRichness,
    avgCover: avgCover.toFixed(1),
    totalIntercepts,
    totalTransectLength: totalTransectLength.toFixed(1)
  };

  toast('Calculations complete');
}

function exportCalculations() {
  if (!lastCalcResults) {
    toast('Run calculations first', true);
    return;
  }

  const csvRows = [
    ['Metric', 'Value'],
    ['Survey Name', lastCalcResults.surveyName],
    ['Simpson Diversity Index (1-D)', lastCalcResults.simpsonD],
    ['Shannon-Wiener Index (H)', lastCalcResults.shannonH],
    ['Species Richness (S)', lastCalcResults.speciesRichness],
    ['Average Quadrat Cover (%)', lastCalcResults.avgCover],
    ['Total Transect Intercepts', lastCalcResults.totalIntercepts],
    ['Total Transect Length (m)', lastCalcResults.totalTransectLength]
  ];

  const csvString = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', `Calculations_${lastCalcResults.surveyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('Calculations exported');
}
