// assets/js/nav.js
// ---------------------------------------------------------------
// Shared chrome behavior used on every public page:
//  - nav background appears after scrolling past the hero
//  - mobile menu open/close
//  - IntersectionObserver-driven scroll-reveal for [data-reveal]
//  - back-to-top button visibility + click
// ---------------------------------------------------------------
'use strict';

(function () {
  // ---- Scroll-aware nav ----
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ---- Mobile menu ----
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const mobileMenu  = document.querySelector('[data-mobile-menu]');

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  // ---- Scroll reveal ----
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  // ---- Back to top ----
  const backToTop = document.querySelector('[data-back-to-top]');
  if (backToTop) {
    const toggleVisibility = () => {
      backToTop.classList.toggle('is-visible', window.scrollY > 600);
    };
    toggleVisibility();
    window.addEventListener('scroll', toggleVisibility, { passive: true });
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ---- Active nav link highlighting based on current path ----
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav__link, .mobile-menu__link').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    const isHome = href === '/' && currentPath === '/';
    // Project detail pages (/project/…) belong under "Projects"
    const isMatch = href !== '/' && (currentPath.startsWith(href) || (href === '/projects' && currentPath.startsWith('/project/')));
    if (isHome || isMatch) link.classList.add('is-active');
  });
})();
