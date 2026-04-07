/**
 * map-offline.js — Forest Capture v3.0
 * ───────────────────────────────────────
 * Offline map tile caching — lets researchers download tiles for a
 * geographic area while on Wi-Fi before heading into the field.
 */

// ─── Configuration ────────────────────────────────────────────────────────────
const TILE_CACHE_NAME = 'fc-v3-0-tiles';
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAX_DOWNLOAD_ZOOM = 16;   // Hard cap to prevent runaway downloads
const TILE_BATCH_SIZE = 8;    // Concurrent tile fetches (be kind to tile servers)
const REQUEST_DELAY_MS = 50;   // Delay between batches (avoid rate limiting)

import { toast } from './ui.js';

// ─── Public API ──────────────────────────────────────────────────────────────

export function initOfflineMapUI(map) {
  _injectDownloadPanel(map);
  _loadCacheStats();
}

export async function downloadTilesForBounds(bounds, maxZoom, onProgress = () => { }) {
  const clampedZoom = Math.min(maxZoom, MAX_DOWNLOAD_ZOOM);
  const cache = await caches.open(TILE_CACHE_NAME);

  // Build the full list of tile coordinates.
  const tiles = _getTilesInBounds(bounds, clampedZoom);
  const total = tiles.length;

  if (total === 0) {
    return { cached: 0, failed: 0, skipped: 0 };
  }

  let done = 0, cached = 0, failed = 0, skipped = 0;

  // Process in batches to avoid overwhelming the tile server.
  for (let i = 0; i < tiles.length; i += TILE_BATCH_SIZE) {
    const batch = tiles.slice(i, i + TILE_BATCH_SIZE);

    await Promise.all(batch.map(async ({ z, x, y }) => {
      const url = OSM_TILE_URL
        .replace('{z}', z)
        .replace('{x}', x)
        .replace('{y}', y);

      // Skip tiles already in cache.
      const existing = await cache.match(url);
      if (existing) { done++; skipped++; onProgress({ done, total, pct: Math.round((done / total) * 100) }); return; }

      try {
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
          await cache.put(url, response);
          cached++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }

      done++;
      onProgress({ done, total, pct: Math.round((done / total) * 100) });
    }));

    // Small delay between batches.
    if (i + TILE_BATCH_SIZE < tiles.length) {
      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
    }
  }

  return { cached, failed, skipped };
}

export async function getCacheStats() {
  try {
    const cache = await caches.open(TILE_CACHE_NAME);
    const keys = await cache.keys();
    return {
      tileCount: keys.length,
      estimatedMB: parseFloat((keys.length * 0.02).toFixed(1)), // ~20 KB avg per tile
    };
  } catch {
    return { tileCount: 0, estimatedMB: 0 };
  }
}

export async function clearTileCache() {
  await caches.delete(TILE_CACHE_NAME);
}

// ─── Tile math ────────────────────────────────────────────────────────────────

function _getTilesInBounds(bounds, maxZoom) {
  const tiles = [];

  for (let z = 1; z <= maxZoom; z++) {
    const nwTile = _latLonToTile(bounds.getNorth(), bounds.getWest(), z);
    const seTile = _latLonToTile(bounds.getSouth(), bounds.getEast(), z);

    for (let x = nwTile.x; x <= seTile.x; x++) {
      for (let y = nwTile.y; y <= seTile.y; y++) {
        tiles.push({ z, x, y });
      }
    }
  }

  return tiles;
}

