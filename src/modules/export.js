// src/modules/export.js

import { $, esc, toast } from './ui.js';
import { dl } from './utils.js';
import { Store, getWps } from './storage.js';

export async function refreshPreview() {
  const s = await Store.getActive();
  const p = $('#dataPreview');
  if (!s) {
    p.innerHTML = '<div class="empty-state small"><p>Select survey</p></div>';
    return;
  }
  p.textContent = JSON.stringify(s, null, 2);
}

export function toCSV(s) {
  const rows = [['Survey', 'Date', 'Location', 'Investigator', 'Q#', 'Size', 'Species', 'Stage', 'Phenology', 'Abundance', 'DBH', 'Height', 'Health', 'GPS']];
  if (s.quadrats) s.quadrats.forEach(q => {
    if (q.species) q.species.forEach(sp => {
      rows.push([s.name, s.date, s.location, s.investigator || '', q.number, q.size, sp.name, sp.stage, sp.phenology || '', sp.abundance, sp.dbh, sp.height, sp.health || '', q.gps || '']);
    });
  });
  return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export async function exportSurveyCSV() {
  const s = await Store.getActive();
  if (!s) { alert('No active survey'); return; }
  dl(toCSV(s), s.name.replace(/\W/g, '_') + '_survey.csv', 'text/csv');
  toast('Exporting CSV...');
}

export async function exportSurveyJSON() {
  const s = await Store.getActive();
  if (!s) { alert('No active survey'); return; }
  dl(JSON.stringify(s, null, 2), s.name.replace(/\W/g, '_') + '_survey.json', 'application/json');
  toast('Exporting JSON...');
}

export async function exportAllSurveysCSV() {
  const sv = await Store.getSurveys();
  if (!sv.length) { alert('No surveys'); return; }
  dl(sv.map(s => toCSV(s)).join('\n'), 'all_surveys.csv', 'text/csv');
  toast('Exporting All Surveys CSV...');
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
  if (!w.length) { alert('No waypoints'); return; }
  let g = '<?xml version="1.0"?>\n<gpx version="1.1" creator="ForestCapture">\n';
  w.forEach(p => {
    g += `<wpt lat="${p.lat}" lon="${p.lng}"><name>${xmlEsc(p.name)}</name><desc>${xmlEsc(p.type)}</desc><time>${p.time}</time></wpt>\n`;
  });
  g += '</gpx>';
  dl(g, 'waypoints.gpx', 'application/gpx+xml');
  toast('Exporting GPX...');
}

export async function generateReport() {
  const s = await Store.getActive();
  if (!s) { alert('No active survey'); return; }

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
    html += `<h2>Transect Data</h2><table><tr><th>T#</th><th>Length</th><th>Width</th><th>Species</th><th>Distance</th><th>Cover %</th></tr>`;
    s.transects.forEach(t => {
      if (t.intercepts) t.intercepts.forEach(int => {
        html += `<tr><td>${t.number}</td><td>${t.length}</td><td>${t.width}</td><td class="species">${esc(int.name)}</td><td>${int.distance}</td><td>${int.cover}</td></tr>`;
      });
    });
    html += `</table>`;
  }

  if (s.environment) {
    html += `<h2>Environmental Variables</h2><table>`;
    Object.entries(s.environment).forEach(([k, v]) => { if (v) html += `<tr><th>${k}</th><td>${v}</td></tr>`; });
    html += `</table>`;
  }

  html += `<div class="footer">Generated by Forest Capture v3.0 — ${new Date().toLocaleString()}</div></body></html>`;
  dl(html, s.name.replace(/\W/g, '_') + '_report.html', 'text/html');
  toast('Exporting HTML Report...');
}

export async function backupAll() {
  const all = await Store.getBackupData();
  all.waypoints = await getWps();
  dl(JSON.stringify(all, null, 2), 'forest_survey_backup_' + new Date().toISOString().split('T')[0] + '.json', 'application/json');
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

  const confirmed = window.confirm(
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
          survey.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
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
