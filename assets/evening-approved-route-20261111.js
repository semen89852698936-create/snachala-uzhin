/* СНАЧАЛА УЖИН: route-only switch of the entry page.
   #evening is the public home, #journal preserves the previous cover.
   Keep existing approved layout, playlists, recipes and interactions intact. */
(() => {
  'use strict';

  function installNavigation() {
    const brand = document.querySelector('a.brand.du-brand');
    if (brand) {
      brand.setAttribute('href', '#evening');
      brand.setAttribute('aria-label', 'СНАЧАЛА УЖИН, на главную страницу Наш вечер');
    }

    const catalogBack = document.querySelector('a.du-catalog-back');
    if (catalogBack) {
      catalogBack.setAttribute('href', '#journal');
      catalogBack.setAttribute('aria-label', 'Вернуться из каталога на страницу СНАЧАЛА УЖИН');
    }

    const eveningBack = document.querySelector('header a.du-evening-back:not(.du-catalog-back)');
    if (eveningBack) {
      eveningBack.setAttribute('href', '#evening');
      eveningBack.setAttribute('aria-label', 'Вернуться со страницы СНАЧАЛА УЖИН в Наш Вечер');
      eveningBack.classList.add('du-journal-home-link');
      const label = eveningBack.querySelector('span:last-child');
      if (label) label.textContent = 'Наш вечер';
    }

    const coverBack = document.querySelector('a.du-match11-sr-back');
    if (coverBack) {
      coverBack.setAttribute('href', '#journal');
      coverBack.textContent = 'Перейти к кулинарному журналу СНАЧАЛА УЖИН';
    }

    // The main header now links to the preserved editorial journal.
    const journalNav = document.querySelector('.main-nav a[data-nav="evening"]');
    if (journalNav) {
      journalNav.setAttribute('href', '#journal');
      journalNav.setAttribute('aria-label', 'На главную страницу СНАЧАЛА УЖИН');
      journalNav.textContent = 'На главную';
    }

    // The mobile header and quick navigation are the same destination.
    const mobileJournalNav = document.querySelector('a.du-evening-nav-mobile');
    if (mobileJournalNav) {
      mobileJournalNav.setAttribute('href', '#journal');
      mobileJournalNav.textContent = 'На главную';
    }
    const mobileQuickNav = document.querySelector('[data-quick-evening]');
    if (mobileQuickNav) {
      mobileQuickNav.setAttribute('href', '#journal');
      mobileQuickNav.textContent = 'На главную';
    }

    // Remove only the editorial kicker and the redundant "Создать наш вечер →" CTA
    // from the new home. Do not touch the other hero button.
    document.querySelector('#eveningLanding .du-match11-kicker')?.remove();
    const redundantCTA = document.querySelector('#eveningLanding .du-match11-actions a.du-match11-button[href="#eveningBuilder"]');
    if (redundantCTA?.textContent?.includes('Создать наш вечер')) redundantCTA.remove();

    // Any remaining old "home" navigation must return to the NEW home.
    document.querySelectorAll('a[href="#home"]').forEach(a => {
      a.setAttribute('href', '#evening');
    });
  }

  function updateEntryRoute() {
    const hash = window.location.hash;
    document.body.classList.toggle('du-journal-view', hash === '#journal');

    // The site is now called «Наш Вечер». The former editorial page keeps
    // its own title «СНАЧАЛА УЖИН», without changing its approved artwork.
    const isJournal = hash === '#journal';
    document.title = isJournal
      ? 'СНАЧАЛА УЖИН · 1001 повод остаться'
      : 'Наш Вечер · Готовим вместе, ужинаем красиво';
    const brandWords = document.querySelector('.du-brand-words');
    if (brandWords) {
      const first = brandWords.firstChild;
      if (first && first.nodeType === 3) first.nodeValue = isJournal ? 'СНАЧАЛА ' : 'НАШ ';
      const highlighted = brandWords.querySelector('em');
      if (highlighted) highlighted.textContent = isJournal ? 'УЖИН' : 'ВЕЧЕР';
    }
    // The old router considers this link to be the active "Наш вечер" tab.
    // Do not announce the renamed "На главную" button as the current page.
    const journalNav = document.querySelector('.main-nav a[data-nav="evening"]');
    if (journalNav) {
      if (hash === '#journal') journalNav.setAttribute('aria-current', 'page');
      else journalNav.removeAttribute('aria-current');
    }
    if (!hash || hash === '#home') {
      // Preserve query parameters and make old bookmarks land on the new home.
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + '#evening');
      // replaceState does not fire hashchange; the existing router listens to it.
      window.dispatchEvent(new Event('hashchange'));
      return;
    }
    if (hash === '#journal') {
      requestAnimationFrame(() => window.scrollTo({top:0, left:0, behavior:'instant'}));
    }
  }

  function restoreApprovedCover() {
    if (window.location.hash !== '#evening') return;
    if (!document.body.classList.contains('du-evening-mode')) return;
    if (!document.querySelector('#eveningLanding .du-match11-hero')) return;
    window.scrollTo({top:0, left:0, behavior:'instant'});
  }

  // Keep the existing floating back-button styling; show it only on the old
  // "СНАЧАЛА УЖИН" cover and make it return to the new "Наш вечер" home.
  if (!document.querySelector('#du-journal-back-visibility')) {
    const style = document.createElement('style');
    style.id = 'du-journal-back-visibility';
    style.textContent =
      'body.du-journal-view header a.du-evening-back.du-journal-home-link{display:inline-flex!important}' +
      'body:not(.du-journal-view) header a.du-evening-back.du-journal-home-link{display:none!important}';
    document.head.appendChild(style);
  }

  installNavigation();
  updateEntryRoute();
  window.addEventListener('hashchange', updateEntryRoute);
  window.addEventListener('load', () => {
    requestAnimationFrame(() => requestAnimationFrame(restoreApprovedCover));
  }, {once:true});
  window.addEventListener('pageshow', () => {
    installNavigation();
    updateEntryRoute();
    requestAnimationFrame(restoreApprovedCover);
  });
})();
