// src/workers/analytics.worker.js

function calculateIndicesPayload(s) {
  if (!s || !s.quadrats || !s.quadrats.length) {
    return { S: 0, H: 0, D: 0, E: 0, margalef: 0, fisherAlpha: 0, chao1: 0, totalN: 0, totalBA: 0, totalArea: 0, iviData: [], dbhClasses: {} };
  }

  const speciesMap = {};
  const totalArea = s.quadrats.reduce((a, q) => a + (parseFloat(q.size) || 0), 0) / 10000;
  let totalN = 0;
  let totalAGB = 0;
  let regenCounts = { seedling: 0, sapling: 0, tree: 0 };
  let allDBH = [];

  s.quadrats.forEach((q, qi) => {
    if (q.species) q.species.forEach(sp => {
      if (!sp.name) return;
      const k = sp.name;
      if (!speciesMap[k]) speciesMap[k] = { abundance: 0, dbhSum: 0, dbhCount: 0, basalArea: 0, quadrats: new Set() };
      const abundance = parseInt(sp.abundance) || 0;
      speciesMap[k].abundance += abundance;
      totalN += abundance;
      
      const stage = (sp.stage || '').toLowerCase();
      if (regenCounts.hasOwnProperty(stage)) {
        regenCounts[stage] += abundance;
      }
      
      let dbhVal = parseFloat(sp.dbh) || 0;
      let hVal = parseFloat(sp.height) || 0;
      if (dbhVal > 0) {
        for(let i=0; i<abundance; i++) allDBH.push(dbhVal);
        let treeAGB = 0;
        const rho = 0.65;
        if (hVal > 0) {
           treeAGB = 0.0673 * Math.pow((rho * dbhVal * dbhVal * hVal), 0.976);
        } else {
           treeAGB = Math.exp(-2.289 + 2.649*Math.log(dbhVal) - 0.021*Math.pow(Math.log(dbhVal), 2));
        }
        totalAGB += (treeAGB * abundance);
      }

      if (parseFloat(sp.dbh) > 0) {
        speciesMap[k].dbhSum += parseFloat(sp.dbh);
        speciesMap[k].dbhCount++;
        const stemBA = Math.PI * Math.pow(parseFloat(sp.dbh) / 200, 2);
        speciesMap[k].basalArea += stemBA * (abundance || 1);
      }
      speciesMap[k].quadrats.add(qi);
    });
  });

  const speciesList = Object.keys(speciesMap);
  const S = speciesList.length;

  let H = 0;
  if (totalN > 0) {
    speciesList.forEach(k => {
      const pi = speciesMap[k].abundance / totalN;
      if (pi > 0) H -= pi * Math.log(pi);
    });
  }

  let D = 0;
  if (totalN > 1) {
    speciesList.forEach(k => {
      const n = speciesMap[k].abundance;
      D += n * (n - 1);
    });
    D = D / (totalN * (totalN - 1));
  }

  const E = S > 1 && totalN > 0 ? H / Math.log(S) : (S === 1 && totalN > 0 ? 1 : 0);

  let totalBA = 0;
  speciesList.forEach(k => totalBA += speciesMap[k].basalArea);

  const margalef = (S > 0 && totalN > 1) ? (S - 1) / Math.log(totalN) : 0;

  let fisherAlpha = 0;
  if (S > 0 && totalN > S) {
    let alpha = margalef > 0 ? margalef : 1;
    for (let iter = 0; iter < 100; iter++) {
      const ratio = totalN / alpha;
      const lnTerm = Math.log(1 + ratio);
      const f = alpha * lnTerm - S;
      const fPrime = lnTerm - totalN / (alpha + totalN);
      if (Math.abs(fPrime) < 1e-15) break;
      const delta = f / fPrime;
      alpha -= delta;
      if (alpha <= 0) alpha = 0.01;
      if (Math.abs(delta) < 1e-8) break;
    }
    fisherAlpha = alpha;
  }

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
    chao1 = S + f1 * (f1 - 1) / 2;
  }

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

  let qmd = 0;
  let sdi = 0;
  if (allDBH.length > 0) {
    const sumD2 = allDBH.reduce((sum, d) => sum + (d * d), 0);
    qmd = Math.sqrt(sumD2 / allDBH.length);
    const nPerHa = totalArea > 0 ? (allDBH.length / totalArea) : allDBH.length;
    sdi = nPerHa * Math.pow((qmd / 25), 1.605);
  }

  const carbonHa = totalArea > 0 ? ((totalAGB * 0.47) / 1000) / totalArea : 0;
  const agbHa = totalArea > 0 ? (totalAGB / 1000) / totalArea : 0;

  let transectCover = 0;
  let transectGap = 0;
  if (s.transects && s.transects.length > 0) {
     let totalLength = 0;
     let totalCoveredLength = 0;
     s.transects.forEach(t => {
       const len = parseFloat(t.length) || 0;
       if (len <= 0) return;
       totalLength += len;
       if (t.intercepts && t.intercepts.length > 0) {
          let intervals = t.intercepts.map(i => [parseFloat(i.startDist)||0, parseFloat(i.endDist)||0]);
          intervals = intervals.filter(iv => iv[1] > iv[0]);
          intervals.sort((a,b) => a[0] - b[0]);
          let merged = [];
          if (intervals.length > 0) {
            let current = intervals[0];
            for(let i=1; i<intervals.length; i++) {
               if (intervals[i][0] <= current[1]) {
                  current[1] = Math.max(current[1], intervals[i][1]);
               } else {
                  merged.push(current);
                  current = intervals[i];
               }
            }
            merged.push(current);
          }
          let tCover = merged.reduce((sum, iv) => sum + (Math.min(iv[1], len) - Math.min(iv[0], len)), 0);
          totalCoveredLength += tCover;
       }
     });

     if (totalLength > 0) {
        transectCover = (totalCoveredLength / totalLength) * 100;
        transectGap = 100 - transectCover;
     }
  }

  return { S, H, D, E, margalef, fisherAlpha, chao1, totalN, totalBA, totalArea, iviData, dbhClasses, speciesList, carbonHa, agbHa, qmd, sdi, regenCounts, transectCover, transectGap };
}

self.addEventListener('message', (e) => {
  const result = calculateIndicesPayload(e.data);
  self.postMessage(result);
});
