/**
 * compass.js – Compass Heading & Aspect Slope Telemetry
 *
 * Tracks real-time device orientation to show compass heading,
 * aspect direction (N, S, W, E), and ground slope (tilt pitch).
 * Supports iOS permission prompts and a desktop simulation mode.
 */

import { $, toast } from './ui.js';

let active = false;
let heading = 0;
let slope = 0;
let _handler = null;
let simulatedHeading = 180; // Default simulated heading for desktop
let simulatedSlope = 0;     // Default simulated slope for desktop

/**
 * Convert a compass heading (0-360) to a cardinal direction (N, NE, E, etc.)
 * @param {number} deg - heading in degrees
 * @returns {string} cardinal label
 */
function getCardinal(deg) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((deg % 360) / 45)) % 8;
  return directions[index];
}

/**
 * Handle device orientation sensor data.
 */
function handleOrientation(event) {
  if (!active) return;

  // 1. Heading determination
  let currentHeading = 0;
  if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
    // iOS magnetic compass heading
    currentHeading = event.webkitCompassHeading;
  } else if (event.alpha !== null) {
    // Android/Non-iOS compass heading (standard deviceorientation alpha)
    currentHeading = (360 - event.alpha) % 360;
  } else {
    // No sensor data (desktop) - trigger simulation fallback
    _enableSimulationMode();
    return;
  }

  // 2. Slope determination (tilt pitch)
  let currentSlope = 0;
  if (event.beta !== null) {
    // Pitch (front/back tilt) represents the slope gradient
    currentSlope = Math.abs(Math.round(event.beta));
  }

  heading = Math.round(currentHeading);
  slope = currentSlope;

  _updateUI(heading, slope);
}

/**
 * Update the DOM elements with heading and slope.
 */
function _updateUI(h, s) {
  const aspectValue = $('#teleAspect');
  const slopeValue = $('#teleSlope');
  const compassSvg = $('#teleCompassSvg');

  if (aspectValue) {
    aspectValue.textContent = `${h}° ${getCardinal(h)}`;
  }
  if (slopeValue) {
    slopeValue.textContent = `Slope: ${s}°`;
  }
  if (compassSvg) {
    // Rotate the needle (polygon) by applying negative rotation to the compass SVG dial
    // to keep the needle pointing true north, or rotate the needle itself.
    // Standard approach: rotate the whole dial to align with the heading.
    compassSvg.style.transform = `rotate(${-h}deg)`;
  }
}

/**
 * Activate the desktop simulation click listener.
 */
function _enableSimulationMode() {
  _updateUI(simulatedHeading, simulatedSlope);
}

/**
 * Simulates a custom compass interaction for desktop environments.
 */
function simulateStep() {
  if (!active) return;
  // Step simulated values to show dynamic activity
  simulatedHeading = (simulatedHeading + 15) % 360;
  simulatedSlope = Math.round(10 + Math.random() * 8); // Random realistic slope aspect
  _updateUI(simulatedHeading, simulatedSlope);
  toast(`Simulated Compass Aspect: ${simulatedHeading}° ${getCardinal(simulatedHeading)}`);
}

/**
 * Start the compass telemetry module.
 */
export function start() {
  if (active) return;
  active = true;

  _handler = (e) => handleOrientation(e);

  // iOS 13+ requires requestPermission
  if (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    DeviceOrientationEvent.requestPermission()
      .then((state) => {
        if (state === 'granted') {
          window.addEventListener('deviceorientation', _handler);
        } else {
          _enableSimulationMode();
        }
      })
      .catch(() => {
        _enableSimulationMode();
      });
  } else if (typeof DeviceOrientationEvent !== 'undefined') {
    // Standalone absolute orientation preferred for Android
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', _handler);
    } else {
      window.addEventListener('deviceorientation', _handler);
    }
  } else {
    _enableSimulationMode();
  }

  // Bind click simulator on the card for desktop users
  const aspectCard = $('#teleCardAspect');
  if (aspectCard) {
    aspectCard.addEventListener('click', simulateStep);
  }
}

/**
 * Stop the compass telemetry module.
 */
export function stop() {
  active = false;
  if (_handler) {
    window.removeEventListener('deviceorientation', _handler);
    window.removeEventListener('deviceorientationabsolute', _handler);
    _handler = null;
  }
  const aspectCard = $('#teleCardAspect');
  if (aspectCard) {
    aspectCard.removeEventListener('click', simulateStep);
  }
}
