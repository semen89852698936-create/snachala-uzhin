/* MY_RECIPES_EDITORIAL_20261110
   Display the approved empty and saved layouts using real favorites only.
   Existing recipe routes, favorites storage and notes storage are reused. */
(function(){
  'use strict';
  const section=document.getElementById('my-recipes');
  const grid=document.getElementById('myRecipesGrid');
  const collectionFilters=document.getElementById('myRecipesCategories');
  const queryInput=document.getElementById('myRecipesSearch');
  const sortControl=document.getElementById('myRecipesSort');
  const allControls=document.getElementById('myRecipesTools');
  const emptyScene=document.getElementById('myRecipesEmpty');
  if(!section||!grid||!collectionFilters||!queryInput||!sortControl||!emptyScene)return;
  const view={query:'',category:'all',sort:'recent'};
  const orderedLabels=['meat','poultry','fish','pasta','vegetables','dessert'];
  const categoryLabels={meat:'Мясо',poultry:'Птица',fish:'Рыба',pasta:'Паста',vegetables:'Овощи',dessert:'Десерты'};
  const clean=s=>String(s??'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').trim();
  const recipesCount=n=>n+' '+(n%10===1&&n%100!==11?'рецепт':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'рецепта':'рецептов');
  const allSaved=()=>[...new Set(Array.isArray(state.favorites)?state.favorites:[])]
    .map(byId).filter(Boolean).reverse();
  function renderEditorialRecipes(){
    const saved=allSaved();
    const hasSaved=saved.length>0;
    section.classList.toggle('du-my-has-saved',hasSaved);
    section.classList.toggle('du-my-is-empty',!hasSaved);
    document.getElementById('myRecipesCount').textContent=recipesCount(saved.length);
    emptyScene.hidden=hasSaved;
    allControls.hidden=!hasSaved;
    if(!hasSaved){grid.innerHTML='';view.category='all';return;}
    const activeCategories=new Set(saved.map(r=>r.category));
    if(view.category!=='all'&&!activeCategories.has(view.category))view.category='all';
    const extra=[...activeCategories].filter(id=>!orderedLabels.includes(id));
    const available=['all',...orderedLabels,...extra];
    collectionFilters.innerHTML=available.map(id=>{
      const name=id==='all'?'Все рецепты':categoryLabels[id]||catName(id);
      return '<button type="button" class="du-my-filter-chip" data-my-category="'+safe(id)+'" aria-pressed="'+String(id===view.category)+'">'+safe(name)+'</button>';
    }).join('');
    let matched=saved.filter(r=>(view.category==='all'||r.category===view.category)&&(!view.query||clean(r.title+' '+r.cuisine+' '+catName(r.category)).includes(clean(view.query))));
    if(view.sort==='title')matched.sort((a,b)=>a.title.localeCompare(b.title,'ru'));
    if(view.sort==='minutes')matched.sort((a,b)=>a.minutes-b.minutes);
    grid.innerHTML=matched.map(r=>{
      const note=(state.recipeNotes&&state.recipeNotes[r.id])||'';
      const portions=state.servings&&state.servings[r.id]||r.base||2;
      const notePreview=note?note:'Добавить свою заметку';
      return '<article class="recipe-card du-personal-card" data-my-id="'+safe(r.id)+'">'+
        '<div class="du-my-card-photo">'+
          '<button type="button" class="du-my-photo-open" data-my-open="'+safe(r.id)+'" aria-label="Открыть рецепт '+safe(r.title)+'">'+
            '<img loading="lazy" alt="'+safe(r.title)+'" src="'+safe(photo(r.photo))+'" onerror="this.onerror=null;this.src=\''+safe(asset(r.category))+'\'">'+
          '</button>'+
          '<button type="button" class="du-my-heart-button" data-my-remove="'+safe(r.id)+'" aria-label="Убрать '+safe(r.title)+' из сохранённых рецептов" title="Убрать из сохранённых">♥</button>'+
        '</div>'+
        '<div class="du-my-card-body">'+
          '<button type="button" class="du-my-card-title" data-my-open="'+safe(r.id)+'">'+safe(r.title)+'</button>'+
          '<div class="du-my-card-meta"><span>◷ '+safe(r.minutes)+' мин</span><span>♧ '+safe(portions)+' порции</span></div>'+
          '<button type="button" class="du-my-card-open" data-my-open="'+safe(r.id)+'">Открыть рецепт ↗</button>'+
          '<button type="button" class="du-my-note-preview" data-my-edit="'+safe(r.id)+'" aria-label="Редактировать личную заметку к рецепту '+safe(r.title)+'">'+
            '<span class="du-my-note-label">Моя заметка</span><span class="du-my-note-text">'+safe(notePreview)+'</span><span class="du-my-note-pencil" aria-hidden="true">✎</span>'+
          '</button>'+
          '<div class="du-my-note-editor" hidden>'+
            '<label class="du-my-note-editor-label" for="my-note-'+safe(r.id)+'">Моя заметка</label>'+
            '<textarea id="my-note-'+safe(r.id)+'" data-my-note="'+safe(r.id)+'" maxlength="600" rows="3" placeholder="Например, добавить побольше базилика...">'+safe(note)+'</textarea>'+
            '<div class="du-my-note-actions">'+
              '<button type="button" data-my-save="'+safe(r.id)+'">Сохранить заметку</button>'+
              '<button type="button" data-my-cancel="'+safe(r.id)+'">Отмена</button>'+
            '</div>'+
          '</div>'+
        '</div></article>';
    }).join('');
    if(!matched.length)grid.innerHTML='<div class="du-my-no-results">По этому запросу ничего не нашлось. Попробуйте другой фильтр.</div>';
  }
  window.renderMyRecipes=renderEditorialRecipes;
  collectionFilters.addEventListener('click',event=>{
    const chip=event.target.closest('[data-my-category]');if(!chip)return;
    view.category=chip.dataset.myCategory;renderEditorialRecipes();
  });
  queryInput.addEventListener('input',()=>{view.query=queryInput.value;renderEditorialRecipes();});
  sortControl.addEventListener('change',()=>{view.sort=sortControl.value;renderEditorialRecipes();});
  grid.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    const card=button.closest('.du-personal-card');
    if(button.dataset.myOpen){location.hash='recipe='+button.dataset.myOpen;return;}
    if(button.dataset.myRemove){toggleFav(button.dataset.myRemove);return;}
    if(!card)return;
    if(button.dataset.myEdit){
      const editor=card.querySelector('.du-my-note-editor');
      const preview=card.querySelector('.du-my-note-preview');
      preview.hidden=true;editor.hidden=false;
      const input=editor.querySelector('textarea');input.focus();
      input.setSelectionRange(input.value.length,input.value.length);
      return;
    }
    if(button.dataset.myCancel){
      card.querySelector('.du-my-note-editor').hidden=true;
      card.querySelector('.du-my-note-preview').hidden=false;
      return;
    }
    if(button.dataset.mySave){
      const input=card.querySelector('textarea[data-my-note]');
      if(!input)return;
      if(!state.recipeNotes||typeof state.recipeNotes!=='object')state.recipeNotes={};
      state.recipeNotes[button.dataset.mySave]=input.value.trim().slice(0,600);
      put('recipeNotes',state.recipeNotes);
      toast('Заметка сохранена');
      renderEditorialRecipes();
    }
  });
  renderEditorialRecipes();
})();
