# Desktop visual reference - 2026-11-12

Status: desktop visual baseline frozen for future mobile-specific refinements.

This branch is a snapshot based on `main` at the time of creation. It must not be used as evidence that the currently deployed Vercel preview has identical contents without a separate deployment-to-commit comparison.

## Rules
- Do not alter desktop composition, typography, image placement, buttons, spacing, interactions or overall editorial appearance as a side effect of mobile work.
- Make mobile refinements through responsive styles or mobile-specific layouts, keeping desktop appearance unchanged.
- Test mobile widths 320, 375, 390, 430 px and desktop widths 1024, 1440 px before merging.
- Keep this approved reference branch untouched after this documentation commit.
- Do not merge or deploy this reference branch automatically; do not modify production, main, or the public Vercel deployment for the purpose of recording this baseline.
- Preserve the earlier approved rollback baseline separately.
