const puppeteer = require('puppeteer');

(async () => {
    console.log("Launching puppeteer...");
    const browser = await puppeteer.launch({ headless: true });
    console.log("Launched! Creating page...");
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    console.log("Going to localhost...");
    await page.goto('http://localhost:8080');
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Evaluate in browser to open the modal
    await page.evaluate(() => {
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
           loginScreen.style.display = 'none';
        }
        document.getElementById('modalNewSurvey').classList.add('show');
    });

    await new Promise(r => setTimeout(r, 500));

    // type in survey name
    await page.type('#surveyName', 'Test Survey');
    
    console.log('Clicking button...');
    await page.click('#btnSaveSurvey');
    
    await new Promise(r => setTimeout(r, 2000));
    console.log('Checking modal visibility...');
    const result = await page.evaluate(() => {
        return document.getElementById('modalNewSurvey').classList.contains('show');
    });
    console.log('Modal is showing: ' + result);
    
    await browser.close();
})();
