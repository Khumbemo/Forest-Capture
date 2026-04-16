describe('Germplasm Collector E2E Tests', () => {
  beforeAll(async () => {
    // Navigate to the local server
    await page.setViewport({ width: 512, height: 800 });
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });
    
    // Check if splash screen goes away (max 2.8s)
    await new Promise(r => setTimeout(r, 3000));
    
    // Dismiss login if necessary
    const skipBtn = await page.$('#btnSkipLogin');
    if (skipBtn) {
      try { await page.click('#btnSkipLogin'); } catch(e) {}
    }
    await new Promise(r => setTimeout(r, 1000));
  });

  test('Navigate to Tools and Create a Survey', async () => {
    await page.waitForSelector('button[data-screen="screenToolbar"]', { timeout: 3000 });
    await page.click('button[data-screen="screenToolbar"]');
    await new Promise(r => setTimeout(r, 500));

    await page.waitForSelector('#btnNewSurvey', { timeout: 2000 });
    await page.click('#btnNewSurvey');
    
    await page.waitForSelector('#surveyName', { timeout: 2000 });
    await page.type('#surveyName', 'Germplasm Test Survey');
    await page.click('#btnSaveSurvey');
    await new Promise(r => setTimeout(r, 2000));

    // Verify selector has a value
    const selVal = await page.$eval('#surveySelector', el => el.value);
    expect(selVal).toBeTruthy();
  });

  test('Open Germplasm Tool and check body cards', async () => {
    // FIX #13: stat-cards now use data-screen (was data-tool)
    await page.waitForSelector('.stat-card[data-screen="screenGermplasm"]', { timeout: 5000 });
    await page.evaluate(() => document.querySelector('.stat-card[data-screen="screenGermplasm"]').click());
    await new Promise(r => setTimeout(r, 1000));

    // Wait for body cards in germplasm home view
    await page.waitForSelector('.g-body-card', { timeout: 5000 });
    const cardsCount = await page.$$eval('.g-body-card', cards => cards.length);
    expect(cardsCount).toBe(3);
  });

  test('Operate NBPGR form and save record', async () => {
    // Use JS click to bypass scroll viewport issues.
    await page.waitForSelector('.g-body-card[data-b="nbpgr"]', { timeout: 5000 });
    await page.evaluate(() => document.querySelector('.g-body-card[data-b="nbpgr"]').click());
    await page.waitForSelector('#germ_nbpgr_speciesScientific', { timeout: 5000 });
    await page.type('#germ_nbpgr_speciesScientific', 'Shorea robusta');
    
    await page.evaluate(() => document.getElementById('btnGSaveRec').click());
    // Wait for save and transition to list
    await new Promise(r => setTimeout(r, 2000));
    
    await page.waitForSelector('#germListCont', { timeout: 5000 });
    const listHtml = await page.$eval('#germListCont', el => el.innerHTML);
    expect(listHtml).toContain('Shorea robusta');
  });

  test('Navigate back and verify ICFRE and ISTA forms rendered', async () => {
    // After NBPGR save we are on the list view.
    // Scroll btnGNavHome into view and click it via JS to bypass Puppeteer scroll issues.
    await page.waitForSelector('#btnGNavHome', { timeout: 5000 });
    await page.evaluate(() => document.getElementById('btnGNavHome').scrollIntoView());
    await page.evaluate(() => document.getElementById('btnGNavHome').click());

    // Wait until the body cards are rendered in home view (renderHome is now async).
    await page.waitForSelector('.g-body-card[data-b="icfre"]', { timeout: 5000 });

    // Check ICFRE form renders correctly.
    await page.evaluate(() => document.querySelector('.g-body-card[data-b="icfre"]').click());
    await page.waitForSelector('#germ_icfre_speciesScientific', { timeout: 5000 });
    expect(await page.$('#germ_icfre_speciesScientific')).toBeTruthy();

    // Go back to home view via the Back button.
    await page.waitForSelector('#btnGCancelRec', { timeout: 3000 });
    await page.evaluate(() => document.getElementById('btnGCancelRec').click());
    // Wait for home body cards to reappear.
    await page.waitForSelector('.g-body-card[data-b="ista"]', { timeout: 5000 });

    // Check ISTA form renders correctly.
    await page.evaluate(() => document.querySelector('.g-body-card[data-b="ista"]').click());
    await page.waitForSelector('#germ_ista_speciesScientific', { timeout: 5000 });
    expect(await page.$('#germ_ista_speciesScientific')).toBeTruthy();
  });

  test('Validation blocks empty name', async () => {
    // This test depends on ISTA form being open from the previous test.
    // FIX: Make it self-contained — navigate to ISTA form from scratch if needed.
    let istaInput = await page.$('#germ_ista_speciesScientific');
    if (!istaInput) {
      // Navigate to ISTA form
      await page.waitForSelector('#btnGCancelRec', { timeout: 2000 }).catch(() => {});
      const cancelBtn = await page.$('#btnGCancelRec');
      if (cancelBtn) await page.evaluate(() => document.getElementById('btnGCancelRec').click());
      await page.waitForSelector('.g-body-card[data-b="ista"]', { timeout: 5000 });
      await page.evaluate(() => document.querySelector('.g-body-card[data-b="ista"]').click());
      await page.waitForSelector('#germ_ista_speciesScientific', { timeout: 5000 });
    }
    await page.$eval('#germ_ista_speciesScientific', el => el.value = '');
    await page.evaluate(() => document.getElementById('btnGSaveRec').click());
    await new Promise(r => setTimeout(r, 500));

    // Should still be on ISTA form (validation blocked save)
    const saveBtnVisible = await page.$('#btnGSaveRec');
    expect(saveBtnVisible).toBeTruthy();
  });
});
