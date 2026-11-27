describe('Invasive Species Monitoring E2E Tests', () => {
  beforeAll(async () => {
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });

    await new Promise(r => setTimeout(r, 3000));

    const skipBtn = await page.$('#btnSkipLogin');
    if (skipBtn) {
      try { await page.click('#btnSkipLogin'); } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 1000));
  });

  test('Navigate to Tools and open the Invasive Species tool', async () => {
    await page.waitForSelector('button[data-screen="screenToolbar"]', { timeout: 3000 });
    await page.click('button[data-screen="screenToolbar"]');
    await new Promise(r => setTimeout(r, 500));

    await page.waitForSelector('.stat-card[data-screen="screenInvasive"]', { timeout: 5000 });
    await page.evaluate(() => document.querySelector('.stat-card[data-screen="screenInvasive"]').click());
    await new Promise(r => setTimeout(r, 500));

    await page.waitForSelector('#invSpeciesScientific', { timeout: 5000 });
    expect(await page.$('#invSpeciesScientific')).toBeTruthy();
  });

  test('Validation blocks an empty scientific name', async () => {
    // Asserting on the toast's text here would race against unrelated
    // toasts the app can show on its own (e.g. a background auth/network
    // "Connecting..." status) — germplasm.test.js/e2e.test.js avoid this
    // same trap by checking DOM/state instead, so this does too: an empty
    // name must leave the log untouched and the form still on-screen.
    await page.evaluate(() => document.getElementById('btnSaveInvasive').click());
    await new Promise(r => setTimeout(r, 500));

    const tableHtml = await page.$eval('#invTableBody', el => el.innerHTML);
    expect(tableHtml).toContain('No invasive species logged');
    expect(await page.$('#invSpeciesScientific')).toBeTruthy();
  });

  test('Fill in and save a record; it appears in the logged table', async () => {
    await page.type('#invSpeciesScientific', 'Lantana camara');
    await page.select('#invCoverClass', '26-50%');
    await page.select('#invGrowthStage', 'Flowering');

    await page.evaluate(() => document.getElementById('btnSaveInvasive').click());

    // Poll for the actual expected state rather than a fixed sleep, so this
    // tolerates the save's storage write taking longer under CI than it
    // does locally.
    await page.waitForFunction(
      () => document.getElementById('invTableBody').innerHTML.includes('Lantana camara'),
      { timeout: 8000 }
    );
    const tableHtml = await page.$eval('#invTableBody', el => el.innerHTML);
    expect(tableHtml).toContain('Lantana camara');
    expect(tableHtml).toContain('26-50%');
  });

  test('Edit button loads the record back into the form', async () => {
    await page.waitForSelector('[data-action="ei"]', { timeout: 5000 });
    await page.evaluate(() => document.querySelector('[data-action="ei"]').click());
    await new Promise(r => setTimeout(r, 500));

    const value = await page.$eval('#invSpeciesScientific', el => el.value);
    expect(value).toBe('Lantana camara');

    const btnText = await page.$eval('#btnSaveInvasive', el => el.textContent);
    expect(btnText).toContain('Update');
  });

  test('Record shows up in the Edit Data screen under its own filter', async () => {
    await page.evaluate(() => document.getElementById('btnSaveInvasive').click());

    // saveInvasive() clears the species field only after its storage write
    // completes, so this is the robust signal that the update actually
    // went through before navigating away.
    await page.waitForFunction(
      () => document.getElementById('invSpeciesScientific').value === '',
      { timeout: 8000 }
    );

    await page.waitForSelector('button[data-screen="screenData"]', { timeout: 3000 });
    await page.click('button[data-screen="screenData"]');
    await new Promise(r => setTimeout(r, 500));

    await page.waitForSelector('.stat-card[data-screen="screenEditData"]', { timeout: 5000 });
    await page.evaluate(() => document.querySelector('.stat-card[data-screen="screenEditData"]').click());
    await new Promise(r => setTimeout(r, 500));

    await page.waitForSelector('#editDataFilterType', { timeout: 5000 });
    await page.select('#editDataFilterType', 'invasive');
    await new Promise(r => setTimeout(r, 500));

    const listHtml = await page.$eval('#editDataList', el => el.innerHTML);
    expect(listHtml).toContain('Lantana camara');
  });
});
