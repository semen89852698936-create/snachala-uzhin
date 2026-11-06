# Checkpoint 2026-11-06 12:40 Asia/Jerusalem

## Live state before change
- GitHub main: `ff3956e97bdeacc540509169928b2ea04e1f39d8` (#123).
- Vercel production: `dpl_ELBqW97qiaY7bDXCQzigyJuZSeaS`, READY, alias `snachala-uzhin-preview.vercel.app`, deployed SHA `d746e08d9af291fcfcb01c89e03760a8a23216c8`. Main and deployed SHA differ.
- Open PRs reviewed via GitHub search; no competing PR focused on the ingredient-search trigger.
- Required CURRENT_STATE and PROJECT_DECISIONS files read from main before editing.

## Actual change
The existing `pantry-search.yml` **runs** `node scripts/test_ingredient_search.cjs` in its static job and includes that script in `push.paths`, but omitted it from `pull_request.paths`. Thus a PR modifying only the legacy ingredient-search regression could skip the relevant CI entirely. Added the missing path to the PR trigger, retaining all existing jobs and tests.

## Verification and limitations
- Direct before/after inspection confirms the PR path filter now includes `scripts/test_ingredient_search.cjs` in both push and pull_request.
- No HTML, recipe, image, secrets, payment settings or production changes.
- GitHub Actions PASS on this branch not yet established; do not merge until observed.
- No new Vercel build requested. Rollback: revert this one-line workflow change.

## Next
Check PR CI, merge on PASS, then prioritize user-visible quantitative-search edge cases or air-fryer content. Avoid more CI-only work unless a concrete gap is discovered.
