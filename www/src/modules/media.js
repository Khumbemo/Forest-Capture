// src/modules/media.js

import { $, toast } from './ui.js';
import { Store } from './storage.js';
import { storage, ensureAuth } from './firebase.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export async function refreshPhotos() {
  const s = await Store.getActive();
  const g = $('#photoGallery');
  if (!s || !s.photos || !s.photos.length) {
    if (g) g.innerHTML = '';
    return;
  }
  g.innerHTML = s.photos.map((p, i) => `<div class="photo-thumb"><img src="${p.localUri || p.url || p.data}" alt="Photo" /><button class="photo-thumb-delete" data-i="${i}">✕</button></div>`).join('');
  g.querySelectorAll('.photo-thumb-delete').forEach(b => {
    b.addEventListener('click', async () => {
      const idx = +b.dataset.i;
      const p = s.photos[idx];

      try {
        if (p.path) {
          const storageRef = ref(storage, p.path);
          await deleteObject(storageRef);
        }
        if (p.localUri) {
          try {
            await Filesystem.deleteFile({ path: p.localUri });
          } catch(e) {}
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

  toast('Saving photo...', false);

  try {
    if (!s.photos) s.photos = [];
    const fileName = `photo_${Date.now()}_${file.name || 'img.jpg'}`;
    
    // Save raw Blob directly to Android cache directory
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: file,
      directory: Directory.Cache
    });
    
    const fileUri = savedFile.uri;
    const convertUrl = Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(fileUri) : fileUri;
    
    let finalUrl = null;
    let finalPath = '';

    const user = await ensureAuth();
    if (user) {
      toast('Uploading photo...', false);
      const storageRef = ref(storage, `users/${user.uid}/surveys/${s.id}/photos/${fileName}`);
      
      // Pipe directly from local filesystem path
      const req = await fetch(convertUrl);
      const blobData = await req.blob();
      
      const snapshot = await uploadBytes(storageRef, blobData);
      finalUrl = await getDownloadURL(snapshot.ref);
      finalPath = snapshot.ref.fullPath;
    }

    s.photos.push({
      url: finalUrl, // May be null if offline
      path: finalPath,
      localUri: convertUrl,
      quadrat: parseInt($('#photoQuadratRef').value) || null,
      time: new Date().toISOString()
    });

    await Store.update(s);
    refreshPhotos();
    toast(user ? 'Photo uploaded' : 'Photo saved locally');
  } catch (err) {
    console.error(err);
    toast('Capture failed: ' + err.message, true);
  }
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

      try {
        const fileName = `audio_${Date.now()}.webm`;
        
        // Save raw Blob to cache directory
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: blob,
          directory: Directory.Cache
        });

        const fileUri = savedFile.uri;
        const convertUrl = Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(fileUri) : fileUri;
        
        let finalUrl = null;
        let finalPath = '';

        const user = await ensureAuth();
        if (user) {
          // Upload by piping from the local filesystem path
          const storageRef = ref(storage, `users/${user.uid}/surveys/${s.id}/audio/${fileName}`);
          const req = await fetch(convertUrl);
          const blobData = await req.blob();
          
          const snapshot = await uploadBytes(storageRef, blobData);
          finalUrl = await getDownloadURL(snapshot.ref);
          finalPath = snapshot.ref.fullPath;
        }

        s.audioNotes.push({ 
          url: finalUrl, 
          path: finalPath, 
          localUri: convertUrl,
          time: new Date().toISOString() 
        });

        await Store.update(s);
        refreshAudio();
        toast(user ? 'Voice note saved & uploaded' : 'Voice note saved locally');
      } catch (err) {
        console.error('Audio save failed', err);
        toast('Audio save failed', true);
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
  list.innerHTML = s.audioNotes.map((a, i) => `<div class="audio-item"><audio controls src="${a.localUri || a.url || a.data}"></audio><button data-i="${i}">✕</button></div>`).join('');
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
        if (note && note.localUri) {
          try { await Filesystem.deleteFile({ path: note.localUri }); } catch(e) {}
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
