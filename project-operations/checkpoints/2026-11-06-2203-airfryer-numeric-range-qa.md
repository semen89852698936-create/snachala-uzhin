# Airfryer candidate numeric range QA - 2026-11-06 22:03 Asia/Jerusalem

## Verified starting point
- GitHub main: `5ce4752a2d14253d8dad640cc3330cb0917615d2` (PR #134).
- Vercel production alias `snachala-uzhin-preview.vercel.app`: READY deployment `dpl_nBRmWxD4mz2iH1GdBo6zyLN98Fkg`, SHA `8e4f4b6effb2bef9a1e02858986404d991a9ff47`. The live site still lacks #133 and #134.
- Read `CURRENT_STATE.md` and `PROJECT_DECISIONS_20261104.md` from main before changes.
- Existing draft PR #80 contains six editorial candidates, without appliance trials or verified WebP; PR #127 independently audits zero coverage in the live 1001 catalog.

## Concrete correction
- In PR #80's `scripts/test-airfryer-candidates.cjs`, reject cooking-time ranges with string or fractional minute values. Previously `['10','20']` passed because relational comparisons coerced types.
- Added negative regression fixtures for string and fractional minute ranges, in addition to reversed ranges.
- No candidate recipes, photos, HTML, payments or Vercel configuration changed.

## Release gate
- PR #80 remains draft; physical-appliance tests and matching original/licensed WebP are mandatory before publishing.
- CI for this new commit must be checked before claiming PASS or merging.
- Rollback: revert commit `688210a18b42a44938dbf8c4b6cea68941b8e892` in the PR #80 branch if regression is demonstrated.
