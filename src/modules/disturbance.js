// src/modules/disturbance.js

import { $, $$, toast } from './ui.js';
import { Store } from './storage.js';
import { getLocalISO } from './utils.js';

export const cbiL = { substrate: ['cbiSubLitter', 'cbiSubDuff', 'cbiSubSoil'], herbaceous: ['cbiHerbFreq', 'cbiHerbMort'], shrub: ['cbiShrubMort', 'cbiShrubChar'], intermediate: ['cbiIntChar', 'cbiIntMort'], overstory: ['cbiOverScorch', 'cbiOverMort', 'cbiOverChar'] };

/**
 * Pure Composite Burn Index calculation — no DOM, so it's directly
 * unit-testable. fieldValues is keyed by the same field ids used
 * throughout this module and in saved survey data (s.cbi[layer][id]),
 * e.g. { cbiSubLitter: 2, cbiSubDuff: 1, cbiOverMort: 3, ... }. Missing
 * fields default to 0, matching the original DOM-reading behavior.
 */
export function calculateCBI(fieldValues) {
  const strataAverages = {};
  let tot = 0, cnt = 0;
  for (const [layer, ids] of Object.entries(cbiL)) {
    const sum = ids.reduce((a, id) => a + (parseFloat(fieldValues[id]) || 0), 0);
    const avg = ids.length ? sum / ids.length : 0;
    strataAverages[layer] = avg;
    tot += avg; cnt++;
  }
  const composite = cnt ? tot / cnt : 0;

  let severity = 'Unburned';
  if (composite > 2.25) severity = 'High';
  else if (composite > 1.25) severity = 'Moderate-High';
  else if (composite > 0.5) severity = 'Moderate-Low';
  else if (composite > 0) severity = 'Low';

  return { strataAverages, composite, severity };
}

export function recalcCBI() {
  const fieldValues = {};
  Object.values(cbiL).flat().forEach(id => {
    const inp = document.getElementById(id);
    if (inp) fieldValues[id] = parseFloat(inp.value) || 0;
  });

  const { strataAverages, composite, severity } = calculateCBI(fieldValues);

  Object.entries(strataAverages).forEach(([layer, avg]) => {
    const el = document.getElementById('cbi' + layer.charAt(0).toUpperCase() + layer.slice(1) + 'Avg');
    if (el) el.textContent = avg.toFixed(2);
  });

  const cs = $('#cbiCompositeScore'), cf = $('#cbiScoreFill'), cl = $('#cbiSeverityClass');
  if (cs) cs.textContent = composite.toFixed(2);
  // FIX #8: Clamp to 100% so bar never overflows its container.
  if (cf) cf.style.width = Math.min(100, (composite / 3) * 100) + '%';

  if (cl) {
    cl.textContent = severity;
    cl.className = 'severity-badge ' + severity.toLowerCase().replace(' ', '-');
  }
}

export async function saveDisturbCBI() {
  const s = await Store.getActive();
  if (!s) { toast('Select survey', true); return; }
  s.disturbance = {
    grazing: { present: $('#distGrazingPresent').checked, severity: +$('#distGrazingSeverity').value, type: $('#distGrazingType').value, recency: $('#distGrazingRecency')?$('#distGrazingRecency').value:'', extent: $('#distGrazingExtent')?$('#distGrazingExtent').value:'' },
    logging: { present: $('#distLoggingPresent').checked, severity: +$('#distLoggingSeverity').value, type: $('#distLoggingType').value, recency: $('#distLoggingRecency')?$('#distLoggingRecency').value:'', extent: $('#distLoggingExtent')?$('#distLoggingExtent').value:'' },
    fire: { present: $('#distFirePresent').checked, severity: +$('#distFireSeverity').value, type: $('#distFireType').value, recency: $('#distFireRecency').value, extent: $('#distFireExtent')?$('#distFireExtent').value:'' },
    abiotic: { present: $('#distAbioticPresent')?$('#distAbioticPresent').checked:false, severity: +($('#distAbioticSeverity')?$('#distAbioticSeverity').value:1), type: $('#distAbioticType')?$('#distAbioticType').value:'', recency: $('#distAbioticRecency')?$('#distAbioticRecency').value:'', extent: $('#distAbioticExtent')?$('#distAbioticExtent').value:'' },
    biotic: { present: $('#distBioticPresent')?$('#distBioticPresent').checked:false, severity: +($('#distBioticSeverity')?$('#distBioticSeverity').value:1), type: $('#distBioticType')?$('#distBioticType').value:'', recency: $('#distBioticRecency')?$('#distBioticRecency').value:'', extent: $('#distBioticExtent')?$('#distBioticExtent').value:'' },
    human: { 
      present: $('#distHumanPresent').checked, 
      severity: +$('#distHumanSeverity').value, 
      types: $('#distHumanType') ? Array.from($('#distHumanType').selectedOptions).map(o => o.value) : [],
      recency: $('#distHumanRecency')?$('#distHumanRecency').value:'', 
      extent: $('#distHumanExtent')?$('#distHumanExtent').value:''
    },
    notes: $('#distNotes').value.trim(),
    recordedAt: getLocalISO()
  };
  s.cbi = {};
  Object.entries(cbiL).forEach(([l, ids]) => {
    s.cbi[l] = {};
    ids.forEach(id => s.cbi[l][id] = parseFloat(document.getElementById(id).value) || 0);
  });
  await Store.update(s);
  toast('Disturbance & CBI saved');
}

