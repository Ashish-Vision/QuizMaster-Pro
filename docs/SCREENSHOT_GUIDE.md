# Screenshot capture guide

The GitHub Pages gallery uses screenshots captured from the real locally rendered QuizMaster Pro application. Capture runs use the existing Express E2E fixture server and Playwright; they do not deploy or connect the application to a production backend.

## Generate screenshots

Install the project dependencies and Playwright Chromium, then run:

```bash
npm run screenshots
```

The dedicated configuration in `playwright.screenshots.config.js` starts `e2e/support/server.js`, uses a 1440 × 900 desktop viewport, requests reduced motion, waits for API hydration and network idle, checks for browser errors, and writes PNG files into `docs/images/`. The default `npm run test:e2e` excludes the capture spec, so routine tests do not rewrite tracked images.

## Synthetic data policy

Only deterministic test fixtures from `e2e/support/apiFixtures.js` are rendered. Names and addresses are fictional, email addresses use the reserved `.invalid` domain, timestamps and identifiers are fixed, and the authentication cookie is signed with an E2E-only secret. Never capture a developer account, personal data, `.env` values, real credentials, tokens, database connection strings, or third-party service configuration.

SMTP and Cloudinary are not required. The capture server returns local API fixtures and the workflow does not fake sending email or uploading an avatar. Screenshots show the closest valid local UI state for those features: forms and existing/default avatar states only.

## Directory structure

- `docs/images/user/` — public authentication and learner screenshots
- `docs/images/admin/` — administrator screenshots
- `docs/images/architecture/` — architecture media, maintained separately
- `e2e/screenshot-capture.spec.js` — capture manifest, authentication, readiness, and browser-error checks

Every gallery image is 1440 × 900 PNG. Filenames are descriptive and stable so regenerated captures update the same intended assets without touching unrelated media.

## Regenerate after UI changes

1. Work on `development` and ensure the application’s E2E fixtures still represent the UI accurately.
2. Update synthetic fixtures or readiness selectors when a legitimate UI/API contract changes.
3. Run `npm run screenshots`.
4. Review every changed PNG for layout, loading states, private values, and accidental browser errors.
5. Run `npm run check`, `npm run test:e2e`, and `git diff --check` before committing.
6. Confirm every `docs/index.html` image source exists and test the All, Learner, and Admin filters plus the enlarged-image dialog.

Do not hand-edit screenshots or invent states for unavailable integrations. If a page cannot render locally, document the limitation and omit it until a valid local state can be captured.
