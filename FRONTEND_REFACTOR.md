# QuizMaster Pro — Frontend Refactor Review

Review date: 2026-08-05  
Scope: All EJS views, browser JavaScript, and CSS under `client/`.  
Constraint: Review only; no source files were changed.

## Executive summary

QuizMaster Pro uses server-rendered EJS pages with page-specific vanilla JavaScript and CSS. This keeps runtime dependencies low, but each page has evolved into a small independent application. The same cards, tables/list grids, modal mechanics, pagination controls, filter bars, request handling, state transitions, formatting helpers, and CSS foundations are repeatedly implemented.

The duplication is substantial:

- **67 direct `fetch` calls** are distributed across page scripts.
- Pagination rendering is independently implemented in at least seven scripts.
- Modal open/close, backdrop, Escape-key, body-scroll, and ARIA behavior is repeated across nearly every administrator page.
- Loading/error/content/empty transitions are repeated in user and admin modules.
- The CSS tree contains approximately **22,695 lines**; most page stylesheets redefine `:root`, reset rules, `body`, `.hidden`, cards, state panels, filters, pagination, and modals.
- Existing `client/js/api.js`, `auth.js`, and `ui.js` are not a coherent shared layer. `api.js` currently contains page-specific authentication-form logic rather than a reusable API client.

The recommended approach does not require React/Vue or a full rewrite. Build a small ES-module component system around EJS partials, DOM factories/controllers, and layered CSS. Migrate one page family at a time while retaining the existing server-rendered architecture.

## Duplication findings and reusable components

### FR-001 — Summary/stat cards are repeated across most dashboard pages

**Examples**

- `client/views/history.ejs:78`
- `client/views/achievements.ejs:73`
- `client/views/admin/questions.ejs:106`
- `client/views/admin/users.ejs:93`
- `client/views/admin/attempts.ejs:94`
- `client/views/admin/categories.ejs:100`
- `client/views/admin/notifications.ejs:114`
- `client/views/admin/activity-logs.ejs:130`
- `client/views/admin/analytics.ejs:161`
- `client/views/dashboard.ejs:829`
- `client/views/profile.ejs:344`

**Duplication**

Cards repeat an icon/label/value/supporting-text structure but use multiple names: `summary-card`, `stat-card`, `overview-card`, `weekly-summary-card`, `daily-challenge-meta-card`, and plain `card`. Each stylesheet then recreates spacing, borders, typography, hover states, and breakpoints.

**Suggested component**

Create an EJS partial plus a DOM factory:

```text
client/views/partials/components/stat-card.ejs
client/js/components/stat-card.js
client/css/components/stat-card.css
```

Proposed interface:

```js
createStatCard({ icon, label, value, detail, tone, href });
```

Use modifier classes such as `stat-card--success` rather than page-specific component copies. Keep complex domain cards (quiz question, result review, daily challenge) separate.

**Priority:** High  
**Estimated effort:** 16–24 hours

### FR-002 — Content/list cards use repeated unsafe HTML assembly

**Examples**

- Achievement cards: `client/js/achievements.js:125`
- Admin question rows: `client/js/admin/questions.js:226`
- Admin user rows: `client/js/admin/users.js:182`
- Admin attempt rows: `client/js/admin/attempts.js:229`
- Admin notification cards: `client/js/admin/notifications.js:198`
- Admin activity rows: `client/js/admin/activity-logs.js:204`
- Category cards: `client/js/admin/categories.js:160`
- Dashboard/admin recent rows: `client/js/admin/dashboard.js:273`, 374, and 455

**Duplication**

Every script creates an element, assigns a class, builds a large `innerHTML` template, attaches data attributes, then wires actions. Escaping is inconsistently applied and each page owns avatar, badge, date, and action-button markup.

**Suggested components**

Create small DOM factories rather than one universal card:

```text
client/js/components/avatar.js
client/js/components/badge.js
client/js/components/action-menu.js
client/js/components/empty-message.js
client/js/components/entity-row.js
```

Use DOM APIs and `textContent` for dynamic values. Feature modules should compose primitives into `createQuestionRow`, `createUserRow`, etc.; do not force unrelated entities through a configuration-heavy generic card renderer.

**Priority:** Highest (security and maintenance)  
**Estimated effort:** 24–40 hours incrementally

