/* Synchronize the two existing catalog masthead backgrounds to the real
   height of their heading. No image, recipe, timer or other UI is changed. */
(() => {
  'use strict';
  const catalog = document.getElementById('catalog');
  const masthead = catalog && catalog.querySelector('.du-section-top');
  if (!catalog || !masthead) return;
  function alignCatalogArtwork() {
    if (window.location.hash !== '#catalog') return;
    const height = masthead.getBoundingClientRect().height;
    if (height > 0) {
      catalog.style.setProperty('--du-catalog-masthead-height', Math.ceil(height) + 'px');
    }
  }
  if ('ResizeObserver' in window) {
    new ResizeObserver(alignCatalogArtwork).observe(masthead);
  }
  window.addEventListener('hashchange', () => requestAnimationFrame(alignCatalogArtwork));
  window.addEventListener('resize', alignCatalogArtwork, {passive:true});
  requestAnimationFrame(alignCatalogArtwork);
})();
