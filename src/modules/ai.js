// src/modules/ai.js
import { $, $$, toast } from './ui.js';
import { Store, idb } from './storage.js';
import { compress } from './utils.js';
import { APP_KNOWLEDGE, TOOL_DECLARATIONS, isWriteTool, describeWriteCall } from './ai-knowledge.js';
import { addSpeciesToQuadrat } from './quadrat.js';
import { addNoteRecord } from './notes.js';
import { searchTaxonomy } from './species-autocomplete.js';
import { calculateIndicesPayload } from './analytics.js';

let messageHistory = [];
let currentPhotoBase64 = null;
let currentPhotoMime = null;
let historyLoadedForSurveyId = null;
let historyLoadInFlight = null; // { surveyId, promise } — de-dupes concurrent loads
let pendingWrite = null; // { name, args } awaiting user confirm/cancel

export function initAI() {
  $('#btnSendChat')?.addEventListener('click', handleChatSubmit);
  $('#chatInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleChatSubmit();
  });

  $('#chatPhotoUpload')?.addEventListener('change', handlePhotoUpload);
  $('#btnRemoveChatPhoto')?.addEventListener('click', clearPhotoPreview);
}

// Loads the active survey's saved chat history into `messageHistory` and
// replays it into the DOM, exactly once per survey. Called both when the
// user opens the Chat tab and at the top of handleChatSubmit — sharing one
// in-flight promise means a send that happens right after opening the tab
// waits on the same load instead of racing it and clobbering a bubble
// that's mid-response with a stale replay.
async function ensureHistoryLoaded() {
  const survey = await Store.getActive();
  const surveyId = survey ? survey.id : '_no_survey_';
  if (surveyId === historyLoadedForSurveyId) return;
  if (historyLoadInFlight && historyLoadInFlight.surveyId === surveyId) {
    return historyLoadInFlight.promise;
  }

  const promise = (async () => {
    pendingWrite = null;
    const stored = await idb.get(`chat_${surveyId}`);
    messageHistory = stored ? JSON.parse(stored) : [];
    historyLoadedForSurveyId = surveyId;

    const historyEl = $('#chatHistory');
    if (historyEl) historyEl.innerHTML = '';
    for (const msg of messageHistory) {
      renderStoredMessage(msg);
    }
  })();

  historyLoadInFlight = { surveyId, promise };
  await promise;
  historyLoadInFlight = null;
}

// Called from main.js's screenChat callback whenever the user opens the AI
// Chat tab.
export async function onChatScreenEnter() {
  await ensureHistoryLoaded();
}

function renderStoredMessage(msg) {
  const textPart = (msg.parts || []).find(p => p.text);
  if (msg.role === 'user' && textPart) appendMessage('user', textPart.text);
  else if (msg.role === 'model' && textPart) appendMessage('model', textPart.text);
  // functionCall/functionResponse turns are conversational bookkeeping only
  // — not re-rendered as bubbles on reload.
}

async function persistHistory() {
  if (!historyLoadedForSurveyId) return;
  // Strip inline photo data before persisting — keeps the stored history
  // small; the text/tool-call parts are what give the model continuity.
  const slim = messageHistory.map(m => ({
    role: m.role,
    parts: (m.parts || []).filter(p => !p.inline_data)
  }));
  try {
    await idb.set(`chat_${historyLoadedForSurveyId}`, JSON.stringify(slim));
  } catch (e) {
    console.warn('AI: failed to persist chat history', e.message);
  }
}

function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  currentPhotoMime = file.type;

  // Compress image to max 1024px for faster upload to Gemini
  compress(file, 1024, (base64) => {
    currentPhotoBase64 = base64;

    // Show preview
    const previewContainer = $('#chatPhotoPreviewContainer');
    const previewImg = $('#chatPhotoPreview');
    if (previewContainer && previewImg) {
      previewImg.src = base64;
      previewContainer.style.display = 'block';
    }
  });
}

function clearPhotoPreview() {
  currentPhotoBase64 = null;
  currentPhotoMime = null;

  const previewContainer = $('#chatPhotoPreviewContainer');
  const previewImg = $('#chatPhotoPreview');
  const fileInput = $('#chatPhotoUpload');

  if (previewContainer) previewContainer.style.display = 'none';
  if (previewImg) previewImg.src = '';
  if (fileInput) fileInput.value = '';
}

