# Frontend review

Review date: 2026-08-06. All public, authenticated-user, and administrator pages were audited through their EJS, CSS, JavaScript, route policy, and Playwright behavior.

## Coverage

User pages: landing, registration, login, recovery, verification, dashboard, standard quiz, daily challenge, result, history, leaderboard, analytics, achievements, notifications, profile, and settings.

Administrator pages: dashboard, questions, categories, users, attempts, analytics, achievements, notifications, reports, activity logs, and settings.

Automated viewports include desktop/mobile Chromium plus explicit 1440, 1024, 768, 480, and 360 pixel overflow checks on representative pages.

## Verified behavior

- Dark design tokens, cards, controls, focus rings, disabled states, dialogs, pagination, and responsive overflow share a common foundation.
- Page-level horizontal overflow is absent in the automated matrix.
- Tables remain inside controlled scrolling containers and long names/emails/text wrap safely.
- Public mobile navigation supports expanded state, Escape close, and focus restoration.
- Dialogs move focus inside, trap Tab navigation, close through existing Escape behavior, restore focus, and lock background scrolling.
- Login/registration validation keeps values and focuses the first invalid field.
- Data-driven pages expose loading, error, retry, empty, and success/content states.
- Hydration produces no unexpected 4xx/5xx responses, console errors, page errors, or CSP violations.
- Representative pages expose titles, main landmarks, headings, labels, accessible button names, progressbar values, and administrator navigation.
- Reduced-motion mode preserves functionality.

## Safe rendering

Shared escaping is tested against tags, ampersands, quotes, apostrophes, script-like text, long strings, and Unicode. Page modules use `textContent`/DOM creation where practical; remaining legacy HTML templates escape dynamic fields. A complete mechanical `innerHTML` rewrite was intentionally avoided to preserve behavior.

## Remaining limitations

- Browser automation currently covers Chromium, not Firefox/WebKit.
- Automated semantic checks are not a substitute for NVDA, VoiceOver, or TalkBack review.
- Some older pages retain page-specific modal/toast/rendering helpers.
- Real screenshots and a short portfolio demo must be captured manually with synthetic data.

## Manual verification

Use `docs/FRONTEND_QA_CHECKLIST.md` and `docs/MANUAL_QA_CHECKLIST.md`. Pay particular attention to real touch devices, screen-reader announcements, chart resizing, slow networks, long translated content, and optional Cloudinary/avatar behavior.
