// assets/js/theme.js
// ---------------------------------------------------------------
// Light/dark theme toggle. The INITIAL theme is set synchronously
// by an inline script in <head> (see index.html etc.) to avoid a
// flash of the wrong theme before this file loads. This file only
// wires up the toggle button's click behavior + persistence.
// ---------------------------------------------------------------
'use strict';

(function () {
  const STORAGE_KEY = 'portfolio-theme';

  function getStoredTheme() {
    return localStorage.getItem(STORAGE_KEY);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    // Keep the browser UI (e.g. mobile status bar) in sync
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0e16' : '#ffffff');
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function toggleTheme() {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  }

  function initToggleButtons() {
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', toggleTheme);
      btn.setAttribute('aria-label', 'Toggle light and dark theme');
    });
  }

  // React to OS-level theme changes ONLY if the user hasn't made an explicit choice
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!getStoredTheme()) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggleButtons);
  } else {
    initToggleButtons();
  }

  // Expose for other scripts if needed
  window.__theme = { setTheme, toggleTheme, currentTheme };
})();