### FR-003 — Tables and responsive list grids are independently implemented

**Examples**

- Native leaderboard table: `client/views/leaderboard.ejs:95`
- Native activity table: `client/views/admin/activity-logs.ejs:249`
- CSS-grid question table: `client/views/admin/questions.ejs:243`
- CSS-grid user table: `client/views/admin/users.ejs:201`
- Attempt list/table: `client/views/admin/attempts.ejs`
- Admin analytics top-user table: `client/views/admin/analytics.ejs:454`
- Dashboard recent-user/attempt tables: `client/views/admin/dashboard.ejs:528`

**Duplication**

Headers, row layouts, empty states, action columns, responsive stacking, and hover/focus behavior are recreated with incompatible class names. Some use semantic `<table>`, others use articles/divs with visual headers, making accessibility and mobile behavior inconsistent.

**Suggested component**

Define two explicit patterns:

1. `DataTable` for truly tabular data, using semantic `<table>` and responsive overflow.
2. `EntityList` for card-like/mobile rows with actions.

```text
client/views/partials/components/data-table.ejs
client/js/components/data-table.js
client/css/components/data-table.css
client/css/components/entity-list.css
```

The JavaScript controller should handle row replacement and empty state, not own entity-specific cell content.

**Priority:** High  
**Estimated effort:** 24–36 hours

### FR-004 — Modal markup and mechanics are repeated across administrator pages

**Examples**

- Questions edit/delete: `client/views/admin/questions.ejs:282` and 465
- Users details/role/status: `client/views/admin/users.ejs:234`, 338, and 369
- Attempts details/delete: `client/views/admin/attempts.ejs:238` and 328
- Categories rename/delete: `client/views/admin/categories.ejs:232` and 301
- Notifications compose/delete: `client/views/admin/notifications.ejs:253` and 385
- Activity details: `client/views/admin/activity-logs.ejs:302`
- Settings reset: `client/views/admin/settings.ejs:549`
- Profile edit: `client/views/profile.ejs:638`

**Duplication**

Each modal repeats backdrop, panel, heading, close button, actions, ARIA attributes, and hidden state. Scripts independently manage `aria-hidden`, `.modal-open`, backdrop clicks, close selectors, and Escape handling. Focus trapping and focus restoration are generally absent or inconsistent.

**Suggested component**

Create:

```text
client/views/partials/components/modal.ejs
client/js/components/modal-controller.js
client/css/components/modal.css
```

Proposed controller:

```js
const modal = createModalController(element, {
  initialFocus,
  onOpen,
  onClose,
});

modal.open();
modal.close();
```

It should centralize ARIA state, body scroll lock, Escape, backdrop behavior, focus trap, focus restoration, and nested/stacked modal policy.

**Priority:** Highest (accessibility and duplication)  
**Estimated effort:** 20–28 hours

### FR-005 — Confirmation modals are duplicated variants of one interaction

**Examples**

- Delete question: `client/views/admin/questions.ejs:465`
- Delete category: `client/views/admin/categories.ejs:301`
- Delete attempt: `client/views/admin/attempts.ejs:328`
- Delete notification: `client/views/admin/notifications.ejs:385`
- Change user role/status: `client/views/admin/users.ejs:338` and 369
- Reset settings: `client/views/admin/settings.ejs:549`

**Duplication**

All ask for confirmation, display contextual text, expose cancel/confirm actions, show an inline error, disable the confirm button, and close after success. Markup and state logic are copied for each entity/action.

**Suggested component**

Build `ConfirmDialog` on the shared Modal controller:

```js
await confirmDialog.open({
  title,
  message,
  confirmLabel,
  tone: "danger",
  onConfirm,
});
```

Use one reusable modal per page or one global dialog in the authenticated shell. Preserve explicit confirmation language for destructive actions.

**Priority:** High  
**Estimated effort:** 8–12 hours after FR-004

### FR-006 — Pagination rendering and events are copied across seven scripts

**Examples**

- `client/js/admin/questions.js:302`
- `client/js/admin/users.js:291`
- `client/js/admin/attempts.js:306`
- `client/js/admin/notifications.js:288`
- `client/js/admin/activity-logs.js:278`
- `client/js/history.js:244`
- `client/js/notifications.js:271`

**Duplication**

