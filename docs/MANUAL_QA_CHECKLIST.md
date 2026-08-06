# Manual QA checklist

Use synthetic accounts and a disposable local MongoDB replica set.

## Authentication

- [ ] Register, verify, login, restore a session, and logout.
- [ ] Exercise forgotten-password/reset, expiry, invalid token, and reuse behavior.
- [ ] Change password and confirm the old session fails while the replacement works.
- [ ] Disable/reactivate a test account and confirm old sessions stay invalid.

## User experience

- [ ] Dashboard loads categories, daily challenge, rank, achievements, and notifications.
- [ ] Start/submit a standard quiz; verify result, XP, counters, history, and replay safety.
- [ ] Complete a daily challenge once and confirm a duplicate cannot award again.
- [ ] Review result ownership using a second synthetic user.
- [ ] Verify leaderboard tie display, analytics charts, achievements, and notification read/delete.
- [ ] Update profile/settings, password, and optional avatar.

## Administrator

- [ ] Dashboard and every navigation item loads with administrator context.
- [ ] Create/edit/search/filter/delete a safe unused question.
- [ ] Rename a category and verify historical/category consistency.
- [ ] Search/filter users; safely test role/status changes and own-admin protection.
- [ ] View and delete a disposable attempt according to current rules.
- [ ] Review analytics and achievement details.
- [ ] Send a synthetic notification with a safe internal path; verify recipient groups.
- [ ] Export every report and inspect UTF-8/formula-safe cells.
- [ ] Filter activity logs and update/reset disposable platform settings.
- [ ] Confirm a regular user cannot load any administrator page or API.

## Responsive and accessibility

- [ ] Check 1440, 1024, 768, 480, and 360 pixel widths.
- [ ] Confirm no page-level horizontal scrolling and usable table/modal overflow.
- [ ] Complete representative flows with keyboard only.
- [ ] Confirm focus visibility, modal trap/Escape/restore, mobile menu, labels, headings, and live feedback.
- [ ] Enable reduced motion and test a quiz/modal/navigation flow.
- [ ] Perform screen-reader basics on login, dashboard, quiz, result, settings, admin questions, and users.

## Resilience and content

- [ ] Test empty collections, long names/emails/questions, Unicode, and script-like display text.
- [ ] Test slow/offline network and representative 400, 401, 403, 404, 409, 429, and 500 responses.
- [ ] Confirm loading states finish, error messages are useful, and retry actions recover.
- [ ] Confirm browser console has no unexpected errors or CSP violations.
- [ ] Confirm no raw API error, secret, token, stack, or correct answer appears early.