function appendMessage(role, text, imageSrc) {
  const historyEl = $('#chatHistory');
  if (!historyEl) return;

  // Remove empty state if present
  const emptyState = historyEl.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const bubble = document.createElement('div');
  bubble.style.margin = '8px 0';
  bubble.style.padding = '12px 16px';
  bubble.style.borderRadius = 'var(--radius-md)';
  bubble.style.maxWidth = '85%';
  bubble.style.lineHeight = '1.4';
  bubble.style.fontSize = '0.95rem';

  if (role === 'user') {
    bubble.style.background = 'var(--emerald)';
    bubble.style.color = '#fff';
    bubble.style.alignSelf = 'flex-end';
    bubble.style.marginLeft = 'auto';
  } else {
    bubble.style.background = 'var(--bg-card)';
    bubble.style.border = '1px solid var(--border)';
    bubble.style.alignSelf = 'flex-start';
    bubble.style.marginRight = 'auto';
  }

  // Render as plain text (preserving line breaks) so external content
  // (AI replies, error messages) can never be parsed as markup.
  setBubbleText(bubble, text);

  if (imageSrc) {
    const img = document.createElement('img');
    img.src = imageSrc;
    img.style.maxHeight = '100px';
    img.style.borderRadius = 'var(--radius-sm)';
    img.style.marginTop = '8px';
    img.style.display = 'block';
    bubble.appendChild(img);
  }

  historyEl.appendChild(bubble);
  historyEl.scrollTop = historyEl.scrollHeight;
  return bubble;
}

function setBubbleText(bubble, text) {
  bubble.textContent = '';
  const lines = String(text).split('\n');
  lines.forEach((line, i) => {
    if (i > 0) bubble.appendChild(document.createElement('br'));
    bubble.appendChild(document.createTextNode(line));
  });
}

// Renders a pending write (add_species_entry / add_note) as a card with
// Confirm/Cancel buttons — SylvX never mutates survey data on its own.
function appendConfirmCard(name, args) {
  const historyEl = $('#chatHistory');
  if (!historyEl) return null;

  const emptyState = historyEl.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const card = document.createElement('div');
  card.style.margin = '8px 0';
  card.style.padding = '12px 16px';
  card.style.borderRadius = 'var(--radius-md)';
  card.style.maxWidth = '90%';
  card.style.background = 'var(--bg-card)';
  card.style.border = '1px solid var(--emerald)';
  card.style.alignSelf = 'flex-start';
  card.style.marginRight = 'auto';

  const label = document.createElement('div');
  label.style.fontSize = '0.7rem';
  label.style.textTransform = 'uppercase';
  label.style.letterSpacing = '0.05em';
  label.style.opacity = '0.7';
  label.style.marginBottom = '6px';
  label.textContent = 'SylvX wants to:';
  card.appendChild(label);

  const desc = document.createElement('div');
  desc.style.fontSize = '0.95rem';
  desc.style.marginBottom = '10px';
  desc.textContent = describeWriteCall(name, args);
  card.appendChild(desc);

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '8px';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-primary btn-sm';
  confirmBtn.type = 'button';
  confirmBtn.textContent = 'Confirm';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost btn-sm';
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';

  confirmBtn.addEventListener('click', () => resolvePendingWrite(true, card, row));
  cancelBtn.addEventListener('click', () => resolvePendingWrite(false, card, row));

  row.appendChild(confirmBtn);
  row.appendChild(cancelBtn);
  card.appendChild(row);

  historyEl.appendChild(card);
  historyEl.scrollTop = historyEl.scrollHeight;
  return card;
}

async function resolvePendingWrite(confirmed, card, buttonRow) {
  if (!pendingWrite) return;
  const { name, args } = pendingWrite;
  pendingWrite = null;
  buttonRow.remove();

  const status = document.createElement('div');
  status.style.fontSize = '0.85rem';
  status.style.marginTop = '4px';

  let functionResponse;
  if (!confirmed) {
    status.textContent = 'Cancelled.';
    status.style.color = 'var(--text-muted)';
    functionResponse = { cancelled: true };
  } else {
    let result;
    if (name === 'add_species_entry') {
      result = await addSpeciesToQuadrat(args.quadratNumber, args);
    } else if (name === 'add_note') {
      result = await addNoteRecord(args.text, args.category, args.quadratNumber);
    } else {
      result = { ok: false, error: 'Unknown action.' };
    }

    if (result.ok) {
      status.textContent = '✅ Done.';
      status.style.color = 'var(--emerald)';
      toast('Saved by SylvX');
    } else {
      status.textContent = `❌ ${result.error}`;
      status.style.color = 'var(--red)';
    }
    functionResponse = result;
  }

  card.appendChild(status);

  messageHistory.push({
    role: 'function',
    parts: [{ functionResponse: { name, response: functionResponse } }]
  });
  await persistHistory();
}

