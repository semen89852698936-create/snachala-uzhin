# Checkpoint 2026-11-07 00:34 Asia/Jerusalem - airfryer asset release gate

Read main CURRENT_STATE.md and PROJECT_DECISIONS_20261104.md. Live Vercel alias snachala-uzhin-preview.vercel.app: production READY dpl_nBRmWxD4mz2iH1GdBo6zyLN98Fkg, githubCommitSha 8e4f4b6effb2bef9a1e02858986404d991a9ff47, behind merged #133/#134 (last reported main 5ce4752a). No deployment attempted due to previously reported 402 quota.

PR #80 remains draft. Prior head 35228da399e1f7871dd34f197266b12e77409764 had GitHub Actions run 42297691621 SUCCESS (Airfryer editorial candidates). This is metadata QA only, not physical cooking verification.

Change: scripts/test-airfryer-candidates.cjs -- release mode now validates a safe local assets/*.webp path, file existence, and RIFF/WEBP signature. This closes the gap where any existing non-image file could satisfy the photo release gate. No recipes, catalog HTML, images, secrets or payment settings modified. Code commit d5b8a1a4e5617838662de57c567e1fb252d76a44.

Still blocked from publication: six candidates lack verified matching photos and independently documented real-appliance cooking tests. New commit CI must be checked; do not merge merely because prior run passed. Next: inspect new CI, fix failures, then source genuine photos and record actual appliance tests. Do not claim 1001 recipe parity has been rerun in this checkpoint.
