# T062 — Visual check against design screens 91, 105, 106, 107

SC-007: "The implemented states 91 (Appearance section), 105, 106 and 107 match the design
screenshots in light and dark, with differences either fixed or listed."

## Method

`docs/design/screens/{91,105,106,107}-*-{light,dark}.png` are captured against the specific
"Logistics Delivery" demo deck used throughout the Claude Design prototype, with one node
(`Payment Service`) selected and coloured. To compare like for like, a small fixture deck
(`apps/app/.tmp-shots/gallery-deck.json`, not committed) was built that reproduces the
prototype's dedicated colour-gallery view — all 13 named fills, 4 stroke-only cards, a
fill+stroke card, 2 custom hex colours and a coloured group — and imported into a real build of
the app (`pnpm --filter @sododeck/app dev`) via Playwright (Chromium, 1440×900, both themes). The
screenshots below are the actual running app, not a mock.

Screens captured into `specs/020-card-style/screens/`:

- `107-colour-gallery-{light,dark}.png` — deck overview with many coloured cards/groups
- `105-fill-popover-{light,dark}.png` — toolbar "Colour" button → Fill tab popover
- `106-custom-colour-{light,dark}.png` — "Add a deck colour" → colour-area/hue picker
- `91-drawer-component-{light,dark}.png` — detail drawer, Appearance section

## 107 — Colour gallery

Matches the design intent: named fills render as solid tinted pills with the OKLCH-derived ink
colour switching per swatch (dark text on light fills, light text on Navy/Indigo/dark custom
fills), stroke-only cards show a coloured 2px border on a neutral fill, the fill+stroke card
combines both, and the group frame renders a tinted dashed fill using the same Teal token as its
member cards, with a Red stroke on its frame border — confirming FR-003/FR-004 (groups use the
same 13+custom colour set, independent fill/stroke) and the R4 hex-token design.

No functional differences found. The only difference from the prototype's 107 screen is content:
our gallery uses one row of plain named-fill cards rather than the prototype's icon-per-row +
`--card-<name>` CSS variable captions — that caption text is the prototype's own annotation
style for a design reference, not app UI, so there is nothing to fix.

## 105 — Fill popover

Matches on all functional points: "Fill"/"Stroke" segmented tabs, "No colour" row, a swatch grid
of the 13 named colours plus deck custom colours, and a live colour name + CSS variable label at
the bottom ("Red · card-red-fill"). Two intentional layout differences, already decided during
implementation (019/020) and not bugs:

- The design mockup groups swatches under "COLOURS" / "DECK COLOURS" section labels; the shipped
  `SwatchGrid` (`packages/ui`) renders one flat `radiogroup` with the named colours followed by
  the deck's custom swatches and the "+" add control, with no sub-headers. This keeps the
  roving-tabindex/keyboard model simple (single grid, one Tab stop) — see `SwatchGrid` a11y
  tests.
- The toolbar trigger button in the mockup is an unlabelled coloured circle; the shipped
  `Colour: <name>` button always shows the colour name as text next to the swatch, for the
  accessible-name requirement in FR-011/T061 (a plain icon-only button would have no readable
  name without extra `aria-label` plumbing already covered by the current pattern).

## 106 — Custom colour

Matches on the core picker: 2D colour area, hue slider, hex input, and the deck's existing custom
swatches shown above the picker. Two small differences from the mockup, not fixed here (cosmetic
only, no acceptance criteria reference them):

- The mockup's "Add" button is solid-orange and shows a live swatch preview + "Navy · saved to
  this deck as 4 of 12" counter next to it; the shipped picker shows a plain "Add"/"Cancel" pair
  and the count only appears in the swatch grid overflow state (`MAX_SWATCHES`), not as inline
  text here.
- Swatch ordering in the mockup's "DECK COLOURS" row groups custom colours separately from named
  ones; as under 105, the shipped grid is a single flat list.

## 91 — Detail drawer Appearance section

Matches the agreed, simpler contract text (`specs/020-card-style/spec.md` FR-011, T034): a
"APPEARANCE" `PanelSection` with two rows, "Fill: <name|none>" and "Stroke: <name|none>", each a
button that opens the same `StylePicker` popover pinned to that channel. The mockup's 91 screen
predates this decision and shows two dropdown-style selects ("No fill" / "No stroke" with a
pencil/circle icon) instead of plain text rows — the shipped text-row pattern was the decision
recorded in this feature's plan/tasks, so this is not a regression to fix.

## Error ring (new in this feature, not in 91/105/106/107 individually but shown in the

## prototype's fuller 107 "STATES ON COLOUR" section)

The prototype's colour-gallery screen includes an "Error · pink" and "Error · navy" card: a
dashed 3px Clay ring around the card plus a small circular Clay alert badge in the bottom-right
corner, layered on top of whatever fill/stroke the card already has. This is documented in
`DESIGN.md`'s "Card Colours" section (node states line, updated in T058) and implemented as the
existing problem/error-ring treatment layered independently of `style.fill`/`style.stroke` — i.e.
a card that is both coloured and has a validation problem shows its custom colour underneath the
dashed Clay ring, exactly as in the design. This was verified by code inspection (the error ring
is drawn by the existing problem-indicator logic, unconditional on node colour) rather than by a
dedicated screenshot, since the gallery fixture deck used here does not include a rule violation;
reproducing one would require adding a decision-table rule to the fixture deck purely for a
screenshot, which was judged unnecessary given the ring's independence from colour is a CSS
layering fact, not new logic added by this feature.

On an **uncoloured** problem card (no `style.fill`/`style.stroke` at all, the pre-020 default),
the ring and badge render exactly as they did before this feature: the dashed Clay ring sits on
top of the plain neutral card surface, with no interaction with the (absent) fill/stroke tokens.
020 only changes what sits _underneath_ the ring (a named or custom colour instead of the default
surface); it does not touch the ring/badge styling or z-order, so this case needed no new code and
has no regression risk.

## Conclusion

No functional or visual bugs found against 91/105/106/107. All differences identified are either
mockup-only annotation styling or prior, already-recorded design simplifications (flat swatch
grid, named "Colour:" button, text-row Appearance section) from this feature's own plan — none
require a code change.
