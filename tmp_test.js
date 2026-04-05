const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        page.on('console', msg => console.log('LOG:', msg.text()));
        
        await page.goto('http://localhost:8080');
        await new Promise(r => setTimeout(r, 3500)); // Wait for login splash

        const isLoginVisible = await page.evaluate(() => {
            const ls = document.getElementById('loginScreen');
            return ls && window.getComputedStyle(ls).display !== 'none';
        });
        console.log('Is login visible:', isLoginVisible);

        if (isLoginVisible) {
            await page.evaluate(() => {
                document.getElementById('loginEmail').value = 'Test User';
                document.getElementById('btnSignIn').click();
            });
            await new Promise(r => setTimeout(r, 1000));
            console.log('Logged in as Test User.');
        }

        console.log('Clicking tools...');
        await page.evaluate(() => {
            const btn = document.querySelector('.nav-btn[data-screen="screenToolbar"]');
            if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 500));
        
        const activeScreen1 = await page.evaluate(() => {
            const s = document.querySelector('.screen.active');
            return s ? s.id : null;
        });
        console.log('Active screen after Tools click:', activeScreen1);

        console.log('Clicking Data...');
        await page.evaluate(() => {
            const btn = document.querySelector('.nav-btn[data-screen="screenData"]');
            if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 500));

        const activeScreen2 = await page.evaluate(() => {
            const s = document.querySelector('.screen.active');
            return s ? s.id : null;
        });
        console.log('Active screen after Data click:', activeScreen2);

        await browser.close();
    } catch(e) {
        console.error('Error:', e);
    }
})();
