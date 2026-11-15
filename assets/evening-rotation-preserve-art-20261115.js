/* Newspaper recipe rotation. The ONLY visible node remains the approved WebP
 * image. A composited bitmap preserves the original silhouette, vintage paper
 * and exact original wine-red "Приготовить" artwork. No HTML cards or overlays.
 */
(function () {
  'use strict';
  const cards = Array.from(document.querySelectorAll('#eveningLanding .du-match11-recipe-grid > a.du-approved-cover-recipe'));
  if (cards.length !== 3 || typeof RECIPES === 'undefined' || !Array.isArray(RECIPES)) return;

  const pools = [['fish', 'meat', 'poultry'], ['pasta', 'vegetables'], ['dessert']];
  const storageKey = 'nash-vecher-previous-three-recipes-v1';
  let previous = [];
  try {
    const old = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(old)) previous = old;
  } catch (_) {}
  function randomIndex(length) {
    try {
      const n = new Uint32Array(1);
      crypto.getRandomValues(n);
      return n[0] % length;
    } catch (_) {
      return Math.floor(Math.random() * length);
    }
  }
  const picked = [];
  for (let i = 0; i < 3; i++) {
    const all = RECIPES.filter(r => pools[i].includes(r.category) &&
      typeof r.photo === 'string' && r.photo.startsWith('/assets/') &&
      r.id && r.title);
    if (!all.length) return;
    const candidates = all.filter(r => r.id !== previous[i] && !picked.some(p => p.id === r.id));
    picked.push((candidates.length ? candidates : all)[randomIndex((candidates.length ? candidates : all).length)]);
  }

  const loadImage = src => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
  const wrap = (ctx, text, width, maxLines) => {
    const words = text.trim().split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      const next = current ? current + ' ' + word : word;
      if (ctx.measureText(next).width > width && current) {
        lines.push(current);
        current = word;
      } else current = next;
    }
    if (current) lines.push(current);
    if (lines.length > maxLines) return null;
    if (lines.some(line => ctx.measureText(line).width > width)) return null;
    return lines;
  };
  // Exact editorial spelling for the baked-apples title, even if a bad
  // title variant arrives from a stale catalogue or browser cache.
  function displayTitle(recipe) {
    const title = recipe.title || '';
    if (recipe.id === 'baked-apples' || /^Запеч[её]нные яблок[ий]/i.test(title)) {
      return title.replace(/^Запеч[её]нные яблок[ий]/i, 'Запечённые яблоки');
    }
    return title;
  }
  function paintNewspaper(original, dish, recipe) {
    const W = original.naturalWidth || original.width;
    const H = original.naturalHeight || original.height;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    if (!ctx) return null;
    ctx.drawImage(original, 0, 0, W, H);
    const sx = W / 490, sy = H / 828;

    // Replace pixels only within the photo window, leaving the approved
    // irregular outer cut and newspaper page edges untouched.
    ctx.save();
    ctx.beginPath();
    const polygon = [[48,93],[68,87],[120,84],[172,80],[235,78],[306,77],[372,82],[432,90],[446,107],[444,366],[421,380],[335,390],[245,389],[155,393],[79,390],[49,375]];
    polygon.forEach(([x,y],i) => i ? ctx.lineTo(x*sx,y*sy) : ctx.moveTo(x*sx,y*sy));
    ctx.closePath();
    ctx.clip();
    const sw = dish.width || dish.naturalWidth, sh = dish.height || dish.naturalHeight;
    const region = {x:45*sx,y:75*sy,w:405*sx,h:322*sy};
    const scale = Math.max(region.w/sw,region.h/sh);
    const dw = sw*scale,dh = sh*scale;
    ctx.drawImage(dish,region.x+(region.w-dw)/2,region.y+(region.h-dh)/2,dw,dh);
    ctx.restore();

    // Reconstruct the paper under the *old baked-in words* using the edge
    // colors of the same original artwork, with feathered borders and fine
    // sampled grain. No solid-color rectangular UI element is introduced.
    const x0=Math.round(24*sx), x1=Math.round(453*sx);
    const y0=Math.round(406*sy), y1=Math.round(644*sy);
    const image=ctx.getImageData(0,0,W,H);
    const data=image.data, originalData=new Uint8ClampedArray(data);
    const at=(x,y)=>(y*W+x)*4;
    function paperSample(x,y) {
      // Two ink-free paper strips from this card at either side of its title.
      // Average samples to avoid reproducing any printed letter.
      const j=at(Math.max(0,Math.min(W-1,Math.round(x))),Math.max(0,Math.min(H-1,Math.round(y))));
      return [originalData[j],originalData[j+1],originalData[j+2]];
    }
    const reference=[];
    for(let x=Math.round(45*sx);x<Math.round(440*sx);x+=Math.max(1,Math.round(7*sx))) {
      const p=paperSample(x,Math.round(404*sy));
      if(p[0]>145&&p[1]>115&&p[2]>80)reference.push(p);
    }
    if(!reference.length)reference.push([239,219,194]);
    const base=[0,1,2].map(k=>reference.reduce((n,p)=>n+p[k],0)/reference.length);
    for (let y=y0;y<y1;y++) {
      for(let x=x0;x<x1;x++) {
        const edge=Math.min(x-x0,x1-1-x,y-y0,y1-1-y);
        const feather=Math.min(1,Math.max(0,edge/(9*Math.max(sx,sy))));
        // Nearby untouched artwork defines the paper tone and shading.
        const v=(x-x0)/(x1-x0),t=(y-y0)/(y1-y0);
        const luminance=7*(.5-v)-7*t;
        const grain=((x*37+y*71+(x*y)%13)%23-11)*.34;
        const target=[base[0]+luminance+grain,base[1]+luminance*.82+grain,base[2]+luminance*.6+grain];
        const p=at(x,y);
        for(let k=0;k<3;k++)data[p+k]=Math.max(0,Math.min(255,Math.round(originalData[p+k]*(1-feather)+target[k]*feather)));
      }
    }
    ctx.putImageData(image,0,0);

    // Serif letterforms, original wine color, exact editorial hierarchy:
    // large title / two-line description / original graphic CTA unchanged.
    const x=57*sx, availableWidth=372*sx;
    let titleLines=null,titleSize=0;
    for(let size=72;size>=30;size-=2) {
      ctx.font='600 '+Math.round(size*sx)+'px "Cormorant Garamond", Georgia, serif';
      titleLines=wrap(ctx,displayTitle(recipe),availableWidth,3);
      if(titleLines&&titleLines.length*size*0.98<=136){titleSize=size;break;}
    }
    if(!titleLines||!titleSize)return null;
    ctx.fillStyle='#61282c';
    ctx.textBaseline='top';
    ctx.font='600 '+Math.round(titleSize*sx)+'px "Cormorant Garamond", Georgia, serif';
    // Match the gently rising editorial baseline of the approved cards.
    ctx.save();
    ctx.translate(x, 419*sy);
    ctx.rotate(-2 * Math.PI / 180);
    titleLines.forEach((line,i)=>ctx.fillText(line,0,i*titleSize*0.98*sy));
    ctx.restore();

    let subtitle=(recipe.description||'Вечер, который хочется повторить вдвоём.')
      .replace(/\s+/g,' ').trim();
    let descLines=null,descSize=0;
    for(let size=32;size>=19;size--) {
      ctx.font='500 '+Math.round(size*sx)+'px "Cormorant Garamond", Georgia, serif';
      descLines=wrap(ctx,subtitle,availableWidth,2);
      if(descLines){descSize=size;break;}
    }
    if(!descLines) {
      const words=subtitle.split(' ');
      while(words.length>2) {
        words.pop();
        const t=words.join(' ')+'…';
        ctx.font='500 '+Math.round(18*sx)+'px "Cormorant Garamond", Georgia, serif';
        descLines=wrap(ctx,t,availableWidth,2);
        if(descLines){descSize=18;break;}
      }
    }
    if(!descLines)return null;
    ctx.fillStyle='#342224';
    ctx.font='500 '+Math.round(descSize*sx)+'px "Cormorant Garamond", Georgia, serif';
    ctx.save();
    ctx.translate(x, 565*sy);
    ctx.rotate(-2 * Math.PI / 180);
    descLines.forEach((line,i)=>ctx.fillText(line,0,i*descSize*1.12*sy));
    ctx.restore();
    return canvas.toDataURL('image/webp',.95);
  }

  // The approved WebP remains on screen until a replacement is fully composed.
  // Try alternate valid catalogue entries if a photo fails to load or a title
  // does not fit. A single broken photo must not disable all three rotations.
  const successful = previous.slice(0,3);
  async function rotateCard(card, i) {
    const original = card.querySelector('img');
    if (!original) return;
    const source = original.getAttribute('src');
    const candidates = [picked[i], ...RECIPES.filter(r =>
      pools[i].includes(r.category) && r.id && r.title &&
      typeof r.photo === 'string' && r.photo.startsWith('/assets/') &&
      r.id !== picked[i].id && r.id !== previous[i]
    )];
    const paper = await loadImage(source);
    const limit = Math.min(candidates.length, 25);
    for (let attempt = 0; attempt < limit; attempt++) {
      const recipe = candidates[attempt];
      if (successful.includes(recipe.id)) continue;
      try {
        const dish = await loadImage(recipe.photo);
        const picture = paintNewspaper(paper, dish, recipe);
        if (!picture) continue;
        // One and only one visible image per card, no extra rectangles,
        // typography overlays or changes to the original paper outline.
        card.href = '#recipe=' + encodeURIComponent(recipe.id);
        card.setAttribute('aria-label', displayTitle(recipe) + '. Приготовить рецепт');
        original.alt = displayTitle(recipe) + '. Приготовить рецепт';
        original.src = picture;
        card.dataset.rotatedRecipe = recipe.id;
        successful[i] = recipe.id;
        try { localStorage.setItem(storageKey, JSON.stringify(successful)); } catch (_) {}
        return;
      } catch (error) {
        console.warn('Evening recipe candidate unavailable:', recipe.id, error);
      }
    }
    console.warn('Evening recipe rotation could not load any candidate for card', i+1);
  }
  // Canvas needs the actual approved font loaded before measuring and painting.
  // Otherwise the browser permanently bakes a fallback face into the image.
  const typographyReady = document.fonts
    ? Promise.all([
        document.fonts.load('600 72px "Cormorant Garamond"', 'Лосось с лимоном'),
        document.fonts.load('500 32px "Cormorant Garamond"', 'Уютная классика')
      ])
    : Promise.resolve();
  typographyReady.catch(() => {}).then(() =>
    Promise.allSettled(cards.map((card, i) => rotateCard(card, i)))
  ).then(() => {
    document.documentElement.dataset.eveningRotationCompleted = 'true';
  });
})();
