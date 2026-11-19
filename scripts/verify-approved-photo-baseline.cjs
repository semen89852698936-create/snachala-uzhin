#!/usr/bin/env node
"use strict";

/**
 * Audit the physical bytes of owner-approved photos against a verified,
 * immutable snapshot of the public deployment. This intentionally does NOT
 * endorse other inventory photos as visually correct.
 *
 * Usage: node scripts/verify-approved-photo-baseline.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "project-operations", "APPROVED_PHOTO_BASELINE_20261119.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const errors = [];
const names = new Set();
const inventory = new Map();

for (const item of manifest.inventory) {
  if (!item.path.startsWith("assets/recipes-ai/") || !/^[a-f0-9]{40}$/.test(item.sha)) {
    errors.push("Invalid inventory record: " + JSON.stringify(item));
  }
  if (inventory.has(item.path)) errors.push("Duplicate inventory file: " + item.path);
  inventory.set(item.path, item.sha);
}
if (inventory.size !== 1000) errors.push("Expected 1000 inventoried WebP files, got " + inventory.size);

for (const item of manifest.approved_locks) {
  if (names.has(item.path)) errors.push("Duplicate approved lock: " + item.path);
  names.add(item.path);
  if (!["pasta","fish"].includes(item.category) || !item.path.startsWith("assets/recipes-ai/") || !item.path.endsWith(".webp")) {
    errors.push("Invalid lock metadata for: " + item.path);
    continue;
  }
  if (inventory.get(item.path) !== item.sha) {
    errors.push("Approved lock disagrees with the published inventory: " + item.path);
  }
  const filePath = path.join(root, item.path);
  if (!fs.existsSync(filePath)) {
    errors.push("Approved photo missing: " + item.path);
    continue;
  }
  const bytes = fs.readFileSync(filePath);
  if (bytes.subarray(0,4).toString("ascii") !== "RIFF" || bytes.subarray(8,12).toString("ascii") !== "WEBP") {
    errors.push("Approved image is not WebP: " + item.path);
    continue;
  }
  const actual = crypto.createHash("sha1")
    .update(Buffer.from("blob " + bytes.length + "\0", "utf8")).update(bytes)
    .digest("hex");
  if (actual !== item.sha) {
    errors.push("APPROVED PHOTO CHANGED: " + item.path + " expected " + item.sha + " got " + actual);
  }
}
if (manifest.approved_locks.length !== 128) errors.push("Approved lock count changed unexpectedly.");
if (errors.length) {
  console.error("FAIL: " + errors.length + " problem(s)\n" + errors.join("\n"));
  process.exit(1);
}
console.log("PASS: 128 approved photo blobs unchanged and in sync with " + manifest.source_commit.slice(0,8));
console.log("Other images remain an inventory snapshot only; this is NOT a visual quality pass.");
