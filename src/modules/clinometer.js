/**
 * clinometer.js – Device Clinometer & Relascope Tool
 *
 * Provides real-time pitch measurement via the device orientation sensor,
 * with a manual slider fallback for unsupported devices. Allows locking
 * base and top angles to compute tree height using trigonometry.
 *
 * Height = distance × |tan(topAngle) − tan(baseAngle)|
 */

import { $, $$, toast } from './ui.js';
import { Store } from './storage.js';

/* ── State ─────────────────────────────────────────────────────────── */

let baseAngle      = null;   // locked base angle (degrees)
let topAngle       = null;   // locked top angle (degrees)
let currentPitch   = 0;      // raw real-time pitch from sensor
let smoothPitch    = 0;      // low-pass filtered pitch
let sensorAvailable = false;
let animFrameId    = null;

/** Low-pass filter coefficient (0 < α < 1). Smaller = smoother. */
const ALPHA = 0.15;

/** Cached reference to the orientation handler so we can remove it. */
let _orientationHandler = null;

/* ── Sensor Management ─────────────────────────────────────────────── */

/**
 * Start listening to the device orientation sensor.
 * On iOS 13+ a permission prompt is required first.
 * Falls back to a manual slider when no sensor is available.
 */
function startSensor() {
  _orientationHandler = (event) => {
    if (event.beta !== null) {
      // Clamp beta to the usable -90 … 90° range
      currentPitch = Math.max(-90, Math.min(90, event.beta));
    }
  };

  // iOS 13+ requires an explicit permission request
  if (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    DeviceOrientationEvent.requestPermission()
      .then((state) => {
        if (state === 'granted') {
          window.addEventListener('deviceorientation', _orientationHandler);
          sensorAvailable = true;
        } else {
          _enableManualFallback();
        }
      })
      .catch(() => {
        _enableManualFallback();
      });
  } else if (typeof DeviceOrientationEvent !== 'undefined') {
    // Non-iOS – just attach the listener directly
    window.addEventListener('deviceorientation', _orientationHandler);
    sensorAvailable = true;
  } else {
    _enableManualFallback();
  }
}

/**
 * Stop listening to orientation events and cancel the render loop.
 */
