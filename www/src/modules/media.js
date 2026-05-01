// src/modules/media.js

import { $, toast } from './ui.js';
import { Store, MediaStore } from './storage.js';
import { storage, ensureAuth } from './firebase.js';
import { ref, uploadBytes, uploadString, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js';
import { compress } from './utils.js';
import { curPos } from './gps.js';

// Capacitor is not imported via ES modules to maintain browser compatibility without a bundler.
// Android WebView injects Capacitor onto the window object globally.
const NativeCap = window.Capacitor || null;
const NativeFS = NativeCap && NativeCap.Plugins ? NativeCap.Plugins.Filesystem : null;
const CACHE_DIR = 'CACHE';

export async function refreshPhotos() {
  const s = await Store.getActive();
  const g = $('#photoGallery');
  if (!s || !s.photos || !s.photos.length) {
    if (g) g.innerHTML = '';
    return;
  }

  // Free memory from previously rendered Object URLs before creating new ones
  MediaStore.revokeAll();

  // Resolve all media URLs (from Firebase, local URI, or IndexedDB)
  const resolved = await Promise.all(s.photos.map(p => MediaStore.resolveUrl(p)));

  g.innerHTML = s.photos.map((p, i) => `<div class="photo-thumb"><img src="${resolved[i]}" alt="Photo" /><button class="photo-thumb-delete" data-i="${i}">✕</button></div>`).join('');
  g.querySelectorAll('.photo-thumb-delete').forEach(b => {
    b.addEventListener('click', async () => {
      const idx = +b.dataset.i;
      const p = s.photos[idx];

      try {
        // Delete from Firebase Storage
        if (p.path) {
          try {
            const storageRef = ref(storage, p.path);
            await deleteObject(storageRef);
          } catch {}
        }
        // Delete from native filesystem
        if (p.localUri && NativeFS) {
          try {
            await NativeFS.deleteFile({ path: p.localUri });
          } catch {}
        }
        // Delete from IndexedDB MediaStore
        if (p.mediaId) {
          await MediaStore.del(p.mediaId);
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
    const user = await ensureAuth();

    // ─── NATIVE ANDROID: HIGH PERFORMANCE RAW BLOB ───
    if (NativeFS && NativeCap.isNativePlatform()) {
      const fileName = `photo_${Date.now()}_${file.name || 'img.jpg'}`;
      
      // Convert file to base64 for Capacitor Filesystem
      const base64Data = await _fileToBase64(file);
      const savedFile = await NativeFS.writeFile({
        path: fileName,
        data: base64Data,
        directory: CACHE_DIR
      });
      
      const fileUri = savedFile.uri;
      const convertUrl = NativeCap.convertFileSrc(fileUri);
      
      let finalUrl = null;
      let finalPath = '';

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
        url: finalUrl,
        path: finalPath,
        localUri: convertUrl,
        quadrat: parseInt($('#photoQuadratRef').value) || null,
        time: new Date().toISOString(),
        gps: curPos.lat ? { lat: curPos.lat, lng: curPos.lng, acc: curPos.acc } : null
      });

      await Store.update(s);
      refreshPhotos();
      toast(user ? 'Photo uploaded' : 'Photo saved locally');

    } else {
      // ─── WEB FALLBACK: COMPRESS → STORE IN IndexedDB ───
      compress(file, 800, async compressedBase64 => {
        try {
          let finalUrl = null;
          let finalPath = '';
          let mediaId = null;
          const fileName = `photo_${Date.now()}.jpg`;

          if (user) {
            toast('Uploading photo...', false);
            const storageRef = ref(storage, `users/${user.uid}/surveys/${s.id}/photos/${fileName}`);
            const snapshot = await uploadString(storageRef, compressedBase64, 'data_url');
            finalUrl = await getDownloadURL(snapshot.ref);
            finalPath = snapshot.ref.fullPath;
            // No need to store blob locally if uploaded
          } else {
            // Offline: store base64 in IndexedDB MediaStore (NOT in survey doc)
            mediaId = await MediaStore.save(compressedBase64);
          }

          s.photos.push({
            mediaId,      // IndexedDB reference (offline only)
            url: finalUrl, // Firebase download URL (online)
            path: finalPath,
            quadrat: parseInt($('#photoQuadratRef').value) || null,
            time: new Date().toISOString(),
            gps: curPos.lat ? { lat: curPos.lat, lng: curPos.lng, acc: curPos.acc } : null
          });

          await Store.update(s);
          refreshPhotos();
          toast(user ? 'Photo uploaded' : 'Photo saved (offline)');
        } catch(e) {
          console.error('Photo save failed', e);
          toast('Photo save failed', true);
        }
      });
    }

  } catch (err) {
    console.error(err);
    toast('Capture failed: ' + err.message, true);
  }
}

// Helper: convert File to base64 string for Capacitor Filesystem
function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // strip data URL prefix
    reader.onerror = reject;
    reader.readAsDataURL(file);
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

      try {
        const user = await ensureAuth();

        // ─── NATIVE ANDROID: HIGH PERFORMANCE RAW BLOB ───
        if (NativeFS && NativeCap.isNativePlatform()) {
          const fileName = `audio_${Date.now()}.webm`;
          
          const base64Data = await _blobToBase64(blob);
          const savedFile = await NativeFS.writeFile({
            path: fileName,
            data: base64Data,
            directory: CACHE_DIR
          });

          const fileUri = savedFile.uri;
          const convertUrl = NativeCap.convertFileSrc(fileUri);
          
          let finalUrl = null;
          let finalPath = '';

          if (user) {
            toast('Uploading audio...', false);
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
          toast(user ? 'Voice note uploaded' : 'Voice note saved locally');
        } else {
          // ─── WEB FALLBACK: STORE IN IndexedDB ───
          const reader = new FileReader();
          reader.onload = async ev => {
            let finalUrl = null;
            let finalPath = '';
            let mediaId = null;
            const fileName = `audio_${Date.now()}.webm`;
            const audioDataUrl = ev.target.result;

            if (user) {
              toast('Uploading audio...', false);
              const storageRef = ref(storage, `users/${user.uid}/surveys/${s.id}/audio/${fileName}`);
              const snapshot = await uploadString(storageRef, audioDataUrl, 'data_url');
              finalUrl = await getDownloadURL(snapshot.ref);
              finalPath = snapshot.ref.fullPath;
            } else {
              // Offline: store in IndexedDB (not in survey doc)
              mediaId = await MediaStore.save(audioDataUrl);
            }

            s.audioNotes.push({ 
              mediaId,
              url: finalUrl, 
              path: finalPath,
              time: new Date().toISOString() 
            });

            await Store.update(s);
            refreshAudio();
            toast(user ? 'Voice note uploaded' : 'Voice note saved (offline)');
          };
          reader.readAsDataURL(blob);
        }
      } catch (err) {
        console.error('Audio save failed', err);
        toast('Audio save failed', true);
      }
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRec.start();
    if (onStart) onStart();
  } catch {
    toast('Mic unavailable', true);
  }
}

// Helper: convert Blob to base64 string for Capacitor Filesystem
function _blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

  // Free memory from previously rendered Object URLs before creating new ones
  // (revokeAll covers both photo and audio URLs from the shared pool)
  MediaStore.revokeAll();

  // Resolve all media URLs
  const resolved = await Promise.all(s.audioNotes.map(a => MediaStore.resolveUrl(a)));

  list.innerHTML = s.audioNotes.map((a, i) => `<div class="audio-item"><audio controls src="${resolved[i]}"></audio><button data-i="${i}">✕</button></div>`).join('');
  list.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', async () => {
      const idx = +b.dataset.i;
      const note = s.audioNotes[idx];
      // Delete from IndexedDB MediaStore
      if (note && note.mediaId) {
        await MediaStore.del(note.mediaId);
      }
      s.audioNotes.splice(idx, 1);
      await Store.update(s);
      refreshAudio();
      toast('Deleted');
      try {
        if (note && note.path) {
          const storageRef = ref(storage, note.path);
          await deleteObject(storageRef);
        }
        if (note && note.localUri && NativeFS) {
          try { await NativeFS.deleteFile({ path: note.localUri }); } catch {}
        }
      } catch (err) {
        console.warn('Audio storage delete failed', err);
      }
    });
  });
}

export function init() {
  $('#photoInput')?.addEventListener('change', e => {
      if(e.target.files[0]) handlePhotoInput(e.target.files[0]);
  });
  $('#btnStartRecording')?.addEventListener('click', () => {
      startRecording(() => {
          $('#recordingStatus').textContent = '🔴 Recording...';
          $('#btnStartRecording').disabled = true;
          $('#btnStopRecording').disabled = false;
      });
  });
  $('#btnStopRecording')?.addEventListener('click', () => {
      stopRecording(() => {
          $('#recordingStatus').textContent = 'Saved';
          $('#btnStartRecording').disabled = false;
          $('#btnStopRecording').disabled = true;
      });
  });
}
