// assets/js/hero-network.js
// ---------------------------------------------------------------
// Signature visual: a quiet, drifting node-network rendered on a
// <canvas>, evoking a live neural net behind the hero headline.
// Nodes drift slowly; lines connect nearby nodes with opacity
// proportional to distance. Respects prefers-reduced-motion by
// rendering one static frame and never animating.
// ---------------------------------------------------------------
'use strict';

(function () {
  const canvas = document.getElementById('hero-network');
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let nodes = [];
  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let rafId = null;

  // Brand colors — read live so it follows light/dark theme switches
  function getColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
      from: styles.getPropertyValue('--primary-from').trim() || '#2563eb',
      to:   styles.getPropertyValue('--primary-to').trim()   || '#7c3aed',
    };
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width  = rect.width;
    height = rect.height;
    canvas.width  = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initNodes() {
    // Density scales with area, capped for performance
    const targetCount = Math.min(60, Math.round((width * height) / 18000));
    nodes = Array.from({ length: targetCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: Math.random() * 1.6 + 1,
    }));
  }

  function step() {
    const { from, to } = getColors();
    ctx.clearRect(0, 0, width, height);

    // Update positions
    if (!prefersReducedMotion) {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width)  n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }
    }

    // Draw connections
    const maxDist = Math.min(160, width / 5);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const opacity = (1 - dist / maxDist) * 0.18;
          const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          gradient.addColorStop(0, hexToRgba(from, opacity));
          gradient.addColorStop(1, hexToRgba(to, opacity));
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(to, 0.55);
      ctx.fill();
    }

    if (!prefersReducedMotion) {
      rafId = requestAnimationFrame(step);
    }
  }

  function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function start() {
    resize();
    initNodes();
    if (rafId) cancelAnimationFrame(rafId);
    step();
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(start, 200);
  });

  // Pause the animation loop when the tab isn't visible (saves battery/CPU)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
    } else if (!prefersReducedMotion) {
      step();
    }
  });

  start();
})();
