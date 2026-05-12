// src/modules/herbarium.js

import { $, toast, esc, fcConfirm } from './ui.js';
import { Store, MediaStore } from './storage.js';
import { fillGPSField } from './gps.js';

import { attachAutocomplete } from './species-autocomplete.js';
import { storage, ensureAuth } from './firebase.js';
import { ref, uploadString, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js';

let currentImageUrl = null;

export function initHerbarium() {
  attachAutocomplete('herbScientific', { maxResults: 10 });
  const today = new Date().toISOString().split('T')[0];
  if (!$('#herbDate').value) $('#herbDate').value = today;
  refreshHerbariumTable();
}

export async function handleHerbariumPhoto(file) {
  if (!file) {
    currentImageUrl = null;
    $('#herbPhotoPreview').style.display = 'none';
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = async () => {
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;

      const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.getElementById('herbCanvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

      // Try uploading to Firebase Storage
      const user = await ensureAuth();
      const s = await Store.getActive();
      if (user && s) {
        try {
          const fileName = `herb_${Date.now()}.jpg`;
          const storageRef = ref(storage, `users/${user.uid}/surveys/${s.id}/herbarium/${fileName}`);
          const snapshot = await uploadString(storageRef, dataUrl, 'data_url');
          const downloadURL = await getDownloadURL(snapshot.ref);
          currentImageUrl = downloadURL; // Store URL, not base64
        } catch (err) {
          console.warn('Herbarium photo upload failed, saving to IndexedDB', err);
          // Offline: store in MediaStore instead of keeping base64 in memory
          const mediaId = await MediaStore.save(dataUrl);
          currentImageUrl = dataUrl; // Keep for preview
          // Store mediaId for later reference
          window._herbMediaId = mediaId;
        }
      } else {
        // Offline: save to MediaStore
        const mediaId = await MediaStore.save(dataUrl);
        currentImageUrl = dataUrl; // Keep for preview
        window._herbMediaId = mediaId;
      }

      const imgEl = document.getElementById('herbImgEl');
      imgEl.src = currentImageUrl;
      $('#herbPhotoPreview').style.display = 'flex';
      toast('Photo captured');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function getFormData() {
  const collectionNo = $('#herbCollectionNo').value.trim();
  const voucherNo = $('#herbVoucherNo').value.trim() || `VCH-${Date.now().toString().slice(-6)}`;
  const mediaId = window._herbMediaId || null;
  // Clear the temp media ID before returning
  window._herbMediaId = null;
  return {
    collectionNo,
    voucherNo,
    institution: $('#herbInstitution').value.trim(),
    family: $('#herbFamily').value.trim(),
    scientific: $('#herbScientific').value.trim(),
    localName: $('#herbLocalName').value.trim(),
    phenology: $('#herbPhenology').value,
    lifeForm: $('#herbLifeForm').value,
    date: $('#herbDate').value,
    gps: $('#herbGPS').value.trim(),
    country: $('#herbCountry').value.trim(),
    state: $('#herbState').value.trim(),
    county: $('#herbCounty').value.trim(),
    locality: $('#herbLocality').value.trim(),
    habitat: $('#herbHabitat').value.trim(),
    assocSpecies: $('#herbAssocSpecies').value.trim(),
    remarks: $('#herbRemarks').value.trim(),
    collector: $('#herbCollector').value.trim(),
    identifier: $('#herbIdentifier').value.trim(),
    dateIdentified: $('#herbDateIdentified').value,
    protocol: $('#herbProtocol').value,
    photoUrl: currentImageUrl && !currentImageUrl.startsWith('data:') ? currentImageUrl : null,
    mediaId
  };
}

export async function saveHerbarium(exportDoc = false) {
  const s = await Store.getActive();
  if (!s) { toast('Select a survey first', true); return; }
  
  const data = getFormData();
  if (!data.scientific && !data.family) {
    toast('Scientific name or Family is required', true);
    return;
  }

  // Generate & export .doc if requested (even if data is otherwise not completely saved yet)
  if (exportDoc) {
    exportHerbariumWord(data);
  }

  if (!s.herbariums) s.herbariums = [];
  
  const editIdx = $('#btnSaveHerbarium').dataset.editIdx;
  if (editIdx !== undefined && editIdx !== "") {
    s.herbariums[parseInt(editIdx)] = data;
    toast(`Voucher #${data.voucherNo} updated`);
    delete $('#btnSaveHerbarium').dataset.editIdx;
    $('#btnSaveHerbarium').textContent = 'Save to Survey';
    $('#btnExportHerbarium').textContent = 'Save & Export (.doc)';
  } else {
    s.herbariums.push(data);
    toast(`Voucher #${data.voucherNo} saved`);
  }

  await Store.update(s);
  
  // Clear form
  $('#herbScientific').value = '';
  $('#herbLocalName').value = '';
  $('#herbCollector').value = '';
  $('#herbRemarks').value = '';
  $('#herbPhotoInput').value = '';
  currentImageUrl = null;
  $('#herbPhotoPreview').style.display = 'none';
  $('#herbCollectionNo').value = '';
  $('#herbVoucherNo').value = '';
  $('#herbLifeForm').value = '';
  $('#herbCountry').value = '';
  $('#herbState').value = '';
  $('#herbCounty').value = '';
  $('#herbDateIdentified').value = '';
  $('#herbProtocol').value = 'Hand-collected';
  
  refreshHerbariumTable();
}

export async function refreshHerbariumTable() {
  const s = await Store.getActive();
  const tb = $('#herbTableBody');
  if (!s || !s.herbariums || !s.herbariums.length) {
    tb.innerHTML = '<tr><td colspan="5" class="table-empty">No vouchers logged</td></tr>';
    return;
  }
  
  let r = '';
  s.herbariums.forEach((h, i) => {
    r += `<tr>
      <td>${esc(h.voucherNo)}</td>
      <td class="species-name-cell">${esc(h.scientific || '—')}</td>
      <td>${esc(h.family || '—')}</td>
      <td>${h.date || '—'}</td>
      <td class="action-btns">
        <button data-action="eh" data-i="${i}" title="Edit">✏️</button>
        <button data-action="dw" data-doc="${i}" title="Download Word">📄</button>
        <button data-action="dh" data-i="${i}" title="Delete">🗑️</button>
      </td>
    </tr>`;
  });
  tb.innerHTML = r;

  // Edit handler
  tb.querySelectorAll('[data-action="eh"]').forEach(b => {
    b.onclick = async () => {
      const idx = +b.dataset.i;
      const h = s.herbariums[idx];
      $('#herbCollectionNo').value = h.collectionNo || '';
      $('#herbVoucherNo').value = h.voucherNo || '';
      $('#herbInstitution').value = h.institution || '';
      $('#herbFamily').value = h.family || '';
      $('#herbScientific').value = h.scientific || '';
      $('#herbLocalName').value = h.localName || '';
      $('#herbPhenology').value = h.phenology || 'Vegetative/Sterile';
      $('#herbLifeForm').value = h.lifeForm || '';
      $('#herbDate').value = h.date || '';
      $('#herbGPS').value = h.gps || '';
      $('#herbCountry').value = h.country || '';
      $('#herbState').value = h.state || '';
      $('#herbCounty').value = h.county || '';
      $('#herbLocality').value = h.locality || '';
      $('#herbHabitat').value = h.habitat || '';
      $('#herbAssocSpecies').value = h.assocSpecies || '';
      $('#herbRemarks').value = h.remarks || '';
      $('#herbCollector').value = h.collector || '';
      $('#herbIdentifier').value = h.identifier || '';
      $('#herbDateIdentified').value = h.dateIdentified || '';
      $('#herbProtocol').value = h.protocol || 'Hand-collected';
      
      currentImageUrl = h.photoUrl || null;
      if (!currentImageUrl && h.mediaId) {
        currentImageUrl = await MediaStore.get(h.mediaId);
      }
      if (currentImageUrl) {
        $('#herbImgEl').src = currentImageUrl;
        $('#herbPhotoPreview').style.display = 'flex';
      } else {
        $('#herbPhotoPreview').style.display = 'none';
      }

      $('#btnSaveHerbarium').textContent = 'Update Voucher';
      $('#btnExportHerbarium').textContent = 'Update & Export';
      $('#btnSaveHerbarium').dataset.editIdx = idx;
      $('#screenHerbarium').scrollTo({ top: 0, behavior: 'smooth' });
      toast('Voucher loaded for editing');
    };
  });

  // Download DOC handler
  tb.querySelectorAll('[data-action="dw"]').forEach(b => {
    b.onclick = () => {
      exportHerbariumWord(s.herbariums[+b.dataset.doc]);
      toast('Exporting...');
    };
  });

  // Delete handler
  tb.querySelectorAll('[data-action="dh"]').forEach(b => {
    b.onclick = async () => {
      const idx = +b.dataset.i;
      if (!await fcConfirm(`Delete Voucher #${s.herbariums[idx].voucherNo}?`)) return;
      s.herbariums.splice(idx, 1);
      await Store.update(s);
      refreshHerbariumTable();
      toast('Voucher deleted');
    };
  });
}

function exportHerbariumWord(data) {
  const content = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Herbarium Voucher</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 12pt; }
        .voucher-box { border: 2px solid #000; padding: 15px; margin-top: 20px; width: 100%; max-width: 500px; page-break-inside: avoid; }
        .title { text-align: center; font-weight: bold; font-size: 16pt; margin-bottom: 5px; text-transform: uppercase; }
        .subtitle { text-align: center; font-size: 12pt; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 4px; vertical-align: top; }
        .label { font-weight: bold; width: 35%; }
        .scientific { font-style: italic; font-weight: bold; }
        .img-container { text-align: center; margin-bottom: 20px; }
        img { max-width: 500px; max-height: 600px; }
      </style>
    </head>
    <body>
      <!-- Specimen Image -->
      ${data.photoUrl ? `<div class="img-container"><img src="${data.photoUrl}" /></div>` : ''}

      <!-- Herbarium Label -->
      <div class="voucher-box">
        <div class="title">FLORA OF ${esc(data.locality ? data.locality.split(',')[0].toUpperCase() : 'REGION')}</div>
        <div class="subtitle">${esc(data.institution || 'INSTITUTION VOUCHER')}</div>
        
        <table>
          <tr><td class="label">Family:</td><td style="text-transform:uppercase;">${esc(data.family || '—')}</td></tr>
          <tr><td class="label">Scientific Name:</td><td class="scientific">${esc(data.scientific || '—')}</td></tr>
          <tr><td class="label">Common Name:</td><td>${esc(data.localName || '—')}</td></tr>
          <tr><td class="label">Plant Habit:</td><td>${esc(data.lifeForm || '—')}</td></tr>
          <tr><td class="label">Locality:</td><td>${esc(data.locality || '—')}</td></tr>
          <tr><td class="label">Region:</td><td>${esc([data.county, data.state, data.country].filter(Boolean).join(', ') || '—')}</td></tr>
          <tr><td class="label">GPS & Altitude:</td><td>${esc(data.gps || '—')}</td></tr>
          <tr><td class="label">Habitat:</td><td>${esc(data.habitat || '—')}</td></tr>
          <tr><td class="label">Associated Spp:</td><td>${esc(data.assocSpecies || '—')}</td></tr>
          <tr><td class="label">Phenology:</td><td>${esc(data.phenology || '—')}</td></tr>
          <tr><td class="label">Notes:</td><td>${esc(data.remarks || '—')}</td></tr>
        </table>
        
        <div style="margin-top: 15px; border-top: 1px solid #000; padding-top: 10px;">
          <table>
            <tr><td class="label">Collector:</td><td>${esc(data.collector || '—')}</td></tr>
            <tr><td class="label">Date:</td><td>${esc(data.date || '—')}</td></tr>
            <tr><td class="label">Protocol:</td><td>${esc(data.protocol || '—')}</td></tr>
            <tr><td class="label">Col. Number:</td><td>${esc(data.collectionNo || '—')}</td></tr>
            <tr><td class="label">Det. By:</td><td>${esc(data.identifier || '—')}</td></tr>
            <tr><td class="label">Det. Date:</td><td>${esc(data.dateIdentified || '—')}</td></tr>
            <tr><td class="label">Accession No:</td><td>${esc(data.voucherNo || '—')}</td></tr>
          </table>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = (data.scientific || 'herbarium').replace(/\W/g, '_') + '_Voucher.doc';
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function init() {
  $('#herbPhotoInput')?.addEventListener('change', e => {
      handleHerbariumPhoto(e.target.files[0]);
  });
  $('#btnSaveHerbarium')?.addEventListener('click', () => {
      saveHerbarium(false);
  });
  $('#btnExportHerbarium')?.addEventListener('click', () => {
      saveHerbarium(true);
  });
  $('#btnHerbGPS')?.addEventListener('click', () => fillGPSField('#herbGPS', true));
}
