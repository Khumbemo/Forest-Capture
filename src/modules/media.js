// src/modules/media.js

import { $, toast } from './ui.js';
import { Store } from './storage.js';
import { compress } from './utils.js';

export function refreshPhotos() {
  const s = Store.getActive();
  const g = $('#photoGallery');
  if (!s || !s.photos || !s.photos.length) {
    if (g) g.innerHTML = '';
    return;
  }
  g.innerHTML = s.photos.map((p, i) => `<div class="photo-thumb"><img src="${p.data}" alt="Photo" /><button class="photo-thumb-delete" data-i="${i}">✕</button></div>`).join('');
  g.querySelectorAll('.photo-thumb-delete').forEach(b => {
    b.addEventListener('click', () => {
      s.photos.splice(+b.dataset.i, 1);
      Store.update(s);
      refreshPhotos();
      toast('Deleted');
    });
  });
}

export function handlePhotoInput(file) {
  const s = Store.getActive();
  if (!s) { toast('Select survey', true); return; }
  compress(file, 800, d => {
    if (!s.photos) s.photos = [];
    s.photos.push({ data: d, quadrat: parseInt($('#photoQuadratRef').value) || null, time: new Date().toISOString() });
    Store.update(s);
    refreshPhotos();
    toast('Photo saved');
  });
}

let mediaRec = null, audioChunks = [];
export async function startRecording(onStart) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRec = new MediaRecorder(stream);
    audioChunks = [];
    mediaRec.ondataavailable = e => audioChunks.push(e.data);
    mediaRec.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = ev => {
        const s = Store.getActive();
        if (!s) return;
        if (!s.audioNotes) s.audioNotes = [];
        s.audioNotes.push({ data: ev.target.result, time: new Date().toISOString() });
        Store.update(s);
        refreshAudio();
        toast('Voice note saved');
      };
      reader.readAsDataURL(blob);
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRec.start();
    if (onStart) onStart();
  } catch (e) {
    toast('Mic unavailable', true);
  }
}

export function stopRecording(onStop) {
  if (mediaRec && mediaRec.state === 'recording') {
    mediaRec.stop();
    if (onStop) onStop();
  }
}

export function refreshAudio() {
  const s = Store.getActive();
  const list = $('#audioList');
  if (!list) return;
  if (!s || !s.audioNotes || !s.audioNotes.length) {
    list.innerHTML = '<div class="empty-state small"><p>No voice notes</p></div>';
    return;
  }
  list.innerHTML = s.audioNotes.map((a, i) => `<div class="audio-item"><audio controls src="${a.data}"></audio><button data-i="${i}">✕</button></div>`).join('');
  list.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      s.audioNotes.splice(+b.dataset.i, 1);
      Store.update(s);
      refreshAudio();
      toast('Deleted');
    });
  });
}
