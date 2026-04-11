// src/modules/environment.js

import { $, toast, fcConfirm } from './ui.js';
import { Store } from './storage.js';
import { curPos } from './gps.js';

export function autoFillEnv() {
  if (curPos.alt !== null) $('#envElevation').value = Math.round(curPos.alt);
  const t = $('#teleTemp').textContent;
  const h = $('#teleHumidity').textContent;
  const tv = parseFloat(t);
  const hv = parseFloat(h);
  if (!isNaN(tv)) $('#envTemperature').value = tv;
  if (!isNaN(hv)) $('#envHumidity').value = Math.round(hv);
  toast('Auto-filled');
}

function numOrNull(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

export async function saveEnv() {
  const s = await Store.getActive();
  if (!s) { toast('Select survey', true); return; }
  const eData = {
    date: $('#envDate') ? $('#envDate').value : '',
    observer: $('#envObserver') ? $('#envObserver').value.trim() : '',
    slope: numOrNull($('#envSlope').value),
    aspect: $('#envAspect').value,
    elevation: numOrNull($('#envElevation').value),
    topoPosition: $('#envTopoPosition') ? $('#envTopoPosition').value : '',
    canopyCover: numOrNull($('#envCanopyCover').value),
    hydrology: $('#envHydrology') ? $('#envHydrology').value : '',
    forestType: $('#envForestType') ? $('#envForestType').value : '',
    soilType: $('#envSoilType').value,
    soilMoisture: $('#envSoilMoisture').value,
    soilColor: $('#envSoilColor').value.trim(),
    soilPH: numOrNull($('#envSoilPH') ? $('#envSoilPH').value : ''),
    litter_depth: numOrNull($('#envLitterDepth') ? $('#envLitterDepth').value : ''),
    humus_depth: numOrNull($('#envHumusDepth') ? $('#envHumusDepth').value : ''),
    bedrock_depth: numOrNull($('#envBedrockDepth') ? $('#envBedrockDepth').value : ''),
    temperature: numOrNull($('#envTemperature').value),
    humidity: numOrNull($('#envHumidity').value),
    windSpeed: numOrNull($('#envWindSpeed') ? $('#envWindSpeed').value : ''),
    lightCondition: $('#envLightCondition') ? $('#envLightCondition').value : '',
    weather: $('#envWeather').value
  };

  // Scientific Range Validation
  if (eData.slope !== null && (eData.slope < 0 || eData.slope > 90)) {
    if (!await fcConfirm('Slope is typically 0-90°. Proceed anyway?')) return;
  }
  const aspVal = parseFloat(eData.aspect);
  if (!isNaN(aspVal) && (aspVal < 0 || aspVal > 360)) {
    if (!await fcConfirm('Aspect should be 0-360°. Proceed anyway?')) return;
  }
  if (eData.soilPH !== null && (eData.soilPH < 0 || eData.soilPH > 14)) {
    if (!await fcConfirm('Soil pH must be 0-14. Proceed anyway?')) return;
  }
  if (eData.canopyCover !== null && (eData.canopyCover < 0 || eData.canopyCover > 100)) {
    toast('Cover must be 0-100%', true); return;
  }

  s.environment = eData;
  await Store.update(s);
  toast('Saved');
}

export async function loadEnvData() {
  const s = await Store.getActive();
  if (!s || !s.environment) return;
  const e = s.environment;
  if (e.date && $('#envDate')) $('#envDate').value = e.date;
  if (e.observer && $('#envObserver')) $('#envObserver').value = e.observer;
  if (e.slope != null) $('#envSlope').value = e.slope;
  if (e.aspect) $('#envAspect').value = e.aspect;
  if (e.elevation != null) $('#envElevation').value = e.elevation;
  if (e.topoPosition && $('#envTopoPosition')) $('#envTopoPosition').value = e.topoPosition;
  if (e.canopyCover != null) $('#envCanopyCover').value = e.canopyCover;
  if (e.hydrology && $('#envHydrology')) $('#envHydrology').value = e.hydrology;
  if (e.forestType && $('#envForestType')) $('#envForestType').value = e.forestType;
  if (e.soilType) $('#envSoilType').value = e.soilType;
  if (e.soilMoisture) $('#envSoilMoisture').value = e.soilMoisture;
  if (e.soilColor) $('#envSoilColor').value = e.soilColor;
  if (e.soilPH != null && $('#envSoilPH')) $('#envSoilPH').value = e.soilPH;
  if (e.litter_depth != null && $('#envLitterDepth')) $('#envLitterDepth').value = e.litter_depth;
  if (e.humus_depth != null && $('#envHumusDepth')) $('#envHumusDepth').value = e.humus_depth;
  if (e.bedrock_depth != null && $('#envBedrockDepth')) $('#envBedrockDepth').value = e.bedrock_depth;
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
      const imgData = ctx.getImageData(0, 0, 200, 200);
      const data = imgData.data;

      // Gray distribution (Green-centric or Excess Green)
      const gray = new Uint8Array(200 * 200);
      const hist = new Int32Array(256);
      for (let i = 0; i < data.length; i += 4) {
        const r2 = data[i], g = data[i + 1], b = data[i + 2];
        const val = Math.max(0, Math.min(255, 2 * g - r2 - b)); // ExG
        gray[i / 4] = val;
        hist[val]++;
      }

      // Otsu Thresholding
      let total = 200 * 200;
      let sum = 0;
      for (let i = 0; i < 256; i++) sum += i * hist[i];
      let sumB = 0, wB = 0, wF = 0, varMax = 0, threshold = 0;
      for (let i = 0; i < 256; i++) {
        wB += hist[i];
        if (wB === 0) continue;
        wF = total - wB;
        if (wF === 0) break;
        sumB += i * hist[i];
        let mB = sumB / wB;
        let mF = (sum - sumB) / wF;
        let varBetween = wB * wF * (mB - mF) * (mB - mF);
        if (varBetween > varMax) {
          varMax = varBetween;
          threshold = i;
        }
      }

      let green = 0;
      for (let i = 0; i < gray.length; i++) {
        if (gray[i] > threshold) {
          green++;
          // Optional: visualized binarization for feedback
          data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 255;
        } else {
          data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const pct = Math.round((green / total) * 100);
      const gapFraction = 1 - (green / total);
      const lai = gapFraction > 0 ? (-2 * Math.log(gapFraction)).toFixed(2) : '—';

      $('#canopyEstimate').textContent = `≈ ${pct}% cover | LAI: ${lai}`;
      if ($('#envLAI')) $('#envLAI').value = lai;
      $('#envCanopyCover').value = pct;
      toast(`Canopy: ~${pct}% (LAI: ${lai})`);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

export function init() {
  $('#btnAutoFillEnv')?.addEventListener('click', autoFillEnv);
  $('#btnSaveEnv')?.addEventListener('click', async () => {
      await saveEnv();
  });
  $('#canopyPhotoInput')?.addEventListener('change', e => {
      if(e.target.files[0]) estimateCanopy(e.target.files[0]);
  });
}
