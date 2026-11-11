/* AIRFRYER_EDITORIAL_UX_20261110
   Independent airfryer catalogue, photo-category entry and Russian word-family search.
   No changes to the 100 validated recipes or their instructions. */
(function (root) {
  'use strict';
  const GROUPS = [
    {name:'Все блюда', count:100, photo:'/assets/airfryer/af-shrimp-garlic-lemon-2.webp'},
    {name:'Птица', count:20, photo:'/assets/airfryer/af-chicken-parmesan-crust-2.webp'},
    {name:'Мясо', count:16, photo:'/assets/airfryer/af-pork-tenderloin-mustard-thyme-2.webp'},
    {name:'Рыба и морепродукты', count:18, photo:'/assets/airfryer/af-salmon-miso-sesame-2.webp'},
    {name:'Овощи и гарниры', count:18, photo:'/assets/airfryer/af-asparagus-parmesan-2.webp'},
    {name:'Завтраки и выпечка', count:10, photo:'/assets/airfryer/af-apple-puff-pastry-roses-2.webp'},
    {name:'Закуски', count:8, photo:'/assets/airfryer/af-calamari-rings-2.webp'},
    {name:'Десерты', count:10, photo:'/assets/airfryer/af-berry-crumble-2.webp'}
  ];
  const WORD_FAMILIES = [
    [/^(говядин|говяж|говяд)/,'говядина'],
    [/^(свинин|свин)/,'свинина'],
    [/^(куриц|курин|цыплен)/,'курица'],
    [/^(индей|индюш)/,'индейка'],
    [/^(баранин|баран|ягнят|ягнен)/,'баранина'],
    [/^(картоф|картош)/,'картофель'],
    [/^(помидор|томат)/,'томат'],
    [/^(гриб|шампиньон|вешенк|лисичк|опят)/,'грибы'],
    [/^(рыбн|рыб)/,'рыба'],
    [/^(кабач|цуккин)/,'кабачок'],
    [/^(яйц|яиц|яичн)/,'яйцо'],
    [/^(яблок|яблоч)/,'яблоко'],
    [/^(клюкв)/,'клюква'],
    [/^(чеснок|чесноч)/,'чеснок'],
    [/^(сырн|сыр)/,'сыр'],
    [/^(морков|морковн)/,'морковь'],
    [/^(кревет)/,'креветки'],
    [/^(кальмар)/,'кальмар']
  ];
  const STOP = new Set(['и','с','со','в','во','на','из','к','по','для','а','или']);
  function canonical(word) {
    const normalized=String(word||'').normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
    for(const [pattern,key] of WORD_FAMILIES)if(pattern.test(normalized))return key;
    return normalized;
  }
  function words(value) {
    return (String(value||'').normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').match(/[а-яa-z0-9]+/g)||[])
      .filter(word=>!STOP.has(word)).map(canonical);
  }
  function matches(recipe,search) {
    const query=words(search);
    if(!query.length)return true;
    const haystack=words([
      recipe.title,recipe.description,recipe.airfryer?.sourceCategory,
      ...(recipe.ingredients||[]).map(ingredient=>ingredient.name)
    ].join(' '));
    return query.every(term=>haystack.some(word=>word===term||(term.length>=3&&word.startsWith(term))||(word.length>=4&&term.startsWith(word))));
  }
  function filterRecipes(recipes,category,search) {
    return recipes.filter(recipe=>(category==='Все блюда'||recipe.airfryer?.sourceCategory===category)&&matches(recipe,search));
  }
  const api={canonical,words,matches,filterRecipes,groups:GROUPS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.AirfryerUX=api;
  if(typeof document==='undefined')return;

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const plural=count=>count+' '+(count%100>=11&&count%100<=14?'рецептов':count%10===1?'рецепт':[2,3,4].includes(count%10)?'рецепта':'рецептов');
  const isStandalone=()=>/^\/airfryer(?:\/|\/index\.html)?$/.test(location.pathname);
  const categoryURL=name=>'/airfryer/?category='+encodeURIComponent(name);

  // Exact percentage rectangles already used by the approved collage's eight links.
  // A separate CSS image crop gives each photograph its own hover movement
  // without replacing or redrawing any part of the approved artwork.
  const APPROVED_TILES=[
    [6.2,11.6,41.4,33.4],[48.3,11.6,21.3,18.0],
    [70.3,11.6,20.7,18.0],[48.3,30.8,42.7,14.5],
    [6.2,46.2,25.2,18.5],[32.2,46.2,27.4,18.5],
    [60.4,46.2,30.6,18.5],[21.0,65.8,53.0,19.9]
  ];
  function photoCropStyle(index){
    const [left,top,width,height]=APPROVED_TILES[index];
    const css=number=>Number(number.toFixed(5))+'%';
    return '--du-crop-width:'+css(10000/width)+
      ';--du-crop-height:'+css(10000/height)+
      ';--du-crop-left:'+css(100*left/(100-width))+
      ';--du-crop-top:'+css(100*top/(100-height));
  }

  function showLanding() {
    const section=document.getElementById('airfryer');
    if(!section)return;
    const intro=section.querySelector('.du-airfryer-lead')?.textContent||'Птица, мясо, рыба, овощи, завтраки, закуски и десерты.';
    const note=section.querySelector('.du-airfryer-footnote')?.textContent||'Время и температура могут отличаться в зависимости от модели аэрогриля. Ориентируйтесь на инструкцию своего прибора.';
    section.innerHTML='<div class="container du-airfryer-landing">'+
      '<div class="du-section-top"><div class="du-eyebrow">100 РЕЦЕПТОВ · ГОТОВИМ ДЛЯ ДВОИХ</div>'+
      '<div class="du-section-heading"><h2 id="airfryerTitle">Аэрогриль. <em>Вкусно и по делу</em></h2><p class="du-airfryer-lead">'+esc(intro)+'</p></div></div>'+
      '<div class="du-airfryer-approved-map" aria-label="Категории блюд для аэрогриля на газетном листе">'+
      '<img class="du-airfryer-approved-image" src="/assets/airfryer/airfryer-newspaper-approved-20261110.webp" width="1448" height="1086" loading="lazy" decoding="async" alt="Категории аэрогриля на одном листе рваной газеты">'+
      '<nav class="du-airfryer-approved-zones" aria-label="Открыть категорию аэрогриля">'+
      GROUPS.map((group,index)=>'<a class="du-airfryer-approved-zone" href="'+categoryURL(group.name)+'" style="'+photoCropStyle(index)+'" aria-label="'+esc(group.name)+', '+plural(group.count)+'"><span class="du-airfryer-zone-label">'+esc(group.name)+'</span></a>').join('')+
      '</nav>'+
      '<div class="du-airfryer-approved-mobile">'+
      '<div class="du-airfryer-paper-header" aria-hidden="true">The Daily News <small>FOOD &amp; LIFESTYLE</small></div>'+
      '<div class="category-grid du-airfryer-category-grid" id="airfryerCategoryGrid">'+
      GROUPS.map(group=>'<a class="category-card" href="'+categoryURL(group.name)+'"'+
        ' style="--photo:url(\''+group.photo+'\');--fallback:url(\''+group.photo+'\')"'+
        ' aria-label="'+esc(group.name)+', '+plural(group.count)+'">'+
        '<img class="food-photo" loading="lazy" alt="" src="'+group.photo+'">'+
        '<span class="category-tag">'+plural(group.count)+'</span>'+
        '<span class="category-bottom"><strong>'+esc(group.name)+'</strong><i aria-hidden="true">↗</i></span></a>').join('')+
      '</div></div></div>'+
      '<p class="du-airfryer-footnote">'+esc(note)+'</p></div>';
  }

  function showCatalogue() {
    document.body.classList.add('du-airfryer-standalone');
    const section=document.getElementById('airfryer');
    if(!section)return;
    const layout=section.querySelector('.du-airfryer-catalog');
    if(layout){
      // The catalogue has exactly one return control, in the approved newsprint style.
      const existing=[...section.querySelectorAll('a,button')].filter(node=>
        node.classList.contains('du-airfryer-home-link') ||
        /^\s*(?:←\s*)?На главную\s*$/i.test(node.textContent||''));
      const link=existing.find(node=>node.classList.contains('du-airfryer-home-link')) ||
        existing[0] || document.createElement('a');
      for(const duplicate of existing)if(duplicate!==link)duplicate.remove();
      link.className='du-airfryer-home-link';
      link.href='/';
      link.textContent='← На главную';
      if(!link.isConnected)layout.prepend(link);
    }
    document.querySelectorAll('.header a[href^="#"],.du-quick-nav-mobile a[href^="#"]').forEach(link=>{
      link.href=link.getAttribute('href')==='#airfryer'?'/airfryer/':'/'+link.getAttribute('href');
    });
    const back=document.getElementById('backCatalog');
    if(back)back.addEventListener('click',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      location.hash='airfryer';
    },true);
    const search=document.getElementById('airfryerSearch');
    const grid=document.getElementById('airfryerGrid');
    const filters=document.getElementById('airfryerFilters');
    if(!search||!grid||!filters||!Array.isArray(root.AIRFRYER_RECIPES))return;
    // Replace the input to remove the old literal-substring search listener.
    const fresh=search.cloneNode(true);
    search.replaceWith(fresh);
    let selected=new URLSearchParams(location.search).get('category')||'Все блюда';
    if(!GROUPS.some(group=>group.name===selected))selected='Все блюда';
    let query='';
    const render=()=>{
      const found=filterRecipes(root.AIRFRYER_RECIPES,selected,query);
      const count=document.getElementById('airfryerCount');
      if(count)count.textContent=plural(found.length);
      grid.innerHTML=found.length?found.map(recipe=>{
        const a=recipe.airfryer||{};
        const photo=String(recipe.photo||'');
        return '<article class="du-airfryer-card" tabindex="0" role="button" data-airfryer-open="'+esc(recipe.id)+'" aria-label="Открыть рецепт '+esc(recipe.title)+'">'+
          '<div class="du-airfryer-card-photo"><img loading="lazy" src="'+esc(photo)+'" alt="'+esc(recipe.title)+'"></div>'+
          '<div class="du-airfryer-card-copy"><div class="du-airfryer-card-meta">'+esc(a.sourceCategory||'Аэрогриль')+'</div>'+
          '<h3>'+esc(recipe.title)+'</h3><p>'+esc(a.temperature)+' °C · '+esc(a.cookMin)+'–'+esc(a.cookMax)+' мин</p>'+
          '<div class="du-airfryer-card-bottom"><span>На '+esc(recipe.base)+' порции</span><span>Открыть ↗</span></div></div></article>';
      }).join(''):'<div class="du-airfryer-empty">Ничего не найдено. Попробуй другое название или ингредиент.</div>';
    };
    const drawFilters=()=>{
      filters.innerHTML=GROUPS.map(group=>'<button type="button" class="du-airfryer-filter" data-airfryer-filter="'+esc(group.name)+'" aria-pressed="'+String(selected===group.name)+'">'+esc(group.name)+'</button>').join('');
    };
    filters.addEventListener('click',event=>{
      const button=event.target.closest('[data-airfryer-filter]');
      if(!button)return;
      selected=button.dataset.airfryerFilter;
      const url=new URL(location.href);
      if(selected==='Все блюда')url.searchParams.delete('category');
      else url.searchParams.set('category',selected);
      history.replaceState(null,'',url.pathname+url.search+url.hash);
      drawFilters();render();
    });
    fresh.addEventListener('input',()=>{query=fresh.value;render();});
    grid.addEventListener('click',event=>{
      const card=event.target.closest('[data-airfryer-open]');
      if(card)location.hash='recipe='+card.dataset.airfryerOpen;
    });
    grid.addEventListener('keydown',event=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      const card=event.target.closest('[data-airfryer-open]');
      if(card){event.preventDefault();location.hash='recipe='+card.dataset.airfryerOpen;}
    });
    // Clicking a card retains its selected category when returning from the recipe.
    drawFilters();render();
  }
  
  function initSitePolish() {
    const heading=document.querySelector('#airfryerTitle em');
    if(heading)heading.textContent=heading.textContent.replace(/\.\s*$/,'');
    const bonus=document.querySelector('.du-bonus .bonus-text > p');
    if(bonus)bonus.textContent=bonus.textContent.replace(/^Особенный рецепт(?=\s*№)/,'Бонусный рецепт');
    const dinner=document.querySelector('.du-photo-break .du-photo-overlay > p');
    if(dinner)dinner.textContent='Иногда этого вполне достаточно.';
    if(!document.getElementById('top')||document.querySelector('.du-back-to-top'))return;
    const button=document.createElement('button');
    button.type='button';
    button.className='du-back-to-top';
    button.setAttribute('aria-label','Вернуться к шапке страницы');
    button.innerHTML='<span class="du-back-to-top-arrow" aria-hidden="true">↑</span><span>Наверх</span>';
    document.body.appendChild(button);
    const update=()=>{
      const recipe=document.getElementById('recipeView');
      const cooking=document.getElementById('cookOverlay');
      const modalOpen=(recipe&&!recipe.hidden)||(cooking&&!cooking.hidden&&getComputedStyle(cooking).display!=='none');
      button.classList.toggle('is-visible',window.scrollY>440&&!modalOpen);
    };
    button.addEventListener('click',()=>{
      // A sticky header is already in view: scrollIntoView(header) can do nothing.
      // Go to the absolute beginning of the document, without animated intermediate stops.
      const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({top:0,left:0,behavior:reduceMotion?'instant':'smooth'});
    });
    window.addEventListener('scroll',update,{passive:true});
    window.addEventListener('hashchange',update);
    window.addEventListener('resize',update,{passive:true});
    update();
  }
  const start=()=>{isStandalone()?showCatalogue():showLanding();initSitePolish();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})(typeof window!=='undefined'?window:globalThis);


/* AIRFRYER_COMPLETION_RUSSIAN_AND_STEPWISE_LABEL_20261111
 * Scope: correct only airfryer final screens, and double only the text of
 * "Готовить пошагово" buttons. No changes to recipes, ingredients or steps.
 */
(function () {
  'use strict';
  const feminine = new Set([1,2,13,14,15,26,32,39,40,41,49,56,58,61,62,67,68,69,70,72,79,80,88]);
  const neuter = new Set([11,43,100]);
  const masculine = new Set([17,21,37,38,42,48,59,60,64,76,83,87,95,98]);
  function readinessForAirfryer(name) {
    const recipes = window.AIRFRYER_RECIPES;
    if (!Array.isArray(recipes)) return null;
    const index = recipes.findIndex(recipe => recipe && recipe.title === name);
    if (index < 0) return null;
    const number = index + 1;
    if (feminine.has(number)) return 'готова';
    if (neuter.has(number)) return 'готово';
    if (masculine.has(number)) return 'готов';
    return 'готовы';
  }
  function correctFinish() {
    const box = document.getElementById('cookContent');
    if (!box) return;
    const heading = box.querySelector('.done-title');
    const description = box.querySelector('.done-desc');
    if (!heading || !description) return;
    const first = description.firstChild;
    const match = first && first.nodeType === Node.TEXT_NODE
      ? String(first.nodeValue || '').match(/^(.+?)\s+готово\.(?=\s|$)/u) : null;
    if (!match) return; // Do not touch ordinary recipes or already-correct text.
    const ending = readinessForAirfryer(match[1]);
    if (!ending) return;
    heading.textContent = 'Приятного аппетита!';
    first.nodeValue = match[1] + ' ' + ending + '.' + first.nodeValue.slice(match[0].length);
  }
  function enlargeStepwiseButton(button) {
    if (!button || button.nodeType !== Node.ELEMENT_NODE || button.dataset.duStepwiseDoubled === '1') return;
    const text = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/Готовить\s+пошагово/iu.test(text)) return;
    // Respect explicitly styled inner lettering when present, and measure
    // its actual computed baseline instead of assuming a global font size.
    const candidates = [...button.querySelectorAll('span,strong,b,em')];
    const label = candidates.find(node => /Готовить\s+пошагово/iu.test(node.textContent || '') &&
      ![...node.children].some(child => /Готовить\s+пошагово/iu.test(child.textContent || ''))) || button;
    const original = parseFloat(getComputedStyle(label).fontSize);
    if (!Number.isFinite(original) || original <= 0) return;
    label.style.setProperty('font-size', String(Math.round(original * 20) / 10) + 'px', 'important');
    label.style.setProperty('line-height', '1.12', 'important');
    button.style.setProperty('white-space', 'normal', 'important');
    button.style.setProperty('height', 'auto', 'important');
    button.style.setProperty('min-height', '52px', 'important');
    button.style.setProperty('max-width', '100%', 'important');
    button.style.setProperty('box-sizing', 'border-box', 'important');
    button.dataset.duStepwiseDoubled = '1';
  }
  function scan(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.matches('button,a,[role="button"]')) enlargeStepwiseButton(root);
    root.querySelectorAll('button,a,[role="button"]').forEach(enlargeStepwiseButton);
  }
  function init() {
    scan(document.body);
    correctFinish();
    const observer = new MutationObserver(records => {
      let mayContainFinish = false;
      for (const record of records) {
        if (record.target && record.target.nodeType === Node.ELEMENT_NODE &&
            (record.target.id === 'cookContent' || record.target.closest('#cookContent'))) {
          mayContainFinish = true;
        }
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            scan(node);
            if (node.id === 'cookContent' || node.querySelector('.done-desc')) mayContainFinish = true;
          } else if (node.nodeType === Node.TEXT_NODE &&
                     node.parentElement && node.parentElement.closest('button,a,[role="button"]')) {
            enlargeStepwiseButton(node.parentElement.closest('button,a,[role="button"]'));
          }
        }
      }
      if (mayContainFinish) correctFinish();
    });
    observer.observe(document.body, {childList:true,subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
