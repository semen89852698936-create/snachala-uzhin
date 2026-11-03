#!/usr/bin/env node
// Physical-file integrity check only. This script does NOT approve licenses or imagery.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const archive = "photo-library/batch-100-20261101/";
const errors = [];
const warnings = [];
const asJSON = async (p) => JSON.parse(await readFile(path.join(root, p), "utf8"));
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const manifest = await asJSON(archive + "manifest.json");
const curated = await asJSON("photo-library/curated-batch-20261102.json");
const approved = await asJSON("photo-library/approved-webp-20261101.json");
const images = manifest.sources || [];
if (images.length !== 100 || manifest.photo_files !== 100) fail("Expected 100 archive records");
if ((curated.assets || []).length !== 12) fail("Expected 12 curated image mappings");

const usedNumbers = new Set(), usedPaths = new Set(), usedHashes = new Set();
const archivedByRecipe = new Map(), archivedByNumber = new Map();
const licenseCounts = {};
for (const img of images) {
  if (!Number.isInteger(img.number) || img.number < 1 || img.number > 100 || usedNumbers.has(img.number))
    fail("Duplicate/invalid number: " + img.number);
  usedNumbers.add(img.number);
  if (usedPaths.has(img.file)) fail("Repeated archive path: " + img.file);
  usedPaths.add(img.file);
  if (usedHashes.has(img.sha256)) fail("Repeated SHA-256 in manifest: " + img.number);
  usedHashes.add(img.sha256);
  if (!img.recipe_id || archivedByRecipe.has(img.recipe_id)) fail("Repeated/missing recipe ID: " + img.recipe_id);
  archivedByRecipe.set(img.recipe_id, img);
  archivedByNumber.set(img.number, img);
  if (!/^photos\/[0-9]{3}-[^/]+\.webp$/.test(img.file || "")) fail("Unexpected file path: " + img.file);
  if (!/^https:\/\//.test(img.source_page || "") || !img.license) fail("Missing source/license: " + img.number);
  licenseCounts[img.license] = (licenseCounts[img.license] || 0) + 1;
  if (img.exact_ingredient_match_verified === true)
    warn("Exact ingredient match flagged, must be reviewed independently: " + img.number);
  let bytes;
  try { bytes = await readFile(path.join(root, archive, img.file)); }
  catch { fail("Missing image " + img.file); continue; }
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP")
    fail("Not a WebP RIFF file: " + img.file);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== img.sha256) fail("SHA-256 mismatch: " + img.file);
  if (img.bytes !== undefined && bytes.length !== img.bytes)
    fail("Byte size mismatch: " + img.file);
}
if (usedNumbers.size !== 100) fail("Archive number count differs from 100");

const gallery = await readFile(path.join(root, archive, "index.html"), "utf8");
const galleryPaths = [...gallery.matchAll(/<img\s+[^>]*src="([^"]+)"/g)].map((match) => match[1]);
if (galleryPaths.length !== 100 || new Set(galleryPaths).size !== 100)
  fail("Archive gallery must show 100 distinct image paths");
for (const src of galleryPaths) if (!usedPaths.has(src)) fail("Gallery path not in archive: " + src);

let staged = 0;
for (const img of curated.assets || []) {
  const original = archivedByRecipe.get(img.recipe_id);
  if (!original || original.number !== img.number) { fail("Curated recipe mismatch: " + img.recipe_id); continue; }
  try {
    const stagedBytes = await readFile(path.join(root, img.asset_path));
    const stagedHash = createHash("sha256").update(stagedBytes).digest("hex");
    if (stagedHash !== original.sha256 || stagedHash !== img.image_sha256)
      fail("Curated/archive file differs: " + img.asset_path);
    else staged += 1;
  } catch { fail("Missing curated file: " + img.asset_path); }
}

let approvedCopyDifferences = 0;
for (const img of approved.images || []) {
  const oldArchive = archivedByNumber.get(img.num);
  if (!oldArchive || oldArchive.recipe_id !== img.recipe_id)
    fail("Approved/archived recipe mismatch: " + img.recipe_id);
  else if (oldArchive.sha256 !== img.sha256) approvedCopyDifferences += 1;
}

const ccBy = images.filter((i) => /^CC BY/.test(i.license || ""));
if (ccBy.length) warn(ccBy.length + " archive entries have attribution/share-alike obligations; verify author, source, modification and license per image.");
if (approvedCopyDifferences) warn(approvedCopyDifferences + " owner-approved production images differ in SHA from their archive copies. Do not mark those archive copies approved.");
warn("Editorial ingredient fidelity, individual licenses and live site rendering require separate human checks.");
console.log(JSON.stringify({
  technical_integrity: errors.length === 0 ? "PASS" : "FAIL",
  archived_files: images.length, distinct_sha256: usedHashes.size,
  curated_identical_to_archive: staged, production_approved_copy_differences: approvedCopyDifferences,
  license_counts: licenseCounts, errors, warnings
}, null, 2));
if (errors.length) process.exitCode = 1;
