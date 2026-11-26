// src/modules/invasive.js — Invasive Species Monitoring

import { $, toast, esc, fcConfirm } from './ui.js';
import { t } from './i18n.js';
import { Store, MediaStore } from './storage.js';
import { fillGPSField } from './gps.js';
import { ensureActiveSurvey } from './survey.js';
import { attachAutocomplete } from './species-autocomplete.js';
import { ensureAuth, loadSDK } from './firebase.js';

let currentImageUrl = null;

// Bound once loadSDK() succeeds — see the matching helper in herbarium.js/media.js.
let storage, ref, uploadString, getDownloadURL;

async function ensureStorageBindings() {
  if (storage) return true;
  const s = await loadSDK();
  if (!s) return false;
  storage = s.storage;
  ({ ref, uploadString, getDownloadURL } = s.storageMod);
  return true;
}

export function initInvasive() {
  attachAutocomplete('invSpeciesScientific', { maxResults: 10 });
  const today = new Date().toISOString().split('T')[0];
  if (!$('#invDate').value) $('#invDate').value = today;
  refreshInvasiveTable();
}

export async function handleInvasivePhoto(file) {
  if (!file) {
    currentImageUrl = null;
    $('#invPhotoPreview').style.display = 'none';
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

      const canvas = document.getElementById('invCanvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

      const user = await ensureAuth();
      const s = await Store.getActive();
      if (user && s && await ensureStorageBindings()) {
        try {
          const fileName = `inv_${Date.now()}.jpg`;
          const storageRef = ref(storage, `users/${user.uid}/surveys/${s.id}/invasive/${fileName}`);
          const snapshot = await uploadString(storageRef, dataUrl, 'data_url');
          const downloadURL = await getDownloadURL(snapshot.ref);
          currentImageUrl = downloadURL;
        } catch (err) {
          console.warn('Invasive species photo upload failed, saving to IndexedDB', err);
          const mediaId = await MediaStore.save(dataUrl);
          currentImageUrl = dataUrl;
          window._invMediaId = mediaId;
        }
      } else {
        const mediaId = await MediaStore.save(dataUrl);
        currentImageUrl = dataUrl;
        window._invMediaId = mediaId;
      }

      const imgEl = document.getElementById('invImgEl');
      imgEl.src = currentImageUrl;
      $('#invPhotoPreview').style.display = 'flex';
      toast(t('Photo captured'));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function getFormData() {
  const mediaId = window._invMediaId || null;
  window._invMediaId = null;
  return {
    speciesScientific: $('#invSpeciesScientific').value.trim(),
    speciesCommon: $('#invSpeciesCommon').value.trim(),
    date: $('#invDate').value,
    observer: $('#invObserver').value.trim(),
    gps: $('#invGPS').value.trim(),
    locality: $('#invLocality').value.trim(),
    habitatType: $('#invHabitatType').value,
    infestationArea: $('#invInfestationArea').value === '' ? null : parseFloat($('#invInfestationArea').value),
    infestationAreaUnit: $('#invInfestationAreaUnit').value,
    coverClass: $('#invCoverClass').value,
    growthStage: $('#invGrowthStage').value,
    spreadRisk: $('#invSpreadRisk').value,
    controlStatus: $('#invControlStatus').value,
    controlMethod: $('#invControlMethod').value,
    controlDate: $('#invControlDate').value,
    notes: $('#invNotes').value.trim(),
    photoUrl: currentImageUrl && !currentImageUrl.startsWith('data:') ? currentImageUrl : null,
    mediaId
  };
}

export async function saveInvasive() {
  const s = await ensureActiveSurvey();
  if (!s) { toast(t('Could not start a survey — try again.'), true); return; }

  const data = getFormData();
  if (!data.speciesScientific) {
    toast(t('Scientific name is required.'), true);
    return;
  }

  if (!s.invasiveSpecies) s.invasiveSpecies = [];

  const editIdx = $('#btnSaveInvasive').dataset.editIdx;
  if (editIdx !== undefined && editIdx !== "") {
    s.invasiveSpecies[parseInt(editIdx)] = data;
    toast(t('{name} updated', { name: data.speciesScientific }));
    delete $('#btnSaveInvasive').dataset.editIdx;
    $('#btnSaveInvasive').textContent = 'Save to Survey';
  } else {
    s.invasiveSpecies.push(data);
    toast(t('{name} logged', { name: data.speciesScientific }));
  }

  await Store.update(s);

  // Clear form
  $('#invSpeciesScientific').value = '';
  $('#invSpeciesCommon').value = '';
  $('#invObserver').value = '';
  $('#invGPS').value = '';
  $('#invLocality').value = '';
  $('#invHabitatType').value = '';
  $('#invInfestationArea').value = '';
  $('#invCoverClass').value = '';
  $('#invGrowthStage').value = '';
  $('#invSpreadRisk').value = '';
  $('#invControlStatus').value = '';
  $('#invControlMethod').value = '';
  $('#invControlDate').value = '';
  $('#invNotes').value = '';
  $('#invPhotoInput').value = '';
  currentImageUrl = null;
  $('#invPhotoPreview').style.display = 'none';

  refreshInvasiveTable();
}

export async function refreshInvasiveTable() {
  const s = await Store.getActive();
  const tb = $('#invTableBody');
  if (!tb) return;
  if (!s || !s.invasiveSpecies || !s.invasiveSpecies.length) {
    tb.innerHTML = '<tr><td colspan="5" class="table-empty">No invasive species logged</td></tr>';
    return;
  }

  let r = '';
  s.invasiveSpecies.forEach((inv, i) => {
    r += `<tr>
      <td class="species-name-cell">${esc(inv.speciesScientific || '—')}</td>
      <td>${esc(inv.coverClass || '—')}</td>
      <td>${esc(inv.growthStage || '—')}</td>
      <td>${inv.date || '—'}</td>
      <td class="action-btns">
        <button data-action="ei" data-i="${i}" title="Edit" aria-label="Edit record">✏️</button>
        <button data-action="di" data-i="${i}" title="Delete" aria-label="Delete record">🗑️</button>
      </td>
    </tr>`;
  });
  tb.innerHTML = r;

  tb.querySelectorAll('[data-action="ei"]').forEach(b => {
    b.onclick = async () => {
      const idx = +b.dataset.i;
      const inv = s.invasiveSpecies[idx];
      $('#invSpeciesScientific').value = inv.speciesScientific || '';
      $('#invSpeciesCommon').value = inv.speciesCommon || '';
      $('#invDate').value = inv.date || '';
      $('#invObserver').value = inv.observer || '';
      $('#invGPS').value = inv.gps || '';
      $('#invLocality').value = inv.locality || '';
      $('#invHabitatType').value = inv.habitatType || '';
      $('#invInfestationArea').value = inv.infestationArea ?? '';
      $('#invInfestationAreaUnit').value = inv.infestationAreaUnit || 'm2';
      $('#invCoverClass').value = inv.coverClass || '';
      $('#invGrowthStage').value = inv.growthStage || '';
      $('#invSpreadRisk').value = inv.spreadRisk || '';
      $('#invControlStatus').value = inv.controlStatus || '';
      $('#invControlMethod').value = inv.controlMethod || '';
      $('#invControlDate').value = inv.controlDate || '';
      $('#invNotes').value = inv.notes || '';

      currentImageUrl = inv.photoUrl || null;
      if (!currentImageUrl && inv.mediaId) {
        currentImageUrl = await MediaStore.get(inv.mediaId);
      }
      if (currentImageUrl) {
        $('#invImgEl').src = currentImageUrl;
        $('#invPhotoPreview').style.display = 'flex';
      } else {
        $('#invPhotoPreview').style.display = 'none';
      }

      $('#btnSaveInvasive').textContent = 'Update Record';
      $('#btnSaveInvasive').dataset.editIdx = idx;
      $('#screenInvasive').scrollTo({ top: 0, behavior: 'smooth' });
      toast(t('Invasive species record loaded for editing'));
    };
  });

  tb.querySelectorAll('[data-action="di"]').forEach(b => {
    b.onclick = async () => {
      const idx = +b.dataset.i;
      if (!await fcConfirm(`Delete record for ${s.invasiveSpecies[idx].speciesScientific || 'this species'}?`)) return;
      s.invasiveSpecies.splice(idx, 1);
      await Store.update(s);
      refreshInvasiveTable();
      toast(t('Invasive species record deleted'));
    };
  });
}

export function init() {
  $('#invPhotoInput')?.addEventListener('change', e => {
    handleInvasivePhoto(e.target.files[0]);
  });
  $('#btnSaveInvasive')?.addEventListener('click', saveInvasive);
  $('#btnInvGPS')?.addEventListener('click', () => fillGPSField('#invGPS', true));
}