export async function loadDistData() {
  const s = await Store.getActive();
  if (!s || !s.disturbance) return;
  const d = s.disturbance;
  if (d.grazing) {
    $('#distGrazingPresent').checked = d.grazing.present;
    if (d.grazing.present) $('#grazingSeverityGroup').classList.add('visible');
    $('#distGrazingSeverity').value = d.grazing.severity;
    if ($('#distGrazingSeverityVal')) $('#distGrazingSeverityVal').textContent = d.grazing.severity;
    $('#distGrazingType').value = d.grazing.type || '';
    if ($('#distGrazingRecency')) $('#distGrazingRecency').value = d.grazing.recency || '';
    if ($('#distGrazingExtent')) $('#distGrazingExtent').value = d.grazing.extent || '';
  }
  if (d.logging) {
    $('#distLoggingPresent').checked = d.logging.present;
    if (d.logging.present) $('#loggingSeverityGroup').classList.add('visible');
    $('#distLoggingSeverity').value = d.logging.severity;
    if ($('#distLoggingSeverityVal')) $('#distLoggingSeverityVal').textContent = d.logging.severity;
    $('#distLoggingType').value = d.logging.type || '';
    if ($('#distLoggingRecency')) $('#distLoggingRecency').value = d.logging.recency || '';
    if ($('#distLoggingExtent')) $('#distLoggingExtent').value = d.logging.extent || '';
  }
  if (d.fire) {
    $('#distFirePresent').checked = d.fire.present;
    if (d.fire.present) $('#fireSeverityGroup').classList.add('visible');
    $('#distFireSeverity').value = d.fire.severity;
    if ($('#distFireSeverityVal')) $('#distFireSeverityVal').textContent = d.fire.severity;
    $('#distFireType').value = d.fire.type || '';
    $('#distFireRecency').value = d.fire.recency || '';
    if ($('#distFireExtent')) $('#distFireExtent').value = d.fire.extent || '';
  }
  if (d.abiotic && $('#distAbioticPresent')) {
    $('#distAbioticPresent').checked = d.abiotic.present;
    if (d.abiotic.present) $('#abioticSeverityGroup').classList.add('visible');
    $('#distAbioticSeverity').value = d.abiotic.severity;
    if ($('#distAbioticSeverityVal')) $('#distAbioticSeverityVal').textContent = d.abiotic.severity;
    $('#distAbioticType').value = d.abiotic.type || '';
    if ($('#distAbioticRecency')) $('#distAbioticRecency').value = d.abiotic.recency || '';
    if ($('#distAbioticExtent')) $('#distAbioticExtent').value = d.abiotic.extent || '';
  }
  if (d.biotic && $('#distBioticPresent')) {
    $('#distBioticPresent').checked = d.biotic.present;
    if (d.biotic.present) $('#bioticSeverityGroup').classList.add('visible');
    $('#distBioticSeverity').value = d.biotic.severity;
    if ($('#distBioticSeverityVal')) $('#distBioticSeverityVal').textContent = d.biotic.severity;
    $('#distBioticType').value = d.biotic.type || '';
    if ($('#distBioticRecency')) $('#distBioticRecency').value = d.biotic.recency || '';
    if ($('#distBioticExtent')) $('#distBioticExtent').value = d.biotic.extent || '';
  }
  if (d.human) {
    $('#distHumanPresent').checked = d.human.present;
    if (d.human.present) $('#humanSeverityGroup').classList.add('visible');
    $('#distHumanSeverity').value = d.human.severity;
    if ($('#distHumanSeverityVal')) $('#distHumanSeverityVal').textContent = d.human.severity;
    if (d.human.types && $('#distHumanType')) {
      Array.from($('#distHumanType').options).forEach(o => o.selected = d.human.types.includes(o.value));
    }
    if ($('#distHumanRecency')) $('#distHumanRecency').value = d.human.recency || '';
    if ($('#distHumanExtent')) $('#distHumanExtent').value = d.human.extent || '';
  }
  if (d.notes) $('#distNotes').value = d.notes;
}

export async function loadCBIData() {
  const s = await Store.getActive();
  if (!s || !s.cbi) return;
  Object.entries(cbiL).forEach(([l, ids]) => {
    if (s.cbi[l]) ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = s.cbi[l][id];
    });
  });
  recalcCBI();
}

export function init() {
  const dToggles = [
    { cb: 'distGrazingPresent', grp: 'grazingSeverityGroup', sl: 'distGrazingSeverity', dsp: 'distGrazingSeverityVal' },
    { cb: 'distLoggingPresent', grp: 'loggingSeverityGroup', sl: 'distLoggingSeverity', dsp: 'distLoggingSeverityVal' },
    { cb: 'distFirePresent', grp: 'fireSeverityGroup', sl: 'distFireSeverity', dsp: 'distFireSeverityVal' },
    { cb: 'distAbioticPresent', grp: 'abioticSeverityGroup', sl: 'distAbioticSeverity', dsp: 'distAbioticSeverityVal' },
    { cb: 'distBioticPresent', grp: 'bioticSeverityGroup', sl: 'distBioticSeverity', dsp: 'distBioticSeverityVal' },
    { cb: 'distHumanPresent', grp: 'humanSeverityGroup', sl: 'distHumanSeverity', dsp: 'distHumanSeverityVal' }
  ];
  dToggles.forEach(t => {
    const c = document.getElementById(t.cb), g = document.getElementById(t.grp), s = document.getElementById(t.sl), d = document.getElementById(t.dsp);
    if (!c || !g || !s || !d) return;
    c.addEventListener('change', () => g.classList.toggle('visible', c.checked));
    s.addEventListener('input', () => { d.textContent = s.value; });
  });
  $$('.cbi-select').forEach(s => s.addEventListener('change', recalcCBI));
  $('#btnSaveDisturbCBI')?.addEventListener('click', async () => {
      await saveDisturbCBI();
  });
}
