# Frontend QA Checklist

Use this checklist after frontend changes. Test with representative user and administrator accounts and an isolated local database.

## Viewports and visual quality

- [ ] Check representative pages at 1440, 1024, 768, 480, and 360 pixels wide.
- [ ] Confirm there is no page-level horizontal scrolling or clipped content.
- [ ] Confirm cards, charts, forms, pagination, and action groups reflow cleanly.
- [ ] Confirm tables scroll within their containers on narrow screens.
- [ ] Confirm modals fit the viewport and their content scrolls internally.
- [ ] Test long names, email addresses, question text, and Unicode content.
- [ ] Confirm touch controls are comfortably sized on a phone or touch emulator.

## Keyboard and assistive technology basics

- [ ] Navigate each representative flow using only Tab, Shift+Tab, Enter, Space, and arrow keys.
- [ ] Confirm the focus indicator is always visible and follows a logical order.
- [ ] Confirm the public mobile menu opens from the keyboard, closes with Escape, and restores focus.
- [ ] Confirm each modal moves focus inside, traps focus, closes with Escape, and restores focus to its trigger.
- [ ] Confirm headings and semantic landmarks produce a useful document outline.
- [ ] Confirm every input has an announced label and errors are associated or announced.
- [ ] Confirm buttons, icon controls, pagination, filters, and status badges have meaningful accessible names.
- [ ] Confirm loading, error, success, and toast messages are announced without stealing focus.
- [ ] Check images for meaningful alternative text and hide decorative icons from assistive technology where appropriate.
- [ ] Check key foreground/background combinations with a contrast analyzer.

## Authentication and forms

- [ ] Submit login, registration, reset-password, profile, and settings forms with invalid values.
- [ ] Confirm focus moves to the first invalid field and entered values remain intact.
- [ ] Confirm password visibility controls work and announce their current action.
- [ ] Confirm submit buttons prevent duplicate requests only while a request is pending.
- [ ] Confirm controls are re-enabled after validation, server, or network errors.
- [ ] Confirm success feedback is clear and sensitive values are never rendered or logged.

## User flows

- [ ] Open the landing, authentication, dashboard, daily challenge, history, leaderboard, analytics, achievements, notifications, profile, and settings pages.
- [ ] Start a quiz, select answers, review the confirmation dialog, submit once, and view the result.
- [ ] Simulate a slow quiz submission and confirm a second click cannot submit twice.
- [ ] Simulate a lost response and verify a safe retry does not duplicate the result or XP.
- [ ] Confirm empty history, achievements, analytics, and notifications have useful empty states.
- [ ] Confirm notification interactions and links remain keyboard accessible.

## Administrator flows

- [ ] Open every administrator page and confirm the administrator context and active navigation state are clear.
- [ ] Exercise question, category, user, attempt, achievement, notification, report, activity-log, and settings controls.
- [ ] Confirm table filters, search, sort, pagination, and action menus work at desktop and mobile widths.
- [ ] Open each editor/details/confirmation modal and verify its focus and scroll behavior.
- [ ] Confirm destructive actions identify the affected record and require confirmation.
- [ ] Confirm ordinary users cannot see or access administrator controls.

## Resilience and feedback

- [ ] Test empty datasets and long datasets.
- [ ] Test slow network and offline failures.
- [ ] Test representative 400, 401, 403, 404, 409, 429, and 500 responses.
- [ ] Confirm 401 responses lead to login without a redirect loop and 403 responses remain understandable.
- [ ] Confirm retry actions recover when the API becomes available.
- [ ] Confirm no page remains on an infinite spinner or blank state.
- [ ] Confirm raw stack traces, HTML, and unsafe user-provided markup are never displayed.

## Browser quality

- [ ] Run desktop and mobile Chromium E2E projects.
- [ ] Confirm there are no unexpected console errors, uncaught page errors, or failed hydration requests.
- [ ] Enable reduced-motion preferences and confirm all flows remain usable without distracting animation.
- [ ] Check refresh, back/forward navigation, and repeated page entry for duplicate requests or event handlers.
- [ ] Check charts after viewport resizing and navigation for incorrect sizing or repeated canvases.