Each implementation sets page/total state, renders `Page X of Y`, disables previous/next, toggles visibility, and registers page-change handlers. Element IDs differ (`previousButton`, `previousPageButton`, prefixed activity IDs), making reuse harder.

**Suggested component**

```text
client/views/partials/components/pagination.ejs
client/js/components/pagination.js
client/css/components/pagination.css
```

Proposed API:

```js
const pager = createPagination(element, {
  onPageChange(page) {},
});

pager.render({ page, totalPages, hasPreviousPage, hasNextPage });
pager.setLoading(true);
```

Use `data-role` selectors inside the component rather than page-global IDs. Consider URL synchronization so page/filter state survives refresh and back navigation.

**Priority:** Highest  
**Estimated effort:** 12–18 hours

### FR-007 — Filter bars repeat markup, query building, and state reset behavior

**Examples**

- History category filter: `client/views/history.ejs:62`
- Achievement filters: `client/views/achievements.ejs:137`
- Admin questions: `client/views/admin/questions.ejs:163`
- Admin users: `client/views/admin/users.ejs:144`
- Admin attempts filter controls and `client/js/admin/attempts.js:319`
- Admin activity logs: `client/views/admin/activity-logs.ejs:181`
- Admin notification search/query: `client/js/admin/notifications.js:328`
- Admin achievement query: `client/js/admin/achievements.js:564`

**Duplication**

Pages independently maintain filter state, build `URLSearchParams`, reset page to one, bind selects/search, debounce search, and reload data. Three scripts define their own `debounce`; others manually store timeout IDs.

**Suggested components/utilities**

```text
client/views/partials/components/filter-bar.ejs
client/js/components/filter-controller.js
client/js/utils/debounce.js
client/js/utils/url-state.js
client/css/components/filter-bar.css
```

`FilterController` should serialize named form controls, debounce text fields, emit a normalized change event, and optionally sync with the URL. Feature scripts retain ownership of allowed filters and API mapping.

**Priority:** High  
**Estimated effort:** 20–30 hours

### FR-008 — `fetch` wrappers are missing despite 67 direct request sites

**Examples**

- Quiz: `client/js/quiz.js:187` and 701
- Dashboard categories: `client/js/dashboard.js:221`
- Notifications: `client/js/notifications.js:304`, 349, 402, and 446
- Profile: `client/js/profile.js:901`, 1107, 1190, and 1349
- Admin questions: `client/js/admin/questions.js:345`, 575, and 657
- Admin users: `client/js/admin/users.js:331`, 397, 516, and 599
- Admin attempts: `client/js/admin/attempts.js:346`, 493, and 619

**Duplication**

Every request repeats credentials, Accept/Content-Type headers, JSON parsing, `response.ok`, `data.success`, error message fallback, and often 401 redirection. Non-JSON responses are handled by several different `parseJsonResponse` implementations. Abort/cancellation and network timeout behavior are absent.

**Suggested component**

Replace the current page-specific `client/js/api.js` with a true ES-module client:

```js
api.request(path, {
  method = "GET",
  body,
  query,
  signal,
  responseType = "json",
});

api.get(path, options);
api.post(path, body, options);
api.patch(path, body, options);
api.delete(path, options);
```

Define `ApiError` with status/code/details. Centralize credentials, JSON validation, 401 handling, CSRF header support, and optional AbortController timeouts. Keep CSV/blob downloading as an explicit response type.

**Priority:** Highest  
**Estimated effort:** 24–36 hours including migration tests

### FR-009 — Unauthorized handling and logout are independently implemented

**Examples**

- Dashboard unauthorized handler: `client/js/dashboard.js:89`
- Daily challenge: `client/js/daily-challenge.js:329` and 383
- Quiz: `client/js/quiz.js:197`, 227, and 715
- Dashboard logout: `client/js/dashboard.js:712`
- History logout: `client/js/history.js:331`
- Leaderboard logout: `client/js/leaderboard.js:374`
- Admin dashboard logout: `client/js/admin/dashboard.js:724`

**Duplication**

Pages redirect differently, clear different localStorage keys, and produce different failure messages. A 401 can be treated as an ordinary page error in scripts lacking explicit checks.

**Suggested component**

Create `client/js/services/session.js`:

```js
handleSessionExpired();
logout(({ redirectTo = "/login" } = {}));
clearSessionStorage();
```

