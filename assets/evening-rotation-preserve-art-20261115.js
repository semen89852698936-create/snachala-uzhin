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
    const x0=Math.round(52*sx), x1=Math.round(441*sx);
    const y0=Math.round(417*sy), y1=Math.round(638*sy);
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
    for(let x=x0;x<x1;x+=Math.max(1,Math.round(7*sx))) {
      const p=paperSample(x,Math.round(407*sy));
      if(p[0]>145&&p[1]>115&&p[2]>80)reference.push(p);
    }
    if(!reference.length)reference.push([239,219,194]);
    const base=[0,1,2].map(k=>reference.reduce((n,p)=>n+p[k],0)/reference.length);
    for (let y=y0;y<y1;y++) {
      for(let x=x0;x<x1;x++) {
        const edge=Math.min(x-x0,x1-1-x,y-y0,y1-1-y);
        const feather=Math.min(1,Math.max(0,edge/(12*Math.max(sx,sy))));
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
    for(let size=54;size>=26;size-=2) {
      ctx.font='600 '+Math.round(size*sx)+'px Georgia, "Times New Roman", serif';
      titleLines=wrap(ctx,recipe.title,availableWidth,3);
      if(titleLines&&titleLines.length*size<=114){titleSize=size;break;}
    }
    if(!titleLines||!titleSize)return null;
    ctx.fillStyle='#61282c';
    ctx.textBaseline='top';
    ctx.font='600 '+Math.round(titleSize*sx)+'px Georgia, "Times New Roman", serif';
    titleLines.forEach((line,i)=>ctx.fillText(line,x,(426+i*titleSize*1.02)*sy));

    let subtitle=(recipe.description||'Вечер, который хочется повторить вдвоём.')
      .replace(/\s+/g,' ').trim();
    let descLines=null,descSize=0;
    for(let size=26;size>=17;size--) {
      ctx.font='500 '+Math.round(size*sx)+'px Georgia, "Times New Roman", serif';
      descLines=wrap(ctx,subtitle,availableWidth,2);
      if(descLines){descSize=size;break;}
    }
    if(!descLines) {
      const words=subtitle.split(' ');
      while(words.length>2) {
        words.pop();
        const t=words.join(' ')+'…';
        ctx.font='500 '+Math.round(18*sx)+'px Georgia, "Times New Roman", serif';
        descLines=wrap(ctx,t,availableWidth,2);
        if(descLines){descSize=18;break;}
      }
    }
    if(!descLines)return null;
    ctx.fillStyle='#342224';
    ctx.font='500 '+Math.round(descSize*sx)+'px Georgia, "Times New Roman", serif';
    descLines.forEach((line,i)=>ctx.fillText(line,x,(557+i*descSize*1.15)*sy));
    return canvas.toDataURL('image/webp',.95);
  }

  const finished=[];
  cards.forEach((card,i)=>{
    const original=card.querySelector('img');
    if(!original)return;
    const recipe=picked[i];
    const source=original.currentSrc || original.src;
    Promise.all([loadImage(source),loadImage(recipe.photo)])
      .then(([paper,dish])=>{
        const picture=paintNewspaper(paper,dish,recipe);
        if(!picture)return;
        card.href='#recipe='+encodeURIComponent(recipe.id);
        card.setAttribute('aria-label',recipe.title+'. Приготовить рецепт');
        original.alt=recipe.title+'. Приготовить рецепт';
        original.src=picture;
        finished.push(recipe.id);
        if(finished.length===3) {
          try{localStorage.setItem(storageKey,JSON.stringify(picked.map(r=>r.id)));}catch(_){}
        }
      }).catch(()=>{/* Original approved image remains intact on failure. */});
  });
})();
