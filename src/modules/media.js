// src/modules/media.js

import { $, toast } from './ui.js';
import { Store } from './storage.js';
import { compress } from './utils.js';
import { storage, ensureAuth } from './firebase.js';
import { ref, uploadString, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js';

export async function refreshPhotos() {
  const s = await Store.getActive();
  const g = $('#photoGallery');
  if (!s || !s.photos || !s.photos.length) {
    if (g) g.innerHTML = '';
    return;
  }
  g.innerHTML = s.photos.map((p, i) => `<div class="photo-thumb"><img src="${p.url || p.data}" alt="Photo" /><button class="photo-thumb-delete" data-i="${i}">✕</button></div>`).join('');
  g.querySelectorAll('.photo-thumb-delete').forEach(b => {
    b.addEventListener('click', async () => {
      const idx = +b.dataset.i;
      const p = s.photos[idx];

      try {
        if (p.path) {
          const storageRef = ref(storage, p.path);
          await deleteObject(storageRef);
        }
        s.photos.splice(idx, 1);
        await Store.update(s);
        refreshPhotos();
        toast('Deleted');
      } catch (err) {
        console.error(err);
        toast('Delete failed', true);
      }
    });
  });
}

export async function handlePhotoInput(file) {
  const s = await Store.getActive();
  if (!s) { toast('Select survey', true); return; }

  const user = await ensureAuth();
  if (!user) { toast('Login required to upload photos', true); return; }

  toast('Uploading photo...', false);

  compress(file, 800, async d => {
    try {
      if (!s.photos) s.photos = [];
      const fileName = `photo_${Date.now()}.jpg`;
      const storageRef = ref(storage, `users/${user.uid}/surveys/${s.id}/photos/${fileName}`);

      // Upload to Firebase Storage
      const snapshot = await uploadString(storageRef, d, 'data_url');
      const downloadURL = await getDownloadURL(snapshot.ref);

      s.photos.push({
        url: downloadURL,
        path: snapshot.ref.fullPath,
        quadrat: parseInt($('#photoQuadratRef').value) || null,
        time: new Date().toISOString()
      });

      await Store.update(s);
      refreshPhotos();
      toast('Photo uploaded');
    } catch (err) {
      console.error(err);
      toast('Upload failed: ' + err.message, true);
    }
  });
}

let mediaRec = null, audioChunks = [];
export async function startRecording(onStart) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRec = new MediaRecorder(stream);
    audioChunks = [];
    mediaRec.ondataavailable = e => audioChunks.push(e.data);
    mediaRec.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const s = await Store.getActive();
      if (!s) return;
      if (!s.audioNotes) s.audioNotes = [];

      const user = await ensureAuth();
      if (user) {
        // Upload to Firebase Storage
        try {
          const fileName = `audio_${Date.now()}.webm`;
          const storageRef = ref(storage, `users/${user.uid}/surveys/${s.id}/audio/${fileName}`);
          const reader = new FileReader();
          reader.onload = async ev => {
            const snapshot = await uploadString(storageRef, ev.target.result, 'data_url');
            const downloadURL = await getDownloadURL(snapshot.ref);
            s.audioNotes.push({ url: downloadURL, path: snapshot.ref.fullPath, time: new Date().toISOString() });
            await Store.update(s);
            refreshAudio();
            toast('Voice note saved');
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          console.error('Audio upload failed', err);
          toast('Audio save failed', true);
        }
      } else {
        // Offline fallback — store as data URL (limited size)
        const reader = new FileReader();
        reader.onload = async ev => {
          s.audioNotes.push({ data: ev.target.result, time: new Date().toISOString() });
          await Store.update(s);
          refreshAudio();
          toast('Voice note saved (offline)');
        };
        reader.readAsDataURL(blob);
      }
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

export async function refreshAudio() {
  const s = await Store.getActive();
  const list = $('#audioList');
  if (!list) return;
  if (!s || !s.audioNotes || !s.audioNotes.length) {
    list.innerHTML = '<div class="empty-state small"><p>No voice notes</p></div>';
    return;
  }
  list.innerHTML = s.audioNotes.map((a, i) => `<div class="audio-item"><audio controls src="${a.url || a.data}"></audio><button data-i="${i}">✕</button></div>`).join('');
  list.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', async () => {
      const idx = +b.dataset.i;
      const note = s.audioNotes[idx];
      // Delete from Firebase Storage if path exists
      try {
        if (note && note.path) {
          const storageRef = ref(storage, note.path);
          await deleteObject(storageRef);
        }
      } catch (err) {
        console.warn('Audio storage delete failed', err);
      }
      s.audioNotes.splice(idx, 1);
      await Store.update(s);
      refreshAudio();
      toast('Deleted');
    });
  });
}
