// src/modules/germplasm.js

import { $, $$, toast, switchScreen, fcConfirm } from './ui.js';
import { Store } from './storage.js';
import { curPos } from './gps.js';

import { renderICFRE, renderNBPGR, renderISTA, emptyICFRE, emptyNBPGR, emptyISTA } from './germplasm-ui.js';

const BODIES = {
  icfre: { 
    id:"icfre", name:"ICFRE", full:"Indian Council of Forestry Research & Education", 
    ministry:"MoEF&CC, Govt. of India", focus:"Field Collection & Seed Certification", 
    icon:`<svg class="anim-tool-svg" viewBox="0 0 100 100"><path d="M50 85 V45 M50 55 L30 35 M50 65 L75 45" stroke="var(--emerald)" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="50" cy="35" r="15" fill="var(--emerald-glow)" stroke="var(--emerald)" stroke-width="2" stroke-dasharray="2 2" class="anim-svg-flow"/><path d="M30 85 H70" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round"/></svg>`, 
    tag:"Forest Seed Management Manual · SOPs 2023", 
    desc:"For forest seed field collection, seed zone demarcation, reproductive material categorisation, and stand/mother-tree documentation as per ICFRE/MoEF guidelines." 
  },
  nbpgr: { 
    id:"nbpgr", name:"ICAR-NBPGR", full:"National Bureau of Plant Genetic Resources", 
    ministry:"ICAR, Govt. of India", focus:"Ex-Situ Genebank Conservation", 
    icon:`<svg class="anim-tool-svg" viewBox="0 0 100 100"><rect x="35" y="40" width="30" height="45" rx="5" stroke="var(--sky)" stroke-width="3" fill="var(--sky-glow)"/><path d="M40 50 Q50 40 60 50 Q50 60 40 50" stroke="var(--sky)" stroke-width="2" fill="none" class="anim-svg-flow"/><path d="M35 35 H65" stroke="var(--text-muted)" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="25" r="5" fill="var(--amber)"/><path d="M50 30 V35" stroke="var(--amber)" stroke-width="2"/></svg>`, 
    tag:"National Genebank Standards · Passport Data Protocol", 
    desc:"For accession passport documentation, IC number assignment, drying/storage protocols, seed viability, plant quarantine clearance, and MTA compliance for the National Genebank." 
  },
  ista: { 
    id:"ista", name:"ISTA / OECD", full:"International Seed Testing Association / OECD Forest Scheme", 
    ministry:"International Standards (adopted by India)", focus:"Seed Testing & Trade Certification", 
    icon:`<svg class="anim-tool-svg" viewBox="0 0 100 100"><path d="M30 85 H70 M50 85 V75 M50 75 L35 55 L45 35 L65 55 L55 75 Z" stroke="var(--violet)" stroke-width="3" fill="var(--violet-glow)"/><circle cx="55" cy="45" r="8" stroke="var(--cyan)" stroke-width="2" fill="none"/><path d="M70 45 L85 45" stroke="var(--cyan)" stroke-width="2" class="anim-svg-flow"/><rect x="35" y="20" width="10" height="5" stroke="var(--violet)" stroke-width="2" fill="none"/></svg>`, 
    tag:"ISTA Rules 2024 · OECD Forest Seed Scheme", 
    desc:"For seed lot certification, purity analysis, germination testing, moisture content, 1000-seed weight, vigour testing, and OECD forest scheme certification for domestic/international trade." 
  }
};

let currentBody = null;
let currentView = 'home'; // home, form, list

// ─── LOGIC ────────────────────────────────────────────────────────
export function init() {
  renderHome();
}

/**
 * Called by main.js every time the screenGermplasm screen is activated.
 * Always starts from the home view for clean system-navigation behaviour.
 */
export function onScreenEnter() {
  currentView = 'home';
  currentBody = null;
  renderHome();
}

