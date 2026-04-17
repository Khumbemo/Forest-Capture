// src/modules/utils.js

export function toUTM(lat, lng) {
  const latR = lat * Math.PI / 180;
  const lngR = lng * Math.PI / 180;
  const z = Math.floor((lng + 180) / 6) + 1;
  const cm = ((z - 1) * 6 - 180 + 3) * Math.PI / 180;

  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;

  const e2 = f * (2 - f);
  const n = f / (2 - f);
  const n2 = n * n, n3 = n * n2, n4 = n * n3;

  const A = a / (1 + n) * (1 + n2 / 4 + n4 / 64);
  const alpha = [
    (1 / 2) * n - (2 / 3) * n2 + (5 / 16) * n3 + (41 / 180) * n4,
    (13 / 48) * n2 - (3 / 5) * n3 + (557 / 1440) * n4,
    (61 / 240) * n3 - (103 / 140) * n4,
    (49561 / 161280) * n4
  ];

  const L = lngR - cm;
  const t = Math.sinh(Math.atanh(Math.sin(latR)) - (Math.sqrt(e2) * Math.atanh(Math.sqrt(e2) * Math.sin(latR))));
  const xi = Math.atan(t / Math.cos(L));
  const eta = Math.atanh(Math.sin(L) / Math.sqrt(1 + t * t));

  let easting = eta, northing = xi;
  for (let j = 0; j < 4; j++) {
    const i = j + 1;
    easting += alpha[j] * Math.cos(2 * i * xi) * Math.sinh(2 * i * eta);
    northing += alpha[j] * Math.sin(2 * i * xi) * Math.cosh(2 * i * eta);
  }

  easting = k0 * A * easting + 500000;
  northing = k0 * A * northing;
  if (northing < 0) northing += 10000000;

  return { zone: z, easting: Math.round(easting), northing: Math.round(northing) };
}

export function compress(file, MX, cb) {
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      let w = img.width, h = img.height;
      const scale = Math.min(MX / w, MX / h, 1);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.6));
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}

export function dl(c, fn, m) {
  const b = new Blob([c], { type: m });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = fn;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Global Metric <-> Imperial Converters
export function toMetric(val, type) {
  if (val == null || val === '') return null;
  const v = parseFloat(val);
  if (isNaN(v)) return val;
  // Type: dist (ft -> m), diam (in -> cm), area (sq ft -> m²), temp (°F -> °C)
  switch (type) {
    case 'dist': return Number((v * 0.3048).toFixed(2));
    case 'diam': return Number((v * 2.54).toFixed(2));
    case 'area': return Number((v * 0.092903).toFixed(2));
    case 'temp': return Number(((v - 32) * 5 / 9).toFixed(1));
    case 'ha':   return Number((v * 0.404686).toFixed(3)); // ac -> ha
  }
  return v;
}

export function toImperial(val, type) {
  if (val == null || val === '') return null;
  const v = parseFloat(val);
  if (isNaN(v)) return val;
  switch (type) {
    case 'dist': return Number((v / 0.3048).toFixed(2));
    case 'diam': return Number((v / 2.54).toFixed(2));
    case 'area': return Number((v / 0.092903).toFixed(2));
    case 'temp': return Number(((v * 9 / 5) + 32).toFixed(1));
    case 'ha':   return Number((v / 0.404686).toFixed(3)); // ha -> ac
  }
  return v;
}
