const puppeteer = require('puppeteer');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  await page.goto('http://localhost:8080');
  await wait(1500);
  await page.evaluate(() => { const b = document.getElementById('btnSkipLogin'); if(b) b.click(); });
  await wait(1000);
  await page.evaluate(() => document.querySelector('[data-screen="screenToolbar"]').click());
  await wait(800);
  await page.evaluate(() => document.querySelector('#btnNewSurvey').click());
  await wait(500);
  await page.type('#surveyName', 'TestGermplasm123');
  await page.evaluate(() => document.querySelector('#btnSaveSurvey').click());
  await wait(1500);
  
  await page.evaluate(() => document.querySelector('[data-tool="screenGermplasm"]').click());
  await wait(800);
  
  await page.evaluate(() => document.querySelector('.g-body-card[data-b="nbpgr"]').click());
  await wait(800);
  
  await page.type('#germ_nbpgr_speciesScientific', 'Shorea robusta');
  console.log('BEFORE CLICKING SAVE');
  await page.evaluate(() => {
     console.log('Clicking Save btn', document.querySelector('#btnGSaveRec'));
     document.querySelector('#btnGSaveRec').click();
  });
  await wait(2000);
  
  const toastText = await page.evaluate(() => document.getElementById('toast') ? document.getElementById('toast').textContent : 'NO TOAST');
  console.log('TOAST:', toastText);

  const html = await page.evaluate(() => {
     const list = document.querySelector('#germListCont');
     return list ? list.innerHTML : 'LIST NOT FOUND';
  });
  console.log('LIST HTML:', html);
  
  console.log('Test End');
  await browser.close();
})();
