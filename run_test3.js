const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto('http://localhost:8080');
    
    // Unregister service workers 
    await page.evaluate(async () => {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (let reg of regs) {
                await reg.unregister();
            }
        }
    });

    // Reload without cache
    await page.reload({ waitUntil: 'networkidle0' });

    // Try to open the modal and click
    await page.evaluate(() => {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('modalNewSurvey').classList.add('show');
    });

    await page.type('#surveyName', 'Test Survey Real');
    
    console.log('Clicking button...');
    await page.click('#btnSaveSurvey');
    
    await new Promise(r => setTimeout(r, 2000));
    const result = await page.evaluate(() => {
        return document.getElementById('modalNewSurvey').classList.contains('show');
    });
    console.log('Modal is showing: ' + result);
    
    await browser.close();
})();
