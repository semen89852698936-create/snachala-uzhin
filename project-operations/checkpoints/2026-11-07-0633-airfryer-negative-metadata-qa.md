# Airfryer metadata negative regression checkpoint - 2026-11-07 06:33 Asia/Jerusalem

- Live main checked: `5ce4752a2d14253d8dad640cc3330cb0917615d2`.
- Production alias `snachala-uzhin-preview.vercel.app`: READY `dpl_nBRmWxD4mz2iH1GdBo6zyLN98Fkg`, SHA `8e4f4b6effb2bef9a1e02858986404d991a9ff47` (behind main). No deployment attempted given 402 quota history.
- Existing draft PR #80 branch `feature/airfryer-editorial-first-three-20261104`: added negative regression assertions for HTTP/javascript source URLs, path traversal, remote WebP paths and unknown photo status in `scripts/test-airfryer-candidates.cjs` (commit `ff46e8ec`).
- All six candidate recipes remain editorial drafts. All six `photo_webp` values are null, and no independent appliance testing is recorded. DO NOT MERGE OR PUBLISH.
- Test status: new CI PASS not confirmed in this run. Next: check Actions for latest branch commit and fix any failure; independently verify real cooking and original WebP before release.
