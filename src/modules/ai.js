// src/modules/ai.js
import { $, $$, toast } from './ui.js';
import { Store } from './storage.js';
import { compress } from './utils.js';

let messageHistory = [];
let currentPhotoBase64 = null;
let currentPhotoMime = null;

export function initAI() {
  $('#btnSendChat')?.addEventListener('click', handleChatSubmit);
  $('#chatInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleChatSubmit();
  });

  $('#chatPhotoUpload')?.addEventListener('change', handlePhotoUpload);
  $('#btnRemoveChatPhoto')?.addEventListener('click', clearPhotoPreview);
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
    bubble.style.background = 'var(--primary)';
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

async function handleChatSubmit() {
  const inputEl = $('#chatInput');
  const text = inputEl?.value.trim();
  if (!text) return;

  const apiKey = $('#settingsGeminiApiKey')?.value.trim();
  if (!apiKey) {
    toast('Please enter your Gemini API Key in Settings', true);
    $('#btnSettings')?.click();
    return;
  }

  if (!navigator.onLine) {
    toast('SylvX requires an internet connection', true);
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

  const loadingBubble = appendMessage('model', '...');
  
  try {
    const survey = await Store.getActive();
    let contextStr = 'No survey active.';
    if (survey) {
      contextStr = `Active Survey: ${survey.name}\n` +
                   `Total Quadrats: ${survey.quadrats?.length || 0}\n` +
                   `Total Transects: ${survey.transects?.length || 0}\n` +
                   `Waypoints: ${survey.waypoints?.length || 0}\n` +
                   `Start Date: ${survey.date || 'Unknown'}\n`;
      if (survey.location) {
         contextStr += `Location: ${survey.location}\n`;
      }
    }

    const systemInstruction = `You are SylvX, an AI Field Assistant built into the Forest Capture app. 
You are an expert in forestry, ecology, GIS, botany, and environmental science. 
Answer anything and everything related to forestry, ecology, GIS, the app, etc.
Keep your answers concise and suitable for a mobile app chat interface.
Here is the context of the user's current field data:\n${contextStr}`;

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    const payload = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: messageHistory
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

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";

    // Model output is external content — render as text, never as markup.
    setBubbleText(loadingBubble, replyText);
    messageHistory.push({ role: 'model', parts: [{ text: replyText }] });

  } catch (err) {
    console.error('SylvX Error:', err);
    loadingBubble.textContent = '';
    const errSpan = document.createElement('span');
    errSpan.style.color = 'var(--red)';
    errSpan.textContent = `Error: ${err.message}`;
    loadingBubble.appendChild(errSpan);
    messageHistory.pop(); // remove user message from history if failed
  }
}