function _latLonToTile(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

function _countTilesInBounds(bounds, maxZoom) {
  return _getTilesInBounds(bounds, Math.min(maxZoom, MAX_DOWNLOAD_ZOOM)).length;
}

// ─── Download panel UI ────────────────────────────────────────────────────────

function _injectDownloadPanel(map) {
  const mapScreen = document.getElementById('screenMap');
  if (!mapScreen) return;
  if (document.getElementById('offlineMapPanel')) return;

  const panel = document.createElement('div');
  panel.id = 'offlineMapPanel';
  panel.className = 'offline-panel';
  panel.innerHTML = `
    <button class="offline-panel-toggle" id="offlinePanelToggle" title="Offline maps">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor"
        stroke-width="1.5" stroke-linecap="round">
        <path d="M3 10a7 7 0 1 0 14 0A7 7 0 0 0 3 10z"/>
        <path d="M3 10h14M10 3a10 10 0 0 1 0 14M10 3a10 10 0 0 0 0 14"/>
      </svg>
    </button>

    <div class="offline-panel-body" id="offlinePanelBody" style="display:none">
      <div class="offline-panel-header">
        <span class="offline-panel-title">Offline map area</span>
        <button class="offline-panel-close" id="offlinePanelClose">✕</button>
      </div>

      <div class="offline-panel-section">
        <label class="offline-label">Max zoom level
          <span class="offline-zoom-hint" id="offlineZoomHint"></span>
        </label>
        <input type="range" id="offlineZoomSlider" min="10" max="16" value="14"
          style="width:100%" />
        <div class="offline-zoom-row">
          <span class="offline-zoom-val" id="offlineZoomVal">Zoom 14</span>
          <span class="offline-tile-count" id="offlineTileCount">Calculating…</span>
        </div>
      </div>

      <div class="offline-panel-section">
        <p class="offline-hint">Area: current map view</p>
        <button class="offline-download-btn" id="offlineDownloadBtn">
          Download this area
        </button>
      </div>

      <div class="offline-progress-wrap" id="offlineProgressWrap" style="display:none">
        <div class="offline-progress-bar">
          <div class="offline-progress-fill" id="offlineProgressFill" style="width:0%"></div>
        </div>
        <span class="offline-progress-label" id="offlineProgressLabel">0%</span>
        <button class="offline-cancel-btn" id="offlineCancelBtn">Cancel</button>
      </div>

      <div class="offline-stats-section">
        <span class="offline-stats-label">Cached tiles:</span>
        <span class="offline-stats-val" id="offlineStatsVal">—</span>
        <button class="offline-clear-btn" id="offlineClearBtn">Clear cache</button>
      </div>
    </div>
  `;

  mapScreen.appendChild(panel);
  _bindPanelEvents(map);
}

let _cancelDownload = false;

function _bindPanelEvents(map) {
  const toggle      = document.getElementById('offlinePanelToggle');
  const body        = document.getElementById('offlinePanelBody');
  const closeBtn    = document.getElementById('offlinePanelClose');
  const zoomSlider  = document.getElementById('offlineZoomSlider');
  const zoomVal     = document.getElementById('offlineZoomVal');
  const tileCount   = document.getElementById('offlineTileCount');
  const downloadBtn = document.getElementById('offlineDownloadBtn');
  const cancelBtn   = document.getElementById('offlineCancelBtn');
  const clearBtn    = document.getElementById('offlineClearBtn');

  toggle.addEventListener('click', () => {
    const open = body.style.display === 'none';
    body.style.display = open ? 'block' : 'none';
    if (open) _updateTileCountEstimate(map, parseInt(zoomSlider.value));
  });

  closeBtn.addEventListener('click', () => { body.style.display = 'none'; });

  // Update tile count estimate as the slider moves.
  zoomSlider.addEventListener('input', () => {
    const z = parseInt(zoomSlider.value);
    zoomVal.textContent = `Zoom ${z}`;
    _updateTileCountEstimate(map, z);
  });

  // Update estimate when map is panned/zoomed.
  map.on('moveend zoomend', () => {
    if (body.style.display !== 'none') {
      _updateTileCountEstimate(map, parseInt(zoomSlider.value));
    }
  });

  downloadBtn.addEventListener('click', async () => {
    _cancelDownload = false;
    const maxZoom = parseInt(zoomSlider.value);
    const bounds  = map.getBounds();

    // Show progress UI.
    document.getElementById('offlineProgressWrap').style.display = 'flex';
    downloadBtn.disabled = true;

    const result = await downloadTilesForBounds(bounds, maxZoom, ({ done, total, pct }) => {
      if (_cancelDownload) return;
      document.getElementById('offlineProgressFill').style.width = pct + '%';
      document.getElementById('offlineProgressLabel').textContent =
        `${done} / ${total} tiles (${pct}%)`;
    });

    document.getElementById('offlineProgressWrap').style.display = 'none';
    downloadBtn.disabled = false;

    if (!_cancelDownload) {
      const msg = `Downloaded ${result.cached} new tiles` +
        (result.skipped > 0 ? ` (${result.skipped} already cached)` : '') +
        (result.failed  > 0 ? `. ${result.failed} failed.` : '.');
      // Use your app's toast function
      if (typeof toast !== 'undefined') toast(msg, result.failed > 0);
      _loadCacheStats();
    }
  });

  cancelBtn.addEventListener('click', () => {
    _cancelDownload = true;
    document.getElementById('offlineProgressWrap').style.display = 'none';
    document.getElementById('offlineDownloadBtn').disabled = false;
  });

  clearBtn.addEventListener('click', async () => {
    if (!confirm('Delete all cached map tiles?')) return;
    await clearTileCache();
    _loadCacheStats();
    if (typeof toast !== 'undefined') toast('Tile cache cleared.', false);
  });
}

function _updateTileCountEstimate(map, maxZoom) {
  const bounds = map.getBounds();
  const count  = _countTilesInBounds(bounds, maxZoom);
  const mb     = (count * 0.02).toFixed(1);
  const el     = document.getElementById('offlineTileCount');
  if (el) el.textContent = `~${count.toLocaleString()} tiles · ~${mb} MB`;

  // Warn if very large.
  const hint = document.getElementById('offlineZoomHint');
  if (hint) {
    hint.textContent = count > 5000
      ? `(large download — zoom in first)`
      : count > 1000 ? `(moderate download)` : '';
  }
}

async function _loadCacheStats() {
  const stats = await getCacheStats();
  const el    = document.getElementById('offlineStatsVal');
  if (el) el.textContent = `${stats.tileCount.toLocaleString()} (${stats.estimatedMB} MB)`;
}