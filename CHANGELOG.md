# Changelog

All notable changes to Forest Capture are documented here. The format
loosely follows [Keep a Changelog](https://keepachangelog.com/).

This file starts now; the entries under **3.1.0** below summarize the
project's history up to this point from its merged pull requests, not a
changelog kept live during that work.

## [Unreleased]

Nothing yet.

## [3.1.0]

### Added
- SylvX, an AI field assistant with three tiers: a cloud assistant
  (Gemini, function-calling) that proposes data edits but never writes
  one without explicit user confirmation; a fully offline rule-based
  app guide; and an optional on-device model (WebLLM) for advisory chat
  with zero network dependency. (#7)
- **Edit Data** tool: a generic list/edit/delete UI for every record
  type across every survey, plus the ability to use any tool directly
  without first creating a survey (one is auto-provisioned on first
  save). (#18)
- Live-switchable UI language (9 languages) with no app restart
  required. (#20)
- `tests/calculation.test.js` and `tests/analytics-worker.test.js`
  regression tests. (#16)

### Fixed
- A brand-new anonymous session's data could become silently
  unreachable the moment the app reloaded, due to a storage key
  resolved and cached before the session's real ID was established.
  High-impact for a field app, where reload/relaunch between sessions
  is routine. (#21)
- Three scientific-accuracy bugs: imperial-mode quadrat area was
  stored unconverted, inflating every per-hectare metric by ~10.76×;
  Simpson's index was mislabeled; and AGB silently mixed two different
  biomass formulas depending on whether height was recorded. (#17)
- The Gemini API key wasn't persisted across reloads, and a GPS fix
  exactly at the equator (latitude `0`) was treated as "no signal" at
  7 call sites due to a truthiness check. (#16)
- Five bugs found in a full-codebase review: a cross-survey message
  leak in the AI chat, a multi-device sync gap in survey storage, a
  CSV-export quoting bug, a race condition in the analytics worker,
  and a silent failure path in the audio recorder's web fallback.
  Also fixed a missing UI element that had made the species-
  accumulation chart dead code since it was written. (#15)
- A race condition in the offline AI model loader that could trigger
  two concurrent multi-hundred-MB model downloads. (#13)
- Two data-corruption bugs in the AI chat: a malformed-forever chat
  history if a write was left unconfirmed, and a cross-survey response
  leak during a fast survey switch. (#12)
- Firebase now loads lazily; an unreachable CDN can no longer break
  the rest of the app. (#10)
- No visible keyboard-focus indicator outside form inputs, and
  `--text-muted` failing WCAG AA contrast in both themes. (#19)
- A stored/reflected XSS gap in the shared HTML-escaping utility
  (missing `"`/`'` escaping) and in the original AI chat
  implementation. (#11, #6)

### Changed
- Leaflet (~1MB) now loads only when the Map screen is opened, instead
  of unconditionally on every page load. (#22)
- Dashboard's Aspect & Slope tile split into two tiles matching the
  other dashboard cards; the AI Chat input no longer renders behind
  the bottom nav bar. (#18)

### Security
- `puppeteer` and `sharp` bumped to resolve `npm audit` findings.
  (`@capacitor/cli`'s own finding is a known, deliberately deferred
  exception — see below.) (#14)

### Internal
- `node_modules`, `.idea`, and the generated `www/` build output are
  no longer tracked in git. (#9, #6)
- e2e tests wired into CI; a long-standing `cap` CLI permission bug
  that had failed every CI build was fixed. (#11, #8)

## Known, deliberately deferred

- **`LICENSE`** is currently "all rights reserved." Blocks any
  open-source publication path until changed on purpose.
- **`@capacitor/cli`**'s `tar` dependency is the one remaining `npm
  audit` finding. Fixing it requires an Android Gradle Plugin + CI JDK
  upgrade, which risks the native Android build — left as a documented
  risk rather than rushed. See PR #14's description for the full
  investigation.
