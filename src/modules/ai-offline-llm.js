// src/modules/ai-offline-llm.js
// Layer 2 of SylvX's offline capability: a real generative model running
// entirely on-device via WebLLM (WebGPU), no server, no API key. This is
// strictly advisory/read-only — it is never given the confirm-before-write
// tools that the cloud (Gemini) path has, since small on-device models are
// far less reliable at structured tool-calling.
//
// The WebLLM engine itself is loaded on demand via a dynamic import() from
// a CDN, only when the user opts in from Settings — never a static
// top-level import. A blocked/unreachable CDN here fails this one feature
// in isolation; it can never cascade into breaking the rest of the app the
// way a static import failure would.

import { idb } from './storage.js';

const READY_FLAG_KEY = 'offline_ai_ready';
const MODEL_ID_KEY = 'offline_ai_model_id';
const ENGINE_CDN_URL = 'https://esm.run/@mlc-ai/web-llm';

// Roughly smallest-to-largest preference — favors fast download/inference
// on modest field hardware over raw capability.
const PREFERRED_MODELS = [
  'Llama-3.2-1B-Instruct',
  'Qwen2.5-1.5B-Instruct',
  'gemma-2-2b-it',
  'Phi-3.5-mini-instruct'
];

let engine = null;
let engineModule = null;
let loadedModelId = null;
let loadInFlight = null;

export function checkOfflineAISupport() {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return { supported: false, reason: 'This device/browser does not support WebGPU, which the on-device model needs to run. Cloud AI or the offline app guide still work.' };
  }
  return { supported: true, reason: '' };
}

export async function getStorageEstimate() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      return { usage, quota, freeMB: Math.round((quota - usage) / 1e6) };
    }
  } catch (e) {
    console.warn('ai-offline-llm: storage estimate failed', e.message);
  }
  return null;
}

// True once a model has been downloaded before (Cache Storage still holds
// the weights) — does NOT mean the in-memory engine is loaded this session.
export async function isOfflineModelDownloaded() {
  if (engine) return true;
  return (await idb.get(READY_FLAG_KEY)) === '1';
}

export function isOfflineEngineLoaded() {
  return !!engine;
}

function pickModelId(modelList) {
  for (const name of PREFERRED_MODELS) {
    const found = modelList.find(m => m.model_id.includes(name) && /q4/i.test(m.model_id));
    if (found) return found.model_id;
  }
  const sorted = [...modelList].sort((a, b) => (a.vram_required_MB || Infinity) - (b.vram_required_MB || Infinity));
  return sorted[0]?.model_id || null;
}

// Downloads (first run) or reloads-from-cache (subsequent sessions) the
// on-device model. Safe to call repeatedly — WebLLM skips re-downloading
// weights it already has cached.
//
// Guarded against concurrent callers (e.g. a double-tap on Send before the
// input is cleared): without this, two overlapping calls would each start
// their own multi-hundred-MB CreateMLCEngine() load and race to overwrite
// the shared `engine` variable, wasting bandwidth/GPU memory. All concurrent
// callers now await the same in-flight load instead.
export async function loadOfflineModel(onProgress) {
  if (loadInFlight) return loadInFlight;
  loadInFlight = _loadOfflineModel(onProgress);
  try {
    return await loadInFlight;
  } finally {
    loadInFlight = null;
  }
}

async function _loadOfflineModel(onProgress) {
  const support = checkOfflineAISupport();
  if (!support.supported) throw new Error(support.reason);

  if (!engineModule) {
    engineModule = await import(/* @vite-ignore */ ENGINE_CDN_URL);
  }

  let modelId = await idb.get(MODEL_ID_KEY);
  if (!modelId) {
    modelId = pickModelId(engineModule.prebuiltAppConfig.model_list);
  }
  if (!modelId) throw new Error('No suitable offline model is available for this device.');

  engine = await engineModule.CreateMLCEngine(modelId, {
    initProgressCallback: (report) => {
      if (onProgress) onProgress(report.progress || 0, report.text || '');
    }
  });
  loadedModelId = modelId;
  await idb.set(READY_FLAG_KEY, '1');
  await idb.set(MODEL_ID_KEY, modelId);
  return modelId;
}

// Advisory-only chat: no tools, no data access beyond the short context
// summary passed in. Lazily reloads the engine from cache if this is a
// fresh page session and the model was already downloaded previously.
export async function offlineChat(userText, contextStr, onProgress) {
  if (!engine) {
    const downloaded = await isOfflineModelDownloaded();
    if (!downloaded) {
      throw new Error('The offline AI model is not downloaded yet — go to Settings → Offline AI to download it once while you have a connection.');
    }
    await loadOfflineModel(onProgress);
  }

  const systemPrompt = `You are SylvX, a forestry field assistant running fully offline on this device with a small local model. Be concise (2-4 sentences). You cannot see or modify the app's data beyond this summary, and you cannot save anything — tell the user to use the app's tools directly, or ask again once online, for anything that needs to be recorded.\nCurrent survey: ${contextStr || 'none active'}`;

  const reply = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText }
    ]
  });
  return reply.choices?.[0]?.message?.content?.trim() || "I couldn't generate a response.";
}

export async function deleteOfflineModel() {
  try {
    if (engine && typeof engine.unload === 'function') await engine.unload();
  } catch (e) {
    console.warn('ai-offline-llm: engine unload failed', e.message);
  }
  engine = null;
  loadedModelId = null;
  await idb.set(READY_FLAG_KEY, '0');
  await idb.set(MODEL_ID_KEY, '');

  // Best-effort: free the cached model weights (typically hundreds of MB+).
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => /webllm|mlc/i.test(k)).map(k => caches.delete(k))
      );
    }
  } catch (e) {
    console.warn('ai-offline-llm: cache cleanup failed', e.message);
  }
}

export function getLoadedModelId() {
  return loadedModelId;
}
