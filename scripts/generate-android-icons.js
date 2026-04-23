/**
 * generate-android-icons.js
 * 
 * Generates all required Android adaptive icon assets from the web icon-512.png.
 * Uses the `sharp` library for high-quality image resizing.
 * 
 * Adaptive icons have two layers:
 *   - Background: solid dark green (#0a1f0a) — set via ic_launcher_background.xml
 *   - Foreground: tree icon centered with safe-zone padding (18% inset)
 * 
 * The foreground image is 108dp at mdpi baseline:
 *   mdpi=108, hdpi=162, xhdpi=216, xxhdpi=288, xxxhdpi=432
 * 
 * Legacy launcher icons (non-adaptive, pre-API 26):
 *   mdpi=48, hdpi=72, xhdpi=96, xxhdpi=144, xxxhdpi=192
 * 
 * Usage: node scripts/generate-android-icons.js
 */

'use strict';
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ICON = path.join(ROOT, 'icon-512.png');
const RES_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const DRAWABLE_DIR = path.join(RES_DIR, 'drawable');

// Android mipmap density factors
const DENSITIES = [
  { name: 'mdpi',    factor: 1.0 },
  { name: 'hdpi',    factor: 1.5 },
  { name: 'xhdpi',   factor: 2.0 },
  { name: 'xxhdpi',  factor: 3.0 },
  { name: 'xxxhdpi', factor: 4.0 },
];

// Foreground icon: 108dp baseline (for adaptive icon system)
const FOREGROUND_BASE_DP = 108;
// Legacy launcher icon: 48dp baseline
const LAUNCHER_BASE_DP = 48;

async function main() {
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error('Source icon not found:', SOURCE_ICON);
    process.exit(1);
  }

  console.log('Source icon:', SOURCE_ICON);
  console.log('Output dir:', RES_DIR);
  console.log('');

  // ─── 1. Generate foreground icons (tree centered with padding for safe zone) ───
  // The adaptive icon safe zone is 66/108 = ~61% of the total area.
  // We resize the source icon to fit within the safe zone, then composite onto a larger canvas.
  for (const density of DENSITIES) {
    const fgSize = Math.round(FOREGROUND_BASE_DP * density.factor);
    // The tree icon should occupy about 60% of the foreground (inside safe zone)
    const iconSize = Math.round(fgSize * 0.60);
    const offset = Math.round((fgSize - iconSize) / 2);

    const dir = path.join(RES_DIR, `mipmap-${density.name}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Resize source icon to fit safe zone
    const resizedIcon = await sharp(SOURCE_ICON)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Create transparent canvas and composite the tree icon centered
    const foreground = await sharp({
      create: {
        width: fgSize,
        height: fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }
    })
      .composite([{ input: resizedIcon, left: offset, top: offset }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`  ✓ mipmap-${density.name}/ic_launcher_foreground.png (${fgSize}×${fgSize})`);
  }

  // ─── 2. Generate legacy launcher icons (composite: dark bg + tree) ───
  for (const density of DENSITIES) {
    const launcherSize = Math.round(LAUNCHER_BASE_DP * density.factor);
    // Tree occupies ~70% of the legacy icon
    const iconSize = Math.round(launcherSize * 0.70);
    const offset = Math.round((launcherSize - iconSize) / 2);

    const dir = path.join(RES_DIR, `mipmap-${density.name}`);

    // Resize source icon
    const resizedIcon = await sharp(SOURCE_ICON)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Dark green background + tree
    await sharp({
      create: {
        width: launcherSize,
        height: launcherSize,
        channels: 4,
        background: { r: 10, g: 31, b: 10, alpha: 255 }, // #0a1f0a
      }
    })
      .composite([{ input: resizedIcon, left: offset, top: offset }])
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    console.log(`  ✓ mipmap-${density.name}/ic_launcher.png (${launcherSize}×${launcherSize})`);
  }

  // ─── 3. Generate round launcher icons (same as legacy but will be masked circular by OS) ───
  for (const density of DENSITIES) {
    const launcherSize = Math.round(LAUNCHER_BASE_DP * density.factor);
    const iconSize = Math.round(launcherSize * 0.65);
    const offset = Math.round((launcherSize - iconSize) / 2);

    const dir = path.join(RES_DIR, `mipmap-${density.name}`);

    const resizedIcon = await sharp(SOURCE_ICON)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Create circular mask
    const circleSvg = Buffer.from(
      `<svg width="${launcherSize}" height="${launcherSize}">
        <circle cx="${launcherSize / 2}" cy="${launcherSize / 2}" r="${launcherSize / 2}" fill="white"/>
      </svg>`
    );

    // Compose dark green circle background + tree
    await sharp({
      create: {
        width: launcherSize,
        height: launcherSize,
        channels: 4,
        background: { r: 10, g: 31, b: 10, alpha: 255 },
      }
    })
      .composite([
        { input: resizedIcon, left: offset, top: offset },
      ])
      // Apply circular mask
      .composite([
        {
          input: await sharp(circleSvg).resize(launcherSize, launcherSize).png().toBuffer(),
          blend: 'dest-in'
        }
      ])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    console.log(`  ✓ mipmap-${density.name}/ic_launcher_round.png (${launcherSize}×${launcherSize})`);
  }

  // ─── 4. Generate splash.png (for native Android splash screen) ───
  {
    const splashSize = 288; // A good size for splash animated icon
    const iconSize = Math.round(splashSize * 0.60);
    const offset = Math.round((splashSize - iconSize) / 2);

    const resizedIcon = await sharp(SOURCE_ICON)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Transparent background — the splash background color is set in styles.xml
    await sharp({
      create: {
        width: splashSize,
        height: splashSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }
    })
      .composite([{ input: resizedIcon, left: offset, top: offset }])
      .png()
      .toFile(path.join(DRAWABLE_DIR, 'splash.png'));

    console.log(`  ✓ drawable/splash.png (${splashSize}×${splashSize})`);
  }

  console.log('\n✅ All Android icons generated successfully!');
  console.log('   Run `npm run cap:sync` to sync web assets, then rebuild in Android Studio.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
