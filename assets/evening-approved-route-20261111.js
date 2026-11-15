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
      catalogBack.setAttribute('href', '#evening');
      catalogBack.setAttribute('aria-label', 'Вернуться из каталога на главную страницу Наш вечер');
    }

    const eveningBack = document.querySelector('header a.du-evening-back:not(.du-catalog-back)');
    if (eveningBack) {
      eveningBack.setAttribute('href', '#journal');
      eveningBack.setAttribute('aria-label', 'Перейти к кулинарному журналу и каталогу');
      const label = eveningBack.querySelector('span:last-child');
      if (label) label.textContent = 'К журналу';
    }

    const coverBack = document.querySelector('a.du-match11-sr-back');
    if (coverBack) {
      coverBack.setAttribute('href', '#journal');
      coverBack.textContent = 'Перейти к кулинарному журналу СНАЧАЛА УЖИН';
    }

    // Any remaining old "home" navigation must return to the NEW home.
    document.querySelectorAll('a[href="#home"]').forEach(a => {
      a.setAttribute('href', '#evening');
    });
  }

  function updateEntryRoute() {
    const hash = window.location.hash;
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
