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
    await page.evaluate(() => document.getElementById('btnSaveInvasive').click());
    await new Promise(r => setTimeout(r, 500));

    const toastText = await page.$eval('#toast', el => el.textContent);
    expect(toastText).toContain('Scientific name is required');
  });

  test('Fill in and save a record; it appears in the logged table', async () => {
    await page.type('#invSpeciesScientific', 'Lantana camara');
    await page.select('#invCoverClass', '26-50%');
    await page.select('#invGrowthStage', 'Flowering');

    await page.evaluate(() => document.getElementById('btnSaveInvasive').click());
    await new Promise(r => setTimeout(r, 1000));

    await page.waitForSelector('#invTableBody', { timeout: 5000 });
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
    await new Promise(r => setTimeout(r, 1000));

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
