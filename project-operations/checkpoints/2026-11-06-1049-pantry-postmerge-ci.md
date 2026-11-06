# Checkpoint: post-merge pantry, cooking and editorial regression CI

Date: 2026-11-06 10:49 Asia/Jerusalem.

## Ground truth before change
- Main HEAD: `32dccc9369c1f3121c9562da629bfa87d1462a37`.
- Public Vercel alias `snachala-uzhin-preview.vercel.app`: READY, deployment `dpl_ELBqW97qiaY7bDXCQzigyJuZSeaS`, `githubCommitSha=d746e08d9af291fcfcb01c89e03760a8a23216c8`. This is behind main; do not claim production contains newer commits.
- Photo-integrity workflow already supports post-merge push; this change targets the *separate* pantry/editorial/cooking workflow, not photos.
- PR #122 separately covers historical photo metadata; do not duplicate it.

## Change
- `.github/workflows/pantry-search.yml`: add `push` on `main` with the same paths filter as `pull_request`. Keep `workflow_dispatch`.
- On relevant merges, both existing static checks (1001 recipes, search, quantities, editorial and timer) and Chromium desktop/mobile smoke tests should run.
- No product HTML, photos, payments, secrets, or customer access changed.

## Verification / limitations
- Workflow syntax and event configuration reviewed against existing workflow and `recipe-photo-integrity.yml`.
- This checkpoint is NOT a claim that GitHub Actions passed or that the post-merge push has fired; verify PR checks before merging and the first main push run afterward.
- No additional Vercel build triggered intentionally. Public alias SHA must be checked separately after future production deployment.
- Rollback: revert the single workflow change (plus this checkpoint if desired).

## Next action
Confirm GitHub Actions PR run. On PASS, merge this non-product CI change and confirm a post-merge main push run. Then prioritize actual quantitative search improvements or substantive photo/recipe mismatches; avoid more metadata-only audits.