The shared API client should call `handleSessionExpired` for protected requests. Use one authoritative list/prefix policy for browser storage cleanup.

**Priority:** Highest  
**Estimated effort:** 8–12 hours after FR-008

### FR-010 — Loading/error/content/empty states are reimplemented per page

**Examples**

- Achievements: `client/js/achievements.js:261`
- Admin achievements: `client/js/admin/achievements.js:200`
- Admin activity: `client/js/admin/activity-logs.js:156`
- Admin analytics: `client/js/admin/analytics.js:162`
- Admin attempts: `client/js/admin/attempts.js:139`
- Admin categories: `client/js/admin/categories.js:92`
- Admin notifications: `client/js/admin/notifications.js:157`
- Admin questions: `client/js/admin/questions.js:149`
- Admin users: `client/js/admin/users.js:142`
- Analytics: `client/js/analytics.js:249`
- History: `client/js/history.js:89`
- Notifications: `client/js/notifications.js:41`
- Profile: `client/js/profile.js:109`
- Settings: `client/js/settings.js:95`

**Duplication**

Each page toggles three or four elements in a slightly different order. Some stop timers; some hide content on error; some preserve stale content; some show empty state independently. State names and ARIA live behavior vary.

**Suggested component**

Create a `ViewStateController`:

```js
const viewState = createViewStateController(root, {
  states: ["loading", "content", "empty", "error"],
});

viewState.show("loading");
viewState.show("error", { message });
```

Use a shared EJS state panel and CSS component. Permit feature hooks for cases such as stopping a quiz timer, but centralize visibility and ARIA semantics.

**Priority:** Highest  
**Estimated effort:** 16–24 hours

### FR-011 — Loading indicators have many unrelated visual implementations

**Examples**

- Generic state cards: `client/views/history.ejs:96`
- Leaderboard loading section: `client/views/leaderboard.ejs:55`
- Quiz loading: `client/views/quiz.ejs:35`
- Modal loading: `client/views/admin/users.ejs:259`
- Inline review loading: `client/views/result.ejs:148`
- Report loading: `client/views/admin/reports.ejs:159`
- Dashboard-local loading strings and daily challenge state

**Duplication**

Some pages render spinners, others plain text or bespoke skeletons. Accessible labels, live regions, size, and layout differ.

**Suggested components**

Define:

- `LoadingState` for full panels;
- `InlineSpinner` for buttons/sections;
- `Skeleton` only where layout stability materially helps.

Use `aria-live="polite"`, `aria-busy`, and visually hidden status text consistently.

**Priority:** Medium  
**Estimated effort:** 8–12 hours

### FR-012 — Error panels and form messages are duplicated

**Examples**

- Page errors: `client/views/history.ejs:104`, `achievements.ejs:174`, `notifications.ejs:89`
- Admin state errors: questions/users/attempts/activity/settings views
- Form message helpers in authentication, settings, password reset, notifications, and question administration
- Error rendering functions listed under FR-010

**Duplication**

Errors alternate between state cards, inline form messages, alerts, and `window.alert`. Retry controls and announcements differ. Some scripts interpolate error messages into `innerHTML`; for example `client/js/dashboard.js:660`.

**Suggested components**

Create:

```text
client/views/partials/components/error-state.ejs
client/js/components/alert.js
client/js/components/form-message.js
client/css/components/alert.css
client/css/components/state-panel.css
```

Dynamic messages must use `textContent`. Standardize error, warning, success, and information tones, with optional retry callback.

**Priority:** High  
**Estimated effort:** 12–18 hours

### FR-013 — Empty states duplicate presentation and visibility logic

**Examples**

- History: `client/views/history.ejs:118`
- Achievements: `client/views/achievements.ejs:186`
- Notifications: `client/views/notifications.ejs:124`
- Leaderboard: `client/views/leaderboard.ejs:112`
- Admin questions/users/attempts/categories/notifications/activity pages

**Duplication**

Every list defines its own empty icon/title/text/action and manually decides when to hide pagination/content. Some distinguish “no data” from “no filter matches”; others do not.

**Suggested component**

Create `EmptyState` with icon, title, message, and optional action. Allow two variants: first-use/no-data and filtered-no-results. Integrate it with `ViewStateController` and pagination visibility.

