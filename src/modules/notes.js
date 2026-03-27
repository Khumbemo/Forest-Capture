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
  l.innerHTML = s.notes.map((n, i) => `<div class="note-item"><div class="note-item-header"><span class="note-badge">${esc(n.category)}</span><span>${n.quadrat ? 'Q#' + n.quadrat : ''}</span></div><p>${esc(n.text)}</p><button class="note-item-delete" data-i="${i}">Delete</button></div>`).join('');
  l.querySelectorAll('.note-item-delete').forEach(b => {
    b.addEventListener('click', () => {
      s.notes.splice(+b.dataset.i, 1);
      Store.update(s);
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
  s.notes.push({ quadrat: parseInt($('#noteQuadratRef').value) || null, category: $('#noteCategory').value, text: t, time: new Date().toISOString() });
  await Store.update(s);
  $('#noteContent').value = '';
  refreshNotes();
  toast('Note saved');
}
