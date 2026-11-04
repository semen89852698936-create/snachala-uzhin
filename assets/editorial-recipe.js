/* Editorial recipe and cooking mode. Uses the already published hero photo for every step.
   No new/generated images. Load AFTER the existing recipe code and stepVisualHtml. */
(function(){
  'use strict';
  if(typeof window.renderRecipe!=='function'||typeof window.renderCook!=='function')return;

  const nativeRecipe=window.renderRecipe;
  const nativeCook=window.renderCook;
  const el=(tag,className,text)=>{
    const n=document.createElement(tag);
    if(className)n.className=className;
    if(text!==undefined)n.textContent=text;
    return n;
  };
  const selectedRecipe=()=>typeof state==='object' ? RECIPES.find(r=>r.id===state.recipe) : null;
  const humanTime=(min)=>{
    if(!Number.isFinite(min)||min<=0)return '';
    const h=Math.floor(min/60),m=min%60;
    return h ? h+' ч'+(m?' '+m+' мин':'') : min+' мин';
  };
  const focusStep=()=>{
    const target=document.querySelector('#cookContent .er-cook-step h2');
    if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
  };

  function adaptOverview(){
    const detail=document.getElementById('recipeDetail');
    if(!detail)return;
    detail.classList.add('er-overview');
    const list=detail.querySelector('.step-list.du-filmstrip');
    if(!list)return;
    const count=list.children.length;
    [...list.children].forEach((li,i)=>{
      const existing=li.querySelector('.du-film-visual');
      const ordinal=el('span','er-overview-number',String(i+1).padStart(2,'0'));
      ordinal.setAttribute('aria-hidden','true');
      if(existing)existing.replaceWith(ordinal);
      const copy=li.querySelector('.du-film-copy');
      if(copy){
        const cardTitle=copy.querySelector('strong');
        if(cardTitle)cardTitle.classList.add('er-overview-title');
      }
    });
    const hint=detail.querySelector('.du-film-hint');
    if(hint)hint.textContent=count+' шагов. Все инструкции и таймеры доступны в режиме готовки.';
  }
  window.renderRecipe=function(id){
    nativeRecipe(id);
    adaptOverview();
  };

  function drawCooking(){
    const box=document.getElementById('cookContent');
    const overlay=document.getElementById('cookOverlay');
    const recipe=selectedRecipe();
    if(!box||!overlay||!recipe)return;

    overlay.classList.add('er-cook-mode');
    const top=overlay.querySelector('.cook-top');
    const label=top&&top.querySelector('.cook-label');
    if(label)label.textContent=recipe.title+' / РЕЖИМ ГОТОВКИ';

    if(top&&!top.querySelector('.er-return')){
      const back=el('button','er-return','← К рецепту');
      back.type='button';
      back.addEventListener('click',()=>window.closeCook());
      top.prepend(back);
    }

    const done=state.cookIndex>=recipe.steps.length;
    box.classList.toggle('er-cook-is-done',done);
    if(done){
      if(!box.querySelector('.er-finish-note')){
        box.prepend(el('p','er-finish-note','ГОТОВО / '+recipe.steps.length+' ШАГОВ'));
      }
      return;
    }

    const idx=state.cookIndex;
    const nativeNodes=[...box.children];
    const nativeStep=nativeNodes.find(n=>n.classList.contains('cook-step'));
    const nativeTimer=nativeNodes.find(n=>n.classList.contains('timer-panel'));
    const nativeNav=nativeNodes.find(n=>n.classList.contains('cook-nav'));
    if(!nativeStep||!nativeNav)return;

    const progress=el('div','er-cook-progress');
    progress.setAttribute('aria-label','Этапы приготовления');
    const progressInfo=el('div','er-cook-progress-head');
    progressInfo.append(
      el('span','er-progress-eyebrow','ПРИГОТОВЛЕНИЕ / '+recipe.steps.length+' '+(recipe.steps.length===1?'ШАГ':'ШАГОВ')),
      el('span','er-total-time',recipe.minutes?('Общее время: '+humanTime(recipe.minutes)):'')
    );
    const track=el('ol','er-progress-steps');
    recipe.steps.forEach((step,i)=>{
      const li=el('li','er-progress-item');
      const control=el('button','er-progress-button'+(i===idx?' is-active':'')+(i<idx?' is-done':''),String(i+1));
      control.type='button';
      control.setAttribute('aria-label','Шаг '+(i+1)+': '+step.title);
      if(i===idx)control.setAttribute('aria-current','step');
      control.addEventListener('click',()=>{stepTo(i);focusStep();});
      li.append(control,el('span','er-progress-title',step.title));
      track.append(li);
    });
    progress.append(progressInfo,track);

    const grid=el('div','er-cook-grid');

    const figure=el('figure','er-cook-photo');
    const image=el('img');
    image.src=photo(recipe.photo);
    image.alt='Готовое блюдо: '+recipe.title;
    image.loading='eager';
    image.decoding='async';
    figure.append(image,el('figcaption','er-photo-caption','ФОТО ГОТОВОГО БЛЮДА · '+recipe.title));

    const article=el('article','er-cook-step');
    article.setAttribute('aria-label','Шаг '+(idx+1));
    const meta=el('div','er-cook-step-meta');
    meta.append(el('span','er-step-index','ШАГ '+(idx+1)+' ИЗ '+recipe.steps.length));
    if(recipe.steps[idx].timer){
      meta.append(el('span','er-step-timer','◷ '+humanTime(recipe.steps[idx].timer)));
    }
    article.append(meta,nativeStep);

    if(nativeTimer){
      article.append(nativeTimer);
    }
    if(recipe.tip){
      const tip=el('aside','er-cook-tip');
      tip.append(el('strong','','✳ Маленький секрет шефа'),el('p','',recipe.tip));
      article.append(tip);
    }
    if(nativeNav){
      const next=nativeNav.querySelector('#nextStep');
      if(next)next.textContent=(idx===recipe.steps.length-1?'Завершить ✓':'Далее →');
      article.append(nativeNav);
    }
    grid.append(figure,article);

    const footer=el('div','er-cook-footer');
    const facts=el('div','er-cook-facts');
    facts.append(
      el('span','','♧ '+recipe.steps.length+' '+(recipe.steps.length===1?'шаг':'шагов')),
      el('span','','◷ '+humanTime(recipe.minutes)),
      el('span','',''+(recipe.level||'Готовим вместе'))
    );
    footer.append(facts);
    const tools=el('div','er-cook-tools');
    const ingredients=el('details','er-cook-ingredients');
    const summary=el('summary','', '☷ Ингредиенты');
    const shopping=el('ul','');
    const portions=servings(recipe);
    recipe.ingredients.forEach(i=>{
      shopping.append(el('li','',i.name+' · '+quantity(i,recipe,portions)));
    });
    ingredients.append(summary,shopping);
    const full=el('button','er-open-recipe','↗ Открыть весь рецепт');
    full.type='button';
    full.addEventListener('click',()=>window.closeCook());
    tools.append(ingredients,full);
    footer.append(tools);

    box.replaceChildren(progress,grid,footer);
  }
  window.renderCook=function(){
    nativeCook();
    drawCooking();
  };
  // The original app routes and buttons stay intact. Only the visual hierarchy changes.
  if(document.getElementById('recipeDetail')?.querySelector('.du-film-card'))adaptOverview();
})();
