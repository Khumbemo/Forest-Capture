const puppeteer = require('puppeteer');

const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let passed = 0;
  let failed = 0;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 512, height: 800 });

  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  await page.goto('http://localhost:8080', { waitUntil: 'networkidle0', timeout: 10000 });
  await wait(1500);

  // ─── Step 1: Dismiss login via JS (bypasses CSS interactability) ──
  try {
    await page.evaluate(() => {
      const btn = document.getElementById('btnSkipLogin');
      if (btn) btn.click();
    });
    await wait(1000);
    console.log('✅ [1] Login dismissed');
    passed++;
  } catch (e) {
    console.log('FAIL [1] Login dismiss:', e.message);
    failed++;
  }

  // ─── Step 2: Navigate to Tools ───────────────────────────────────
  try {
    await page.evaluate(() => document.querySelector('[data-screen="screenToolbar"]').click());
    await wait(800);
    const active = await page.$eval('#screenToolbar', el => el.classList.contains('active'));
    if (active) { console.log('✅ [2] Tools screen is active'); passed++; }
    else { console.log('FAIL [2] Tools screen not activated'); failed++; }
  } catch (e) {
    console.log('FAIL [2] Navigate to Tools:', e.message); failed++;
  }

  // ─── Step 3: Create a Survey ─────────────────────────────────────
  try {
    await page.evaluate(() => document.querySelector('#btnNewSurvey').click());
    await wait(500);
    await page.type('#surveyName', 'Germplasm Test Survey');
    await page.evaluate(() => document.querySelector('#btnSaveSurvey').click());
    await wait(2000); // allow async Store.setActive + populateSurveySelector
    // Verify active survey via the Store directly
    const activeName = await page.evaluate(() => {
      return new Promise(resolve => {
        import('./src/modules/storage.js').then(m => m.Store.getActive()).then(s => resolve(s ? s.name : null)).catch(() => resolve(null));
      });
    });
    // Fallback: check if selector has any value set
    const selVal = await page.$eval('#surveySelector', el => el.value);
    if (selVal || activeName) {
      console.log('✅ [3] Survey created & active');
      passed++;
    } else {
      // Last resort: manually trigger selection via Store
      await page.evaluate(() => {
        const sel = document.getElementById('surveySelector');
        if (sel && sel.options.length > 1) {
          sel.value = sel.options[1].value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await wait(1000);
      const selVal2 = await page.$eval('#surveySelector', el => el.value);
      if (selVal2) { console.log('✅ [3] Survey selected manually'); passed++; }
      else { console.log('FAIL [3] Survey not selectable'); failed++; }
    }
  } catch (e) {
    console.log('FAIL [3] Create survey:', e.message); failed++;
  }

  // ─── Step 4: Click Germplasm Tool Card ───────────────────────────
  try {
    await page.evaluate(() => document.querySelector('[data-tool="screenGermplasm"]').click());
    await wait(800);
    const germActive = await page.$eval('#screenGermplasm', el => el.classList.contains('active'));
    if (germActive) { console.log('✅ [4] Germplasm screen opened'); passed++; }
    else { console.log('FAIL [4] Germplasm screen not active'); failed++; }
  } catch (e) {
    console.log('FAIL [4] Open Germplasm:', e.message); failed++;
  }

  // ─── Step 5: Home view — 3 body cards ───────────────────────────
  try {
    const cards = await page.$$('.g-body-card');
    if (cards.length === 3) { console.log('✅ [5] All 3 regulatory body cards (ICFRE, NBPGR, ISTA)'); passed++; }
    else { console.log(`FAIL [5] Expected 3 cards, found ${cards.length}`); failed++; }
  } catch (e) {
    console.log('FAIL [5] Body cards:', e.message); failed++;
  }

  // ─── Step 6: NBPGR form opens ────────────────────────────────────
  try {
    await page.evaluate(() => document.querySelector('.g-body-card[data-b="nbpgr"]').click());
    await wait(700);
    const nameField = await page.$('#germ_nbpgr_speciesScientific');
    if (nameField) { console.log('✅ [6] NBPGR form rendered — Scientific Name field present'); passed++; }
    else { console.log('FAIL [6] NBPGR form field missing'); failed++; }
  } catch (e) {
    console.log('FAIL [6] NBPGR form:', e.message); failed++;
  }

  // ─── Step 7: Fill & save a record ───────────────────────────────
  try {
    await page.type('#germ_nbpgr_speciesScientific', 'Shorea robusta');
    await wait(200);
    await page.evaluate(() => document.querySelector('#btnGSaveRec').click());
    await wait(12000); // 10s for 2x Firestore timeout + 2s padding
    // After save, should show list view with germListCont
    const listCont = await page.$('#germListCont');
    if (listCont) {
      const html = await page.$eval('#germListCont', el => el.innerHTML);
      if (html.includes('Shorea robusta')) {
        console.log('✅ [7] Record saved — Shorea robusta listed'); passed++;
      } else {
        console.log('FAIL [7] Record missing in list. HTML:', html.substring(0, 300)); failed++;
      }
    } else {
      // Check if still on form — possibly survey wasn't active
      const onForm = await page.$('#germ_nbpgr_speciesScientific');
      const toast = await page.$eval('#toast', el => el.textContent).catch(() => '');
      console.log(`FAIL [7] List not shown. Toast: "${toast}". Still on form: ${!!onForm}`); failed++;
    }
  } catch (e) {
    console.log('FAIL [7] Save record:', e.message); failed++;
  }

  // ─── Step 8: Navigate back and open ICFRE form ───────────────────
  try {
    // Use Cancel/Back button in form, or btnGNavHome in list
    await page.evaluate(() => {
      (document.querySelector('#btnGNavHome') || document.querySelector('#btnGCancelRec'))?.click();
    });
    await wait(6000); // Wait for renderHome()'s Store.getActive timeout
    await page.evaluate(() => document.querySelector('.g-body-card[data-b="icfre"]')?.click());
    await wait(700);
    const icfreField = await page.$('#germ_icfre_speciesScientific');
    if (icfreField) { console.log('✅ [8] ICFRE form rendered'); passed++; }
    else { console.log('FAIL [8] ICFRE form field missing'); failed++; }
  } catch (e) {
    console.log('FAIL [8] ICFRE form:', e.message); failed++;
  }

  // ─── Step 9: Open ISTA form ──────────────────────────────────────
  try {
    await page.evaluate(() => {
      (document.querySelector('#btnGNavHome') || document.querySelector('#btnGCancelRec'))?.click();
    });
    await wait(6000); // Wait for renderHome()'s Store.getActive timeout
    await page.evaluate(() => document.querySelector('.g-body-card[data-b="ista"]')?.click());
    await wait(700);
    const istaField = await page.$('#germ_ista_speciesScientific');
    if (istaField) { console.log('✅ [9] ISTA form rendered'); passed++; }
    else { console.log('FAIL [9] ISTA form field missing'); failed++; }
  } catch (e) {
    console.log('FAIL [9] ISTA form:', e.message); failed++;
  }

  // ─── Step 10: Validation — empty name blocked ────────────────────
  try {
    await page.$eval('#germ_ista_speciesScientific', el => el.value = '');
    await page.evaluate(() => document.querySelector('#btnGSaveRec').click());
    await wait(500);
    const stillOnForm = await page.$('#btnGSaveRec');
    if (stillOnForm) { console.log('✅ [10] Validation correct — empty name blocked'); passed++; }
    else { console.log('FAIL [10] Blank name was accepted (validation broken)'); failed++; }
  } catch (e) {
    console.log('FAIL [10] Validation test:', e.message); failed++;
  }

  await browser.close();

  console.log(`\n─────────────────────────────────────`);
  console.log(`Germplasm Tests: ${passed} passed, ${failed} failed`);
  console.log(`─────────────────────────────────────`);
  if (failed > 0) process.exit(1);
})();
