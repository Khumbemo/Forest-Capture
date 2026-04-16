/**
 * Diagnostic script — finds actual element IDs for the 4 failing checks.
 */
const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto('http://localhost:8080', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 4500));
  await p.evaluate(() => { const s = document.getElementById('btnSkipLogin'); if (s) s.click(); });
  await new Promise(r => setTimeout(r, 800));

  // 1. Welcome title
  const nav = sel => p.evaluate(s => document.querySelector(s), sel);
  const wh = await p.evaluate(() => {
    const candidates = ['h2', 'h3', '.welcome-title', '.hello', '#welcomeTitle', '#dashTitle'];
    return candidates.map(sel => {
      const el = document.querySelector('#screenDashboard ' + sel) || document.querySelector(sel);
      return el ? sel + ' => "' + el.textContent.trim().slice(0, 50) + '"' : null;
    }).filter(Boolean);
  });
  console.log('\n[Welcome candidates]', wh);

  // 2. CBI severity label
  await p.evaluate(() => {
    const c = document.querySelector('.stat-card[data-screen="screenDisturbCBI"]');
    if (c) c.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  const cbi = await p.evaluate(() => {
    return [...document.querySelectorAll('[id]')]
      .filter(e => /cbi|severity/i.test(e.id))
      .map(e => ({ id: e.id, tag: e.tagName, txt: e.textContent.trim().slice(0, 30) }));
  });
  console.log('\n[CBI elements]', cbi);

  // 3. Notes textarea
  await p.evaluate(() => {
    const b2 = document.querySelector('button[data-screen="screenToolbar"]');
    if (b2) b2.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await p.evaluate(() => {
    const c = document.querySelector('.stat-card[data-screen="screenPhotos"]');
    if (c) c.click();
  });
  await new Promise(r => setTimeout(r, 800));
  const notes = await p.evaluate(() => {
    return [...document.querySelectorAll('textarea, [id*="note"]')]
      .map(e => ({ tag: e.tagName, id: e.id, ph: e.placeholder || '' }))
      .slice(0, 10);
  });
  console.log('\n[Notes elements]', notes);

  // 4. Herbarium scientific name field
  await p.evaluate(() => {
    const b2 = document.querySelector('button[data-screen="screenToolbar"]');
    if (b2) b2.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await p.evaluate(() => {
    const c = document.querySelector('.stat-card[data-screen="screenHerbarium"]');
    if (c) c.click();
  });
  await new Promise(r => setTimeout(r, 800));
  const herb = await p.evaluate(() => {
    return [...document.querySelectorAll('input, select, textarea')]
      .filter(e => e.id)
      .map(e => ({ id: e.id, ph: e.placeholder || '' }))
      .slice(0, 15);
  });
  console.log('\n[Herbarium inputs]', herb);

  await b.close();
  console.log('\nDone.');
})();
