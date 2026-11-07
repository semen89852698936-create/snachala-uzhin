#!/usr/bin/env node
'use strict';
// Read-only audit: flags missing air-fryer instructions; it does not certify recipes.
const fs = require('node:fs');
const assert = require('node:assert/strict');

function extract(html) {
  const match = html.match(/<script id="recipeData" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'recipeData JSON not found');
  return JSON.parse(match[1]);
}
function audit(recipes) {
  const rows = [];
  for (const recipe of recipes) {
    const metadata = [recipe.title, recipe.category, recipe.section, recipe.tags, recipe.preheat, recipe.basket, recipe.turn].flat().filter(Boolean).join(' ');
    const steps = Array.isArray(recipe.steps) ? recipe.steps.map(s => typeof s === 'string' ? s : Object.values(s || {}).join(' ')).join(' ') : String(recipe.steps || '');
    if (!/аэрогрил/i.test(metadata + ' ' + steps)) continue;
    const description = [recipe.description, recipe.instructions, recipe.preheat, recipe.basket, recipe.turn, steps].filter(Boolean).join(' ');
    const hasTemperature = /(?:1[0-9]{2}|2[0-3][0-9])\s*(?:°\s*[CcСс]?|градус)/i.test(description);
    const hasTime = /\b\d+\s*(?:[-–]\s*\d+\s*)?(?:минут|мин\.?|час)/i.test(description);
    const hasDoneness = /готовност|внутренн.{0,15}температур|термометр|прозрачн.{0,12}сок|золотист|румян|мягк|липк|хруст/i.test(description);
    rows.push({id:recipe.id,title:recipe.title,hasTemperature,hasTime,hasDoneness,needsReview:!hasTemperature||!hasTime||!hasDoneness});
  }
  return rows;
}
if (require.main === module) {
  const first = extract(fs.readFileSync('index.html','utf8'));
  const second = extract(fs.readFileSync('full-catalog/index.html','utf8'));
  assert.equal(first.length,1001,'index.html must contain 1001 recipes');
  assert.equal(second.length,1001,'full-catalog must contain 1001 recipes');
  assert.deepEqual(second,first,'catalog entries must match across both HTML variants');
  const publishedRows=audit(first);
  const candidates=JSON.parse(fs.readFileSync('data/airfryer-editorial-candidates.json','utf8'));
  assert.equal(candidates.recipes.length,6,'six editorial candidates must be included in the audit');
  const candidateRows=audit(candidates.recipes);
  const summary={
    totalRecipes:first.length,
    publishedAirfryerTagged:publishedRows.length,
    sourceReviewedCandidates:candidateRows.length,
    flaggedCandidates:candidateRows.filter(r=>r.needsReview).length,
    candidateStatus:candidateRows.length===6?'six-candidates-audited':'candidate-coverage-incomplete',
    publishedStatus:publishedRows.length?'published-airfryer-recipes-found':'no-airfryer-candidates-published-yet',
    candidates:candidateRows
  };
  process.stdout.write(JSON.stringify(summary,null,2)+'\n');
  // Published coverage may correctly be zero while the six new candidates are still gated.
  // Fail only if the candidate set is incomplete or any candidate lacks basic cooking instructions.
  if(candidateRows.length!==6||candidateRows.some(r=>r.needsReview)){
    console.error('AIRFRYER CANDIDATE AUDIT FAILURE');
    process.exitCode=2;
  }
  // Flags are editorial review prompts, not automatic proof of a faulty recipe.
}
module.exports={extract,audit};