**Priority:** Medium  
**Estimated effort:** 8–12 hours

### FR-014 — Buttons independently manage pending/loading labels

**Examples**

- Quiz submit: `client/js/quiz.js:684`
- Question save/delete flows
- User role/status actions
- Notification compose/delete
- Profile avatar upload/delete
- Settings save/password change/reset
- Auth forms have `setButtonLoading` in `client/js/api.js:48`

**Duplication**

Scripts save or reconstruct labels, set `disabled`, change text, and restore state in `finally`. Failures can leave buttons with the wrong label; accessible busy state is not standardized.

**Suggested component**

Create `setButtonPending(button, pending, { pendingLabel })`, preserving original content in a WeakMap and setting `aria-busy`. A `withPendingButton(button, task, options)` helper can guarantee restoration.

**Priority:** Medium  
**Estimated effort:** 6–10 hours

### FR-015 — Date, number, HTML escaping, and visibility helpers are duplicated

**Examples**

- `escapeHtml` in most admin scripts, including `client/js/admin/questions.js:108` and `admin/users.js:83`
- `formatDate` in profile/history/settings/admin scripts
- `parseJsonResponse` in quiz/result/analytics/profile/notifications/admin scripts
- `toggleElement` or equivalent in at least ten scripts

**Duplication**

Formatting varies by page and HTML escaping creates a false sense of safety when large templates are still interpolated. Visibility helpers differ between `hidden` class, native `hidden` property, and ARIA state.

**Suggested utilities**

```text
client/js/utils/date.js
client/js/utils/number.js
client/js/utils/dom.js
```

Prefer DOM creation and `textContent`; retain `escapeHtml` only for narrowly reviewed unavoidable string templates. `setVisible` should update class/property/ARIA according to one documented policy.

**Priority:** High  
**Estimated effort:** 12–18 hours

### FR-016 — CSS design tokens are copied into nearly every page stylesheet

**Examples**

- `client/css/dashboard.css:1`
- `client/css/analytics.css:6`
- `client/css/profile.css:1`
- `client/css/history.css:1`
- `client/css/notifications.css:1`
- Every `client/css/admin/*.css` file begins with a local `:root`
- Existing shared tokens: `client/css/variables.css:1`, loaded only by a few public/auth views

**Duplication**

Colors, surfaces, borders, shadows, radii, and text tones are repeatedly defined and already differ slightly. Changing the brand or contrast policy requires editing dozens of files.

**Suggested CSS layer**

Expand `variables.css` into a shared token system:

```css
@layer tokens, reset, base, components, utilities, pages;
```

Define semantic tokens (`--color-surface`, `--color-danger`, `--space-4`, `--radius-card`, `--shadow-card`) once. Page styles should consume semantic tokens and define only genuine local values.

**Priority:** Highest  
**Estimated effort:** 20–32 hours

### FR-017 — CSS reset, body, typography, and utility rules are repeated

**Examples**

- Almost every page stylesheet defines `*`, `body`, and `.hidden` near its beginning.
- Admin page resets begin at approximately line 17 in achievements, activity logs, analytics, attempts, categories, dashboard, notifications, questions, reports, settings, and users.
- `.hidden` is independently defined in most stylesheets.

**Duplication**

Box sizing, margins, font stacks, backgrounds, min-height, focus behavior, and visibility are page-local. Load order and selector differences can produce subtle regressions.

**Suggested CSS files**

```text
client/css/base/reset.css
client/css/base/typography.css
client/css/base/layout.css
client/css/utilities/visibility.css
client/css/utilities/accessibility.css
```

Load them from a shared EJS head partial. Remove local resets only after visual regression comparison.

**Priority:** Highest  
**Estimated effort:** 16–24 hours

### FR-018 — Component CSS for cards, states, filters, pagination, and modals is copied

**Evidence**

The audit found 270 common-selector occurrences across CSS for `summary-card`, `state-card`, `pagination`, `modal-backdrop`, `modal-panel`, `modal-actions`, `filter-group`, `table-wrapper`, `.hidden`, `:root`, reset, and body rules.

Representative duplicates:

