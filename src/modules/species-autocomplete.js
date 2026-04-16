/**
 * species-autocomplete.js — Forest Capture v3.0
 * Local taxonomy autocomplete for species name fields in Quadrat and
 * Transect entry forms.
 */

import { Store, idb } from './storage.js';

const _learnedSpecies = new Map(); // scientific name → entry object

export function loadSurveyHistory(surveys) {
  for (const survey of (surveys || [])) {
    for (const quadrat of (survey.quadrats || [])) {
      for (const sp of (quadrat.species || [])) {
        _addLearnedEntry(sp);
      }
    }
    for (const transect of (survey.transects || [])) {
      for (const sp of (transect.intercepts || [])) {
        _addLearnedEntry(sp);
      }
    }
  }
}

function _addLearnedEntry(sp) {
  if (!sp?.name) return;
  const key = sp.name.toLowerCase().trim();
  _learnedSpecies.set(key, {
    scientific: sp.name,
    common: sp.common || '',
    family: sp.family || '',
    genus: sp.genus || sp.name.split(' ')[0] || '',
    source: 'history',
    count: (_learnedSpecies.get(key)?.count || 0) + 1,
  });
}

export function attachAutocomplete(inputId, options = {}) {
  const input = document.getElementById(inputId);
  if (!input) {
    console.warn(`[autocomplete] Element #${inputId} not found.`);
    return;
  }

  const { onSelect = () => { }, maxResults = 8 } = options;

  // Create the dropdown.
  const dropdown = _createDropdown(inputId);
  input.parentElement.style.position = 'relative';
  input.insertAdjacentElement('afterend', dropdown);

  let _activeIndex = -1;
  let _currentResults = [];
  let _debounceTimer = null;

  // ── Input handler ─────────────────────────────────────────────────────────
  input.addEventListener('input', () => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(async () => {
      const query = input.value.trim();
      if (query.length < 2) { _hide(dropdown); return; }

      _currentResults = await _search(query, maxResults);
      if (_currentResults.length === 0) { _hide(dropdown); return; }

      _activeIndex = -1;
      dropdown._query = query;
      _render(dropdown, _currentResults, _activeIndex, (entry) => {
        _select(input, entry, dropdown, onSelect);
      });
      _show(dropdown);
    }, 300);
  });

  // ── Keyboard navigation ───────────────────────────────────────────────────
  input.addEventListener('keydown', (e) => {
    if (!_isVisible(dropdown)) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _activeIndex = Math.min(_activeIndex + 1, _currentResults.length - 1);
      _render(dropdown, _currentResults, _activeIndex, (entry) => {
        _select(input, entry, dropdown, onSelect);
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _activeIndex = Math.max(_activeIndex - 1, -1);
      _render(dropdown, _currentResults, _activeIndex, (entry) => {
        _select(input, entry, dropdown, onSelect);
      });
    } else if (e.key === 'Enter' && _activeIndex >= 0) {
      e.preventDefault();
      _select(input, _currentResults[_activeIndex], dropdown, onSelect);
    } else if (e.key === 'Escape') {
      _hide(dropdown);
    }
  });

  // Keydown / Input / Mouse handlers stay the same...
}

// ── Hide on outside click (global listener) ─────────────────────────────────
document.addEventListener('click', (e) => {
  const dropdowns = document.querySelectorAll('.species-dropdown');
  dropdowns.forEach(dropdown => {
    if (dropdown.style.display === 'none') return;
    const inputId = dropdown.id.replace('autocomplete-', '');
    const input = document.getElementById(inputId);
    if (input && !input.contains(e.target) && !dropdown.contains(e.target)) {
      _hide(dropdown);
    }
  });
});

// ─── Search ───────────────────────────────────────────────────────────────────

async function _getActiveTaxonomyPackResults(query, max) {
  try {
     const active = await Store.getActive();
     if (active && active.taxonomyPack) {
         const packDataStr = await idb.get(`taxpack_${active.taxonomyPack}`);
         if (packDataStr) {
             const packData = JSON.parse(packDataStr);
             const q = query.toLowerCase().trim();
             const res = packData.filter(e => 
                (e.scientific && e.scientific.toLowerCase().includes(q)) ||
                (e.common && e.common.toLowerCase().includes(q)) ||
                (e.family && e.family.toLowerCase().includes(q))
             );
             return res.map(r => ({ ...r, source: 'regional_pack', status: 'ACCEPTED' })).slice(0, max);
         }
     }
  } catch(e) {
     console.warn('Failed to scan regional taxonomy cache', e);
  }
  return [];
}

