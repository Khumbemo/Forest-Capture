/**
 * 3D Satellite Background Animation
 * A lightweight, vanilla JS canvas animation system.
 * Renders a full-screen wireframe satellite behind all UI elements.
 */

export function initBackgrounds() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Subtle vignette overlay
    const w2 = canvas.width / 2;
    const h2 = canvas.height / 2;
    const vig = ctx.createRadialGradient(w2, h2, canvas.height * 0.2, w2, h2, canvas.height * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  window.addEventListener('resize', resize);
  resize();
}

// Global hooks for the UI router to manage battery life
export function pauseBackgrounds() {
  window.fcBgPaused = true;
  if (window.fcBgAnimId) {
    cancelAnimationFrame(window.fcBgAnimId);
    window.fcBgAnimId = null;
  }
}

export function resumeBackgrounds() {
  if (window.fcBgPaused) {
    window.fcBgPaused = false;
    // Just trigger a resize to jumpstart if needed, though the loop will restart 
    // if we call requestAnimationFrame here. But since `render` is inside `initBackgrounds`,
    // the easiest way is to let the router toggle `window.fcBgPaused` and we just dispatch an event.
    window.dispatchEvent(new Event('fc-resume-bg'));
  }
}
