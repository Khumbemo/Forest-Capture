// src/modules/map.js

import { toast, esc, fcPrompt } from './ui.js';
import { curPos } from './gps.js';
import { getWps, saveWps, loadSettings } from './storage.js';
import { initOfflineMapUI } from './map-offline.js';

let map = null, userMarker = null, wpMarkers = [], satLayer, terLayer, hybLayer;

export async function initMap() {
  if (typeof L === 'undefined') return;
  if (map) {
    map.invalidateSize();
    return;
  }
  const sysSettings = await loadSettings();
  const satUrl = sysSettings.settingMapTileUrl || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  const la = (curPos.lat !== null && curPos.lat !== undefined) ? curPos.lat : 20.5937;
  const ln = (curPos.lng !== null && curPos.lng !== undefined) ? curPos.lng : 78.9629;
  try {
    map = L.map('mapView', { zoomControl: false }).setView([la, ln], 14);
    satLayer = L.tileLayer(satUrl, { maxZoom: 19 });
    terLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    hybLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
    satLayer.addTo(map);
    if (curPos.lat != null && curPos.lng != null) userMarker = L.circleMarker([curPos.lat, curPos.lng], { radius: 8, color: '#5ee5a0', fillColor: '#5ee5a0', fillOpacity: .8, weight: 2 }).addTo(map).bindPopup('You');
    refreshMapWps();
    initOfflineMapUI(map);
  } catch (err) {
    console.error('Map init failed', err);
  }
}

export async function refreshMapWps() {
  if (!map || typeof L === 'undefined') return;
  wpMarkers.forEach(m => { try { map.removeLayer(m); } catch { } });
  wpMarkers = [];
  const wps = await getWps();
  wps.forEach(wp => {
    if (!wp || !Number.isFinite(wp.lat) || !Number.isFinite(wp.lng)) return;
    const m = L.marker([wp.lat, wp.lng]).addTo(map).bindPopup(`<b>${esc(wp.name || 'WP')}</b><br>${esc(wp.type || '')}`);
    wpMarkers.push(m);
  });
}

export function locateMe() {
  if (map && curPos.lat != null && curPos.lng != null) {
    map.setView([curPos.lat, curPos.lng], 16);
    if (userMarker) userMarker.setLatLng([curPos.lat, curPos.lng]);
    else userMarker = L.circleMarker([curPos.lat, curPos.lng], { radius: 8, color: '#5ee5a0', fillColor: '#5ee5a0', fillOpacity: .8, weight: 2 }).addTo(map).bindPopup('You');
    toast('Centered');
  } else toast('No GPS', true);
}

function mapHas(Ly) { return map && Ly && map.hasLayer(Ly); }

export function setMapLayer(type) {
  if (!map) return;
  if (type === 'sat') {
    if (mapHas(terLayer)) map.removeLayer(terLayer);
    if (mapHas(hybLayer)) map.removeLayer(hybLayer);
    if (!mapHas(satLayer)) satLayer.addTo(map);
    toast('Satellite');
  } else if (type === 'ter') {
    if (mapHas(satLayer)) map.removeLayer(satLayer);
    if (mapHas(hybLayer)) map.removeLayer(hybLayer);
    if (!mapHas(terLayer)) terLayer.addTo(map);
    toast('Terrain');
  } else if (type === 'hyb') {
    if (mapHas(satLayer)) map.removeLayer(satLayer);
    if (mapHas(terLayer)) map.removeLayer(terLayer);
    if (!mapHas(hybLayer)) hybLayer.addTo(map);
    toast('Hybrid');
  }
}

export async function addWaypoint(name, type, notes = '', manualLat = null, manualLng = null) {
  let lat = manualLat != null ? manualLat : curPos.lat;
  let lng = manualLng != null ? manualLng : curPos.lng;

  if (lat == null || lng == null) {
    // Prompt for manual coordinates when GPS is unavailable
    const manual = await fcPrompt('No GPS signal. Enter coordinates manually (lat, lng):');
    if (!manual) return;
    const parts = manual.split(',').map(s => parseFloat(s.trim()));
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      toast('Invalid coordinates. Use format: lat, lng', true);
      return;
    }
    lat = parts[0];
    lng = parts[1];
  }

  const w = await getWps();
  w.push({ name: name || 'Waypoint', type: type || 'plot', lat, lng, notes, time: new Date().toISOString() });
  await saveWps(w);
  await refreshMapWps();
  toast('Waypoint added');
}
