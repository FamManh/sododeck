# 000 visual check

Screenshots of the dev-only gallery (`/design`) at 1440×900, captured 2026-09-27 with Playwright
against `pnpm dev`. Compare with `docs/design/screens/`:

| Gallery shot                    | Design reference                                                   |
| ------------------------------- | ------------------------------------------------------------------ |
| `buttons-*.png`, `fields-*.png` | `02-editor-node-selected-*.png`, `14-editor-palette-tab-light.png` |
| `kinds-*.png`                   | `14-editor-palette-tab-light.png`                                  |
| `feedback-*.png`                | `01-library-*.png` (banner), `02-…` (tags), `22-…-toast-light.png` |
| `dialog-*.png`                  | `06-export-json-*.png`                                             |
| `coach-mark-*.png`              | `05-empty-deck-tour-1-*.png`                                       |
| `toast-*.png`                   | `22-editor-custom-view-toast-light.png`                            |
| `motion-*.png`                  | — (no design; motion tokens from design-analysis §c)               |

## Accessibility audit

Lighthouse 12, accessibility category, `/design`: **100 in light, 100 in dark** (dark forced with
`--blink-settings=preferredColorScheme=0`). Keyboard-only pass (scripted): all 38 tab stops show a
solid 2px Deck Orange outline in both themes.

## Differences from the design (all intentional)

1. **Label on Deck Orange is dark**, not white (DESIGN.md "On Primary": white fails contrast).
2. **lucide icons** instead of Material Symbols, stroke 1.5 (`docs/design/icon-mapping.md`).
3. **Focus**: 2px orange outline with a 2px gap on every control; the design's soft halo is too
   faint (≈1.1:1) and is kept for selection only (founder decision 2026-09-27).
4. **Text on surface-2** (search placeholder, ⌘K hint, chips) uses ink-secondary instead of
   muted, which is 4.40:1 in light (founder decision 2026-09-27).
5. **Non-color state cues** added: pressed toggle shows a check icon and heavier text; invalid
   input shows an alert icon; selected select item shows a check.
6. **Coach-mark Skip/Back** are text buttons styled for the inverse card (the ghost button would
   be unreadable on it).
7. **Geist Variable** (bundled) instead of static Geist: minor rendering differences.

Known and approved (plan.md Complexity Tracking): input border and switch-off track stay below
3:1 as designed.
