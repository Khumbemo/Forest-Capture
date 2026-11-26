# Changelog

All notable changes to Forest Capture are documented here. The format
loosely follows [Keep a Changelog](https://keepachangelog.com/).

This file starts now; the entries under **3.1.0** below summarize the
project's history up to this point from its merged pull requests, not a
changelog kept live during that work.

## [Unreleased]

### Added
- **Invasive Species Monitoring**, a new survey tool alongside Quadrat/
  Transect/Herbarium: logs a species (with autocomplete), observation
  date/observer, GPS location and habitat type, an infestation
  assessment (area + unit, cover class, growth stage, spread risk), a
  control/management record (status, method, treatment date), notes,
  and an optional photo (same capture/upload pipeline as the Herbarium
  tool). Fully wired into the rest of the app: a Toolbar entry point,
  the Data and Edit Data screens' generic record list/editor/delete
  flow, the HTML survey report, and its own XLSX export sheet
  (`Invasive_Species`, alongside the existing `Prism_Sweeps`). Every
  user-facing message is translated across all 9 supported languages,
  consistent with the i18n coverage work in #27. (#28)
- Found, while adding the new tool's translations, that most of the
  ~24 `aria-label`s added in the accessibility pass (#26) — "Edit
  voucher", "Satellite map layer", "Send message", and so on — had
  never actually gotten a dictionary entry, even though
  `walkDOMAndTranslate()` was already set up to translate them (#27):
  the mechanism worked, but almost nothing had been added for it to
  translate, so those labels were silently stuck in English in every
  language. Added the missing ~32 translations. (#28)
- i18n coverage for dynamically-generated content. Every `toast()` call
  across the app (~140 call sites, ~100 distinct messages) now routes
  through the translation layer and has real dictionary entries in all
  9 supported languages — previously toast messages were raw JS string/
  template literals that bypassed `t()` entirely, so switching languages
  translated static labels but left every save/delete/error/export
  notification in English. The `t()` engine itself gained `{placeholder}`
  substitution (`t('Quadrat #{n} saved', { n: q.number })`) so a message
  built from a live value — a record number, a filename, a percentage —
  can be translated without translating the value itself. Also found
  and fixed ~10 pre-existing `t()` calls (in export.js, analytics.js's
  regen-status chart, the connectivity banner) that were silently
  non-functional because no dictionary entry existed for them, and
  extended `walkDOMAndTranslate()` to translate `aria-label` the same
  way it already does `title`/`placeholder`, so the accessible names
  added in the accessibility pass are translatable too. Confirm/prompt/
  alert dialog body text (the Germplasm validation warnings, delete
  confirmations, etc.) is a deliberately separate scope boundary not
  covered here. (#27)
- Accessibility pass on the app's shared interaction primitives: the
  toast notification region now announces to screen readers
  (`role="status"`/`aria-live="polite"`); the custom confirm/prompt/alert
  dialogs (used everywhere `window.confirm`/`prompt`/`alert` would
  otherwise appear) now expose `role="alertdialog"`/`aria-modal="true"`
  with their message wired via `aria-describedby`, trap Tab focus inside
  the dialog while open, and restore focus to whatever triggered them on
  close; and roughly two dozen icon-only buttons across the app (Settings,
  map layer/locate/waypoint controls, GPS-fill, edit/delete/remove icons
  in Quadrat, Transect, Prism, Herbarium, Germplasm, Media and Waypoints)
  now have `aria-label`s, where previously only a mouse-hover `title` (or
  nothing) identified them. (#26)
- Soft data-validation warnings on the Germplasm tool (ICFRE/NBPGR/ISTA),
  surfaced as a confirm-to-proceed prompt rather than a hard block: ISTA
  purity components (Pure Seed + Other Crop + Weed + Inert) not summing to
  ~100% as ISTA Rules require, ISTA germination categories exceeding 100%
  combined, any percentage field outside 0–100%, an out-of-range
  latitude/longitude, and a seed-lot/accession/label number that duplicates
  an existing record for the same body. (#25)

### Fixed
- Three more scientific-accuracy/data-integrity bugs found during a full
  audit of every tool's formulas and protocols against forestry/ecology
  conventions: the Prism Sweep tool's DBH field was labeled unit-aware
  (cm/in) but never actually converted, so an imperial-mode entry was
  stored as if it were metric; the Clinometer's distance field had the
  same gap, and its height result was always suffixed "m" regardless of
  the active unit system; and the canopy-cover photo tool's computed Leaf
  Area Index (LAI) was calculated but had no field to be saved into, so it
  was silently discarded on every save instead of persisting with the
  survey. Also fixed the Clinometer's "Apply to Species" button, which
  reported success without ever writing the computed height anywhere.
  Every other audited formula and protocol (Shannon-Wiener, Simpson's,
  Pielou's, Margalef's, Fisher's alpha, Chao1, Chave et al. 2014 AGB,
  Reineke's SDI, basal-area-factor prism sampling, line-intercept cover,
  two-angle clinometer trigonometry, CBI scoring, herbarium voucher
  fields) checked out against the published methods. (#24)

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