async function handleChatSubmit() {
  const inputEl = $('#chatInput');
  const text = inputEl?.value.trim();
  if (!text) return;

  await ensureHistoryLoaded();

  const apiKey = $('#settingsGeminiApiKey')?.value.trim();

  if (!navigator.onLine) {
    await handleOfflineMessage(text);
    inputEl.value = '';
    return;
  }

  if (!apiKey) {
    toast('Please enter your Gemini API Key in Settings', true);
    $('#btnSettings')?.click();
    return;
  }

  inputEl.value = '';

  // Build user message parts
  const userParts = [{ text }];

  // Add image to payload if present
  if (currentPhotoBase64 && currentPhotoMime) {
    // Extract base64 data without data URI prefix for Gemini API
    const base64Data = currentPhotoBase64.split(',')[1];
    if (base64Data) {
      userParts.push({
        inline_data: {
          mime_type: currentPhotoMime,
          data: base64Data
        }
      });
      // Add image to UI bubble
      appendMessage('user', text, currentPhotoBase64);
    } else {
      appendMessage('user', text);
    }
    clearPhotoPreview();
  } else {
    appendMessage('user', text);
  }

  messageHistory.push({ role: 'user', parts: userParts });
  await persistHistory();

  const loadingBubble = appendMessage('model', '...');

  try {
    const systemInstruction = await buildSystemInstruction();
    const data = await callGemini(apiKey, systemInstruction);
    await handleGeminiResponse(data, apiKey, systemInstruction, loadingBubble);
  } catch (err) {
    console.error('SylvX Error:', err);
    loadingBubble.textContent = '';
    const errSpan = document.createElement('span');
    errSpan.style.color = 'var(--red)';
    errSpan.textContent = `Error: ${err.message}`;
    loadingBubble.appendChild(errSpan);
    messageHistory.pop(); // remove user message from history if failed
    await persistHistory();
  }
}

async function buildSystemInstruction() {
  const survey = await Store.getActive();
  let contextStr = 'No survey active.';
  if (survey) {
    contextStr = `Active Survey: ${survey.name}\n` +
                 `Total Quadrats: ${survey.quadrats?.length || 0}\n` +
                 `Total Transects: ${survey.transects?.length || 0}\n` +
                 `Waypoints: ${survey.waypoints?.length || 0}\n` +
                 `Start Date: ${survey.date || 'Unknown'}\n`;
    if (survey.location) contextStr += `Location: ${survey.location}\n`;
    if (survey.quadrats?.length) {
      contextStr += `Quadrat numbers: ${survey.quadrats.map(q => q.number).join(', ')}\n`;
    }
  }

  return `You are SylvX, the AI Field Assistant built into the Forest Capture app.
You are an expert in forestry, ecology, GIS, botany, and environmental science.

${APP_KNOWLEDGE}

You have tools to look up taxonomy, compare surveys, and (with the user's
confirmation) log species entries and notes. Call a tool directly when the
user's intent is clear — the app will always ask the user to confirm before
anything is written, so you do not need to ask for confirmation yourself.

Keep answers concise and suitable for a mobile app chat interface.
Here is the context of the user's current field data:
${contextStr}`;
}

async function callGemini(apiKey, systemInstruction, contents = messageHistory) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    contents
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'API request failed');
  }

  return response.json();
}

