'use strict';
const assert=require('node:assert/strict');
const {audit}=require('./audit-airfryer-technology.cjs');
const good=audit([{id:1,title:'Курица в аэрогриле',steps:['180°С 20 минут до готовности']}]);
assert.equal(good.length,1);
assert.equal(good[0].needsReview,false);
const incomplete=audit([{id:2,section:'Аэрогриль',steps:['Готовить до готовности']}]);
assert.equal(incomplete.length,1);
assert.equal(incomplete[0].needsReview,true);
assert.equal(audit([{id:3,title:'Суп',steps:['Кипятить 20 минут']}]).length,0);
console.log('PASS: airfryer audit synthetic fixtures');

const inSteps=audit([{id:4,title:'Картофель',steps:['Готовить в аэрогриле при 180°С 15 минут до румяной корочки']}]);
assert.equal(inSteps.length,1,'airfryer mentioned only in steps must be detected');

assert.doesNotThrow(() => audit([{id:5,title:'Обычная паста',steps:[]}]), 'non-airfryer recipe must not throw');
assert.equal(audit([{id:6,title:'Овощи',steps:['Готовить в аэрогриле 190°С 12 минут до румяности']}])[0].needsReview,false);
console.log('PASS: airfryer coverage and no temporal-dead-zone exception');