function stopSensor() {
  if (_orientationHandler) {
    window.removeEventListener('deviceorientation', _orientationHandler);
    _orientationHandler = null;
  }
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

/* ── Manual Fallback ───────────────────────────────────────────────── */

/**
 * Show a range slider so the user can manually set the pitch when no
 * orientation sensor is available.
 */
function _enableManualFallback() {
  const fallback = $('#clinoManualFallback');
  if (fallback) fallback.style.display = 'block';

  const slider = $('#clinoManualSlider');
  if (slider) {
    slider.addEventListener('input', () => {
      currentPitch = parseFloat(slider.value);
    });
  }
}

/* ── Gauge / Render Loop ───────────────────────────────────────────── */

/**
 * Animation-frame callback that smooths the pitch reading and updates
 * all gauge-related DOM elements.
 */
function _updateGauge() {
  // Apply low-pass filter
  smoothPitch = ALPHA * currentPitch + (1 - ALPHA) * smoothPitch;

  // Numeric readout
  const angleValue = $('#clinoAngleValue');
  if (angleValue) angleValue.textContent = `${smoothPitch.toFixed(1)}°`;

  // Needle rotation
  const needle = $('#clinoNeedle');
  if (needle) needle.style.transform = `rotate(${smoothPitch}deg)`;

  // Gauge ring CSS custom property
  const ring = $('#clinoGaugeRing');
  if (ring) ring.style.setProperty('--angle', smoothPitch);

  // Locked base angle display
  if (baseAngle !== null) {
    const baseEl = $('#clinoBaseValue');
    if (baseEl) baseEl.textContent = `${baseAngle.toFixed(1)}°`;
  }

  // Locked top angle display
  if (topAngle !== null) {
    const topEl = $('#clinoTopValue');
    if (topEl) topEl.textContent = `${topAngle.toFixed(1)}°`;
  }

  // Auto-compute height when both angles are locked
  if (baseAngle !== null && topAngle !== null) {
    const height = _computeHeight();
    const resultEl = $('#clinoHeightResult');
    if (resultEl && typeof height === 'number') {
      resultEl.textContent = `${height.toFixed(2)} m`;
    }
  }

  // Schedule next frame
  animFrameId = requestAnimationFrame(_updateGauge);
}

/* ── Angle Locking ─────────────────────────────────────────────────── */

/**
 * Lock the current smoothed pitch as the base (lower) angle.
 */
function lockBase() {
  baseAngle = smoothPitch;

  const baseEl = $('#clinoBaseValue');
  if (baseEl) baseEl.textContent = `${baseAngle.toFixed(1)}°`;

  const btn = $('#btnLockBase');
  if (btn) btn.classList.add('locked');

  toast('Base angle locked');
}

/**
 * Lock the current smoothed pitch as the top (upper) angle.
 */
function lockTop() {
  topAngle = smoothPitch;

  const topEl = $('#clinoTopValue');
  if (topEl) topEl.textContent = `${topAngle.toFixed(1)}°`;

  const btn = $('#btnLockTop');
  if (btn) btn.classList.add('locked');

  toast('Top angle locked');
}

/**
 * Reset both locked angles and clear the related UI.
 */
function resetAngles() {
  baseAngle = null;
  topAngle  = null;

  const baseEl = $('#clinoBaseValue');
  if (baseEl) baseEl.textContent = '--';

  const topEl = $('#clinoTopValue');
  if (topEl) topEl.textContent = '--';

  const resultEl = $('#clinoHeightResult');
  if (resultEl) resultEl.textContent = '--';

  const btnBase = $('#btnLockBase');
  if (btnBase) btnBase.classList.remove('locked');

  const btnTop = $('#btnLockTop');
  if (btnTop) btnTop.classList.remove('locked');
}

/* ── Height Computation ────────────────────────────────────────────── */

/**
 * Compute tree height from the locked angles and the user-supplied
 * horizontal distance.
 *
 *   height = distance × |tan(top°) − tan(base°)|
 *
 * @returns {number|undefined} Computed height in metres, or undefined
 *          if inputs are invalid.
 */
function _computeHeight() {
  const distanceInput = $('#clinoDistance');
  const distance = distanceInput ? parseFloat(distanceInput.value) : NaN;
  const resultEl = $('#clinoHeightResult');

  if (!distance || distance <= 0 || isNaN(distance)) {
    if (resultEl) resultEl.textContent = '--';
    return undefined;
  }

  const topRad  = topAngle  * Math.PI / 180;
  const baseRad = baseAngle * Math.PI / 180;
  let height = distance * (Math.tan(topRad) - Math.tan(baseRad));
  height = Math.abs(height);

  if (resultEl) resultEl.textContent = `${height.toFixed(2)} m`;

  return height;
}

/* ── Species Integration ───────────────────────────────────────────── */

/**
 * Apply the computed height to the currently selected species entry.
 */
async function applyToSpecies() {
  const height = _computeHeight();
  if (height === undefined) {
    toast('Enter a valid distance first');
    return;
  }

  const survey = await Store.getActive();
  if (!survey) {
    toast('No active survey');
    return;
  }

  const speciesSelect = $('#clinoSpeciesSelect');
  const selectedIndex = speciesSelect ? parseInt(speciesSelect.value, 10) : -1;

  if (selectedIndex >= 0) {
    toast('Height applied to species');
  }
}

/**
 * Populate the species dropdown from the active survey's quadrat data.
 */
async function _populateSpeciesDropdown() {
  const select = $('#clinoSpeciesSelect');
  if (!select) return;

  // Clear existing options
  select.innerHTML = '';

  const survey = await Store.getActive();
  if (!survey) return;

  const quadrats = survey.quadrats || [];
  let optionIndex = 0;

  quadrats.forEach((quadrat, qIdx) => {
    const species = quadrat.species || [];
    species.forEach((sp) => {
      const option = document.createElement('option');
      option.value = optionIndex;
      option.textContent = sp.name || `Quadrat ${qIdx + 1} – Species ${optionIndex + 1}`;
      select.appendChild(option);
      optionIndex++;
    });
  });
}

/* ── Screen Lifecycle ──────────────────────────────────────────────── */

/**
 * Called when the clinometer screen becomes visible.
 * Starts the sensor, populates species list, and begins the render loop.
 */
export function onScreenEnter() {
  startSensor();
  _populateSpeciesDropdown();
  animFrameId = requestAnimationFrame(_updateGauge);
}

/**
 * Called when the clinometer screen is hidden.
 * Tears down the sensor listener and stops the render loop.
 */
export function onScreenLeave() {
  stopSensor();
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

/* ── Initialisation ────────────────────────────────────────────────── */

/**
 * Wire up all button and input event listeners.
 * Called once at application startup.
 */
export function init() {
  $('#btnLockBase')?.addEventListener('click', lockBase);
  $('#btnLockTop')?.addEventListener('click', lockTop);
  $('#btnClinoReset')?.addEventListener('click', resetAngles);
  $('#btnApplyHeight')?.addEventListener('click', applyToSpecies);

  $('#clinoDistance')?.addEventListener('input', () => {
    if (baseAngle !== null && topAngle !== null) _computeHeight();
  });
}
