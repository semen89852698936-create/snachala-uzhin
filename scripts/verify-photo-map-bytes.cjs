#!/usr/bin/env node
"use strict";
// Verify the actual 1001 catalog photo files and metadata only. Unlike the legacy
// 2026-11-01 suite, this does not assume old 1001-recipe or Spotify UI contracts.
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const root=path.resolve(__dirname,"..");
const photos=JSON.parse(fs.readFileSync(path.join(root,"photo-library/ai-recipe-photo-map.json"),"utf8")).photos;
if(photos.length!==1001)throw Error("expected 1001 photo records, got "+photos.length);
const seenIds=new Set(),seenPaths=new Set(),seenHashes=new Set();
for(let i=0;i<photos.length;i++){
 const p=photos[i];
 if(p.n!==i+1||seenIds.has(p.recipe_id)||seenPaths.has(p.path))throw Error("duplicate or out-of-order photo record #"+(i+1));
 seenIds.add(p.recipe_id);seenPaths.add(p.path);
 if(!p.path.startsWith("/assets/")||p.path.includes(".."))throw Error("unsafe photo path "+p.path);
 const content=fs.readFileSync(path.join(root,p.path.slice(1)));
 if(content.length!==p.bytes)throw Error("byte count mismatch #"+p.n+" "+p.path);
 if(content.toString("ascii",0,4)!=="RIFF"||content.toString("ascii",8,12)!=="WEBP"||content.readUInt32LE(4)+8!==content.length)throw Error("invalid RIFF WebP #"+p.n);
 const sha=crypto.createHash("sha1").update(Buffer.from("blob "+content.length+String.fromCharCode(0))).update(content).digest("hex");
 if(sha!==p.sha)throw Error("incorrect Git blob hash #"+p.n+" "+p.path);
 if(seenHashes.has(sha))throw Error("duplicate image content #"+p.n);
 seenHashes.add(sha);
}
console.log("PASS: 1001 unique recipe photo paths, physical WebP blobs and exact SHA/size metadata");
