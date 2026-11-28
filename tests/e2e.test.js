// The app guards navigation with an "unsaved changes" confirm dialog
// (window.fcIsDirty, reset on a successful save — see quadrat.js /
// ui.js switchScreen()). If a prior test's save hasn't finished
// resetting that flag by the time the next test navigates away, this
// dialog appears and silently blocks the click the test issued. Call
// this before/after any cross-screen navigation so a stray dialog
// never strands a later test on the wrong screen.
async function dismissUnsavedChangesDialog(page) {
  const okBtn = await page.$('.fc-modal-overlay.show .fc-modal-ok');
  if (okBtn) {
    await page.evaluate(() => document.querySelector('.fc-modal-overlay.show .fc-modal-ok')?.click());
    await new Promise(r => setTimeout(r, 300));
  }
}

describe('Forest Capture E2E UI Tests', () => {
  beforeAll(async () => {
    // Navigate to the local server
    await page.goto('http://localhost:8080');
    // Set a consistent viewport
    await page.setViewport({ width: 390, height: 844 }); // iPhone 12 size
  });

  test('Page loads and initializes dashboard', async () => {
    // Wait for the main app container
    await page.waitForSelector('#appMain', { timeout: 5000 });
    
    // Check if splash screen goes away (max 2.8s)
    await new Promise(r => setTimeout(r, 3000));
    
    // Check if we need to skip login
    const skipBtn = await page.$('#btnSkipLogin');
    if (skipBtn) {
      try { await page.click('#btnSkipLogin'); } catch(e) {}
    }

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('Forest Capture');
  });

  test('Navigate to Tools and Create a new survey', async () => {
    // Click Tools tab (data-screen="screenToolbar")
    await page.waitForSelector('button[data-screen="screenToolbar"]', { timeout: 3000 });
    await page.click('button[data-screen="screenToolbar"]');
    await new Promise(r => setTimeout(r, 500));

    // Click New Survey button
    await page.waitForSelector('#btnNewSurvey', { timeout: 2000 });
    await page.evaluate(() => document.querySelector('#btnNewSurvey').click());

    // Wait for Modal and type name
    await page.waitForSelector('#surveyName', { timeout: 2000 });
    await page.type('#surveyName', 'E2E Puppeteer Survey');

    // Save
    await page.evaluate(() => document.querySelector('#btnSaveSurvey').click());
    await new Promise(r => setTimeout(r, 1000));
  });

  test('Open Quadrat Tool and add a species', async () => {
    try {
      // Try to click Quadrat card
      // FIX #13: stat-cards now use data-screen (was data-tool)
      await page.waitForSelector('.stat-card[data-screen="screenQuadrat"]', { timeout: 2000 });
      await page.evaluate(() => document.querySelector('.stat-card[data-screen="screenQuadrat"]').click());
      await new Promise(r => setTimeout(r, 1000));
      
      // Wait for quadrat inputs
      await page.waitForSelector('#quadratSize', { timeout: 2000 });
      await page.type('#quadratSize', '100');
      await page.type('#quadratNumber', '1');

      // Click Add Species button
      await page.evaluate(() => document.querySelector('#btnAddSpecies').click());
      await new Promise(r => setTimeout(r, 500));
      
      // Type a species name so Analytics counts it
      await page.type('.sp-name', 'Test Tree');
      await new Promise(r => setTimeout(r, 500));
      await new Promise(r => setTimeout(r, 1000));
      
      // Since it's dynamic DOM, we will just try to hit save quadrat.
      // Store.update() runs async work (local cache write, background
      // Firestore sync attempt) after this click resolves — give it real
      // time to finish and reset window.fcIsDirty before the next test
      // tries to navigate away.
      await page.evaluate(() => document.querySelector('#btnSaveQuadrat').click());
      await new Promise(r => setTimeout(r, 1500));
      await dismissUnsavedChangesDialog(page);
    } catch(e) {
      console.log('Quadrat tool err: ' + e.message);
    }
  });

  test('Check Analytics Tab', async () => {
    // Navigate to Analytics tool instead of nav (Analytics is a tool card)
    await page.waitForSelector('button[data-screen="screenToolbar"]');
    await page.evaluate(() => document.querySelector('button[data-screen="screenToolbar"]').click());
    await new Promise(r => setTimeout(r, 500));
    await dismissUnsavedChangesDialog(page);

    // FIX #13: stat-cards now use data-screen (was data-tool)
    await page.waitForSelector('.stat-card[data-screen="screenAnalytics"]');
    await page.evaluate(() => document.querySelector('.stat-card[data-screen="screenAnalytics"]').click());
    await new Promise(r => setTimeout(r, 1000));
    await dismissUnsavedChangesDialog(page);

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.toUpperCase()).toContain('RICHNESS');
  });

  test('Settings: account button re-translates on every language switch, not just the first', async () => {
    // Regression test for a bug found during a live walkthrough: the
    // Settings account button's "Sign Out"/"Offline Mode"/"Log In" text
    // was set via a raw string literal with no dictionary entry at all,
    // so it stayed stuck in English no matter the active language — the
    // same class of bug as the aria-label gap fixed in #28. Switching
    // language and back twice over also guards against a narrower variant
    // where the fix only takes effect once, the first time, rather than
    // on every subsequent switch.
    await dismissUnsavedChangesDialog(page);
    await page.waitForSelector('#btnSettings', { timeout: 3000 });
    await page.evaluate(() => document.querySelector('#btnSettings').click());
    await page.waitForSelector('.settings-panel.show', { timeout: 3000 });

    await page.waitForSelector('#btnSignOut', { timeout: 3000 });
    const initial = await page.$eval('#btnSignOut', el => el.textContent.trim());
    expect(initial).toBe('Log In');

    await page.waitForSelector('.settings-tab[data-tab="setLang"]', { timeout: 3000 });
    await page.evaluate(() => document.querySelector('.settings-tab[data-tab="setLang"]').click());
    await page.waitForSelector('#settingLanguage', { timeout: 3000 });

    await page.select('#settingLanguage', 'fr');
    await page.waitForFunction(
      () => document.getElementById('btnSignOut').textContent.trim() === 'Se Connecter',
      { timeout: 5000 }
    );

    await page.select('#settingLanguage', 'en');
    await page.waitForFunction(
      () => document.getElementById('btnSignOut').textContent.trim() === 'Log In',
      { timeout: 5000 }
    );

    await page.evaluate(() => document.querySelector('#btnSettingsClose').click());
    await new Promise(r => setTimeout(r, 300));
  });

  test('Clinometer: falls back to a manual angle slider when no real sensor reports data', async () => {
    // Regression test for a bug found during a live walkthrough: on any
    // device (or browser) where `DeviceOrientationEvent` exists as an API
    // but no real motion sensor ever actually fires it — true for every
    // desktop/laptop browser, not just this headless one — the Clinometer
    // used the API's mere presence as proof a sensor was available, so it
    // never showed the manual-entry fallback and height stayed stuck at
    // 0.00m with no way to enter an angle.
    await dismissUnsavedChangesDialog(page);
    await page.waitForSelector('button[data-screen="screenToolbar"]', { timeout: 3000 });
    await page.evaluate(() => document.querySelector('button[data-screen="screenToolbar"]').click());
    await new Promise(r => setTimeout(r, 500));
    await dismissUnsavedChangesDialog(page);

    await page.waitForSelector('.stat-card[data-screen="screenClinometer"]', { timeout: 5000 });
    await page.evaluate(() => document.querySelector('.stat-card[data-screen="screenClinometer"]').click());

    // The fallback only engages after a short grace period (giving a real
    // sensor, if any, a chance to report in first), so poll for it rather
    // than assuming a fixed delay is enough.
    await page.waitForFunction(
      () => document.getElementById('clinoManualFallback')?.style.display === 'block',
      { timeout: 5000 }
    );

    await page.waitForSelector('#clinoDistance', { timeout: 3000 });
    await page.type('#clinoDistance', '20');

    const slider = await page.$('#clinoManualSlider');
    const setSliderTo = async (value) => {
      await page.evaluate((el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, slider, value);
      // Height is computed from the low-pass-filtered pitch, not the raw
      // slider value, so give it time to converge before locking.
      await new Promise(r => setTimeout(r, 1000));
    };

    await setSliderTo(-10);
    await page.evaluate(() => document.getElementById('btnLockBase').click());

    await setSliderTo(25);
    await page.evaluate(() => document.getElementById('btnLockTop').click());

    // The result only updates on the next requestAnimationFrame tick
    // after both angles are locked, not synchronously on the click.
    await page.waitForFunction(
      () => /^\d+\.\d{2} m$/.test(document.getElementById('clinoHeightResult')?.textContent.trim()),
      { timeout: 3000 }
    );
    const resultText = await page.$eval('#clinoHeightResult', el => el.textContent.trim());
    expect(resultText).toMatch(/^\d+\.\d{2} m$/);
    expect(parseFloat(resultText)).toBeGreaterThan(0);
  });
});
