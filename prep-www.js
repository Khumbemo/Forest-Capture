'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;
const www = path.join(root, 'www');
const copy = ['index.html', 'index.css', 'app.js', 'manifest.json', 'service-worker.js'];
if (!fs.existsSync(www)) fs.mkdirSync(www, { recursive: true });
for (const f of copy) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(www, f));
}
for (const f of ['icon-192.png', 'icon-512.png']) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(www, f));
}
