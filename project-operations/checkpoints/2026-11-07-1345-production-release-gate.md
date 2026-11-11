# Checkpoint 2026-11-07 13:45 Asia/Jerusalem

## Verified live
- GitHub main: `5ce4752a2d14253d8dad640cc3330cb0917615d2` (PR #134).
- Vercel production alias `snachala-uzhin-preview.vercel.app`: READY deployment `dpl_nBRmWxD4mz2iH1GdBo6zyLN98Fkg`, `githubCommitSha=8e4f4b6effb2bef9a1e02858986404d991a9ff47`.
- Difference: #133 and #134 are in main but not deployed to the public alias.
- Vercel deployment listing shows no newer production deployment. Last documented deployment POST rejected with HTTP 402 `api-deployments-free-per-day`, `retryAfter=86400` on 2026-11-06. Quota recovery has NOT been confirmed. No new deployment attempted in this checkpoint.

## Release gate
1. Before any POST, re-read main SHA, CI results, and Vercel alias SHA. Avoid concurrent production deployments.
2. When quota is demonstrably available, attempt one production deployment for tested current main only.
3. Accept release only when deployment READY and alias's `githubCommitSha` equals that main SHA; retain `dpl_nBRmWxD4mz2iH1GdBo6zyLN98Fkg` as rollback reference.
4. If blocked, capture exact HTTP status/retry window and switch to independent development work; do not change billing.

## Airfryer gate
- Draft PR #80 contains candidate recipes; draft PR #136 has physical acceptance protocol and image briefs. Do not merge either as production recipes without verified unique WebP and actual appliance trials.
- QA PASS alone does not prove real-world cooking safety or image correspondence.

This checkpoint is a documented release blocker, not a deployment, recipe acceptance, or new CI PASS. No paid APIs, billing, secrets, or access settings changed.

## Revalidation 2026-11-07 14:18 Asia/Jerusalem
- Re-read `project-operations/CURRENT_STATE.md` and `PROJECT_DECISIONS_20261104.md` from main. These documents date to November 4 and their deployment references are historical, not live release evidence.
- GitHub latest main commit search again returns `5ce4752a2d14253d8dad640cc3330cb0917615d2`; preceding commits are #133 `e92d7b2292abe24784f53ba0180d9fa4021c2e2a` and #132 `8e4f4b6effb2bef9a1e02858986404d991a9ff47`.
- Vercel `get_deployment` by public alias independently returns READY, production, `dpl_nBRmWxD4mz2iH1GdBo6zyLN98Fkg`, githubCommitSha `8e4f4b6effb2bef9a1e02858986404d991a9ff47`, alias explicitly includes `snachala-uzhin-preview.vercel.app`.
- Vercel production history lists this deployment as newest; no deployment for `5ce4752a` is visible. This verifies the release gap, not quota recovery. No deployment POST was made.
- Do not infer quota availability from elapsed time or READY status. The next production attempt must be coordinated with other automations and made only once when justified by the known retry window and fresh checks.
- Existing issue #73 remains the airfryer acceptance target. Draft recipe and photo work must not be represented as physical testing.
- No new CI execution or production release claimed in this revalidation.

## 2026-11-07 16:49 Asia/Jerusalem: separate Vercel project trap
- Fresh `get_deployment` for the actual public alias still resolves to `snachala-uzhin-preview`, project `prj_VitUSLk8EC9CCYpgwRptAoQmih3y`, deployment `dpl_nBRmWxD4mz2iH1GdBo6zyLN98Fkg`, READY, `githubCommitSha=8e4f4b6effb2bef9a1e02858986404d991a9ff47`. Latest production listing for THIS project shows no newer release.
- GitHub's Vercel bot comment on PR #138 advertises a READY preview from DIFFERENT project `snachala-uzhin-git` (`prj_6K1cIjW8emhX1lcTc3dh0gDPTKEd`, rootDirectory `photo-library`). That green preview does NOT prove the primary public site is updated. Never promote, redeploy or inspect that other project as a substitute for `snachala-uzhin-preview`.
- Fresh GitHub commit search: main remains `5ce4752a2d14253d8dad640cc3330cb0917615d2`. This is a read-only check; quota availability still unknown. No production POST, payment, API generation or new CI run was made.
