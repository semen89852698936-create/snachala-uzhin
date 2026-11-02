// Verify every mood gets distinct daily menus and time limits hold.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = require('node:path').resolve(__dirname,'..');
const read=(relative)=>fs.readFileSync(require('node:path').join(root,relative),'utf8');
const main=read('index.html'),catalog=read('full-catalog/index.html');
function extract(html){
 const start=html.indexOf('// Moscow calendar day is shared');
 const end=html.indexOf('const EVENING_ROLES=',start);
 assert(start>=0&&end>start,'Missing daily plan logic');
 return html.slice(start,end);
}
assert.equal(extract(main),extract(catalog),'Daily logic must be identical in two pages');
function getRecipes(html){
 const content=html.match(/<script id="recipeData" type="application\/json">([\s\S]*?)<\/script>/);
 assert(content,'Recipe collection not found');
 return JSON.parse(content[1]);
}
const recipes=getRecipes(main);
assert.equal(recipes.length,1001);
let now=Date.UTC(2026,10,2);
const context=vm.createContext({RECIPES:recipes,Date:{now:()=>now}});
vm.runInContext(extract(main),context,{timeout:2000});
const moods=['tender','spark','play','cozy'],times=['quick','relaxed','long'];
let prev={};
for(let day=0;day<31;day++){
 now=Date.UTC(2026,10,2+day);
 const plans=vm.runInContext('dailyEveningMenus()',context,{timeout:2500});
 const same=vm.runInContext('dailyEveningMenus()',context,{timeout:2500});
 assert.deepEqual(JSON.parse(JSON.stringify(plans)),JSON.parse(JSON.stringify(same)));
 for(const time of times){
  const unique=new Set();
  for(const mood of moods){
   const ids=Array.from(plans[mood][time]);
   assert.equal(ids.length,time==='quick'?2:3);
   assert.equal(new Set(ids).size,ids.length);
   assert.equal(prev[mood+time]===ids.join('|'),false,'Menu should rotate on next day');
   prev[mood+time]=ids.join('|');
   const rs=ids.map(id=>recipes.find(r=>r.id===id));
   assert(rs.every(Boolean),'Unknown recipe id');
   assert(['salads','soup'].includes(rs[0].category));
   assert(['fish','pasta','meat','poultry','vegetables'].includes(rs[1].category));
   if(time!=='quick')assert.equal(rs[2].category,'dessert');
   const duration=rs.reduce((sum,r)=>sum+r.minutes,0);
   if(time==='quick')assert(duration<=45,'Quick plan exceeds 45 min: '+duration);
   if(time==='relaxed')assert(duration<=75,'Relaxed plan exceeds 75 min: '+duration);
   ids.forEach(id=>{assert(!unique.has(id),'Duplicate dish shared among moods on '+time+': '+id);unique.add(id)});
  }
 }
}
console.log('Verified 31 days x 4 moods x 3 time plans: daily rotation, unique dishes, budgets, parity.');
