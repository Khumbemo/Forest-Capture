const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
        }
    });

    page.on('pageerror', error => {
        console.log(`[PAGE ERROR] ${error.message}`);
    });

    try {
        await page.goto('http://localhost:8080', { waitUntil: 'networkidle0', timeout: 10000 });
        console.log("Page loaded successfully.");
        
        // Wait a bit to catch async errors
        await new Promise(r => setTimeout(r, 2000));
        
    } catch (e) {
        console.error("Failed to load page:", e);
    } finally {
        await browser.close();
    }
})();
