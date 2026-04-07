// src/modules/environment.js

import { $, toast } from './ui.js';
import { Store } from './storage.js';
import { curPos } from './gps.js';

export function autoFillEnv() {
  if (curPos.alt !== null) $('#envElevation').value = Math.round(curPos.alt);
  const t = $('#teleTemp').textContent;
  const h = $('#teleHumidity').textContent;
  if (t !== '--°C') $('#envTemperature').value = parseFloat(t);
  if (h !== '---%') $('#envHumidity').value = parseInt(h);
  toast('Auto-filled');
}

function numOrNull(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

export async function saveEnv() {
  const s = await Store.getActive();
  if (!s) { toast('Select survey', true); return; }
  s.environment = {
    slope: numOrNull($('#envSlope').value),
    aspect: $('#envAspect').value,
    elevation: numOrNull($('#envElevation').value),
    canopyCover: numOrNull($('#envCanopyCover').value),
    forestType: $('#envForestType') ? $('#envForestType').value : '',
    soilType: $('#envSoilType').value,
    soilMoisture: $('#envSoilMoisture').value,
    soilColor: $('#envSoilColor').value.trim(),
    soilPH: numOrNull($('#envSoilPH') ? $('#envSoilPH').value : ''),
    litterDepth: numOrNull($('#envLitterDepth') ? $('#envLitterDepth').value : ''),
    temperature: numOrNull($('#envTemperature').value),
    humidity: numOrNull($('#envHumidity').value),
    windSpeed: numOrNull($('#envWindSpeed') ? $('#envWindSpeed').value : ''),
    lightCondition: $('#envLightCondition') ? $('#envLightCondition').value : '',
    weather: $('#envWeather').value
  };
  await Store.update(s);
  toast('Saved');
}

export async function loadEnvData() {
  const s = await Store.getActive();
  if (!s || !s.environment) return;
  const e = s.environment;
  if (e.slope != null) $('#envSlope').value = e.slope;
  if (e.aspect) $('#envAspect').value = e.aspect;
  if (e.elevation != null) $('#envElevation').value = e.elevation;
  if (e.canopyCover != null) $('#envCanopyCover').value = e.canopyCover;
  if (e.forestType && $('#envForestType')) $('#envForestType').value = e.forestType;
  if (e.soilType) $('#envSoilType').value = e.soilType;
  if (e.soilMoisture) $('#envSoilMoisture').value = e.soilMoisture;
  if (e.soilColor) $('#envSoilColor').value = e.soilColor;
  if (e.soilPH != null && $('#envSoilPH')) $('#envSoilPH').value = e.soilPH;
  if (e.litterDepth != null && $('#envLitterDepth')) $('#envLitterDepth').value = e.litterDepth;
  if (e.temperature != null) $('#envTemperature').value = e.temperature;
  if (e.humidity != null) $('#envHumidity').value = e.humidity;
  if (e.windSpeed != null && $('#envWindSpeed')) $('#envWindSpeed').value = e.windSpeed;
  if (e.lightCondition && $('#envLightCondition')) $('#envLightCondition').value = e.lightCondition;
  if (e.weather) $('#envWeather').value = e.weather;
}

export function estimateCanopy(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const c = $('#canopyCanvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 200, 200);
      const data = ctx.getImageData(0, 0, 200, 200).data;
      let green = 0, total = 200 * 200;
      for (let i = 0; i < data.length; i += 4) {
        const r2 = data[i], g = data[i + 1], b = data[i + 2];
        if (g > r2 && g > b && g > 60) green++;
      }
      const pct = Math.round((green / total) * 100);
      $('#canopyEstimate').textContent = `≈ ${pct}% canopy cover`;
      $('#envCanopyCover').value = pct;
      toast(`Canopy: ~${pct}%`);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
