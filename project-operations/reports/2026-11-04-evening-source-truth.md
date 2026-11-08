# Photo provenance checkpoint - 2026-11-04 evening

## Read-only source reconciliation
- `main` contains `photo-library/summary.json` dated 2026-11-01, with **3** locally confirmed files and **29** photo identifiers. This is a **historical snapshot**, not a current count of the newer 1001-WebP AI photo map.
- `photo-library/curated-images.json` has **10 candidate source pages** for batch 21-50; these are not downloaded, approved or published assets.
- `photo-library/approved-webp-20261101.json` records **3 previously approved WebP**. The broader 1001 WebP technical map described in CURRENT_STATE is a different dataset; its existence does not imply visual/editorial or rights approval.
- The `photo-library/recipes-photo-registry.csv` file is **absent from main**. It exists in historical branch `photo-library/evening-audit-20261101`; do not silently use it as current production evidence.
- New image files created in this run: **0**. Newly visually reviewed: **0**. Newly rights-reviewed: **0**. Newly approved: **0**. Unreviewed by this run: **1001** (not a claim that all 1001 lack historical review).
- Next batch: **21-50**; 10 have candidate source pages, 20 still need source identification according to the dated curated registry. Do not assume source-page license equals approval of downloaded binary.

## Code and deployment
- Current observed main HEAD: `4f0bb9c3c2a9e0d14651a5e9dd7e983ea4c9114b` (PR #86, search beef/chicken/turkey + potato).
- Most recent production deployment returned by Vercel: `dpl_59CYFXhEmVNC62DTEtYx8fc89WKK` READY for **older** `3bc1e443ce144916aaa4bcfe436f62d5cd55d83b`. Thus the #86 changes were **not confirmed live** in this check.
- The active project registry includes «СНАЧАЛА УЖИН» and «Мои границы». «Мои границы» repository last observed commit `6c0fac72f5e894b7693092a6ba0ec6380ad8c153`; Vercel project latest deployment READY, target unspecified. No payment, regional or AI full-flow acceptance inferred.
- PR #12 legacy state file exists in branch `operations/persistent-state-and-data-plan-20261102`; main has a newer CURRENT_STATE dated 2026-11-04 and should take precedence.
- PR inventory was not available from the limited connector query in this run; only merged PRs referenced by recent commits are confirmed.

## Safe action
Added `scripts/check-photo-provenance.js` to cross-check historical summary, candidate sources, approved file manifest, and physical presence of approved assets without counting URLs/prompts as photos.

## Next
1. Run the provenance checker in GitHub CI, reconcile with the newer 1001-WebP map, and update the dated summary using distinct technical/visual/legal counts.
2. Review batch 21-50 against exact recipes and license evidence; produce/download binary files only with verifiable rights.
3. Finish quantity-aware pantry search in a separate PR, coordinated with the hourly production agent.
4. No merges, production deployment, payment changes or access changes in this run.
