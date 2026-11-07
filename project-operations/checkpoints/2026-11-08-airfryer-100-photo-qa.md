# Air fryer photo QA checkpoint - 2026-11-08

## Verified production state
- GitHub main SHA at inspection: `58843728567f8c5b5299d9b80d2ac7a7aae29cde`.
- 100 recipe manifests, 100 unique recipe IDs, 100 WebP assets, 100 photo records.
- All WebP assets are 1200 × 900 and their SHA-256 values match the records.
- All photos remain unpublished (`approved_for_publication: false`). Physical testing on the owner's exact appliance has not been performed.

## Visual review
- 100 images visually reviewed.
- 87 visually accepted.
- 13 require regeneration; the per-image reason and replacement brief are in `photo-library/airfryer/visual-review.json`.
- Rejected images must not be shown on the website. Original files should be archived before replacement.

## Workflow safety
- Remove the hourly schedule and automatic push trigger from `yandex-ai-airfryer-batch-01.yml`.
- Keep manual dispatch guarded by `paid_generation=yes`.
- Allow paid regeneration only on the dedicated branch `feature/airfryer-photo-regeneration-20261108` after free preflight succeeds.
- Process all ten manifests in one run, verify each batch and then run the aggregate 100-image verifier.

## Next steps
1. Regenerate the 13 rejected images with the revised briefs.
2. Visually inspect all 13 replacements and mark only matching images accepted.
3. Build the interactive 100-recipe air-fryer section in both HTML variants.
4. Run desktop/mobile and recipe-flow regression tests.
5. Publish only after preview QA and Vercel READY SHA verification.
