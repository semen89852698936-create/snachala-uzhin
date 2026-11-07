# Checkpoint 2026-11-07 04:33 Asia/Jerusalem

## Live baseline
- GitHub main: 5ce4752a2d14253d8dad640cc3330cb0917615d2 (PR #134 merged).
- Vercel production alias snachala-uzhin-preview.vercel.app: READY deployment dpl_nBRmWxD4mz2iH1GdBo6zyLN98Fkg, githubCommitSha 8e4f4b6effb2bef9a1e02858986404d991a9ff47. It does NOT include PR #133/#134.
- Existing Vercel quota failure 402 api-deployments-free-per-day; no deployment attempted in this run.
- Read CURRENT_STATE.md and PROJECT_DECISIONS_20261104.md from main. Reviewed open PRs; continued existing draft PR #80 rather than creating a duplicate.

## Changes in draft PR #80
- data/airfryer-editorial-candidates.json: chicken breast instructions now prohibit washing raw poultry, specify washing hands/knife/board after handling, and prohibit reuse of raw-poultry serving utensils without washing. Retain 74 C core-temperature check.
- scripts/test-airfryer-candidates.cjs: regression assertions for all four food-safety instructions.
- Commits 911af4b569ccc455fadf34e6e07c38a809f820c2 and d53225c487da17e2a626177c9e3705b7f0786f31.
- CI for latest SHA not yet confirmed. Do not merge until PASS.
- No recipe/photo/catalog production changes; six candidates still lack independently documented real-appliance tests and matching WebP.

## Next
1. Verify workflow run for latest SHA; investigate failed job logs and fix if needed.
2. Continue actual content and photo QA; no release until real-appliance checks and matching image assets.
3. After Vercel quota clears, deploy one validated current main SHA and confirm READY, alias and exact githubCommitSha.
