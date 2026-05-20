/**
 * ============================================================
 *  FOREST CAPTURE — Export & Download Utility (ES Module)
 *  Formats: PDF (.pdf) | Word (.doc) | GPX (.gpx)
 * ============================================================
 *  Excel is already handled by the existing export.js module.
 *  This module adds PDF, Word, and enhanced GPX export.
 * ============================================================
 */

import { $, toast } from './ui.js';
import { Store, getWps } from './storage.js';

// ----------------------------------------------------------
// HELPER: trigger a file download from a Blob
// ----------------------------------------------------------
function _download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ----------------------------------------------------------
// HELPER: build a safe filename
// ----------------------------------------------------------
function _filename(name, ext) {
  const safe = (name || 'ForestCapture').replace(/\s+/g, '_').replace(/\W/g, '_');
  const date = new Date().toISOString().slice(0, 10);
  return `${safe}_${date}.${ext}`;
}

// ----------------------------------------------------------
// HELPER: convert camelCase key to readable label
// ----------------------------------------------------------
function _label(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

// ----------------------------------------------------------
// HELPER: escape special XML characters
// ----------------------------------------------------------
function _escapeXML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================
//  1. PDF EXPORT (.pdf)
// ============================================================
export async function exportPDF() {
  const s = await Store.getActive();
  if (!s) { toast('No active survey', true); return; }

  if (typeof window.jspdf === 'undefined') {
    toast('PDF library loading...', true);
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const margin = 20;
  const pageW = 210;
  const usableW = pageW - margin * 2;
  let y = margin;

  // --- Header ---
  doc.setFillColor(34, 85, 53);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('FOREST CAPTURE', margin, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleString(), pageW - margin - 45, 12);

  // --- Title ---
  y = 28;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text((s.name || 'Survey') + ' — Field Report', margin, y);
  y += 6;
  doc.setDrawColor(34, 85, 53);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // --- Survey summary fields ---
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  const summaryFields = [
    ['Survey Name', s.name || ''],
    ['Date', s.date || ''],
    ['Location', s.location || ''],
    ['Investigator', s.investigator || ''],
    ['GPS Coordinates', s.gpsCoords || '']
  ];
  summaryFields.forEach(([label, val]) => {
    if (!val) return;
    if (y > 270) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(val), margin + 50, y);
    y += 7;
  });

  // --- Quadrat data table ---
  if (s.quadrats && s.quadrats.length > 0) {
    y += 4;
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(34, 85, 53);
    doc.text('Quadrat Data', margin, y);
    y += 7;

    const qHeaders = ['Q#', 'Size', 'Species', 'Stage', 'Abundance', 'DBH', 'Height'];
    const qColW = usableW / qHeaders.length;

    doc.setFillColor(220, 237, 225);
    doc.rect(margin, y - 5, usableW, 8, 'F');
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    qHeaders.forEach((h, i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(h, margin + i * qColW + 1, y);
    });
    y += 5;

    s.quadrats.forEach(q => {
      const species = q.species || [];
      species.forEach((sp, idx) => {
        if (y > 275) { doc.addPage(); y = margin; }
        if (idx % 2 === 0) {
          doc.setFillColor(245, 250, 247);
          doc.rect(margin, y - 4, usableW, 7, 'F');
        }
        const vals = [String(q.number), String(q.size), sp.name || '', sp.stage || '', String(sp.abundance || ''), String(sp.dbh || ''), String(sp.height || '')];
        vals.forEach((val, i) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(50, 50, 50);
          const truncated = val.length > 14 ? val.substring(0, 13) + '…' : val;
          doc.text(truncated, margin + i * qColW + 1, y);
        });
        y += 6;
      });
    });
  }

  // --- Transect data table ---
  if (s.transects && s.transects.length > 0) {
    y += 6;
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(34, 85, 53);
    doc.text('Transect Data', margin, y);
    y += 7;

    const tHeaders = ['T#', 'Length', 'Width', 'Species', 'Distance', 'Cover%', 'Height'];
    const tColW = usableW / tHeaders.length;

    doc.setFillColor(220, 237, 225);
    doc.rect(margin, y - 5, usableW, 8, 'F');
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    tHeaders.forEach((h, i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(h, margin + i * tColW + 1, y);
    });
    y += 5;

    s.transects.forEach(t => {
      const ints = t.intercepts || [];
      ints.forEach((int, idx) => {
        if (y > 275) { doc.addPage(); y = margin; }
        if (idx % 2 === 0) {
          doc.setFillColor(245, 250, 247);
          doc.rect(margin, y - 4, usableW, 7, 'F');
        }
        const vals = [String(t.number), String(t.length), String(t.width), int.name || '', String(int.distance || ''), String(int.cover || ''), String(int.height || '')];
        vals.forEach((val, i) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(50, 50, 50);
          const truncated = val.length > 14 ? val.substring(0, 13) + '…' : val;
          doc.text(truncated, margin + i * tColW + 1, y);
        });
        y += 6;
      });
    });
  }

  // --- Environment ---
  if (s.environment) {
    y += 6;
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(34, 85, 53);
    doc.text('Environment', margin, y);
    y += 7;
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    Object.entries(s.environment).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined) return;
      if (y > 275) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold');
      doc.text(_label(k) + ':', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(v), margin + 55, y);
      y += 6;
    });
  }

  // --- Footer on every page ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Forest Capture — Generated: ' + new Date().toLocaleString(), margin, 290);
    doc.text('Page ' + i + ' of ' + pageCount, pageW - margin - 20, 290);
  }

  doc.save(_filename(s.name, 'pdf'));
  toast('PDF report exported');
}


