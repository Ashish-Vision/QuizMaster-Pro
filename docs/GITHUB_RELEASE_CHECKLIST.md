# GitHub release checklist

## Repository

- [x] Generated reports, coverage, test results, logs, uploads, dependencies, and `.env` are ignored.
- [x] No tracked real secret found by the final scan.
- [x] README, API, architecture, environment, testing, security, contribution, and release docs are current.
- [x] Read-only quality workflow and review templates are present.
- [x] Confirm the all-rights-reserved `LICENSE` matches `package.json` and README.
- [ ] Review historical large Playwright objects; do not rewrite history without a separate decision.

## Presentation

- [ ] Capture real desktop/mobile screenshots using `SCREENSHOT_GUIDE.md`.
- [ ] Record an optional short demo with synthetic data.
- [ ] Create a 1280 × 640 GitHub social preview.
- [ ] Set repository description and topics.
- [ ] Pin the repository on the owner profile.

## Quality

- [ ] Run `npm ci` from a clean clone.
- [ ] Run `npm run check`.
- [ ] Run `npm run test:coverage` and review important uncovered files.
- [ ] Run `npm run test:e2e`.
- [ ] Run `npm run audit:prod`.
- [ ] Complete `MANUAL_QA_CHECKLIST.md` with synthetic data.
- [ ] Confirm ignored local `.env` files are not staged.

## Release

- [ ] Merge reviewed changes through the desired branch strategy.
- [ ] Confirm `CHANGELOG.md` release date.
- [ ] Create an annotated `v1.0.0` tag only after manual QA is complete.
- [ ] Create GitHub release notes from `RELEASE_NOTES_V1.md`.
