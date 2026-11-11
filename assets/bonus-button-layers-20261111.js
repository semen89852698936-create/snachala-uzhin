/* BONUS_BUTTON_TRUE_LAYER_SEPARATION_20261111
 * The approved poster has a button baked into the photograph. Reconstruct only
 * the smooth wall behind that button, then cut the ORIGINAL letterforms out of
 * the same source pixels as a transparent interactive layer. No second font,
 * no flat-colored rectangle, no blur overlay, no other changes to the image.
 */
(() => {
  'use strict';
  function initBonusLayers() {
    const banner = document.querySelector('#homeView .du-bonus .bonus-inner');
    const button = document.querySelector('#homeView .du-bonus #bonusRecipe');
    if (!banner || !button || banner.dataset.bonusLayerReady === '1') return;
    // The original CTA is inside .bonus-text. All poster coordinates and final
    // button CSS are relative to .bonus-inner, so move the SAME link (with its
    // existing click handler) to that parent. Otherwise the cropped paper
    // appears a second time, shifted away from the printed CTA.
    if (button.parentElement !== banner) banner.appendChild(button);
    const picture = new Image();
    picture.decoding = 'async';
    picture.onload = () => {
      try {
        const w = picture.naturalWidth, h = picture.naturalHeight;
        if (w < 900 || h < 300) return;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', {willReadFrequently:true});
        if (!ctx) return;
        ctx.drawImage(picture, 0, 0, w, h);
        const frame = ctx.getImageData(0, 0, w, h);
        const original = new Uint8ClampedArray(frame.data);

        // Exact pixel crop of the approved printed paper button.
        const bx = Math.round(w * 0.359), by = Math.round(h * 0.558);
        const bw = Math.round(w * 0.202), bh = Math.round(h * 0.137);
        const sticker = document.createElement('canvas');
        sticker.width = bw; sticker.height = bh;
        const stickerCtx = sticker.getContext('2d');
        if (!stickerCtx) return;
        const stickerPixels = stickerCtx.createImageData(bw, bh);
        const paperPixel = (n) => original[n] > 170 &&
          original[n+1] > 132 && original[n+2] > 112;
        for (let col = 0; col < bw; col++) {
          let first = -1, last = -1;
          for (let row = 0; row < bh; row++) {
            const p = 4 * ((by + row) * w + bx + col);
            if (paperPixel(p)) { if (first < 0) first = row; last = row; }
          }
          if (first < 0 || last-first < 4) continue;
          for (let row = first; row <= last; row++) {
            const src = 4 * ((by + row)*w + bx + col);
            const dst = 4 * (row*bw + col);
            stickerPixels.data[dst] = original[src];
            stickerPixels.data[dst+1] = original[src+1];
            stickerPixels.data[dst+2] = original[src+2];
            const edge = Math.min(row-first+1, last-row+1);
            stickerPixels.data[dst+3] = Math.round(255*Math.min(1,edge/2));
          }
        }
        stickerCtx.putImageData(stickerPixels,0,0);

        // Inpaint the OLD stationary button. Interpolate the same photograph's
        // wall pixels above/below the printed paper, column by column. Feather
        // only the outer boundary, entirely outside the torn-paper silhouette.
        const left = Math.round(w*.346), right = Math.round(w*.574);
        const top = Math.round(h*.535), bottom = Math.round(h*.722);
        const sampleTop = Math.max(0,top-5);
        const sampleBottom = Math.min(h-1,bottom+5);
        for (let y = top; y <= bottom; y++) {
          const t = (y-top)/(bottom-top);
          for (let x = left; x <= right; x++) {
            const dst = 4*(y*w+x);
            const pTop = 4*(sampleTop*w+x);
            const pBottom = 4*(sampleBottom*w+x);
            const distance = Math.min(x-left,right-x,y-top,bottom-y);
            const feather = Math.max(0, Math.min(1, distance/13));
            const alpha = feather*feather*(3-2*feather);
            for (let c = 0; c < 3; c++) {
              const wall = original[pTop+c]*(1-t) + original[pBottom+c]*t;
              frame.data[dst+c] = Math.round(original[dst+c]*(1-alpha)+wall*alpha);
            }
          }
        }
        ctx.putImageData(frame,0,0);
        const cleanPoster = canvas.toDataURL('image/webp',.95);
        const originalPaper = sticker.toDataURL('image/png');
        // Apply both layers together after successful processing.
        banner.style.setProperty('background-image','url("'+cleanPoster+'")','important');
        button.style.setProperty('background-image','url("'+originalPaper+'")','important');
        button.style.setProperty('left',(bx/w*100)+'%','important');
        button.style.setProperty('top',(by/h*100)+'%','important');
        button.style.setProperty('width',(bw/w*100)+'%','important');
        button.style.setProperty('height',(bh/h*100)+'%','important');
        banner.dataset.bonusLayerReady='1';
      } catch (err) {
        console.warn('Bonus button layers: retain approved static artwork', err);
      }
    };
    picture.src = '/assets/approved-banners/bonus-corrected-20261110.webp';
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',initBonusLayers,{once:true});
  } else {
    initBonusLayers();
  }
})();