function handleAutoGPS() {
  if (curPos.lat) {
    if ($('#germ_icfre_latitude')) $('#germ_icfre_latitude').value = curPos.lat.toFixed(6);
    if ($('#germ_icfre_longitude')) $('#germ_icfre_longitude').value = curPos.lng.toFixed(6);
    if ($('#germ_icfre_altitude') && curPos.alt) $('#germ_icfre_altitude').value = Math.round(curPos.alt);
    if ($('#germ_nbpgr_latitude')) $('#germ_nbpgr_latitude').value = curPos.lat.toFixed(6);
    if ($('#germ_nbpgr_longitude')) $('#germ_nbpgr_longitude').value = curPos.lng.toFixed(6);
    if ($('#germ_nbpgr_altitude') && curPos.alt) $('#germ_nbpgr_altitude').value = Math.round(curPos.alt);
    toast('GPS coordinates filled');
  } else {
    toast('No GPS signal — enter coordinates manually', true);
  }
}

function getHeaderHtml(title) {
  return `
    <div class="screen-header">
      <h2>${title}</h2>
    </div>
    <div class="active-survey-bar">
       <span class="active-label">Active:</span>
       <span class="active-name" id="germTopSurveyName">No survey</span>
    </div>
  `;
}

export async function refreshGermplasmUI() {
  const mount = $('#germplasmMount');
  if (!mount) return;

  // Home view — no survey needed
  if (currentView === 'home') {
    // FIX #2: await renderHome so DOM is fully settled before callers/tests proceed.
    await renderHome();
    return;
  }

  // Form view — render immediately, survey only needed at save time
  if (currentView === 'form' && currentBody) {
    const b = BODIES[currentBody];
    let fieldsHtml = '';
    if (currentBody === 'icfre') fieldsHtml = renderICFRE();
    if (currentBody === 'nbpgr') fieldsHtml = renderNBPGR();
    if (currentBody === 'ista') fieldsHtml = renderISTA();

    mount.innerHTML = getHeaderHtml(`New Record &nbsp;<span style="font-weight:400;font-size:0.8em;opacity:0.7;">${b.name}</span>`) + `
      <div style="padding:var(--sp-md);">
        ${fieldsHtml}
        <button id="btnGSaveRec" class="btn btn-primary btn-block mt-md">Save Record</button>
      </div>
    `;

    // Update active survey name if available
    Store.getActive().then(s => {
      if (s && $('#germTopSurveyName')) $('#germTopSurveyName').textContent = s.name;
    });

    // FIX #3: Bind each GPS button by its unique ID.
    if ($('#btnGermICFREGPS')) $('#btnGermICFREGPS').addEventListener('click', handleAutoGPS);
    if ($('#btnGermNBPGRGPS')) $('#btnGermNBPGRGPS').addEventListener('click', handleAutoGPS);
    // The 'btnGCancelRec' button was removed; users rely on the system back button.

    // Auto-fill today's date
    const isoDate = new Date().toISOString().split('T')[0];
    if ($('#germ_icfre_collectionDate')) $('#germ_icfre_collectionDate').value = isoDate;
    if ($('#germ_nbpgr_acquisitionDate')) $('#germ_nbpgr_acquisitionDate').value = isoDate;
    if ($('#germ_ista_samplingDate')) $('#germ_ista_samplingDate').value = isoDate;

    // Save listener
    const saveBtn = document.getElementById('btnGSaveRec');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        console.log('germplasm.js: SAVE BTN CLICKED!');
        try {
          const spc = $('#germ_' + currentBody + '_speciesScientific').value.trim();
          console.log('species extracted:', spc);
          if (!spc) { toast('Scientific name is required.', true); return; }

          const sv = await Store.getActive();
          if (!sv) { toast('No active survey — select one in the Tools tab.', true); return; }

          const keys = currentBody === 'icfre' ? emptyICFRE : currentBody === 'nbpgr' ? emptyNBPGR : emptyISTA;
          const rec = { id: Date.now(), bodyId: currentBody };
          keys.forEach(k => {
            const el = $('#germ_' + currentBody + '_' + k);
            rec[k] = el ? el.value : '';
          });

          sv.germplasm = sv.germplasm || [];
          sv.germplasm.unshift(rec);
          await Store.update(sv);

          toast('Record saved!');
          currentView = 'list';
          await refreshGermplasmUI();
        } catch (e) {
          console.error(e);
          toast('Error saving record.', true);
        }
      });
      console.log('germplasm.js: ATTACHED save listener to btnGSaveRec');
    } else {
      console.log('germplasm.js: NO saveBtn found to attach to!');
    }
    return;
  }

  // List view — needs active survey
  const s = await Store.getActive();
  if (!s) {
    mount.innerHTML = getHeaderHtml('Germplasm <span>Registry</span>') + `
      <div style="padding:var(--sp-xl); text-align:center; color:var(--text-muted);">
        
        <p>No active survey selected.</p>
        <p style="font-size:0.85rem;">Go to <strong>Tools</strong> and select or create a survey first.</p>
        <button class="btn btn-primary mt-md" id="btnGGoTools">Go to Tools</button>
      </div>
    `;
    document.getElementById('btnGGoTools').addEventListener('click', () => switchScreen('screenToolbar'));
    return;
  }
  const records = s.germplasm || [];

  if (currentView === 'list') {
    let ht = getHeaderHtml('Germplasm <span>Registry</span>');
    ht += `
      <div style="padding: 0 var(--sp-md);">
        <div class="settings-tabs settings-tabs-custom" style="margin-bottom: var(--sp-md);">
          <button class="btn btn-sm settings-tab active btn-g-filter" data-b="all">All (${records.length})</button>
          ${Object.keys(BODIES).map(k => `<button class="btn btn-sm btn-ghost settings-tab btn-g-filter" data-b="${k}">${BODIES[k].icon} ${BODIES[k].name}</button>`).join('')}
        </div>
        <div class="form-row" style="margin-bottom: var(--sp-md);">
           <button class="btn btn-ghost" id="btnGNavHome" style="flex:1; border:1px solid var(--border);">Rules / Forms</button>
           <button class="btn btn-primary" style="flex:1;">Records (${records.length})</button>
        </div>
        <div id="germListCont" style="padding-bottom: 20px;"></div>
      </div>
    `;
    mount.innerHTML = ht;
    if (s.name && $('#germTopSurveyName')) $('#germTopSurveyName').textContent = s.name;

    // FIX #2: await so body cards are in DOM before any test waitForSelector.
    document.getElementById('btnGNavHome').addEventListener('click', async () => { currentView = 'home'; await refreshGermplasmUI(); });

    const applyFilter = (fBody) => {
      $$('.btn-g-filter').forEach(b => {
        const isSel = (b.dataset.b === fBody);
        if (isSel) { b.classList.add('btn-primary', 'active'); b.classList.remove('btn-ghost'); }
        else { b.classList.add('btn-ghost'); b.classList.remove('btn-primary', 'active'); }
      });
      
      const filtered = fBody === 'all' ? records : records.filter(r => r.bodyId === fBody);
      const cont = $('#germListCont');
      
      if (filtered.length === 0) {
        cont.innerHTML = `
          <div class="empty-state" style="padding:var(--sp-xl) 0;text-align:center;color:var(--text-muted);background:var(--bg-deep);border-radius:var(--radius-md);">
            
            <div>No ${fBody === 'all' ? '' : BODIES[fBody].name} records found yet</div>
            <button class="btn btn-primary mt-md" id="btnGNewFirst">Add Record</button>
          </div>
        `;
        $('#btnGNewFirst')?.addEventListener('click', () => { currentView = 'home'; refreshGermplasmUI(); });
      } else {
        cont.innerHTML = filtered.map(r => {
          const body = BODIES[r.bodyId];
          return `
            <div class="form-card" style="position:relative;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:flex; gap:var(--sp-md); align-items:center;">
                  <div style="width:40px; height:40px;">${body.icon}</div>
                  <div>
                    <div class="g-card-meta">${body.name}</div>
                    <div style="font-size:1.05rem; color:var(--text-primary); font-weight:700; font-style:italic;">${r.speciesScientific || '—'}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">${r.speciesCommon || ''}</div>
                  </div>
                </div>
                <button class="btn-ghost btn-g-del" data-id="${r.id}" style="color:var(--red); padding:4px;">✕</button>
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:12px; display:flex; gap:12px; flex-wrap:wrap; font-weight:500;">
                ${r.collectionDate||r.acquisitionDate||r.samplingDate ? `<span>${r.collectionDate||r.acquisitionDate||r.samplingDate}</span>` : ''}
                ${r.district||r.collectionDistrict ? `<span>${r.district||r.collectionDistrict}</span>` : ''}
                ${r.collectorName||r.samplingOfficer ? `<span>${r.collectorName||r.samplingOfficer}</span>` : ''}
              </div>
            </div>
          `;
        }).join('');

        $$('.btn-g-del').forEach(b => {
          b.addEventListener('click', async () => {
            if (await fcConfirm('Delete this germplasm record?')) {
              const sv = await Store.getActive();
              sv.germplasm = sv.germplasm.filter(x => x.id != b.dataset.id);
              await Store.update(sv);
              refreshGermplasmUI();
            }
          });
        });
      }
    };

    $$('.btn-g-filter').forEach(b => b.addEventListener('click', () => applyFilter(b.dataset.b)));
    applyFilter('all');
  }
}

