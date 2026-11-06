# Checkpoint 2026-11-06 15:36 Asia/Jerusalem

- Base main: `b50fcaded2f948e98238d03cbb54a716f71e3d1f`.
- Verified live Vercel latest production READY: `d746e08d9af291fcfcb01c89e03760a8a23216c8`, deployment `dpl_ELBqW97qiaY7bDXCQzigyJuZSeaS`; not current main. No deployment requested.
- Read CURRENT_STATE.md and PROJECT_DECISIONS_20261104.md from main. Checked open PRs; no other open PR specifically tests decimal metric stock cases.
- Isolated branch `qa/pantry-metric-boundaries-20261106-1536`: added three regression assertions to `scripts/test_pantry_quantities.cjs` for 0.25kg => 50g deficit, 0.25l => 50ml deficit, and repeated mixed-unit entries summing to exact stock.
- Both HTML entry points and all 1001 recipes are exercised by existing test harness. This change is test-only and does not alter catalog, photos, payments, or site.
- CI result pending; do not merge until real GitHub Actions PASS. If tests fail, inspect whether engine behavior needs safe correction rather than weakening assertions.
- Rollback: close PR or revert test-only commit; production untouched.
