// src/modules/utils.js

export function toUTM(lat, lng) {
  const z = Math.floor((lng + 180) / 6) + 1;
  const cm = (z - 1) * 6 - 180 + 3;
  const k0 = 0.9996;
  const e = 0.00669438;
  const ep2 = e / (1 - e);
  const n2 = 6378137 / Math.sqrt(1 - e * Math.sin(lat * Math.PI / 180) ** 2);
  const t = Math.tan(lat * Math.PI / 180);
  const c = ep2 * Math.cos(lat * Math.PI / 180) ** 2;
  const a2 = (lng - cm) * Math.PI / 180 * Math.cos(lat * Math.PI / 180);
  const lr = lat * Math.PI / 180;
  const m = 6378137 * ((1 - e / 4 - 3 * e * e / 64) * lr - (3 * e / 8 + 3 * e * e / 32) * Math.sin(2 * lr) + (15 * e * e / 256) * Math.sin(4 * lr));
  let x = k0 * n2 * (a2 + a2 ** 3 / 6 * (1 - t ** 2 + c)) + 500000;
  let y = k0 * (m + n2 * Math.tan(lr) * a2 ** 2 / 2);
  if (lat < 0) y += 10000000;
  return { zone: z, easting: Math.round(x), northing: Math.round(y) };
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
