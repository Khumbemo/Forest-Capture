// src/modules/weather.js

import { setHeaderWeatherIcon } from './ui.js';

let weatherLastKey = '', weatherFetchT = 0;

export async function fetchWeather(lat, lng, onUpdate) {
  try {
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    const now = Date.now();
    if (key === weatherLastKey && now - weatherFetchT < 600000) return;
    weatherLastKey = key;
    weatherFetchT = now;
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`);
    const d = await r.json();
    if (!d || !d.current) return;
    const c = d.current;
    const wm = { 0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime Fog', 51: 'Light Drizzle', 53: 'Drizzle', 55: 'Dense Drizzle', 61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain', 71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 80: 'Showers', 95: 'Thunderstorm' };

    let wi = '☀︎';
    if (c.weather_code <= 3) wi = '⛅︎';
    if (c.weather_code <= 0) wi = '☀︎';
    else if (c.weather_code <= 48) wi = '🌫︎';
    else if (c.weather_code <= 55) wi = '🌦︎';
    else if (c.weather_code <= 65) wi = '🌧︎';
    else if (c.weather_code <= 75) wi = '❄︎';
    else if (c.weather_code <= 80) wi = '☔︎';
    else if (c.weather_code >= 95) wi = '⚡︎';

    setHeaderWeatherIcon(wi);
    if (onUpdate) onUpdate({
      temp: c.temperature_2m,
      humidity: c.relative_humidity_2m,
      wind: c.wind_speed_10m,
      desc: wm[c.weather_code] || '',
      icon: wi
    });
  } catch (e) {
    console.error('Weather fetch failed', e);
    if (onUpdate) onUpdate(null); // Signal failure
  }
}