/**
 * FIX #2: renderHome is now async and awaits Store.getActive() directly.
 * This eliminates the race condition where DOM was populated asynchronously
 * in an unawaited .then(), causing Puppeteer waitForSelector to fire before
 * body cards existed. All callers must await this function.
 */
async function renderHome() {
  const mount = $('#germplasmMount');
  if (!mount) return;
  const sv = await Store.getActive();
  const rc = sv ? (sv.germplasm ? sv.germplasm.length : 0) : 0;
  let bHtml = Object.keys(BODIES).map(k => {
    const b = BODIES[k];
    return `
      <div class="form-card g-body-card" data-b="${k}">
        <div style="display:flex; align-items:flex-start; gap:var(--sp-lg);">
          <div class="g-icon-large" style="width:60px; height:60px; flex-shrink:0;">${b.icon}</div>
          <div style="flex:1;">
            <h3 class="card-title" style="margin-bottom:4px;">${b.name} <span class="badge">${b.focus}</span></h3>
            <div class="g-card-meta">${b.full}</div>
            <div class="card-desc" style="margin-bottom:0;">${b.desc}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  mount.innerHTML = getHeaderHtml('Germplasm <span>Collector</span>') + `
    <div style="padding:var(--sp-md);">
      <div class="form-row" style="margin-bottom:var(--sp-md);">
         <button class="btn btn-primary" id="btnGNavHome" style="flex:1;">Rules / Forms</button>
         <button class="btn btn-ghost" id="btnGNavList" style="flex:1; border:1px solid var(--border);">Saved Records (${rc})</button>
      </div>
      <p class="card-desc" style="text-align:center; margin-bottom:var(--sp-md);">Select a regulatory body to add new germplasm material:</p>
      ${bHtml}
    </div>
  `;

  if (sv && sv.name && $('#germTopSurveyName')) $('#germTopSurveyName').textContent = sv.name;

  // FIX #2: All event listeners wired after DOM is synchronously injected.
  document.getElementById('btnGNavList').addEventListener('click', async () => { currentView = 'list'; await refreshGermplasmUI(); });

  $$('.g-body-card').forEach(c => {
    c.addEventListener('click', async () => {
      currentBody = c.dataset.b;
      currentView = 'form';
      await refreshGermplasmUI();
    });
  });
}

