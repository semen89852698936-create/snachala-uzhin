'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
for(const path of ['index.html','full-catalog/index.html']){
  const html=fs.readFileSync(path,'utf8');
  const startData=html.indexOf('id="recipeData"');
  assert.ok(startData>=0,path+': embedded recipe data missing');
  const start=html.indexOf('>',startData)+1,end=html.indexOf('</script>',start);
  const recipes=JSON.parse(html.slice(start,end));
  assert.equal(recipes.length,1001,path+': recipe count');
  assert.equal(new Set(recipes.map(r=>r.id)).size,1001,path+': duplicate ids');

  const sourceStart=html.indexOf('/* INGREDIENT_SEARCH_V1_START');
  const endMarker='/* PANTRY_SEARCH_V2_END */';
  const sourceEnd=html.indexOf(endMarker,sourceStart);
  assert.ok(sourceStart>0 && sourceEnd>sourceStart,path+': matcher source missing');
  const engine=html.slice(sourceStart,sourceEnd+endMarker.length);
  const context=vm.createContext({norm:s=>String(s??'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').normalize('NFKC')});
  new vm.Script(engine,{filename:path}).runInContext(context);
  const parts=vm.runInContext('ingredientSearchParts',context);
  const rank=vm.runInContext('pantryRankedCandidates',context);
  const hasAll=vm.runInContext('recipeMatchesIngredientParts',context);
  const missing=vm.runInContext('pantryMissingIngredients',context);
  const allParts=parts('курица, сливки, грибы');
  const totalAll=recipes.filter(r=>hasAll(r,allParts));
  assert.equal(totalAll.length,6,path+': baseline AND search keeps six matching ingredient sets');

  const matches=rank(recipes,allParts,true);
  assert.ok(matches.length>=8,path+': too few pantry candidates');
  assert.ok(matches.every(x=>x.missing.length<=2 && x.available>0),path+': wrong candidate conditions');
  assert.ok(matches.every((x,i)=>!i||matches[i-1].missing.length<=x.missing.length),path+': not sorted by missing count');
  assert.ok(matches.some(x=>x.recipe.title.includes('Куриное рагу')&&x.missing.length===1&&x.missing[0].name==='Бульон овощной'),path+': missing broth detection');
  assert.ok(matches.some(x=>x.recipe.title.includes('Нежные фрикадельки')&&x.missing.length===1&&x.missing[0].name==='Сухари панировочные'),path+': missing breadcrumbs detection');
  assert.ok(matches.some(x=>x.missing.length===0),path+': complete pantry dishes missing');
  const withoutBasics=rank(recipes,allParts,false);
  assert.ok(withoutBasics.filter(x=>x.missing.length===0).length<=matches.filter(x=>x.missing.length===0).length,path+': basics toggle ineffective');
  assert.equal(missing({ingredients:[{name:'Перец зелёный горошком',unit:'г',amount:10}]},[],true).length,1,path+': specialty pepper must not be assumed stocked');
  assert.equal(rank(recipes,parts(''),true).length,0,path+': no query should not show false ready dishes');
  assert.equal(rank(recipes,parts('несуществующийпродукт'),true).length,0,path+': unrelated query returns items');
  assert.equal(rank(recipes,parts('курица, сливки, грибы'),true).length,matches.length,path+': stable repeated ranking');

  const appStart=html.lastIndexOf('<script>',html.indexOf('function renderRecipes()'))+8;
  const appEnd=html.indexOf('</script>',appStart);
  new vm.Script(html.slice(appStart,appEnd),{filename:path});
  for(const required of ['id="pantryMode"','id="pantryBasics"','id="pantrySummary"','data-shop-missing','state.shoppingExtras','data-remove-extra','state.shoppingExtras={};state.shopChecked={}']){
    assert.ok(html.includes(required),path+': missing '+required);
  }
  // The shopping aggregator must include ONLY requested missing groceries unless the
  // entire recipe is explicitly in the shopping list.
  const aggStart=html.indexOf('function aggregates(){');
  const aggEnd=html.indexOf('function renderShopping()',aggStart);
  const aggSource=html.slice(aggStart,aggEnd);
  const ragout=recipes.find(r=>r.title==='Куриное рагу с шампиньонами и сливками');
  assert.ok(ragout,path+': smoke recipe missing');
  const keyFor=i=>context.norm(i.name)+'|'+i.unit;
  const missingKey=keyFor(ragout.ingredients.find(i=>i.name==='Бульон овощной'));
  const shopState={shopping:{},shoppingExtras:{[ragout.id]:[missingKey]},servings:{}};
  const shopEnv=vm.createContext({
    state:shopState,
    byId:id=>recipes.find(r=>r.id===id),
    shoppingKey:keyFor,
    norm:context.norm,
    servings:r=>r.base
  });
  new vm.Script(aggSource,{filename:path}).runInContext(shopEnv);
  const onlyMissing=vm.runInContext('aggregates()',shopEnv);
  assert.equal(onlyMissing.length,1,path+': missing-only shopping must not include full recipe');
  assert.equal(onlyMissing[0].name,'Бульон овощной',path+': missing-only product');
  shopState.shopping[ragout.id]=ragout.base;
  const full=vm.runInContext('aggregates()',shopEnv);
  assert.equal(full.length,ragout.ingredients.length,path+': full recipe must not double-count missing-only item');
  // Meat + potato queries must recognize grammatical forms of proteins, and
  // provide honest separate-dish suggestions when no combined recipe exists.
  for(const [protein,potato] of [['говядина','картофель'],['курица','картофель'],['индейка','картофель']]){
    const input=parts(protein+', '+potato);
    const proteinRecipes=recipes.filter(r=>hasAll(r,[protein]));
    const potatoRecipes=recipes.filter(r=>hasAll(r,[potato]));
    assert.ok(proteinRecipes.length>=20,path+': missing protein alias '+protein);
    assert.ok(potatoRecipes.length>=20,path+': missing potato alias');
    const candidates=rank(recipes,input,true);
    assert.ok(candidates.some(e=>hasAll(e.recipe,[protein])),path+': no protein suggestions '+protein);
    assert.ok(candidates.some(e=>hasAll(e.recipe,[potato])),path+': no potato suggestions '+protein);
    assert.ok(html.includes('Блюда с продуктом «'),path+': pairing UI missing');
    assert.ok(html.includes('В коллекции пока нет одного рецепта'),path+': honest pairing label missing');
    assert.ok(html.includes("state.category='all';state.cuisine='all'"),path+': existing search filters not reset');
  }
  console.log('PASS',path,recipes.length,'recipes; all terms:',totalAll.length,'pantry ready:',matches.filter(x=>!x.missing.length).length,'near matches:',matches.filter(x=>x.missing.length).length);
}
