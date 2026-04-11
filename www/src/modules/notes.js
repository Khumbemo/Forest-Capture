// src/modules/notes.js

import { $, toast, esc } from './ui.js';
import { Store } from './storage.js';

export async function refreshNotes() {
  const s = await Store.getActive();
  const l = $('#notesList');
  if (!s || !s.notes || !s.notes.length) {
    if (l) l.innerHTML = '<div class="empty-state small"><p>No notes</p></div>';
    return;
  }
  l.innerHTML = s.notes.map((n) => `<div class="note-item"><div class="note-item-header"><span class="note-badge">${esc(n.category)}</span><span>${n.quadrat ? 'Q#' + n.quadrat : ''}</span></div><p>${esc(n.text)}</p><button class="note-item-delete" data-id="${n.uid}">Delete</button></div>`).join('');
  l.querySelectorAll('.note-item-delete').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.id;
      s.notes = s.notes.filter(n => n.uid !== id);
      await Store.update(s);
      refreshNotes();
      toast('Deleted');
    });
  });
}

export async function addNote() {
  const s = await Store.getActive();
  if (!s) { toast('Select survey', true); return; }
  const t = $('#noteContent').value.trim();
  if (!t) { toast('Enter text', true); return; }
  if (!s.notes) s.notes = [];
  s.notes.push({ 
    uid: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    quadrat: parseInt($('#noteQuadratRef').value) || null, 
    category: $('#noteCategory').value, 
    text: t, 
    time: new Date().toISOString() 
  });
  await Store.update(s);
  $('#noteContent').value = '';
  refreshNotes();
  toast('Note saved');
}
