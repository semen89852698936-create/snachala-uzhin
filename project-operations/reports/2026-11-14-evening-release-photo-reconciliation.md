# Evening independent release and photo evidence audit - 2026-11-14

Scope: read-only GitHub/Vercel inspection. No production changes, merges, payments or permissions.

## Registry and source of truth
- Read `project-operations/registry.json` from main: two active projects, `snachala-uzhin` and `moi-granitsy`. Registry updatedAt 2026-11-01.
- Read `project-operations/CURRENT_STATE.md` from main and the historical operations branch. Main document's leading checkpoint is 2026-11-08 and must not be treated as live deployment evidence.

## Vercel observations
- `snachala-uzhin-preview.vercel.app` resolves via Vercel deployment lookup to READY `dpl_HwPCAXfyXpxyjLu8LQ7Q8Ni1mWVz`, commit `7bce2339d7468c635576a6d1328363b37f7caf97`, branch `release/51-archived-recipe-photos-20261114`, target production. The deployment's returned alias list contains a branch-specific hostname, not the customary hostname; verify alias routing independently before declaring the public URL updated.
- Newer READY preview deployment `dpl_GAButmqsELjsDTwLwic2rkkNtJZV` is commit `a776a425e74f9c14553257e1977240f20c6b6563`, branch `feat/approved-site-50-photos-20261114`, target null. **Not evidence of production publication**.
- `snachala-uzhin-git` production READY `dpl_5Bhx9PzRjoPxTM2PGPTPJMaAQC8j`, commit `b5fe110097748be7933ac0d574ebd64015f9b417`, branch main. Later branch deployments exist, but target null.
- `granitsy-semen-chayka` production READY `dpl_6banGij2M62bmzdG6GCPNL2gQDnV`, commit `6c0fac72f5e894b7693092a6ba0ec6380ad8c153`, branch main. Its chronologically later READY `dpl_5y1dovLGY2wDGpCJ5YV44ycLZNxC` is branch `snachala-uzhin-site`, target null. Do not confuse them.

## Photo evidence
- Read `photo-library/summary.json` (dated 2026-11-01) and `photo-library/curated-images.json` (dated 2026-11-01). Main `photo-library/recipes-photo-registry.csv` and root `recipes-photo-registry.csv` returned 404.
- Old summary records 3 historically final-approved files and 10 candidate source pages, not a modern acceptance ledger.
- Curated batch 21-50 has 10 source-page candidates, zero downloaded files and zero publication approvals per its own metadata. Candidate #30 points to a URL with `chicken-meat-dish` despite pork recipe title: unresolved content conflict, not proof of mismatch.
- This run: **0** new image files, **0** directly visually inspected image files, **0** independently legally cleared files, **0** newly owner-approved images. The total accepted count and remaining count out of 1001 are **not verifiable** from these dated ledgers. No inference that all 1001 remain.
- Recent Vercel branch messages mention 25 and 50 approved meat images, but commit messages alone are not visual inspection or owner approval evidence. These batches may overlap and must not be added together.

## Next independent action
1. Reconcile the Nov 13 owner decisions (12 approved, 56 rejected among 68) with exact binary hashes and current recipe IDs, avoiding overlap with current hourly photo work.
2. Validate customary public hostname routing, rather than treating READY or target=production as sufficient proof.
3. For course, check actual `moigranitsy.ru` routing and the paid API flow in a safe test environment before commercial launch.
4. Refresh the legacy photo ledger only after actual image-file and license evidence is available. Do not rewrite historical counts as current counts.

This document is an audit-only checkpoint. No application code or image asset was changed.
