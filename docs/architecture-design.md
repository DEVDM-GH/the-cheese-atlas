# Architecture design — The Cheese Atlas

Standing architecture and coding-practice reference for the project. Phase plans (for example `docs/implementation-plan/implementation-phase-1-interactive-core.md`) describe one release and go stale when that phase ships; this document describes how the project is built and should stay current.

This consolidates and supersedes `docs/development-driving-files/CODING-PRACTICES.txt`, which is retained as a historical note only.

---

## Architectural principles

- **Vanilla HTML/CSS/JS**, zero runtime dependencies, no bundler, no build step. The site is static files served as-is (Vercel or any static host).
- **Progressive enhancement as a rule.** Search and Family/Region chips are the baseline. Matrix, cheese wire, and Story Wheel are layers: if a feature module fails to load or throws during `init()`, the rest of the page keeps working.
- **Additive animation.** Motion never gates content. Under `prefers-reduced-motion: reduce`, decorative overlays (cheese wire) are omitted; the modal and grid remain fully usable.
- **One composition, one store.** Filters compose through a single state object; the grid does not invent a second source of truth.

---

## Module contract

Every feature module:

1. Exposes `init()`.
2. Is gated on a flag in `window.TCA_CONFIG.features`.
3. Wraps setup in `try/catch`, logs on failure, and leaves the page in its pre-feature state (no orphaned DOM).
4. Owns its entire surface, including its entry point (for example Matrix owns the “Filter by taste” disclosure; Story Wheel owns “Roll the Wheel”).

Infrastructure is never flagged: `config.js`, `store.js`, `modal.js`, the grid visibility refactor, motion tokens, and schema migrations always load.

`app.js` is the orchestrator: after building the baseline UI it consults the flags and calls each feature `init()`.

---

## State management

`store.js` exposes `window.CheeseStore`:

| API | Role |
| --- | --- |
| `get()` | Current state |
| `set(patch)` | Shallow merge; `matrix` merged one level deeper; dispatches `change` |
| `subscribe(fn)` | `EventTarget` listener for `change` |
| `selectVisible(cheeses)` | **Pure** filter — no DOM access |

State shape today:

```js
{
  query: "",
  family: "all",
  region: "all",
  matrix: { active: false, x: 3, y: 4, radius: 2.0 }
}
```

`selectVisible` applies search and chips, then optionally the matrix proximity filter (radius 2.0 with count floor 6 and ceiling 24). When `TCA_CONFIG.features.matrix` is off, the matrix clause is ignored even if `matrix.active` is true.

The grid builds cards once and toggles `.is-hidden` on store changes.

---

## Feature flags

Defined in `config.js` as a frozen `window.TCA_CONFIG`. Phase 1 flags: `matrix`, `cheeseWire`, `storyWheel`.

**Contract when a flag is off:**

- The module’s `init()` is never called.
- No feature DOM, listeners, or store writes from that feature.
- Entry points disappear with the feature (no orphaned buttons or layout holes).
- `selectVisible` ignores that feature’s state slice.

**QA override:** `?flags=matrix:off` (comma-separated `name:on|off` pairs) overrides file defaults at runtime without a redeploy.

**Limitation:** with no backend, flags are a deploy-time switch (edit + push), not an instant kill switch. Defensive `init()` covers unexpected production exceptions; flags cover known problems. Neither substitutes for the other.

**Removal policy:** delete a flag once its feature is stable. A flag surviving two phases is dead configuration.

---

## Feature dependency map

Three coupling clusters — treat them as such; the eight catalogue features are not independent.

1. **Filter / grid** — search, chips, Matrix, (future) Map, Compare, command palette. All write the store; all read through `selectVisible`; the grid only toggles visibility.
2. **Modal surface** — cheese detail, Story Wheel spotlight, cheese wire overlay, (future) Shareable Card entry points. Shared `Modal.open` / `Modal.close` with focus trap and focus restoration.
3. **Deterministic picker** — Story Wheel `drawStory(pool, seed, bag)`; (future) Cheese of the Day reuses the same shape with a date-derived seed.

**Cross-phase couplings already decided:**

- Carousel and spotlight images use `crossorigin="anonymous"` so Phase 3 canvas export (Shareable Card) does not taint the canvas.
- Passport (future) will span all three clusters — plan it that way rather than bolting storage onto one feature.

---

## Data architecture

- Catalogue lives in `data-part1.js` … `data-part6.js`, each appending to `window.CHEESES`.
- Records carry `schemaVersion: 2`, `mildStinky`, `softHard`, and explicit `isBizarreLore` (boolean, never implied).
- Axis scores are authored in `docs/TCA2/MATRIX-TABLE.md` / `.json`. That JSON is the enforced source of truth: `npm run check` fails if live scores disagree.
- Story Wheel pool membership is the approved 40-id set on the cheese records (Appendix A of the Phase 1 plan), also enforced by `npm run check`.
- Migrate by injecting fields into the existing pretty-printed files — do not regenerate prose from scraped mirrors.

There is **no** per-file size ceiling on the git-based Vercel pipeline. Guidance that assumed the old in-chat deploy payload limit is retired.

---

## Accessibility baseline

- Every pointer gesture has a keyboard (and, where relevant, button) equivalent.
- Dialogs trap Tab/Shift-Tab and restore focus to the opener on close.
- Filtered count is exposed via a polite ARIA live region (debounced so drag does not spam).
- `prefers-reduced-motion` disables decorative motion; content does not depend on animation completing.
- Matrix disclosure on small viewports is a real `aria-expanded` button, not a CSS-only toggle.

---

## Conventions

- ES5-flavoured style in app modules (`var`, function expressions, IIFEs) — no transpiler, keep one idiom.
- `escapeHtml` on all interpolated cheese fields.
- Future `localStorage` keys: namespaced and versioned (e.g. `cheeseAtlas.passport.v1`), every read/write in `try/catch`.
- Shared motion tokens in `:root`: `--motion-fast`, `--motion-base`, `--motion-ease`.
- Pure helpers (`selectVisible`, `drawStory`, matrix ranking) stay DOM-free so Phase 2 can unit-test them without a refactor.
