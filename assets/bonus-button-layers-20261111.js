/* BONUS_FULL_REBUILD_20261112
   The approved poster is a static photo asset without the printed CTA.
   The one actual #bonusRecipe link is painted with the matching original
   torn-paper image and remains clickable, hoverable and keyboard-accessible.
   No canvas, old image reprocessing or duplicate interaction layers.
*/
(() => {
  'use strict';
  function mount() {
    const banner = document.querySelector('#homeView .du-bonus .bonus-inner');
    const link = document.getElementById('bonusRecipe');
    if (!banner || !link) return;
    // Existing link handlers and hash destinations remain unchanged.
    if (link.parentElement !== banner) banner.appendChild(link);
    banner.dataset.bonusLayerReady = '1';
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, {once:true});
  } else {
    mount();
  }
})();
