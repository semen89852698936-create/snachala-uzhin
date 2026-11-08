'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

let referenceCatalog=null;
for(const path of ['index.html','full-catalog/index.html']){
 const html=fs.readFileSync(path,'utf8');
 const data=html.match(/<script id="recipeData" type="application\/json">([\s\S]*?)<\/script>/);
 assert.ok(data,path+': recipe data');
 const recipes=JSON.parse(data[1]);
 assert.equal(recipes.length,1001,path+': 1001 recipes unchanged');
 const ids=recipes.map(r=>String(r.id));
 assert.equal(new Set(ids).size,1001,path+': recipe IDs must be unique');
 // The two public entry points must never silently ship different recipes or quantities.
 // Compare full embedded objects, not just IDs, to catch changes to ingredients and steps.
 if(referenceCatalog===null)referenceCatalog=recipes;
 else assert.deepEqual(recipes,referenceCatalog,path+': catalog content diverged from index.html');
 const a=html.indexOf('/* INGREDIENT_SEARCH_V1_START');
 const end='/* PANTRY_QUANTITY_V3_END */',b=html.indexOf(end,a);
 assert.ok(a>0&&b>a,path+': V3 engine embedded');
 const context=vm.createContext({norm:x=>String(x??'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').normalize('NFKC')});
 new vm.Script(html.slice(a,b+end.length),{filename:path}).runInContext(context);
 const parse=vm.runInContext('pantryParseStock',context);
 const missing=vm.runInContext('pantryQuantityMissing',context);
 const legacyParts=vm.runInContext('ingredientSearchParts',context);
 const legacyMatch=vm.runInContext('recipeMatchesIngredientParts',context);
 const rank=vm.runInContext('pantryQuantityRankedCandidates',context);
 const synthetic={id:'fixture',title:'Контрольное блюдо',minutes:25,base:2,ingredients:[
  {name:'Курица',amount:300,unit:'г'},
  {name:'Сливки',amount:300,unit:'мл'},
  {name:'Чеснок',amount:2,unit:'зубчика'},
  {name:'Лук',amount:1,unit:'шт.'}
 ]};
 const stock=parse('100 г курицы, 200 мл сливок, чеснок, лук');
 let need=missing(synthetic,stock,false,2);
 assert.equal(need.length,2,path+': partial shortage count');
 assert.equal(need[0].name,'Курица');
 assert.equal(need[0].amount,200,path+': 300g needed minus 100g stocked');
 assert.equal(need[1].amount,100,path+': 300ml needed minus 200ml stocked');
 assert.equal(need[0].partial,true);
 assert.equal(missing(synthetic,parse('0,1 кг курицы, 0,2 л сливок, чеснок, лук'),false,2)[0].amount,200,path+': kg to g');
 assert.equal(missing(synthetic,parse('0,1 кг курицы, 0,2 л сливок, чеснок, лук'),false,2)[1].amount,100,path+': liter to ml');
 assert.equal(missing(synthetic,parse('курица 100 г, сливки 300 мл, чеснок, лук'),false,2)[0].amount,200,path+': trailing quantities');
 assert.equal(missing(synthetic,parse('100 г курицы, 150 г курицы, сливки, чеснок, лук'),false,2)[0].amount,50,path+': multiple stock entries add');
 assert.equal(missing(synthetic,stock,false,4)[0].amount,500,path+': selected servings 4 instead of 2');
 assert.equal(missing(synthetic,stock,false,4)[1].amount,400,path+': cream with 4 portions');
 // Extra boundary cases: decimal quantities and mixed metric units must remain exact.
 assert.equal(missing(synthetic,parse('0,25 кг курицы, 0,3 л сливок, чеснок, лук'),false,2)[0].amount,50,path+': fractional kilograms leave 50g');
 assert.equal(missing(synthetic,parse('250 г курицы, 0,25 л сливок, чеснок, лук'),false,2)[1].amount,50,path+': fractional liters leave 50ml');
 assert.equal(missing(synthetic,parse('100 г курицы, 0,1 кг курицы, 100 г курицы, 300 мл сливок, чеснок, лук'),false,2).length,0,path+': repeated entries in mixed units sum to exact stock');
 const mismatch=missing(synthetic,parse('1 шт. курицы, сливки, чеснок, лук'),false,2);
 assert.equal(mismatch.length,1);
 assert.equal(mismatch[0].uncertain,true,path+': cannot infer grams from 1 chicken');
 assert.equal(missing(synthetic,parse('курица, сливки, чеснок, лук'),false,2).length,0,path+': unspecified stock means enough');
 // Boundary regression: exact stock or surplus must not create phantom groceries.
 assert.equal(missing(synthetic,parse('300 г курицы, 300 мл сливок, чеснок, лук'),false,2).length,0,path+': exact quantities have no deficit');
 assert.equal(missing(synthetic,parse('1 кг курицы, 1 л сливок, чеснок, лук'),false,2).length,0,path+': surplus after unit conversion has no deficit');
 assert.equal(missing(synthetic,parse('0,3 кг курицы, 0,3 л сливок, чеснок, лук'),false,2).length,0,path+': equivalent metric units match exactly');
 assert.equal(rank([synthetic],stock,false,r=>2)[0].missing.length,2,path+': partial deficits ranked as missing');

 const eggRecipe={id:'eggs-test',base:2,ingredients:[{name:'Яйцо',amount:4,unit:'шт.'}]};
 const onions={id:'onion-test',base:2,ingredients:[{name:'Лук репчатый',amount:4,unit:'шт.'}]};
 const greenOnions={id:'green-onion-test',base:2,ingredients:[{name:'Лук зелёный',amount:30,unit:'г'}]};
 // Natural piece counts are as useful as grams on a Russian shopping list.
 assert.equal(parse('2 яйца')[0].amount,2,path+': two eggs in plain Russian');
 assert.equal(parse('1 яйцо')[0].dimension,'pieces',path+': singular egg count');
 assert.equal(parse('5 яиц')[0].amount,5,path+': genitive egg count');
 assert.equal(parse('3 луковицы')[0].name,'лук репчатый',path+': onion noun maps to bulb onion');
 assert.equal(missing(eggRecipe,parse('2 яйца'),false,2)[0].amount,2,path+': two more eggs are needed');
 assert.equal(missing(eggRecipe,parse('1 яйцо, 2 яйца'),false,2)[0].amount,1,path+': natural counts sum');
 assert.equal(missing(eggRecipe,parse('4 яйца'),false,2).length,0,path+': enough eggs');
 assert.equal(missing(eggRecipe,parse('2 яйца'),false,4)[0].amount,6,path+': egg deficit scales with portions');
 assert.equal(missing(onions,parse('3 луковицы'),false,2)[0].amount,1,path+': 4 onions minus 3');
 assert.equal(missing(greenOnions,parse('3 луковицы'),false,2)[0].amount,30,path+': bulb onion must never stand for green onion');
 assert.equal(rank([eggRecipe],parse('2 яйца'),false,r=>2)[0].missing[0].amount,2,path+': natural count enters ranked search');
 // The original data contains hundreds of recipes with eggs measured in pieces.
 const ramen=recipes.find(r=>r.id==='ramen');
 assert.ok(ramen,path+': ramen fixture missing');
 assert.equal(missing(ramen,parse('1 яйцо'),false,2).find(x=>x.name==='Яйцо').amount,1,path+': real ramen needs one more egg');

 const salt={base:2,ingredients:[{name:'Соль',amount:4,unit:'г'}]};
 assert.equal(missing(salt,parse('курица'),true,2).length,0,path+': basics assumed available');
 assert.equal(missing(salt,parse('курица'),false,2).length,1,path+': basics switch off');
 const old=recipes.filter(r=>legacyMatch(r,legacyParts('курица, сливки, грибы')));
 assert.equal(old.length,6,path+': original AND search stays compatible');

 const ui=html.slice(html.lastIndexOf('<script>',html.indexOf('function renderRecipes()'))+8,html.indexOf('</script>',html.indexOf('function renderRecipes()')));
 new vm.Script(ui,{filename:path+':app'}); // compile without DOM
 assert.ok(ui.includes('pantryQuantityRankedCandidates(filtered,stock,state.pantryBasics,servings)'),path+': quantity mode connected');
 assert.ok(ui.includes('item.amount!==null'),path+': numeric search auto-activates pantry mode');
 assert.ok(ui.includes('payable.map(item=>({key:shoppingKey(item),query:state.search,basics:state.pantryBasics}))'),path+': precise deficit saved');

 const a2=html.indexOf('function aggregates(){'),b2=html.indexOf('function renderShopping()',a2);
 const saved={shopping:{},shoppingExtras:{fixture:[{key:'курица|г',query:'100 г курицы, сливки, чеснок, лук',basics:false}]},servings:{fixture:2}};
 const cart=vm.createContext({state:saved,byId:id=>id==='fixture'?synthetic:null,shoppingKey:i=>String(i.name).toLocaleLowerCase('ru-RU')+'|'+i.unit,norm:context.norm,servings:r=>saved.servings[r.id]||r.base,pantryParseStock:parse,pantryQuantityMissing:missing});
 new vm.Script(html.slice(a2,b2),{filename:path+':shopping'}).runInContext(cart);
 const aggregate=vm.runInContext('aggregates',cart);
 const chickenPack=vm.runInContext('chickenPackSuggestion',cart);
 assert.equal(chickenPack({name:'Курица',amount:200,unit:'г'}).amount,500,path+': 200g deficit means buy a 500g pack');
 assert.equal(chickenPack({name:'Куриное филе',amount:500,unit:'г'}).amount,500,path+': exact pack not rounded up');
 assert.equal(chickenPack({name:'Куриные бёдра без кости',amount:600,unit:'г'}).amount,1000,path+': 600g needs two 500g packs');
 assert.equal(chickenPack({name:'Курица',amount:0,unit:'г'}),null,path+': zero chicken requires no packs');
 assert.equal(chickenPack({name:'Куриный бульон',amount:200,unit:'г'}),null,path+': do not treat broth as meat');
 assert.equal(chickenPack({name:'Говядина',amount:200,unit:'г'}),null,path+': no assumed 500g packs for other meat');
 assert.equal(chickenPack({name:'Куриное филе',amount:2,unit:'шт.'}),null,path+': no mass guessed from pieces');
 let basket=aggregate();
 assert.equal(basket.length,1,path+': only one missing grocery');
 assert.equal(basket[0].name,'Курица');
 assert.equal(basket[0].amount,200,path+': shopping has deficit rather than 300g whole recipe');
 assert.equal(chickenPack(basket[0]).amount,500,path+': show buy 500g while keeping 200g exact shortage');
 // Both partial deficits must survive in the same shopping list, without full-recipe amounts.
 const originalQuery=saved.shoppingExtras.fixture[0].query;
 saved.shoppingExtras.fixture[0].query='100 г курицы, 200 мл сливок, чеснок, лук';
 saved.shoppingExtras.fixture.push({key:'сливки|мл',query:'100 г курицы, 200 мл сливок, чеснок, лук',basics:false});
 basket=aggregate();
 assert.equal(basket.length,2,path+': both missing ingredients retained in shopping');
 assert.equal(basket.find(x=>x.name==='Курица').amount,200,path+': chicken partial deficit retained');
 assert.equal(basket.find(x=>x.name==='Сливки').amount,100,path+': cream partial deficit retained');
 saved.shoppingExtras.fixture.pop();
 saved.shoppingExtras.fixture[0].query=originalQuery;
 saved.servings.fixture=4;
 basket=aggregate();
 assert.equal(basket[0].amount,500,path+': shortage recalculated when servings change');
 saved.shopping.fixture=4;
 basket=aggregate();
 assert.equal(basket.find(x=>x.name==='Курица').amount,600,path+': full shopping replaces deficit without double counting');
 assert.equal(chickenPack(basket.find(x=>x.name==='Курица')).amount,1000,path+': purchase two packs for aggregated 600g');
 console.log('PASS',path,'1001 recipes; 200g deficit, kg/ml/l, 4 portions, incompatible units and shopping');
}