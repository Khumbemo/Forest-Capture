// src/modules/waypoints.js

import { $, esc, toast } from './ui.js';
import { getWps, saveWps } from './storage.js';
import { refreshMapWps } from './map.js';

export async function refreshWpList() {
  const wps = await getWps();
  const list = $('#waypointList');
  if (!list) return;
  if (!wps.length) {
    list.innerHTML = '';
    return;
  }
  const icons = { plot: '⌖', sample: '🧪', landmark: '🏔️', trail: '🚶', water: '💧', camp: '⛺', other: '📍' };
  list.innerHTML = wps.map((w, i) => {
    const cord = (Number.isFinite(w.lat) && Number.isFinite(w.lng)) ? `${w.lat.toFixed(5)}, ${w.lng.toFixed(5)}` : '—';
    return `<div class="waypoint-item">
      <span class="wp-icon">${icons[w.type] || icons.other}</span>
      <div class="wp-info">
        <div class="wp-name">${esc(w.name || 'Waypoint')}</div>
        <div class="wp-coords">${cord}</div>
      </div>
      <button class="wp-delete" data-i="${i}">✕</button>
    </div>`;
  }).join('');
  list.querySelectorAll('.wp-delete').forEach(b => {
    b.addEventListener('click', () => {
      const w = getWps();
      w.splice(+b.dataset.i, 1);
      saveWps(w);
      refreshWpList();
      refreshMapWps();
      toast('Deleted');
    });
  });
}
