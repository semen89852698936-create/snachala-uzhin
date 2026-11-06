# Production checkpoint - 2026-11-05

Source of truth: live Vercel API and GitHub, not previous prose.

- Repository: semen89852698936-create/snachala-uzhin
- Base main SHA verified from latest production Git metadata: `5b1143636c217f5265482cf309387ce7b1111c42` (PR #95).
- Vercel project: `snachala-uzhin-preview`, project ID `prj_VitUSLk8EC9CCYpgwRptAoQmih3y`.
- Production deployment: `dpl_7Tk9PTYe2t2oKp1oLw9zcL2oKwmi`.
- Deployment state: **READY**, target: **production**, `githubCommitSha=5b1143636c217f5265482cf309387ce7b1111c42`.
- Aliases include `snachala-uzhin-preview.vercel.app` and `snachala-uzhin-preview-git-main-chaika2.vercel.app`; `aliasError=null`.
- This resolves the previous **build-rate-limit publication blocker for PR #95**. No redundant deployment is needed.
- Prior READY deployment for PR #94: `dpl_8oEq3sZjcPKVN49sMubykw5AMCfy` (SHA `8746cb9268e25bdf981678b12493ef2ec2c3d41d`), potential rollback reference.
- The public URL could not be opened by the available web reader (tool error). This is **not** evidence of a user-facing outage. Live browser testing of the timer, sleep/reload persistence, sound/notifications, desktop/mobile remains unverified by this run.
- No paid image/API calls, secrets changes, payments, or further deployments performed.

## Next production task

1. Run live Chromium desktop/mobile smoke on production: guided cooking, timer pause/resume, reload persistence, notification permissions and completion, no regressions in search, favorites, shopping list.
2. Validate latest main HEAD again before any new deployment.
3. Work on approved editorial recipe layout with illustrated action pictograms in a separate isolated PR, preserving catalog, music, and approved «Наш вечер» images.
4. Keep commercial purchase flow gated until actual payment/access control is independently verified.

This checkpoint records **deployment verification**, not completion of product QA or commercial readiness.
