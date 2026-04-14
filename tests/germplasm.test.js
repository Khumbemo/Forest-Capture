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
    await page.waitForSelector('.stat-card[data-tool="screenGermplasm"]', { timeout: 2000 });
    await page.click('.stat-card[data-tool="screenGermplasm"]');
    await new Promise(r => setTimeout(r, 1000));

    const cardsCount = await page.$$eval('.g-body-card', cards => cards.length);
    expect(cardsCount).toBe(3);
  });

  test('Operate NBPGR form and save record', async () => {
    await page.click('.g-body-card[data-b="nbpgr"]');
    await new Promise(r => setTimeout(r, 1000));

    await page.waitForSelector('#germ_nbpgr_speciesScientific', { timeout: 2000 });
    await page.type('#germ_nbpgr_speciesScientific', 'Shorea robusta');
    
    await page.click('#btnGSaveRec');
    // Wait for save and transition to list
    await new Promise(r => setTimeout(r, 2000));
    
    await page.waitForSelector('#germListCont', { timeout: 5000 });
    const listHtml = await page.$eval('#germListCont', el => el.innerHTML);
    expect(listHtml).toContain('Shorea robusta');
  });

  test('Navigate back and verify ICFRE and ISTA forms rendered', async () => {
    // Go back to Home
    await page.click('#btnGNavHome');
    await new Promise(r => setTimeout(r, 1000));

    // Check ICFRE
    await page.click('.g-body-card[data-b="icfre"]');
    await page.waitForSelector('#germ_icfre_speciesScientific', { timeout: 2000 });
    expect(await page.$('#germ_icfre_speciesScientific')).toBeTruthy();
    
    await page.click('#btnGCancelRec');
    await new Promise(r => setTimeout(r, 500));

    // Check ISTA
    await page.click('.g-body-card[data-b="ista"]');
    await page.waitForSelector('#germ_ista_speciesScientific', { timeout: 2000 });
    expect(await page.$('#germ_ista_speciesScientific')).toBeTruthy();
  });

  test('Validation blocks empty name', async () => {
    await page.waitForSelector('#germ_ista_speciesScientific', { timeout: 2000 });
    await page.$eval('#germ_ista_speciesScientific', el => el.value = '');
    await page.click('#btnGSaveRec');
    await new Promise(r => setTimeout(r, 500));

    // Should still be on ISTA form
    const saveBtnVisible = await page.$('#btnGSaveRec');
    expect(saveBtnVisible).toBeTruthy();
  });
});
