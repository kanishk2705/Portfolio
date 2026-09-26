// assets/js/admin-login.js
'use strict';

(function () {
  const emailInput   = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn     = document.getElementById('login-btn');
  const errorBox     = document.getElementById('login-error');
  const errorText    = document.getElementById('login-error-text');
  const pwToggle     = document.getElementById('password-toggle');
  const eyeOpen      = document.getElementById('eye-open');
  const eyeClosed    = document.getElementById('eye-closed');

  // If already logged in, redirect immediately — use raw fetch so we don't
  // trigger adminApi's automatic redirect-to-login on a 401 (which would
  // create an infinite loop on this very page).
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((res) => res.ok ? res.json() : null)
    .then((data) => {
      if (data?.success) {
        const next = new URLSearchParams(window.location.search).get('next') || '/admin/dashboard';
        window.location.href = next;
      }
    })
    .catch(() => { /* not logged in — stay */ });

  // ---- Show/hide password ----
  pwToggle.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    eyeOpen.style.display   = isPassword ? 'none'  : '';
    eyeClosed.style.display = isPassword ? ''      : 'none';
    pwToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });

  // ---- Show error ----
  function showError(message) {
    errorText.textContent = message;
    errorBox.classList.add('is-visible');
    loginBtn.disabled = false;
    loginBtn.innerHTML = 'Sign in';
  }

  function clearError() {
    errorBox.classList.remove('is-visible');
  }

  // ---- Submit ----
  async function attemptLogin() {
    clearError();
    const email    = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email)    { emailInput.focus();    return showError('Email address is required.'); }
    if (!password) { passwordInput.focus(); return showError('Password is required.'); }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Signing in…';

    try {
      await adminApi.login(email, password);
      const next = new URLSearchParams(window.location.search).get('next') || '/admin/dashboard';
      window.location.href = next;
    } catch (err) {
      showError(err.message || 'Login failed. Please check your credentials.');
    }
  }

  loginBtn.addEventListener('click', attemptLogin);

  // Submit on Enter key in either field
  [emailInput, passwordInput].forEach((el) => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptLogin(); });
  });
})();
