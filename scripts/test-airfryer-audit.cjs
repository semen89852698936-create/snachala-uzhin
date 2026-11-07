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

const six=audit([
 {id:'salmon',title:'Лосось в аэрогриле',steps:['180 °C, 8–10 минут, проверить термометром']},
 {id:'chicken',title:'Курица в аэрогриле',steps:['180 °C, 18–23 минуты, термометр 74 °C']},
 {id:'potato',title:'Картофель',steps:['Готовить в аэрогриле при 200 °C 30–40 минут до румяной корочки']},
 {id:'sprouts',title:'Капуста',steps:['Готовить в аэрогриле при 180 °C 10–15 минут до мягкости']},
 {id:'mushrooms',title:'Грибы',steps:['Готовить в аэрогриле при 200 °C 12–15 минут до золотистых краёв']},
 {id:'carrots',title:'Морковь',steps:['Готовить в аэрогриле при 180 °C 30–40 минут до мягкости и липкой глазури']}
]);
assert.equal(six.length,6,'all six candidate styles must be detected');
assert.equal(six.filter(r=>r.needsReview).length,0,'all six candidates need temperature, time and doneness');
console.log('PASS: six airfryer candidates pass basic technology inventory');

const prepOnly=audit([{id:7,title:'Картофельные дольки',preheat:'Разогреть аэрогриль до 200 °C',steps:['Готовить 30–40 минут до румяной корочки']}]);
assert.equal(prepOnly.length,1,'airfryer mention in preparation metadata must be detected');
assert.equal(prepOnly[0].needsReview,false,'preheat metadata and steps together must pass');
console.log('PASS: airfryer mention in preheat metadata');
