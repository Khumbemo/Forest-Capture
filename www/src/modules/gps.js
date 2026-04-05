// src/modules/gps.js

import { toUTM } from './utils.js';
import { setHeaderWeatherIcon } from './ui.js';

export let curPos = { lat: null, lng: null, alt: null, acc: null };
let gpsWatchId = null;

export function fmtCoords(lat, lng, format = 'dd') {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return '—';
  if (format === 'utm') {
    const u = toUTM(lat, lng);
    return `${u.zone}${lat >= 0 ? 'N' : 'S'} ${u.easting}mE ${u.northing}mN`;
  }
  if (format === 'dms') {
    function toDMS(d, pos, neg) {
      const dir = d >= 0 ? pos : neg;
      d = Math.abs(d);
      const deg = Math.floor(d);
      const m = Math.floor((d - deg) * 60);
      const s = ((d - deg) * 60 - m) * 60;
      return `${deg}°${m}'${s.toFixed(1)}"${dir}`;
    }
    return toDMS(lat, 'N', 'S') + ' ' + toDMS(lng, 'E', 'W');
  }
  return `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
}

export function startGPS(onUpdate, onError) {
  if (!navigator.geolocation) {
    if (onError) onError('NO API');
    return;
  }

  setHeaderWeatherIcon('⟲');
  gpsWatchId = navigator.geolocation.watchPosition(p => {
    curPos.lat = p.coords.latitude;
    curPos.lng = p.coords.longitude;
    curPos.alt = p.coords.altitude;
    curPos.acc = p.coords.accuracy;

    if (onUpdate) onUpdate(curPos);
  }, e => {
    if (onError) onError('NO SIGNAL');
    setHeaderWeatherIcon(navigator.onLine ? '📡' : '∅');
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
}

export async function reverseGeocode(lat, lon) {
  if (!navigator.onLine) {
    return null;
  }
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
    const data = await res.json();
    if (data && data.display_name) {
      return data.display_name;
    }
  } catch (e) {
    console.error('Geocode error', e);
  }
  return null;
}
