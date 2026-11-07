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
