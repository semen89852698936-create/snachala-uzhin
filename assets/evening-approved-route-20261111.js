/* Scope: only an initial direct visit to #evening on the approved 11 Nov cover.
   Browsers may apply native fragment scrolling to the *lower* #evening section
   after the site's router has positioned #eveningLanding. Restore the cover
   after the initial page load without changing user-initiated scrolling. */
(() => {
  const restoreApprovedCover = () => {
    if (window.location.hash !== '#evening') return;
    if (!document.body.classList.contains('du-evening-mode')) return;
    if (!document.querySelector('#eveningLanding .du-match11-hero')) return;
    window.scrollTo({top:0,left:0,behavior:'instant'});
  };
  window.addEventListener('load', () => {
    requestAnimationFrame(() => requestAnimationFrame(restoreApprovedCover));
  }, {once:true});
  window.addEventListener('pageshow', () => {
    requestAnimationFrame(restoreApprovedCover);
  });
})();
