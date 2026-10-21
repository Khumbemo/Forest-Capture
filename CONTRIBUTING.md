# Contributing to Forest Capture

## Getting started

```bash
git clone https://github.com/Khumbemo/Forest-Capture.git
cd Forest-Capture
npm install
npm start          # serves the app at http://localhost:8080
```

No build step is required to run or edit the app locally: `index.html`,
`index.css`, and `src/**` are plain, unbundled ES modules served
directly. `www/` is a generated build artifact (not tracked in git) —
only regenerate it with `npm run prep` when you specifically need the
packaged output (e.g. before opening the Android project).

## Project shape

- **No framework, no bundler.** Vanilla JavaScript, native ES modules,
  one file per feature under `src/modules/` (currently 36 of them —
  `quadrat.js`, `transect.js`, `analytics.js`, `storage.js`, `ai.js`,
  and so on). Keep new code consistent with that: plain modules,
  `import`/`export`, no build-time transform to rely on.
- **Offline-first.** `src/modules/storage.js`'s `idb`/`Store` wrap
  IndexedDB as the local source of truth. Cloud sync (Firebase) and
  the AI assistant's cloud/on-device tiers are optional, additive
  layers loaded lazily via dynamic `import()` — a blocked or
  unreachable CDN must never be able to break the offline-first core.
  If you touch `firebase.js`, `ai.js`, or `ai-offline-llm.js`, preserve
  that isolation.
- **SylvX** (`ai.js`) follows a confirm-before-write rule: the AI
  assistant may propose a data change via function-calling, but a
  write only happens after the user explicitly confirms it on-screen.
  Don't weaken that gate.
- **Escaping.** All dynamic content rendered into HTML must go through
  `esc()` in `ui.js` (escapes `&<>"'`). This was the subject of a real
  XSS fix (see CHANGELOG.md) — don't reintroduce unescaped
  interpolation.

## Before opening a PR

```bash
npx eslint src/                      # 0 errors required (some pre-existing warnings are fine)
npm run test:unit                    # fast, no browser needed
npm run test:e2e                     # Puppeteer-driven, slower
```

CI (`.github/workflows/android-build.yml`) runs on every push and PR
against `main`: unit tests, e2e tests, then a full native Android
build (`./gradlew assembleDebug`) via Capacitor. A PR isn't mergeable
until all three are green — the Android build step in particular
catches packaging regressions that the JS-only tests can't see.

For a UI change, actually drive it in a browser (Playwright or by
hand) before calling it done — the test suites check logic and
rendering details, not that a feature works end-to-end.

## Building for Android

Requires Android Studio, JDK 17, and the Android SDK (API 24–35).

```bash
npm run cap:sync   # rebuilds www/ and syncs the native Capacitor project
npm run cap:open    # opens the project in Android Studio
```

## Commit and PR style

Write commit messages and PR descriptions that explain *why*, not just
*what* — see the git log for the house style: a clear problem
statement, what was tried or ruled out if relevant, and how the fix
was verified. Favor small, focused PRs over bundling unrelated changes.

## Reporting a bug

Open a GitHub issue with: what you did, what you expected, what
happened instead, and whether it reproduces offline, online, or both
(this app's offline/online code paths genuinely differ, so that detail
matters here more than in most apps).
