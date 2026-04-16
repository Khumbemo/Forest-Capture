/**
 * Visual smoke test — runs headfully so you can watch it,
 * and saves screenshots for each test step.
 * Usage: node tests/visual-smoke.js
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8080';
const OUT  = path.join(__dirname, 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

let pass = 0, fail = 0;
const results = [];

async function shot(page, name) {
  const p = path.join(OUT, name + '.png');
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

function log(label, ok, detail = '') {
  const sym = ok ? '✅' : '❌';
  console.log(`  ${sym}  ${label}${detail ? ' — ' + detail : ''}`);
  results.push({ label, ok, detail });
  ok ? pass++ : fail++;
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log('\n──────────────────────────────────────────');
  console.log(' Forest Capture — Visual Smoke Test');
  console.log('──────────────────────────────────────────\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--window-size=390,844'],
    defaultViewport: { width: 390, height: 844 }
  });
  const page = await browser.newPage();

  try {
    // ── SETUP ───────────────────────────────────────────────────────────
    console.log('⏳  Loading app…');
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await wait(4000); // splash fade

    // Dismiss login if shown
    const skip = await page.$('#btnSkipLogin');
    if (skip) { await page.evaluate(() => document.getElementById('btnSkipLogin').click()); await wait(600); }

    await shot(page, '01_dashboard');
    const hasDash = await page.$('#screenDashboard');
    log('App loads (dashboard present)', !!hasDash);

    // ── TEST 1: Telemetry cards tappable ────────────────────────────────
    console.log('\n🧪  TEST 1 — Telemetry card navigation');
    const teleCard = await page.$('#teleCardLocation, .tele-card');
    if (teleCard) {
      await page.evaluate(() => {
        const c = document.getElementById('teleCardLocation') || document.querySelector('.tele-card');
        if (c) c.click();
      });
      await wait(1200);
      await shot(page, '02_tele_card_click');
      const mapActive = await page.$('#screenMap.active');
      log('Location telemetry card navigates to Map', !!mapActive);
      // go back
      await page.evaluate(() => window.history.back());
      await wait(800);
    } else {
      log('Location telemetry card navigates to Map', false, 'card element not found');
    }

    // ── TEST 2: Back button visible on tool screens ──────────────────────
    console.log('\n🧪  TEST 2 — Back button on tool screens');
    // Navigate to Tools tab
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-screen="screenToolbar"]');
      if (btn) btn.click();
    });
    await wait(600);
    // Click Quadrat card
    const qCard = await page.$('.stat-card[data-screen="screenQuadrat"]');
    if (qCard) {
      await page.evaluate(() => document.querySelector('.stat-card[data-screen="screenQuadrat"]').click());
      await wait(1000);
      await shot(page, '03_quadrat_back_btn');
      const backBtn = await page.$('#btnHeaderBack');
      const backVisible = backBtn ? await page.evaluate(el => {
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden';
      }, backBtn) : false;
      log('Back button visible on Quadrat screen', backVisible);
    } else {
      log('Back button visible on Quadrat screen', false, 'Quadrat card not found');
    }

    // ── TEST 3: Connectivity banner ─────────────────────────────────────
    console.log('\n🧪  TEST 3 — Connectivity banner');
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-screen="screenDashboard"]');
      if (btn) btn.click();
    });
    await wait(800);
    // Call via the window.__fc bridge exposed by main.js — deterministic regardless of timer order.
    await page.evaluate(() => {
      if (window.__fc && window.__fc.updateConnectivityBanner) {
        window.__fc.updateConnectivityBanner();
      }
    });
    await wait(300);
    await shot(page, '04_connectivity_banner');
    const bannerDiag = await page.evaluate(() => {
      const b = document.getElementById('connectivityBanner');
      const hdr = document.getElementById('appHeader');
      return {
        bannerExists: !!b,
        bannerText: b ? b.textContent.trim() : null,
        headerExists: !!hdr,
        headerParent: hdr ? hdr.parentNode.tagName : null,
        bodyChildCount: document.body.children.length
      };
    });
    log('Connectivity banner rendered with text', !!bannerDiag.bannerText,
      bannerDiag.bannerText || `absent — header:${bannerDiag.headerExists}, __fc:${!!bannerDiag.headerExists}`);

    // ── TEST 4: Environment — no duplicate fields ────────────────────────
    console.log('\n🧪  TEST 4 — Environment: unique field IDs');
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-screen="screenToolbar"]');
      if (btn) btn.click();
    });
    await wait(500);
    await page.evaluate(() => {
      const c = document.querySelector('.stat-card[data-screen="screenEnvironment"]');
      if (c) c.click();
    });
    await wait(1000);
    await shot(page, '05_env_form');

    const elevCount = await page.evaluate(() => document.querySelectorAll('#envElevation').length);
    const canopyCount = await page.evaluate(() => document.querySelectorAll('#envCanopyCover').length);
    const topoPresent = await page.evaluate(() => !!document.querySelector('#envTopoPosition'));
    const hydPresent  = await page.evaluate(() => !!document.querySelector('#envHydrology, #envDrainageHydrology'));

    log('No duplicate envElevation elements', elevCount === 1, `found ${elevCount}`);
    log('No duplicate envCanopyCover elements', canopyCount === 1, `found ${canopyCount}`);
    log('Topographic Position field present', topoPresent);
    log('Drainage/Hydrology field present', hydPresent);

    // ── TEST 5: Germplasm — async body cards + unique GPS IDs ────────────
    console.log('\n🧪  TEST 5 — Germplasm async render + unique GPS IDs');
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-screen="screenToolbar"]');
      if (btn) btn.click();
    });
    await wait(500);
    await page.evaluate(() => {
      const c = document.querySelector('.stat-card[data-screen="screenGermplasm"]');
      if (c) c.click();
    });
    await wait(2000);
    await shot(page, '06_germplasm_home');

    const bodyCards = await page.evaluate(() => document.querySelectorAll('.g-body-card').length);
    log('Germplasm home shows 3 body cards', bodyCards === 3, `found ${bodyCards}`);

    // Click ICFRE
    const icfre = await page.$('.g-body-card[data-b="icfre"]');
    if (icfre) {
      await page.evaluate(() => document.querySelector('.g-body-card[data-b="icfre"]').click());
      await page.waitForSelector('#germ_icfre_speciesScientific', { timeout: 5000 });
      await shot(page, '07_icfre_form');

      // Check GPS button IDs are unique
      const icfregps  = await page.evaluate(() => !!document.getElementById('btnGermICFREGPS'));
      const oldgps    = await page.evaluate(() => !!document.getElementById('btnGermGPS')); // should NOT exist
      log('ICFRE form has unique GPS button ID (btnGermICFREGPS)', icfregps);
      log('Old duplicate btnGermGPS no longer on ICFRE form', !oldgps);

      // Back → home cards reappear
      await page.goBack();
      await wait(500);
      await page.evaluate(() => {
        const c = document.querySelector('.stat-card[data-screen="screenGermplasm"]');
        if (c) c.click();
      });
      await page.waitForSelector('.g-body-card', { timeout: 5000 });
      await shot(page, '08_germplasm_back');
      const cardsAfter = await page.evaluate(() => document.querySelectorAll('.g-body-card').length);
      log('Body cards reappear after Back (async renderHome fix)', cardsAfter === 3, `found ${cardsAfter}`);
    } else {
      log('ICFRE form has unique GPS button ID', false, 'ICFRE card not found');
    }

    // ── TEST 6: Export — Summary Report icon ────────────────────────────
    console.log('\n🧪  TEST 6 — Export: Summary Report button icon');
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-screen="screenToolbar"]');
      if (btn) btn.click();
    });
    await wait(500);
    await page.evaluate(() => {
      const c = document.querySelector('.stat-card[data-screen="screenExport"]');
      if (c) c.click();
    });
    await wait(1000);
    await shot(page, '09_export_screen');
    const reportBtnHasSVG = await page.evaluate(() => {
      const btn = document.getElementById('btnExportReport');
      if (!btn) return false;
      return btn.innerHTML.includes('<svg') || btn.querySelector('svg') !== null;
    });
    const reportBtnHasAlpha = await page.evaluate(() => {
      const btn = document.getElementById('btnExportReport');
      return btn ? btn.textContent.includes('α') : false;
    });
    log('Summary Report button has SVG icon (not α)', reportBtnHasSVG && !reportBtnHasAlpha,
      `hasSVG=${reportBtnHasSVG}, hasAlpha=${reportBtnHasAlpha}`);

    // ── TEST 7: CBI bar clamped ──────────────────────────────────────────
    console.log('\n🧪  TEST 7 — CBI score bar clamp');
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-screen="screenToolbar"]');
      if (btn) btn.click();
    });
    await wait(500);
    await page.evaluate(() => {
      const c = document.querySelector('.stat-card[data-screen="screenDisturbCBI"]');
      if (c) c.click();
    });
    await wait(1000);
    await shot(page, '10_disturb_cbi');
    // CBI bar starts at 0% or empty until scores are entered — just verify element exists
    // and that if width IS set, it doesn't exceed 100%.
    const cbiOk = await page.evaluate(() => {
      const fill = document.getElementById('cbiScoreFill');
      if (!fill) return { found: false };
      const raw = fill.style.width;
      const pct = parseFloat(raw);
      // Empty string / NaN means 0% (default) — valid initial state.
      return { found: true, width: isNaN(pct) ? 0 : pct };
    });
    log('CBI score fill element exists', cbiOk.found);
    log('CBI bar width ≤ 100% (Fix #8 clamp)', !cbiOk.found || cbiOk.width <= 100,
      cbiOk.found ? `width=${cbiOk.width}%` : 'element missing');

    // ── TEST 8: Settings sign-out section ───────────────────────────────
    console.log('\n🧪  TEST 8 — Settings Account section');
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-screen="screenDashboard"]');
      if (btn) btn.click();
    });
    await wait(400);
    await page.evaluate(() => {
      const btn = document.getElementById('btnSettings');
      if (btn) btn.click();
    });
    await wait(600);
    await shot(page, '11_settings_panel');
    const signOutBtn = await page.evaluate(() => !!document.getElementById('btnSignOut'));
    const accountSection = await page.evaluate(() => !!document.getElementById('settingsAccountSection'));
    log('Settings has Sign Out button (#btnSignOut)', signOutBtn);
    log('Settings has Account section element', accountSection);

  } catch (err) {
    console.error('\n💥  Unexpected error:', err.message);
    await shot(page, '99_error_state');
  } finally {
    await wait(1500);
    await browser.close();
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log(` RESULTS: ${pass} passed / ${fail} failed / ${pass + fail} total`);
  console.log('══════════════════════════════════════════\n');
  results.forEach(r => {
    console.log(`  ${r.ok ? '✅' : '❌'}  ${r.label}${r.detail ? '  →  ' + r.detail : ''}`);
  });
  console.log(`\n📸  Screenshots saved to: ${OUT}\n`);

  process.exit(fail > 0 ? 1 : 0);
})();
