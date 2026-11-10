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
      GROUPS.map(group=>'<a class="du-airfryer-approved-zone" href="'+categoryURL(group.name)+'" aria-label="'+esc(group.name)+', '+plural(group.count)+'"><span class="du-airfryer-zone-label">'+esc(group.name)+'</span></a>').join('')+
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
      window.scrollTo({top:0,left:0,behavior:'instant'});
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
