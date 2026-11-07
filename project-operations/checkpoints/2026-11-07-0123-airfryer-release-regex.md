# Airfryer release regex checkpoint - 2026-11-07 01:23 Asia/Jerusalem

- Read CURRENT_STATE.md and PROJECT_DECISIONS_20261104.md; both have historical SHA references.
- Live GitHub main: 5ce4752a2d14253d8dad640cc3330cb0917615d2.
- Live production alias snachala-uzhin-preview.vercel.app: READY dpl_nBRmWxD4mz2iH1GdBo6zyLN98Fkg at 8e4f4b6effb2bef9a1e02858986404d991a9ff47. PR #133/#134 not yet on alias. Prior Vercel 402 daily deployment quota: no deployment attempted.
- Existing draft PR #80 branch feature/airfryer-editorial-first-three-20261104: fixed release-only photo path regex in scripts/test-airfryer-candidates.cjs. Previously doubled regex backslashes caused a valid assets/*.webp path to be rejected even when a verified photo eventually exists. Added positive and negative regex assertions. Fix commit f1f7cab7b87836522c70df1b6fa919821c64d725.
- No real-appliance tests or approved matching WebP photos established. Release gate must remain closed. Do not merge draft or advertise recipes.
- Next: check GitHub Actions for this branch head, fix failures; obtain real cooking QA and matching licensed/generated WebP, then test both catalogues. After Vercel quota resets, deploy exactly one validated main SHA and verify alias.
