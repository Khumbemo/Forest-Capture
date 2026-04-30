// src/modules/export.js

import { $, esc, toast, fcConfirm } from './ui.js';
import { dl } from './utils.js';
import { Store, getWps } from './storage.js';
import { t } from './i18n.js';

export async function refreshPreview() {
  const s = await Store.getActive();
  const p = $('#dataPreview');
  if (!s) {
    p.innerHTML = `<div class="empty-state small"><p>${t('Select survey')}</p></div>`;
    return;
  }
  p.textContent = JSON.stringify(s, null, 2);
}

export function toCSV(s) {
  const rows = [['Survey', 'Date', 'Location', 'Investigator', 'Q#', 'Size', 'MeasDate', 'Observer', 'Species', 'Stage', 'Status', 'Phenology', 'Abundance', 'Stems', 'DBH', 'DBH_MeasHt', 'GBH', 'Height', 'CrownClass', 'CrownDiam', 'Distance', 'Azimuth', 'Health', 'Bark', 'DecayClass', 'GPS', 'Cover%', 'Stratum']];
  if (s.quadrats) s.quadrats.forEach(q => {
    if (q.species) q.species.forEach(sp => {
      rows.push([s.name, s.date, s.location, s.investigator || '', q.number, q.size, q.measDate || '', q.observer || '', sp.name, sp.stage, sp.status || 'live', sp.phenology || '', sp.abundance, sp.stems || 1, sp.dbh, sp.dbhMeasHeight || 1.3, sp.gbh || 0, sp.height, sp.crownClass || '', sp.crownDiameter || 0, sp.distance || 0, sp.azimuth || 0, sp.health || '', sp.bark || '', sp.decayClass || 0, q.gps || '', sp.cover || 0, sp.stratum || '']);
    });
  });
  // Transect data as additional CSV rows
  if (s.transects && s.transects.length) {
    rows.push([]);
    rows.push(['--- TRANSECT DATA ---']);
    rows.push(['Survey', 'T#', 'Method', 'Length', 'Width', 'Bearing', 'Slope', 'MeasDate', 'Observer', 'Species', 'LifeForm', 'IntType', 'StartDist', 'EndDist', 'Distance', 'Cover%', 'Height', 'DBH', 'Abundance', 'Stratum', 'Substrate', 'PerpDist', 'Notes']);
    s.transects.forEach(t => {
      if (t.intercepts) t.intercepts.forEach(int => {
        rows.push([s.name, t.number, t.type || 'belt', t.length, t.width, t.bearing, t.slope || 0, t.measDate || '', t.observer || '', int.name, int.lifeForm || '', int.interceptType || '', int.startDist || 0, int.endDist || 0, int.distance, int.cover, int.height || 0, int.dbh || 0, int.abundance || 0, int.stratum || '', int.substrate || '', int.perpDistance || 0, int.notes || '']);
      });
    });
  }
  return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export async function exportSurveyCSV() {
  const s = await Store.getActive();
  if (!s) { toast(t('No active survey'), true); return; }
  
  if (window.XLSX) {
    const rows = [['Survey', 'Date', 'Location', 'Investigator', 'Q#', 'Size', 'MeasDate', 'Observer', 'Species', 'Stage', 'Status', 'Phenology', 'Abundance', 'Stems', 'DBH', 'DBH_MeasHt', 'GBH', 'Height', 'CrownClass', 'CrownDiam', 'Distance', 'Azimuth', 'Health', 'Bark', 'DecayClass', 'GPS', 'Cover%', 'Stratum']];
    if (s.quadrats) s.quadrats.forEach(q => {
      if (q.species) q.species.forEach(sp => {
        rows.push([s.name, s.date, s.location, s.investigator || '', q.number, q.size, q.measDate || '', q.observer || '', sp.name, sp.stage, sp.status || 'live', sp.phenology || '', sp.abundance, sp.stems || 1, sp.dbh, sp.dbhMeasHeight || 1.3, sp.gbh || 0, sp.height, sp.crownClass || '', sp.crownDiameter || 0, sp.distance || 0, sp.azimuth || 0, sp.health || '', sp.bark || '', sp.decayClass || 0, q.gps || '', sp.cover || 0, sp.stratum || '']);
      });
    });

    const wb = window.XLSX.utils.book_new();
    const wsQuadrat = window.XLSX.utils.aoa_to_sheet(rows);
    window.XLSX.utils.book_append_sheet(wb, wsQuadrat, "Quadrats");

    if (s.transects && s.transects.length) {
      const tRows = [['Survey', 'T#', 'Method', 'Length', 'Width', 'Bearing', 'Slope', 'MeasDate', 'Observer', 'Species', 'LifeForm', 'IntType', 'StartDist', 'EndDist', 'Distance', 'Cover%', 'Height', 'DBH', 'Abundance', 'Stratum', 'Substrate', 'PerpDist', 'Notes']];
      s.transects.forEach(t => {
        if (t.intercepts) t.intercepts.forEach(int => {
          tRows.push([s.name, t.number, t.type || 'belt', t.length, t.width, t.bearing, t.slope || 0, t.measDate || '', t.observer || '', int.name, int.lifeForm || '', int.interceptType || '', int.startDist || 0, int.endDist || 0, int.distance, int.cover, int.height || 0, int.dbh || 0, int.abundance || 0, int.stratum || '', int.substrate || '', int.perpDistance || 0, int.notes || '']);
        });
      });
      const wsTransect = window.XLSX.utils.aoa_to_sheet(tRows);
      window.XLSX.utils.book_append_sheet(wb, wsTransect, "Transects");
    }

    const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await dl(wbout, s.name.replace(/\W/g, '_') + '_survey.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    toast(t('Exporting Excel (XLSX)...'));
  } else {
    await dl(toCSV(s), s.name.replace(/\W/g, '_') + '_survey.csv', 'text/csv');
    toast(t('Exporting CSV...'));
  }
}

export async function exportSurveyJSON() {
  const s = await Store.getActive();
  if (!s) { toast(t('No active survey'), true); return; }
  await dl(JSON.stringify(s, null, 2), s.name.replace(/\W/g, '_') + '_survey.json', 'application/json');
  toast(t('Exporting JSON...'));
}

export async function exportAllSurveysCSV() {
  const sv = await Store.getSurveys();
  if (!sv.length) { toast(t('No surveys to export'), true); return; }
  
  if (window.XLSX) {
    const rows = [['Survey', 'Date', 'Location', 'Investigator', 'Q#', 'Size', 'MeasDate', 'Observer', 'Species', 'Stage', 'Status', 'Phenology', 'Abundance', 'Stems', 'DBH', 'DBH_MeasHt', 'GBH', 'Height', 'CrownClass', 'CrownDiam', 'Distance', 'Azimuth', 'Health', 'Bark', 'DecayClass', 'GPS', 'Cover%', 'Stratum']];
    sv.forEach(s => {
      if (s.quadrats) s.quadrats.forEach(q => {
        if (q.species) q.species.forEach(sp => {
          rows.push([s.name, s.date, s.location, s.investigator || '', q.number, q.size, q.measDate || '', q.observer || '', sp.name, sp.stage, sp.status || 'live', sp.phenology || '', sp.abundance, sp.stems || 1, sp.dbh, sp.dbhMeasHeight || 1.3, sp.gbh || 0, sp.height, sp.crownClass || '', sp.crownDiameter || 0, sp.distance || 0, sp.azimuth || 0, sp.health || '', sp.bark || '', sp.decayClass || 0, q.gps || '', sp.cover || 0, sp.stratum || '']);
        });
      });
    });

    const wb = window.XLSX.utils.book_new();
    const wsQuadrat = window.XLSX.utils.aoa_to_sheet(rows);
    window.XLSX.utils.book_append_sheet(wb, wsQuadrat, "All_Quadrats");

    const tRows = [['Survey', 'T#', 'Method', 'Length', 'Width', 'Bearing', 'Slope', 'MeasDate', 'Observer', 'Species', 'LifeForm', 'IntType', 'StartDist', 'EndDist', 'Distance', 'Cover%', 'Height', 'DBH', 'Abundance', 'Stratum', 'Substrate', 'PerpDist', 'Notes']];
    sv.forEach(s => {
      if (s.transects && s.transects.length) {
        s.transects.forEach(t => {
          if (t.intercepts) t.intercepts.forEach(int => {
            tRows.push([s.name, t.number, t.type || 'belt', t.length, t.width, t.bearing, t.slope || 0, t.measDate || '', t.observer || '', int.name, int.lifeForm || '', int.interceptType || '', int.startDist || 0, int.endDist || 0, int.distance, int.cover, int.height || 0, int.dbh || 0, int.abundance || 0, int.stratum || '', int.substrate || '', int.perpDistance || 0, int.notes || '']);
          });
        });
      }
    });
    if (tRows.length > 1) {
      const wsTransect = window.XLSX.utils.aoa_to_sheet(tRows);
      window.XLSX.utils.book_append_sheet(wb, wsTransect, "All_Transects");
    }

    const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await dl(wbout, 'all_surveys.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    toast(t('Exporting All Surveys Excel (XLSX)...'));
  } else {
    const header = ['Survey', 'Date', 'Location', 'Investigator', 'Q#', 'Size', 'MeasDate', 'Observer', 'Species', 'Stage', 'Status', 'Phenology', 'Abundance', 'Stems', 'DBH', 'DBH_MeasHt', 'GBH', 'Height', 'CrownClass', 'CrownDiam', 'Distance', 'Azimuth', 'Health', 'Bark', 'DecayClass', 'GPS', 'Cover%', 'Stratum']
      .map(c => `"${c}"`).join(',');
    const dataRows = sv.flatMap(s => {
      const rows = [];
      if (s.quadrats) s.quadrats.forEach(q => {
        if (q.species) q.species.forEach(sp => {
          rows.push([s.name, s.date, s.location, s.investigator || '', q.number, q.size, q.measDate || '', q.observer || '', sp.name, sp.stage, sp.status || 'live', sp.phenology || '', sp.abundance, sp.stems || 1, sp.dbh, sp.dbhMeasHeight || 1.3, sp.gbh || 0, sp.height, sp.crownClass || '', sp.crownDiameter || 0, sp.distance || 0, sp.azimuth || 0, sp.health || '', sp.bark || '', sp.decayClass || 0, q.gps || '', sp.cover || 0, sp.stratum || '']
            .map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));
        });
      });
      return rows;
    });
    const bom = '\uFEFF';
    await dl(bom + header + '\n' + dataRows.join('\n'), 'all_surveys.csv', 'text/csv;charset=utf-8');
    toast(t('Exporting All Surveys CSV...'));
  }
}

function xmlEsc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function exportGPX() {
  const w = await getWps();
  if (!w.length) { toast(t('No waypoints to export'), true); return; }
  let g = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="ForestCapture" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n';
  w.forEach(p => {
    g += `<wpt lat="${p.lat}" lon="${p.lng}"><name>${xmlEsc(p.name)}</name><desc>${xmlEsc(p.type)}</desc><time>${p.time}</time></wpt>\n`;
  });
  g += '</gpx>';
  await dl(g, 'waypoints.gpx', 'application/gpx+xml');
  toast(t('Exporting GPX...'));
}

export async function generateReport() {
  const s = await Store.getActive();
  if (!s) { toast(t('No active survey'), true); return; }

  // Basic calculation for report
  const speciesMap = {}; let totalN = 0;
  if (s.quadrats) s.quadrats.forEach(q => {
    if (q.species) q.species.forEach(sp => {
      if (!sp.name) return;
      if (!speciesMap[sp.name]) speciesMap[sp.name] = { abundance: 0, ba: 0 };
      const abundance = parseInt(sp.abundance) || 0;
      speciesMap[sp.name].abundance += abundance;
      totalN += abundance;
      const dbh = parseFloat(sp.dbh);
      if (dbh > 0) speciesMap[sp.name].ba += Math.PI * Math.pow(dbh / 200, 2) * (abundance || 1);
    });
  });

  const reportRich = Object.keys(speciesMap).filter(k => speciesMap[k].abundance > 0).length;
  let H = 0;
  if (totalN > 0) {
    Object.values(speciesMap).forEach(v => {
      const p = v.abundance / totalN;
      if (p > 0) H -= p * Math.log(p);
    });
  }

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Survey Report — ${esc(s.name)}</title><style>
    body{font-family:'Segoe UI',Roboto,sans-serif;max-width:900px;margin:0 auto;padding:30px;color:#222;background:#f9fbf9;}
    h1{color:#15803d;border-bottom:3px solid #15803d;padding-bottom:12px;margin-bottom:30px;text-align:center;}
    h2{color:#166534;margin-top:40px;border-left:5px solid #166534;padding-left:12px;}
    table{width:100%;border-collapse:collapse;margin:20px 0;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,0.05);}
    th,td{border:1px solid #e2e8f0;padding:12px 15px;text-align:left;font-size:14px;}
    th{background:#f0fdf4;color:#166534;font-weight:700;text-transform:uppercase;font-size:12px;letter-spacing:0.5px;}
    .species{font-style:italic;color:#15803d;font-weight:500;}
    .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:20px 0;}
    .stat-card{background:#fff;padding:20px;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);text-align:center;border:1px solid #e2e8f0;}
    .stat-card h3{margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;}
    .stat-val{margin-top:10px;font-size:24px;font-weight:800;color:#15803d;}
    .footer{margin-top:50px;padding-top:20px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;text-align:center;}
  </style></head><body>`;
  html += `<h1>🌲 Forest Capture — Survey Report</h1><table><tr><th>Survey</th><td>${esc(s.name)}</td></tr><tr><th>Date</th><td>${s.date || ''}</td></tr><tr><th>Location</th><td>${esc(s.location || '')}</td></tr><tr><th>Investigator</th><td>${esc(s.investigator || '')}</td></tr><tr><th>GPS</th><td>${s.gpsCoords || ''}</td></tr></table>`;
  html += `<h2>Summary Statistics</h2><div class="stat-grid">
    <div class="stat-card"><h3>Species Richness (S)</h3><div class="stat-val">${reportRich}</div></div>
    <div class="stat-card"><h3>Total Individuals (N)</h3><div class="stat-val">${totalN}</div></div>
    <div class="stat-card"><h3>Shannon H′</h3><div class="stat-val">${totalN > 0 ? H.toFixed(3) : '—'}</div></div>
  </div>`;

  if (s.quadrats && s.quadrats.length) {
    html += `<h2>Quadrat Data</h2><table><tr><th>Q#</th><th>Size</th><th>Species</th><th>Stage</th><th>Phenology</th><th>Abundance</th><th>DBH</th><th>Height</th></tr>`;
    s.quadrats.forEach(q => {
      if (q.species) q.species.forEach(sp => {
        html += `<tr><td>${q.number}</td><td>${q.size}</td><td class="species">${esc(sp.name)}</td><td>${sp.stage}</td><td>${sp.phenology || ''}</td><td>${sp.abundance}</td><td>${sp.dbh}</td><td>${sp.height}</td></tr>`;
      });
    });
    html += `</table>`;
  }

  if (s.transects && s.transects.length) {
    html += `<h2>Transect Data</h2>`;
    s.transects.forEach(t => {
      html += `<h3 style="color:#166534;margin-top:20px;">Transect #${t.number} — ${esc(t.type || 'belt').replace(/-/g,' ')} (${t.length}m × ${t.width}m, ${t.bearing}°)</h3>`;
      if (t.observer) html += `<p style="color:#64748b;font-size:13px;">Observer: ${esc(t.observer)} | Date: ${t.measDate || ''} | Slope: ${t.slope || 0}°</p>`;
      html += `<table><tr><th>Species</th><th>Life Form</th><th>Start (m)</th><th>End (m)</th><th>Dist (m)</th><th>Cover %</th><th>Height</th><th>DBH</th><th>Count</th><th>Stratum</th></tr>`;
      if (t.intercepts) t.intercepts.forEach(int => {
        html += `<tr><td class="species">${esc(int.name)}</td><td>${int.lifeForm || ''}</td><td>${int.startDist || '—'}</td><td>${int.endDist || '—'}</td><td>${int.distance || '—'}</td><td>${int.cover}</td><td>${int.height || '—'}</td><td>${int.dbh || '—'}</td><td>${int.abundance || '—'}</td><td>${int.stratum || ''}</td></tr>`;
      });
      html += `</table>`;
    });
  }

  if (s.environment) {
    html += `<h2>Environmental Variables</h2><table>`;
    const envLabels = {
      date: 'Measurement Date', observer: 'Observer / Team ID',
      slope: 'Slope (°)', aspect: 'Aspect', elevation: 'Elevation (m)', topoPosition: 'Topographic Position',
      canopyCover: 'Canopy Cover (%)', hydrology: 'Drainage / Hydrology', forestType: 'Forest Type',
      soilType: 'Soil Type', soilMoisture: 'Soil Moisture', soilColor: 'Soil Color', soilPH: 'Soil pH',
      litter_depth: 'Litter Depth (cm)', humus_depth: 'Humus Depth (cm)', bedrock_depth: 'Depth to Bedrock (cm)',
      temperature: 'Temperature (°C)', humidity: 'Humidity (%)', windSpeed: 'Wind Speed (km/h)',
      lightCondition: 'Light Condition', weather: 'Weather'
    };
    Object.entries(s.environment).forEach(([k, v]) => { 
      if (v !== '' && v !== null && v !== undefined) {
        html += `<tr><th>${envLabels[k] || k}</th><td>${esc(String(v)).replace(/-/g, ' ')}</td></tr>`; 
      }
    });
    html += `</table>`;
  }
  if (s.disturbance) {
    html += `<h2>Disturbance Indicators</h2><table><tr><th>Category</th><th>Present</th><th>Severity (1-5)</th><th>Type(s)</th><th>Recency</th><th>Extent</th></tr>`;
    const distCats = ['grazing', 'logging', 'fire', 'abiotic', 'biotic', 'human'];
    distCats.forEach(cat => {
      const d = s.disturbance[cat];
      if (d) {
        let t = d.type || (d.types ? d.types.join(', ') : '');
        let p = d.present ? 'Yes' : 'No';
        let sVal = d.present ? d.severity : '—';
        let r = d.recency || '—';
        let ext = d.extent ? d.extent.replace('<', '&lt;').replace('>', '&gt;') : '—';
        html += `<tr><td style="text-transform:capitalize;">${cat}</td><td>${p}</td><td>${sVal}</td><td>${t||'—'}</td><td>${r}</td><td>${ext}</td></tr>`;
      }
    });
    html += `</table>`;
    if (s.cbi) {
      // Basic flat export of CBI
      html += `<h3>Composite Burn Index (CBI)</h3><table><tr><th>Stratum</th><th>Values</th></tr>`;
      Object.entries(s.cbi).forEach(([layer, vals]) => {
         let sub = Object.values(vals).join(' | ');
         html += `<tr><td style="text-transform:capitalize;">${layer}</td><td>${sub}</td></tr>`;
      });
      html += `</table>`;
    }
  }

  if (s.herbariums && s.herbariums.length) {
    html += `<h2>Herbarium Vouchers</h2><table><tr><th>Voucher #</th><th>Family</th><th>Scientific Name</th><th>Region</th><th>Life Form</th><th>Phenology</th><th>Date Collected</th><th>Det. Date</th></tr>`;
    s.herbariums.forEach(h => {
      let r = [h.county, h.state, h.country].filter(Boolean).join(', ');
      html += `<tr><td>${esc(h.voucherNo||'—')}</td><td style="text-transform:uppercase;">${esc(h.family||'—')}</td><td class="species">${esc(h.scientific||'—')}</td><td>${esc(r||h.locality||'—')}</td><td>${esc(h.lifeForm||'—')}</td><td>${esc(h.phenology||'—')}</td><td>${esc(h.date||'—')}</td><td>${esc(h.dateIdentified||'—')}</td></tr>`;
    });
    html += `</table>`;
  }

  const fmtDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
  html += `<div class="footer">Generated by Forest Capture v3.0 — ${fmtDate}</div></body></html>`;
  await dl(html, s.name.replace(/\W/g, '_') + '_report.html', 'text/html');
  toast(t('Exporting HTML Report...'));
}

export async function backupAll() {
  const all = await Store.getBackupData();
  all.waypoints = await getWps();
  await dl(JSON.stringify(all, null, 2), 'forest_survey_backup_' + new Date().toISOString().split('T')[0] + '.json', 'application/json');
}

/**
 * restoreData(file)
 *
 * Reads a Forest Capture JSON backup file, validates it, then writes each
 * survey into Firestore via Store.add() — compatible with the current storage layer.
 *
 * @param {File} file — The .json backup file selected by the user.
 * @returns {Promise<void>}
 */
export async function restoreData(file) {
  if (!file) return;

  // 1. Parse
  let backupData;
  try {
    const text = await file.text();
    backupData = JSON.parse(text);
  } catch {
    throw new Error('Could not read the backup file. Make sure it is a valid JSON export.');
  }

  // 2. Validate
  if (!backupData || typeof backupData !== 'object') {
    throw new Error('File does not contain a valid JSON object.');
  }
  if (!Array.isArray(backupData.surveys) && !Array.isArray(backupData.waypoints)) {
    throw new Error('Backup file does not contain any recognisable Forest Capture data.');
  }

  // 3. Confirm with user
  const surveyCount   = Array.isArray(backupData.surveys)   ? backupData.surveys.length   : 0;
  const waypointCount = Array.isArray(backupData.waypoints) ? backupData.waypoints.length : 0;
  const totalRecords  = surveyCount + waypointCount;

  const confirmed = await fcConfirm(
    `This will import the backup contents:\n\n` +
    `  • ${surveyCount} survey${surveyCount !== 1 ? 's' : ''}\n` +
    `  • ${waypointCount} waypoint${waypointCount !== 1 ? 's' : ''}\n\n` +
    `Existing data will NOT be deleted. Continue?`
  );
  if (!confirmed) return;

  // 4. Import surveys via Store.add()
  try {
    if (Array.isArray(backupData.surveys)) {
      for (const survey of backupData.surveys) {
        // Ensure each survey has an ID (preserve original or generate new)
        if (!survey.id) {
          survey.id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        }
        await Store.add(survey);
      }
    }

    // Import waypoints if present
    if (Array.isArray(backupData.waypoints) && backupData.waypoints.length > 0) {
      const { getWps, saveWps } = await import('./storage.js');
      const existing = await getWps();
      await saveWps([...existing, ...backupData.waypoints]);
    }
  } catch (err) {
    throw new Error('Restore failed during import: ' + err.message);
  }

  // 5. Success
  toast(
    `Restore complete — ${totalRecords} record${totalRecords !== 1 ? 's' : ''} imported from backup.`,
    false
  );
  setTimeout(() => location.reload(), 1200);
}