async function handleGeminiResponse(data, apiKey, systemInstruction, loadingBubble) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  const functionCallPart = parts.find(p => p.functionCall);

  if (functionCallPart) {
    const { name, args } = functionCallPart.functionCall;

    if (isWriteTool(name)) {
      loadingBubble.remove();
      messageHistory.push({ role: 'model', parts: [{ functionCall: { name, args } }] });
      pendingWrite = { name, args };
      appendConfirmCard(name, args);
      await persistHistory();
      return;
    }

    // Read-only tools execute immediately, then we ask Gemini for a
    // natural-language summary of the result.
    const toolResult = await executeReadOnlyTool(name, args);
    messageHistory.push({ role: 'model', parts: [{ functionCall: { name, args } }] });
    messageHistory.push({ role: 'function', parts: [{ functionResponse: { name, response: toolResult } }] });
    await persistHistory();

    try {
      const followUp = await callGemini(apiKey, systemInstruction);
      const followParts = followUp.candidates?.[0]?.content?.parts || [];
      const replyText = followParts.find(p => p.text)?.text || JSON.stringify(toolResult);
      setBubbleText(loadingBubble, replyText);
      messageHistory.push({ role: 'model', parts: [{ text: replyText }] });
    } catch (e) {
      console.warn('SylvX: follow-up call failed, showing raw tool result', e.message);
      setBubbleText(loadingBubble, formatToolResultFallback(name, toolResult));
    }
    await persistHistory();
    return;
  }

  const replyText = parts.find(p => p.text)?.text || "Sorry, I couldn't generate a response.";
  // Model output is external content — render as text, never as markup.
  setBubbleText(loadingBubble, replyText);
  messageHistory.push({ role: 'model', parts: [{ text: replyText }] });
  await persistHistory();
}

async function executeReadOnlyTool(name, args) {
  if (name === 'compare_surveys') {
    const surveys = await Store.getSurveys();
    const findByName = (n) => surveys.find(s => s.name && s.name.toLowerCase().includes((n || '').toLowerCase()));
    const a = findByName(args.surveyNameA);
    const b = findByName(args.surveyNameB);
    if (!a || !b) {
      return { error: `Could not find ${!a ? `"${args.surveyNameA}"` : `"${args.surveyNameB}"`} among saved surveys: ${surveys.map(s => s.name).join(', ') || 'none'}.` };
    }
    const ia = calculateIndicesPayload(a);
    const ib = calculateIndicesPayload(b);
    return {
      surveyA: { name: a.name, richness: ia.S, shannonH: ia.H, simpsonD: ia.D, evenness: ia.E, basalArea: ia.totalBA },
      surveyB: { name: b.name, richness: ib.S, shannonH: ib.H, simpsonD: ib.D, evenness: ib.E, basalArea: ib.totalBA },
      delta: { richness: ia.S - ib.S, shannonH: +(ia.H - ib.H).toFixed(3), basalArea: +(ia.totalBA - ib.totalBA).toFixed(3) }
    };
  }

  if (name === 'lookup_taxonomy') {
    const results = await searchTaxonomy(args.query, 6);
    if (!results.length) return { found: false, message: `No matches for "${args.query}" in the local taxonomy pack or this survey's logged species.` };
    return { found: true, results: results.map(r => ({ scientific: r.scientific, common: r.common, family: r.family })) };
  }

  return { error: `Unknown tool: ${name}` };
}

function formatToolResultFallback(name, result) {
  if (name === 'compare_surveys' && result.surveyA) {
    return `${result.surveyA.name}: S=${result.surveyA.richness}, H'=${result.surveyA.shannonH}\n` +
           `${result.surveyB.name}: S=${result.surveyB.richness}, H'=${result.surveyB.shannonH}`;
  }
  if (name === 'lookup_taxonomy' && result.results) {
    return result.results.map(r => `${r.scientific}${r.common ? ` (${r.common})` : ''}${r.family ? ` — ${r.family}` : ''}`).join('\n');
  }
  return result.message || result.error || JSON.stringify(result);
}

// When there's no network, SylvX can't reach Gemini — but a downloaded
// regional taxonomy pack works entirely offline, so route the message
// there instead of just refusing.
async function handleOfflineMessage(text) {
  appendMessage('user', text);

  const results = await searchTaxonomy(text, 5);
  if (results.length) {
    const summary = '📴 Offline taxonomy lookup:\n' +
      results.map(r => `• ${r.scientific}${r.common ? ` (${r.common})` : ''}${r.family ? ` — ${r.family}` : ''}`).join('\n');
    appendMessage('model', summary);
    messageHistory.push({ role: 'user', parts: [{ text }] });
    messageHistory.push({ role: 'model', parts: [{ text: summary }] });
    await persistHistory();
  } else {
    appendMessage('model', "I'm offline, so I can't reach the AI right now — but I can still look up species names from your downloaded taxonomy pack. Try asking about a species name directly.");
  }
}