// ============================================================
//  2. WORD EXPORT (.doc)
// ============================================================
export async function exportWord() {
  const s = await Store.getActive();
  if (!s) { toast('No active survey', true); return; }

  const title = (s.name || 'Survey') + ' — Field Report';

  // Summary table rows
  const summaryFields = [
    ['Survey Name', s.name || ''],
    ['Date', s.date || ''],
    ['Location', s.location || ''],
    ['Investigator', s.investigator || ''],
    ['GPS Coordinates', s.gpsCoords || '']
  ].filter(([, v]) => v);

  const summaryRows = summaryFields.map(([label, val]) =>
    `<tr>
      <td style="padding:5px 12px 5px 0;font-weight:bold;color:#22553a;width:35%;vertical-align:top">${label}</td>
      <td style="padding:5px 0;color:#333">${val}</td>
    </tr>`
  ).join('');

  // Quadrat table
  let quadratTable = '';
  if (s.quadrats && s.quadrats.length > 0) {
    const qHeaders = ['Q#', 'Size', 'Species', 'Stage', 'Phenology', 'Abundance', 'DBH', 'Height'].map(h =>
      `<th style="background:#d4ede0;padding:6px 8px;border:1px solid #aed4bc;font-weight:bold;color:#22553a;font-size:10pt">${h}</th>`
    ).join('');
    let qRows = '';
    s.quadrats.forEach(q => {
      (q.species || []).forEach((sp, i) => {
        const bg = i % 2 === 0 ? '#f5faf7' : '#fff';
        qRows += `<tr>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${q.number}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${q.size}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg};font-style:italic;color:#15803d">${sp.name || ''}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${sp.stage || ''}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${sp.phenology || ''}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${sp.abundance || ''}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${sp.dbh || ''}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${sp.height || ''}</td>
        </tr>`;
      });
    });
    quadratTable = `
      <h2 style="color:#22553a;font-size:13pt;margin-top:20px">Quadrat Data</h2>
      <table style="border-collapse:collapse;width:100%;font-size:10pt"><tr>${qHeaders}</tr>${qRows}</table>`;
  }

  // Transect table
  let transectTable = '';
  if (s.transects && s.transects.length > 0) {
    const tHeaders = ['T#', 'Method', 'Length', 'Width', 'Species', 'Distance', 'Cover%', 'Height'].map(h =>
      `<th style="background:#d4ede0;padding:6px 8px;border:1px solid #aed4bc;font-weight:bold;color:#22553a;font-size:10pt">${h}</th>`
    ).join('');
    let tRows = '';
    s.transects.forEach(t => {
      (t.intercepts || []).forEach((int, i) => {
        const bg = i % 2 === 0 ? '#f5faf7' : '#fff';
        tRows += `<tr>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${t.number}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${t.type || 'belt'}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${t.length}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${t.width}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg};font-style:italic;color:#15803d">${int.name || ''}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${int.distance || ''}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${int.cover || ''}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${int.height || ''}</td>
        </tr>`;
      });
    });
    transectTable = `
      <h2 style="color:#22553a;font-size:13pt;margin-top:20px">Transect Data</h2>
      <table style="border-collapse:collapse;width:100%;font-size:10pt"><tr>${tHeaders}</tr>${tRows}</table>`;
  }

  // Environment section
  let envSection = '';
  if (s.environment) {
    const envRows = Object.entries(s.environment)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .map(([k, v]) =>
        `<tr><td style="padding:4px 8px;font-weight:bold;color:#22553a;border:1px solid #ddd;width:40%">${_label(k)}</td><td style="padding:4px 8px;border:1px solid #ddd">${v}</td></tr>`
      ).join('');
    if (envRows) {
      envSection = `
        <h2 style="color:#22553a;font-size:13pt;margin-top:20px">Environment</h2>
        <table style="border-collapse:collapse;width:100%;font-size:10pt">${envRows}</table>`;
    }
  }

  // Disturbance section
  let distSection = '';
  if (s.disturbance) {
    const distCats = ['grazing', 'logging', 'fire', 'abiotic', 'biotic', 'human'];
    let distRows = '';
    distCats.forEach(cat => {
      const d = s.disturbance[cat];
      if (d) {
        const bg = '#f5faf7';
        distRows += `<tr>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg};text-transform:capitalize">${cat}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${d.present ? 'Yes' : 'No'}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${d.present ? d.severity : '—'}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;background:${bg}">${d.type || (d.types ? d.types.join(', ') : '—')}</td>
        </tr>`;
      }
    });
    if (distRows) {
      distSection = `
        <h2 style="color:#22553a;font-size:13pt;margin-top:20px">Disturbance Indicators</h2>
        <table style="border-collapse:collapse;width:100%;font-size:10pt">
          <tr><th style="background:#d4ede0;padding:6px 8px;border:1px solid #aed4bc;font-weight:bold;color:#22553a">Category</th>
          <th style="background:#d4ede0;padding:6px 8px;border:1px solid #aed4bc;font-weight:bold;color:#22553a">Present</th>
          <th style="background:#d4ede0;padding:6px 8px;border:1px solid #aed4bc;font-weight:bold;color:#22553a">Severity</th>
          <th style="background:#d4ede0;padding:6px 8px;border:1px solid #aed4bc;font-weight:bold;color:#22553a">Type</th></tr>
          ${distRows}</table>`;
    }
  }

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Calibri, sans-serif; font-size: 11pt; margin: 2.5cm; color: #222; }
        h1   { font-size: 18pt; color: #22553a; border-bottom: 2px solid #22553a; padding-bottom: 6px; }
        h2   { font-size: 13pt; color: #22553a; margin-top: 18px; }
        table { border-collapse: collapse; width: 100%; }
        .footer { margin-top: 30px; font-size: 9pt; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
      </style>
    </head>
    <body>
      <h1>🌿 ${title}</h1>
      <p style="color:#666;font-size:9pt">Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Forest Capture App</p>

      <h2>Summary</h2>
      <table>${summaryRows}</table>

      ${quadratTable}
      ${transectTable}
      ${envSection}
      ${distSection}

      <p class="footer">Forest Capture — Field Data Report</p>
    </body>
    </html>`;

  _download(
    new Blob(['\ufeff', html], { type: 'application/msword' }),
    _filename(s.name, 'doc')
  );
  toast('Word document exported');
}


// ============================================================
//  3. ENHANCED GPX EXPORT (.gpx)
// ============================================================
export async function exportEnhancedGPX() {
  const s = await Store.getActive();
  const wps = await getWps();

  if (!s && (!wps || !wps.length)) {
    toast('No survey or waypoints to export', true);
    return;
  }

  const trackName = s ? s.name : 'Forest Capture';
  const now = new Date().toISOString();
  const points = [];

  // Add waypoints from the waypoints store
  if (wps && wps.length > 0) {
    wps.forEach(wp => {
      points.push({
        name: wp.name || '',
        lat: wp.lat || 0,
        lon: wp.lng || wp.lon || 0,
        alt: wp.alt || 0,
        notes: wp.type || '',
        time: wp.time || now
      });
    });
  }

  // Add GPS from quadrats
  if (s && s.quadrats) {
    s.quadrats.forEach(q => {
      if (q.gps) {
        const parts = q.gps.split(',').map(p => parseFloat(p.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          points.push({
            name: `Quadrat #${q.number}`,
            lat: parts[0],
            lon: parts[1],
            alt: parts[2] || 0,
            notes: `Quadrat ${q.number} — ${(q.species || []).length} species`,
            time: q.recordedAt || now
          });
        }
      }
    });
  }

  // Add GPS from transects
  if (s && s.transects) {
    s.transects.forEach(t => {
      if (t.startGPS) {
        const parts = t.startGPS.split(',').map(p => parseFloat(p.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          points.push({
            name: `Transect #${t.number} Start`,
            lat: parts[0],
            lon: parts[1],
            alt: parts[2] || 0,
            notes: `Transect ${t.number} start point`,
            time: t.recordedAt || now
          });
        }
      }
      if (t.endGPS) {
        const parts = t.endGPS.split(',').map(p => parseFloat(p.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          points.push({
            name: `Transect #${t.number} End`,
            lat: parts[0],
            lon: parts[1],
            alt: parts[2] || 0,
            notes: `Transect ${t.number} end point`,
            time: t.recordedAt || now
          });
        }
      }
    });
  }

  if (points.length === 0) {
    toast('No GPS coordinates found in data', true);
    return;
  }

  // Build <wpt> tags
  const wptTags = points.map(p => `
  <wpt lat="${p.lat}" lon="${p.lon}">
    <ele>${p.alt}</ele>
    <time>${p.time}</time>
    <name>${_escapeXML(p.name)}</name>
    <desc>${_escapeXML(p.notes)}</desc>
    <sym>Flag, Blue</sym>
  </wpt>`).join('');

  // Build <trk> tag
  const trkTag = `
  <trk>
    <name>${_escapeXML(trackName)}</name>
    <trkseg>
      ${points.map(p => `<trkpt lat="${p.lat}" lon="${p.lon}">
        <ele>${p.alt}</ele>
        <time>${p.time}</time>
        <name>${_escapeXML(p.name)}</name>
      </trkpt>`).join('\n      ')}
    </trkseg>
  </trk>`;

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
     creator="Forest Capture App"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1
                         http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${_escapeXML(trackName)}</name>
    <desc>Exported from Forest Capture</desc>
    <time>${now}</time>
  </metadata>
${wptTags}
${trkTag}
</gpx>`;

  _download(
    new Blob([gpx], { type: 'application/gpx+xml' }),
    _filename(trackName, 'gpx')
  );
  toast('Enhanced GPX exported');
}

// ============================================================
//  INIT — Wire up buttons
// ============================================================
export function init() {
  $('#btnExportPDF')?.addEventListener('click', exportPDF);
  $('#btnExportWord')?.addEventListener('click', exportWord);
  $('#btnExportEnhancedGPX')?.addEventListener('click', exportEnhancedGPX);
}
