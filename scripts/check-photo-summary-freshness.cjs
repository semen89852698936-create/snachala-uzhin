#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
function check(summary, map) {
  const issues = [];
  const photos = Array.isArray(map.photos) ? map.photos : [];
  const paths = new Set(photos.map(p => p.path));
  if (summary.totalRecipes !== map.total || map.total !== 1001) issues.push('recipe totals disagree or differ from 1001');
  if (paths.size !== photos.length || photos.length !== map.total) issues.push('AI photo map missing/duplicate paths');
  if (summary.updatedAt < '2026-11-03') issues.push('legacy summary is stale; its counters must not be used as current AI-photo readiness');
  if (summary.distinctImageFilesLocallyConfirmed > photos.length) issues.push('legacy local count exceeds mapped photos');
  return {ok: issues.length === 0, issues, mapEntries: photos.length, uniquePaths: paths.size, legacyDate: summary.updatedAt};
}
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const summary = JSON.parse(fs.readFileSync(path.join(root, 'photo-library/summary.json'), 'utf8'));
  const map = JSON.parse(fs.readFileSync(path.join(root, 'photo-library/ai-recipe-photo-map.json'), 'utf8'));
  const result = check(summary, map);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.issues.some(x => !x.startsWith('legacy summary is stale')) ? 1 : 0;
}
module.exports = {check};