async function _search(query, max) {
  const q = query.toLowerCase().trim();
  const results = [];
  const seen = new Set();

  const regionalPack = await _getActiveTaxonomyPackResults(query, max);
  let isStrict = false;
  
  const active = await Store.getActive();
  if (active && active.taxonomyPack && regionalPack.length > 0) {
      isStrict = true; // For real strict mode, we'd block submission, but here we just prioritize autocomplete.
  }

  // Priority 1: Regional Taxonomy Pack (if active)
  for (const entry of regionalPack) {
      if (results.length >= max) break;
      const key = entry.scientific.toLowerCase();
      if (!seen.has(key)) { seen.add(key); results.push(entry); }
  }

  // Priority 2: researcher's own learned species (sorted by frequency)
  const learned = [..._learnedSpecies.values()]
    .filter(e => _matches(e, q))
    .sort((a, b) => b.count - a.count);

  for (const entry of learned) {
    if (results.length >= max) break;
    const key = entry.scientific.toLowerCase();
    if (!seen.has(key)) { seen.add(key); results.push({ ...entry, source: 'history' }); }
  }

  // Priority 2: GBIF Remote API (Fail-safe)
  if (results.length < max && navigator.onLine) {
    try {
      const res = await fetch(`https://api.gbif.org/v1/species/suggest?datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        for (const item of data) {
          if (results.length >= max) break;
          const scientific = item.canonicalName || item.scientificName;
          if (!scientific || item.rank !== 'SPECIES') continue;
          
          const key = scientific.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            results.push({
              scientific: scientific,
              common: '',
              family: item.family || '',
              genus: item.genus || '',
              status: item.status || 'ACCEPTED',
              source: 'gbif'
            });
          }
        }
      }
    } catch (e) {
      console.warn('GBIF API fetch failed, falling back to local only', e);
    }
  }

  return results;
}

function _matches(entry, q) {
  return entry.scientific?.toLowerCase().includes(q)
    || entry.common?.toLowerCase().includes(q)
    || entry.family?.toLowerCase().includes(q);
}

// ─── Dropdown rendering ───────────────────────────────────────────────────────

function _createDropdown(inputId) {
  const el = document.createElement('ul');
  el.id = `autocomplete-${inputId}`;
  el.className = 'species-dropdown';
  el.setAttribute('role', 'listbox');
  el.style.display = 'none';
  return el;
}

function _render(dropdown, results, activeIndex, onSelect) {
  dropdown.innerHTML = '';
  results.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = `species-option${i === activeIndex ? ' species-option--active' : ''}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');

    const badge = entry.source === 'history'
      ? `<span class="species-badge-history">used</span>`
      : entry.source === 'regional_pack' ? `<span class="species-badge-regional" style="background:var(--emerald);color:#000;font-size:0.7em;padding:2px 6px;border-radius:4px;">regional dict</span>` : '';

    const statusBadge = entry.status === 'SYNONYM' ? `<span class="species-badge-synonym">synonym</span>` : '';
    li.innerHTML = `
      <div class="species-option-main">
        <span class="species-scientific">${_highlight(entry.scientific, dropdown._query || '')}</span>
        ${entry.common ? `<span class="species-common">${escapeHtml(entry.common)}</span>` : ''}
      </div>
      <div class="species-option-meta">
        ${entry.family ? `<span class="species-family">${escapeHtml(entry.family)}</span>` : ''}
        ${badge}
        ${statusBadge}
      </div>
    `;

    li.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur before click fires
      onSelect(entry);
    });

    dropdown.appendChild(li);
  });
}

async function _select(input, entry, dropdown, onSelect) {
  input.value = entry.scientific;
  _hide(dropdown);
  
  // Attempt to enrich with full taxonomy if online
  let enriched = { ...entry };
  if (navigator.onLine && entry.source === 'gbif') {
    try {
      const res = await fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(entry.scientific)}&strict=true`);
      if (res.ok) {
        const data = await res.json();
        if (data.matchType && data.matchType !== 'NONE') {
          enriched.family = data.family || enriched.family;
          enriched.order = data.order || '';
          enriched.class = data.class || '';
          enriched.phylum = data.phylum || '';
          enriched.kingdom = data.kingdom || '';
        }
      }
    } catch (e) {
      console.warn('GBIF enrich failed', e);
    }
  }

  onSelect(enriched);
  // Add to learned history.
  _addLearnedEntry({ 
    name: enriched.scientific, 
    common: enriched.common, 
    family: enriched.family, 
    genus: enriched.genus,
    order: enriched.order,
    class: enriched.class
  });
}

function _show(el) { el.style.display = 'block'; }
function _hide(el) { el.style.display = 'none';  }
function _isVisible(el) { return el.style.display !== 'none'; }

function _highlight(text, query) {
  if (!query) return escapeHtml(text);
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return escapeHtml(text);
  return escapeHtml(text.slice(0, i))
    + `<strong>${escapeHtml(text.slice(i, i + query.length))}</strong>`
    + escapeHtml(text.slice(i + query.length));
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


