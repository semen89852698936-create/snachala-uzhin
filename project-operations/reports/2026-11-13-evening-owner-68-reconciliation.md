# Independent evening checkpoint - 2026-11-13

## Source control and deployments (read-only)
- Registry main: two active projects, snachala-uzhin and moi-granitsy. The registry has not yet onboarded ZUMER.
- CURRENT_STATE.md read from main; PR #12 historical branch also inspected. PR #12 remains discoverable as open, so no automatic merge.
- snachala-uzhin main latest returned SHA: `2cfa753d3c50c970291c48b492d6adef5b29bf6b` (Nov 12). Git-connected Vercel `snachala-uzhin-git` production-target READY for same SHA, deployment `dpl_HjHm2jeY5XaU5hSqJMqXk2WpQfWM`. This does NOT prove public preview alias points to that SHA.
- Public preview Vercel project latest observed READY `dpl_C7UZ5DciPDZ7fRdaFeJj4V6UfF9W`, target null, branch `photo-release/approved-visual-seven-meat-20261113`, SHA `dcbb81d0364dc57d87f72c76c5026437828afe2f`. Do not equate this unique preview deployment with the public root alias.
- Moi granitsy main latest SHA `6c0fac72f5e894b7693092a6ba0ec6380ad8c153`. Production-target READY `dpl_6banGij2M62bmzdG6GCPNL2gQDnV` matches main SHA; newer target-null previews are from `snachala-uzhin-site` branch and are not proof of a new production release. Payment/API/Russian reachability not tested.
- Open PRs relevant to visual regression include #256 and #257. Do not touch approved stylesheet, design, player, or photo-release branches. Hourly photo/music production owns ongoing generation and upload.

## Photo library and actual progress
- `photo-library/summary.json` in main is an outdated Nov 1 snapshot (3 locally confirmed/approved WebP at that historical moment), not an authoritative count of the current 1001-photo technical map.
- `photo-library/curated-images.json` read from PR #12 branch: 10 historical source-page candidates for 21-50; all marked not downloaded/not visually approved/not approved for publication. Its generic Pexels license text is NOT individual rights clearance.
- `photo-library/recipes-photo-registry.csv` absent in main and PR #12 branch (404). PR #11 describes a separate archived 100-photo CSV; no current complete owner-acceptance CSV was confirmed.
- Owner's latest 68-photo review was independently normalized into `project-operations/photo-review/owner-68-reconciliation-20261113.json`: 12 yes (3 prior + 9 new), 56 no. Validation: exactly 68 distinct integer numbers, full coverage 1..68, no overlap, PASS.
- These 68 gallery positions are NOT necessarily recipe IDs. Owner approval is NOT evidence of physical file presence, provenance or rights clearance.
- New image files this run: 0. New direct visual file inspections: 0. New individual legal clearances: 0. New owner approvals: 0.
- Full library total: 1001 recipes. Verified current complete final approvals across all 1001: unknown; remaining final approvals cannot be calculated reliably. Within the reviewed 68: 56 rejected, 12 owner-approved (subject to technical and provenance reconciliation).

## Next safe work
1. Reconcile gallery positions 1..68 with real SHA/path/recipe IDs in the latest photo production branch, without overwriting existing data or changing published assets.
2. Verify public alias deployment ownership separately from Git-connected production-target READY.
3. Check PR #257 against the immutable Nov 12 visual baseline before any merge decision.
4. For Moi granitsy: verify domain mapping and Russian accessibility, then auth/payment in a non-charging test environment.

No production publication, merge, purchases, payments, permission changes, or image replacement were performed.
