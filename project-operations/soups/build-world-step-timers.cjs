#!/usr/bin/env node
'use strict';
/**
 * Generate actionable, reviewable phase timings from all 100 soup manuscripts.
 * Does not invent times for untimed steps or mark culinary approval.
 * Source of truth: WORLD_100_RECIPES.json.
 */
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname;
const recipes=JSON.parse(fs.readFileSync(path.join(dir,'WORLD_100_RECIPES.json'),'utf8')).recipes;
const re=/(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?\s*(секунд(?:ы|у)?|минут(?:ы|у)?|мин\.?|час(?:а|ов)?)/gi;
const number=n=>Number(String(n).replace(',','.'));
const sec=(n,u)=>Math.round(number(n)*(u.startsWith('час')?3600:u.startsWith('сек')?1:60));
const readiness=/до\s+(?:полной\s+)?(?:готовности|мягкости|загустения|схватывания|прозрачности)|пока\s+(?:всё\s+)?не|пока\s+\w+\s+не|по упаковке|согласно инструкции/i;
const endOnly=/за последние|на последние|через \d|перед концом|за \d+.*до конца/i;
const errors=[], rows=[], stats={recipes:recipes.length,steps:0,phases:0,timed_steps:0,untimed_steps:0,multiple_phases:0,readiness_steps:0,relative_time_steps:0};
if(recipes.length!==100)errors.push('100 recipes required');
for(const rec of recipes){
 const steps=rec.steps.map((instruction,idx)=>{
  const parts=[...instruction.matchAll(re)];
  const phases=parts.map((m,j)=>{
    const start=m.index, end=start+m[0].length;
    const clauseStart=Math.max(instruction.lastIndexOf('.',start)+1,instruction.lastIndexOf(';',start)+1);
    const clauseEndCandidates=[instruction.indexOf('.',end),instruction.indexOf(';',end)].filter(x=>x>=0);
    const clauseEnd=clauseEndCandidates.length?Math.min(...clauseEndCandidates):instruction.length;
    const context=instruction.slice(clauseStart,clauseEnd).trim();
    const relative=endOnly.test(context);
    const min=sec(m[1],m[3]),max=sec(m[2]||m[1],m[3]);
    if(!(min>0&&max>=min))errors.push('#'+rec.id+' step '+(idx+1)+' phase '+(j+1)+' invalid range');
    return {phase:j+1,quoted_duration:m[0],min_seconds:min,max_seconds:max,phase_text:context.slice(0,220),start_mode:relative?'RELATIVE_TO_OTHER_ACTION':'MANUAL_START_AT_ACTION',timer_approved:false,can_auto_start:false};
  });
  const requires=readiness.test(instruction);
  const relative=phases.some(x=>x.start_mode==='RELATIVE_TO_OTHER_ACTION');
  stats.steps++;stats.phases+=phases.length;
  if(phases.length)stats.timed_steps++;else stats.untimed_steps++;
  if(phases.length>1)stats.multiple_phases++;
  if(requires)stats.readiness_steps++;
  if(relative)stats.relative_time_steps++;
  return {step:idx+1,step_text:instruction,phases,completion_condition:requires?'CHECK_PRODUCT_READINESS':'FOLLOW_WRITTEN_INSTRUCTION',warning:requires?'Ориентируйся не только на таймер: проверь готовность продукта.':null,editorial_status:phases.length?'EXTRACTED_REQUIRES_CULINARY_CHECK':'NO_TIMER_SPECIFIED'};
 });
 rows.push({id:rec.id,title:rec.title,cuisine:rec.country_cuisine,servings:rec.servings,steps});
}
if(stats.steps!==504)errors.push('504 steps expected; got '+stats.steps);
if(errors.length)throw Error(errors.join('\n'));
const result={collection:'НАШ ВЕЧЕР: 100 супов мира',schema:'step-timer-phases-v1',approval_status:'NOT_CULINARY_VALIDATED',notes:[
'Начало отсчёта только после фактического запуска действия пользователем.',
'Не создавай таймер, если в шаге нет числовой длительности.',
'Несколько интервалов внутри шага - независимые фазы, не складывать и не запускать одновременно автоматически.',
'«За последние/через» - относительное событие; нельзя запускать с начала всего шага.',
'Готовность мяса, рыбы, круп, яиц и бобовых проверяют фактически, таймер даёт лишь ориентир.',
'Этот файл генерируется автоматически, не заменяет независимую кулинарную сверку трёх источников.'
],stats,recipes:rows};
fs.writeFileSync(path.join(dir,'WORLD_100_STEP_TIMER_PHASES.json'),JSON.stringify(result,null,2)+'\n');
console.log('PASS: generated reviewable timer phases for 100 recipes, stats:',JSON.stringify(stats));
