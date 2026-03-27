// src/modules/disturbance.js

import { $, $$, toast } from './ui.js';
import { Store } from './storage.js';

const cbiL = { substrate: ['cbiSubLitter', 'cbiSubDuff', 'cbiSubSoil'], herbaceous: ['cbiHerbFreq', 'cbiHerbMort'], shrub: ['cbiShrubMort', 'cbiShrubChar'], intermediate: ['cbiIntChar', 'cbiIntMort'], overstory: ['cbiOverScorch', 'cbiOverMort', 'cbiOverChar'] };

export function recalcCBI() {
  let tot = 0, cnt = 0;
  Object.entries(cbiL).forEach(([l, ids]) => {
    let lt = 0;
    ids.forEach(id => {
      const inp = document.getElementById(id);
      if (inp) lt += parseFloat(inp.value) || 0;
    });
    const avg = ids.length ? lt / ids.length : 0;
    const el = document.getElementById('cbi' + l.charAt(0).toUpperCase() + l.slice(1) + 'Avg');
    if (el) el.textContent = avg.toFixed(2);
    tot += avg; cnt++;
  });
  const c = cnt ? tot / cnt : 0;
  const cs = $('#cbiCompositeScore'), cf = $('#cbiScoreFill');
  if (cs) cs.textContent = c.toFixed(2);
  if (cf) cf.style.width = ((c / 3) * 100) + '%';
}

export async function saveDisturbCBI() {
  const s = await Store.getActive();
  if (!s) { toast('Select survey', true); return; }
  s.disturbance = {
    grazing: { present: $('#distGrazingPresent').checked, severity: +$('#distGrazingSeverity').value, type: $('#distGrazingType').value },
    logging: { present: $('#distLoggingPresent').checked, severity: +$('#distLoggingSeverity').value, type: $('#distLoggingType').value },
    fire: { present: $('#distFirePresent').checked, severity: +$('#distFireSeverity').value, type: $('#distFireType').value, recency: $('#distFireRecency').value },
    human: { present: $('#distHumanPresent').checked, severity: +$('#distHumanSeverity').value, types: Array.from($('#distHumanType').selectedOptions).map(o => o.value) },
    notes: $('#distNotes').value.trim()
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
    $('#distGrazingSeverityVal').textContent = d.grazing.severity;
    $('#distGrazingType').value = d.grazing.type || '';
  }
  if (d.logging) {
    $('#distLoggingPresent').checked = d.logging.present;
    if (d.logging.present) $('#loggingSeverityGroup').classList.add('visible');
    $('#distLoggingSeverity').value = d.logging.severity;
    $('#distLoggingSeverityVal').textContent = d.logging.severity;
    $('#distLoggingType').value = d.logging.type || '';
  }
  if (d.fire) {
    $('#distFirePresent').checked = d.fire.present;
    if (d.fire.present) $('#fireSeverityGroup').classList.add('visible');
    $('#distFireSeverity').value = d.fire.severity;
    $('#distFireSeverityVal').textContent = d.fire.severity;
    $('#distFireType').value = d.fire.type || '';
    $('#distFireRecency').value = d.fire.recency || '';
  }
  if (d.human) {
    $('#distHumanPresent').checked = d.human.present;
    if (d.human.present) $('#humanSeverityGroup').classList.add('visible');
    $('#distHumanSeverity').value = d.human.severity;
    $('#distHumanSeverityVal').textContent = d.human.severity;
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
