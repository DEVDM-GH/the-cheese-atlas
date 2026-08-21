# Cheese Atlas — existing design system

When editing The Cheese Atlas UI, **extend this identity**; do not replace it with a new aesthetic.

## Visual direction

Aging creamery ledger / cave shelves: cave-dark backgrounds, cream cards, wax-gold accents. Brand-forward masthead (*The Cheese Atlas*). Progressive enhancement; motion is additive.

## Tokens (from `styles.css`)

| Token | Role |
| --- | --- |
| `--cave` / `--cave-deep` | Aging-cave background |
| `--curd` / `--curd-dim` | Cream type & cards |
| `--wax-gold` | Brand accent, active chips, stats |
| `--rind-rust` | Modal field labels |
| `--motion-fast` / `--motion-base` / `--motion-ease` | Shared animation timing |

## Type

| Face | Role |
| --- | --- |
| Big Shoulders Display | Display titles |
| Source Serif 4 | Body copy |
| Space Mono | Ledger UI (chips, labels, footer) |

## Interaction / architecture constraints

- Vanilla HTML/CSS/JS; no bundler. Prefer CSS variables already in `:root`.
- Shared modal via `modal.js`; do not invent a second dialog system for new surfaces.
- Feature UI is flag-gated (`config.js`); entry points live with the feature module.
- Decorative overlays (e.g. cheese wire) must respect `prefers-reduced-motion: reduce`.
- Cards in the grid are the product metaphor (wheels on shelves) — keep that language consistent.

## What “good” looks like here

- One composition in the hero: brand, one pitch, stats / Roll the Wheel — not a marketing dashboard.
- Matrix, Story Wheel, and filters feel like ledger tools, not SaaS widgets.
- New motion should reuse motion tokens; two hero moments already exist (wire + wheel spotlight).
