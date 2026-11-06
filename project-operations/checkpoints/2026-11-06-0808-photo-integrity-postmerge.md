# Checkpoint - post-merge photo integrity CI (2026-11-06 08:08 Asia/Jerusalem)

## Verified starting state
- main HEAD: `1016c78aaed7277ab3317d2caf1ca52d515439c1`.
- Production Vercel alias `snachala-uzhin-preview.vercel.app`: deployment `dpl_ELBqW97qiaY7bDXCQzigyJuZSeaS`, READY, Git SHA `d746e08d9af291fcfcb01c89e03760a8a23216c8`; production is behind main.
- Existing photo integrity workflow runs on pull requests and manual dispatch, but **not on pushes to main**. Thus a successful PR run is not a post-merge verification.
- PR #120 is already open for an earlier CI checkpoint; this change uses an isolated branch and does not edit PR #120 or unrelated photo audits.

## Change
- `.github/workflows/recipe-photo-integrity.yml`: add a `push` event restricted to `main` and the same photo/HTML/test paths already covered by PR validation. Keep `pull_request`, `workflow_dispatch`, read-only permissions and ten-minute timeout.
- No changes to recipe data, image bytes, HTML, approved evening assets, payments or production settings.

## Verification boundaries
- The workflow YAML change is committed; an actual GitHub Actions run and PASS for this PR must be checked before merging.
- The 1001 WebP checks run in the workflow, not in this connector operation. No new claim of 1001-file execution is made here.
- No Vercel deployment triggered deliberately; GitHub HEAD and Vercel READY SHA must be compared after a safe merge.
- Rollback: revert the workflow commit without touching recipes or images.

## Next
1. Inspect PR CI and changed files. Merge only after a confirmed PASS.
2. Verify a post-merge `push` workflow run when the next photo-related commit lands on main.
3. Recheck Vercel deployment SHA; do not trigger repeated costly builds merely to publish a CI-only change.
4. Continue semantic image audit and quantitative pantry search in separate branches.
