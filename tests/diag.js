const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.error('REQUEST FAILED:', request.url(), request.failure().errorText));

  try {
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });
    console.log('Page loaded successfully.');
    
    // Check if the dashboard is visible
    const dashVisible = await page.$eval('#screenDashboard', el => el.classList.contains('active'));
    console.log('Is Dashboard Active?', dashVisible);
    
    // Check if splash is hidden
    const splash = await page.$('#splashScreen');
    console.log('Splash exists?', !!splash);
    
  } catch (e) {
    console.error('Error during navigation:', e);
  } finally {
    await browser.close();
  }
})();