- Summary cards: `client/css/admin/questions.css:268`, users `:237`, attempts `:237`, notifications `:278`, activity logs `:301`
- State cards: questions `:518`, users `:503`, attempts `:455`, notifications `:590`, activity logs `:622`
- Pagination: questions `:502`, users `:491`, attempts `:443`, notifications `:637`, history `:423`
- Modal backdrop/panels: questions `:570`, users `:550`, attempts `:503`, notifications `:668`, activity logs `:705`

**Suggested CSS components**

```text
client/css/components/card.css
client/css/components/state-panel.css
client/css/components/filter-bar.css
client/css/components/data-table.css
client/css/components/pagination.css
client/css/components/modal.css
client/css/components/button.css
client/css/components/form.css
```

Use BEM-like modifiers or data attributes for variants. Keep page CSS for layout composition and domain-specific visuals only.

**Priority:** Highest  
**Estimated effort:** 40–64 hours incrementally

### FR-019 — Authentication/password pages repeat the same card and form shell

**Examples**

- Login auth card: `client/views/login.ejs:80`
- Registration auth card: `client/views/register.ejs:62`
- Forgot password: `client/views/forgot-password.ejs:19`
- Reset password: `client/views/reset-password.ejs:19`
- Resend verification: `client/views/resend-verification.ejs:22`
- Verify email: `client/views/verify-email.ejs:22`

**Duplication**

These pages repeat complete document shells, branding, card header, form messaging, password toggles, and navigation links. `client/js/api.js` mixes old login/register behavior with newer separate `login.js` and `register.js`, creating unclear ownership and probable dead/legacy code paths.

**Suggested components**

- `auth-layout.ejs`
- `auth-card.ejs`
- `form-field.ejs`
- shared password-toggle and form-message controllers

Audit which authentication script is actually loaded on each page, rename the reusable API module, and remove dead code only after usage tests.

**Priority:** High  
**Estimated effort:** 16–24 hours

### FR-020 — Page layout/head/navigation markup lacks consistent composition

**Examples**

- Every view begins with a complete HTML/head/body document.
- User pages hand-code headers/navigation; dashboard alone is 1,032 lines.
- Admin views repeat administrator shell/navigation and asset loading.
- Only `client/views/partials/navbar.ejs` and `footer.ejs` exist, and usage is limited.

**Duplication**

Branding, metadata, CSS/script includes, user controls, navigation links, and accessibility landmarks are copied. CSP nonces, cache-busting, a new navigation item, or shared component CSS would require widespread edits.

**Suggested layouts**

```text
client/views/layouts/public.ejs
client/views/layouts/auth.ejs
client/views/layouts/user.ejs
client/views/layouts/admin.ejs
client/views/partials/head.ejs
client/views/partials/scripts.ejs
```

If layout middleware is not desired, use nested EJS partials and explicit locals for title, description, styles, scripts, and active navigation.

**Priority:** High  
**Estimated effort:** 24–40 hours

### FR-021 — Celebration overlays duplicate animation/modal infrastructure

**Examples**

- `client/js/achievement-celebrations.js`
- `client/js/result-celebrations.js`
- `client/js/daily-challenge-celebration.js`
- Related overlay styling is concentrated in `client/css/result.css`

**Duplication**

Each feature manages sessionStorage “shown” keys, overlay visibility, dynamic markup, animation lifecycle, and cleanup. Achievement celebrations additionally manage confetti. They are similar but not identical enough for one generic modal.

**Suggested abstraction**

Create a shared `CelebrationOverlay` controller for lifecycle, accessibility, storage key, close/timeout, and reduced-motion handling. Keep achievement/level/daily content and animation strategies as adapters.

**Priority:** Low  
**Estimated effort:** 12–18 hours

### FR-022 — Filter/search request races are not centrally controlled

**Examples**

- Questions search timeout: `client/js/admin/questions.js:712`
- Users search timeout: `client/js/admin/users.js:655`
- Attempts search timeout: `client/js/admin/attempts.js:673`
- Notifications debounce: `client/js/admin/notifications.js:614`
- Activity debounce: `client/js/admin/activity-logs.js:493`
- Achievements debounce: `client/js/admin/achievements.js:643`

**Duplication**

Debounce reduces requests, but previous requests are not consistently aborted. A slower old response can overwrite a newer filter result. Each script separately tracks loading and timeout state.

**Suggested utility**

Add `createLatestRequest()` around AbortController:

```js
const loadLatest = createLatestRequest(async ({ signal }) => {
  return api.get(path, { query, signal });
});
```

Integrate it with FilterController and ViewStateController so aborted requests do not show errors or replace current content.

**Priority:** High  
**Estimated effort:** 8–12 hours after FR-008

## Proposed no-framework component architecture

```text
client/
  js/
    core/
      api-client.js
      session.js
      view-state.js
    components/
      alert.js
      avatar.js
      badge.js
      button.js
      confirm-dialog.js
      data-table.js
      empty-state.js
      filter-controller.js
      modal-controller.js
      pagination.js
      stat-card.js
    utils/
      date.js
      debounce.js
      dom.js
      number.js
      url-state.js
    pages/
      admin/
      user/
  css/
    tokens.css
    base/
    components/
    utilities/
    pages/
  views/
    layouts/
    partials/
      components/
```

Use native ES modules (`type="module"`) or a small bundler only if browser support/deployment requirements demand it. The goal is reusable boundaries, not introducing a framework for its own sake.

## Component API principles

- Components own their internal selectors through `data-role`, not globally unique page IDs.
- Components receive DOM nodes or safe primitive data; dynamic text is assigned with `textContent`.
- Page modules retain domain/API orchestration.
- Every interactive component exposes teardown when it registers document/window listeners.
- Modal and state components own ARIA behavior and focus, not only CSS visibility.
- CSS components use semantic tokens and documented modifiers.
- EJS partials render stable initial markup; JavaScript enhances rather than reconstructs entire pages where practical.
- Avoid one generic “Card” or “Table” configuration that attempts to model every screen.

## Recommended migration sequence

### Stage 1 — Shared foundation

1. Add shared tokens, reset, visibility, buttons, and form primitives.
2. Introduce ES-module utility structure.
3. Implement API client, session handling, `ApiError`, formatting, debounce, and latest-request helpers.
4. Add unit tests for pure utilities and browser tests for API error/401 handling.

### Stage 2 — Page-state components

1. Implement ViewStateController, LoadingState, ErrorState, and EmptyState.
2. Migrate history and notifications first because they exercise all four states with limited domain complexity.
3. Migrate admin activity logs, then admin questions/users/attempts.

### Stage 3 — Pagination and filters

1. Implement Pagination and FilterController.
2. Standardize API pagination fields with the backend refactor.
3. Add URL synchronization and AbortController race protection.
4. Migrate all administrator list pages.

### Stage 4 — Modal family

1. Implement Modal controller with focus/accessibility tests.
2. Implement ConfirmDialog.
3. Migrate simple delete confirmations first, then form/detail modals.
4. Remove duplicated modal CSS only after all variants are represented.

### Stage 5 — Cards, tables, and layouts

1. Extract stat cards and entity primitives.
2. Standardize DataTable versus EntityList semantics.
3. Introduce user/admin/auth layouts and shared head/scripts.
4. Migrate CSS page by page with visual regression screenshots.

### Stage 6 — Specialized cleanup

1. Consolidate authentication form shell/scripts.
2. Consolidate celebration overlay lifecycle.
3. Delete dead helpers and CSS only after repository-wide usage checks.

## Testing strategy

- API client tests: JSON, non-JSON, 204, validation errors, 401, 403, 429, network failure, abort, timeout, blob download.
- ViewState tests: exactly one active state, correct ARIA, retry behavior, stale-content policy.
- Modal tests: initial focus, tab trap, Escape, backdrop, nested policy, focus restoration, body scroll lock.
- Pagination tests: boundaries, disabled controls, page event, hidden single-page behavior.
- Filter tests: serialization, reset-to-page-one, debounce, URL restore, stale request cancellation.
- DOM factory tests with hostile HTML strings to prove text is not interpreted as markup.
- Accessibility checks for cards, tables, live regions, dialogs, labels, and keyboard navigation.
- Visual regression snapshots for user/admin page families before deleting duplicate CSS.
- Contract tests ensuring each migrated page uses the same API fields and behavior.

## Expected outcome

The refactor should substantially reduce repeated JavaScript and CSS while improving security, accessibility, and behavioral consistency. The highest-value first steps are the API/session layer, view-state controller, pagination/filter components, modal controller, and shared CSS foundations. These abstractions recur across the largest number of pages and make later card/table/layout consolidation safer.
