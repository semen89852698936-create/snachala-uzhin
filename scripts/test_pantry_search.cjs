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
  // Regression: common Russian pantry queries must never disappear because of grammatical forms.
  // Existing catalog does not contain a recipe combining either protein with potato;
  // show genuine partial matches, not invented complete matches.
  for(const protein of ['говядина','курица','индейка']){
    const request=parts(protein+', картофель');
    const ranked=rank(recipes,request,true);
    assert.ok(ranked.length>0,path+': no suggestions for '+protein+' + картофель');
    assert.ok(ranked.some(x=>x.available>0),path+': query terms not understood for '+protein);
    assert.ok(!recipes.some(x=>hasAll(x,request)),path+': catalog changed, update expected full-match coverage for '+protein);
    assert.ok(ranked.every(x=>x.available<request.length),path+': partial match must not be labeled a complete ingredient match');
  }
  const beefQuery=parts('говядина');
  const turkeyQuery=parts('индейка');
  assert.ok(recipes.some(x=>hasAll(x,beefQuery)),path+': beef grammatical form must be recognized');
  assert.ok(recipes.some(x=>hasAll(x,turkeyQuery)),path+': turkey grammatical form must be recognized');
  assert.ok(html.includes('Используется '),path+': partial matches require a clear explanation');
  assert.ok(html.includes('Рецептов со всеми введёнными продуктами пока нет.'),path+': catalog limitation must be disclosed');

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
  console.log('PASS',path,recipes.length,'recipes; all terms:',totalAll.length,'pantry ready:',matches.filter(x=>!x.missing.length).length,'near matches:',matches.filter(x=>x.missing.length).length);
}
