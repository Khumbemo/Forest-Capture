'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;
const www = path.join(root, 'www');

// Define files and directories to copy
const copyFiles = [
  'index.html',
  'index.css',
  'manifest.json',
  'service-worker.js',
  'icon-192.png',
  'icon-512.png'
];

const copyDirs = [
  'src'
];

if (!fs.existsSync(www)) fs.mkdirSync(www, { recursive: true });

// Copy individual files
for (const f of copyFiles) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(www, f));
  }
}

// Helper to recursively copy directories
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy directories
for (const d of copyDirs) {
  const src = path.join(root, d);
  if (fs.existsSync(src)) {
    copyDirRecursive(src, path.join(www, d));
  }
}

console.log('Build assets prepared in www/');
