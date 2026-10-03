---
name: Sododeck
description: A precise, calm workspace for architecture and flow diagrams.
colors:
  primary: "#f2661c"
  primary-hover: "#e85d12"
  primary-soft: "#fdeee4"
  primary-ink: "#b3480c"
  on-primary: "#1c1c1a"
  success: "#1d7351"
  success-soft: "#e6f1ec"
  success-ink: "#17603f"
  amber-soft: "#f6eddb"
  amber-ink: "#8a6112"
  blue-soft: "#e3ecf5"
  blue-ink: "#2d5b86"
  clay-soft: "#f9e3e6"
  clay-ink: "#a3303f"
  inverse: "#1c1c1a"
  on-inverse: "#ffffff"
  app: "#e9e9e6"
  surface: "#ffffff"
  surface-2: "#f4f4f1"
  surface-3: "#ecece8"
  canvas: "#fafaf8"
  dot: "#d9d9d3"
  group: "rgba(255,255,255,.7)"
  code: "#f7f7f4"
  hairline: "#ecece8"
  border: "#deded8"
  edge: "#c9c9c2"
  ink: "#1c1c1a"
  text-secondary: "#55554f"
  muted: "#72726b"
  scrim: "rgba(28,28,26,.3)"
  shadow: "rgba(0,0,0,.06)"
typography:
  display: { fontFamily: Geist, fontSize: 22px, fontWeight: 500, lineHeight: 1.2, letterSpacing: -0.02em }
  title-lg: { fontFamily: Geist, fontSize: 16px, fontWeight: 500, lineHeight: 1.3 }
  title-md: { fontFamily: Geist, fontSize: 15px, fontWeight: 500, lineHeight: 1.35 }
  title-sm: { fontFamily: Geist, fontSize: 14px, fontWeight: 500, lineHeight: 1.3, letterSpacing: -0.01em }
  body: { fontFamily: Geist, fontSize: 13px, fontWeight: 400, lineHeight: 1.5 }
  body-sm: { fontFamily: Geist, fontSize: 12.5px, fontWeight: 400, lineHeight: 1.45 }
  caption: { fontFamily: Geist, fontSize: 11.5px, fontWeight: 400, lineHeight: 1.4 }
  node-sub: { fontFamily: Geist, fontSize: 11px, fontWeight: 400, lineHeight: 1.3 }
  micro-label: { fontFamily: Geist, fontSize: 11px, fontWeight: 500, lineHeight: 1.2, letterSpacing: 0.07em, textTransform: uppercase }
  group-label: { fontFamily: Geist, fontSize: 10.5px, fontWeight: 500, lineHeight: 1.2, letterSpacing: 0.08em, textTransform: uppercase }
  code: { fontFamily: Geist Mono, fontSize: 12px, fontWeight: 400, lineHeight: 1.6 }
  code-sm: { fontFamily: Geist Mono, fontSize: 11.5px, fontWeight: 400, lineHeight: 1.5 }
  edge-label: { fontFamily: Geist Mono, fontSize: 10.5px, fontWeight: 400, lineHeight: 1 }
rounded:
  button: 9px
  input: 10px
  node: 14px
  card: 14px
  group: 16px
  deck-card: 16px
  modal: 20px
  full: 9999px
spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 24px
  xl: 32px
---

# Sododeck Design System

> Tokens in the front matter are the **light** theme. Dark values are listed next to each token below and ship under the same token names.

## Overview

Sododeck is a precise, calm workspace for architecture and flow diagrams. The chrome sits on a **warm off-white canvas** (`{colors.canvas}` — #fafaf8) framed by **white panels** (`{colors.surface}` — #ffffff) and warm grey hairlines. Text is a **warm near-black** (`{colors.ink}` — #1c1c1a). One accent, **Deck Orange** (`{colors.primary}` — #f2661c), carries every primary CTA (Export, New deck, Download), the selection ring, the active flow path, the animated token and the "matched row" state in decision tables.

Colour is used to mean something, not to decorate. Beyond orange there are **semantic tints** tied to node kinds and states: amber for logic and rules, blue for data, clay (rose-red) for external systems and errors, green for success, and neutral grey for clients. Each tint has a soft fill and a readable ink pair, and they are used only in icon tiles, rule headers and status chips.

Type is **Geist** for all UI and **Geist Mono** for anything machine-readable: ids, JSON, edge labels, conditions, SLA values and rule cells. Weights stay at 400–500. 600 is used for the wordmark and small status headings, and inside Deck cards (titles, chips, count discs, §g-68); nowhere else on the canvas. Display sizes are small (22px max). The diagram carries the visual weight, not the typography.

The shape language is **soft-technical**: 9px buttons, 10px inputs, 14px nodes and Deck cards (12px for other cards), 16px group boundaries and deck cards, 20px modals, and full pills for chips and status. Icons are **Lucide** (`lucide-react`) outline icons at 1.5px stroke, 15–21px.

Sododeck ships **light and dark** themes built from the same token names. Every surface reads from CSS variables, so a theme switch is a single swap of the variable set.

**Key characteristics:**

- Single accent: `{colors.primary}` (#f2661c). About 90% of any screen is neutral surface and ink, with one or two orange moments.
- Kind-coded icon tiles: every node shows a 30px rounded tile whose fill and ink come from its kind (service, data, queue, gateway, client, external).
- Mono for machine truth: ids, protocols, conditions, JSON and rule cells always render in Geist Mono.
- Canvas-first editor: the canvas fills the window and the chrome floats over it in small islands, a left icon rail with flyouts, an on-demand detail drawer and a JSON overlay hidden by default. Panels overlay the canvas and never resize it.
- Uppercase micro-labels (11px, 0.07em tracking, muted) head every inspector section. Sections are separated by 1px hairlines, not cards.
- Flat inside panels. Floating shadows appear only on floating chrome (islands, flyouts, drawer, toolbars, player, minimap, empty-state card) and modals.
- Local-first honesty: autosave status ("Saved in this browser") is always available, as an icon in the deck island with the words in its tooltip and accessible name.

## Colors

### Brand & Accent

- **Deck Orange** (`{colors.primary}` — #f2661c · dark #f07a32): Primary CTAs, selection border, active flow edges, flow token, active step dot, progress segments, toggle-on.
- **Deck Orange Hover** (`{colors.primary-hover}` — #e85d12 · dark #ff8a45): Hover and press state of primary buttons.
- **Orange Soft** (`{colors.primary-soft}` — #fdeee4 · dark #3a2214): Selected rows in outlines and lists, the selection halo (3px ring), matched decision-table rows, and the "THEN" column header.
- **Orange Ink** (`{colors.primary-ink}` — #b3480c · dark #ffb285): Text and icons placed on Orange Soft.
- **On Primary** (`{colors.on-primary}` — #1c1c1a · dark #171716): Labels and icons on Deck Orange fills. White fails contrast on this orange (3.1:1 light, 2.8:1 dark), so the label is dark in both themes (5.4:1 light, 6.4:1 dark).

### Type & Semantic Tints

Each tint is a *soft / ink* pair. Soft is the fill and ink is the text or icon on it.

| Token | Light soft / ink | Dark soft / ink | Use |
|---|---|---|---|
| `{colors.amber}` | #f6eddb / #8a6112 | #352a14 / #e2b659 | Rules, conditions, "WHEN" headers, queue nodes, backup banner, warnings |
| `{colors.blue}` | #e3ecf5 / #2d5b86 | #172636 / #8fbbe3 | Data nodes (databases, stores, caches) |
| `{colors.clay}` | #f9e3e6 / #a3303f | #3a1a20 / #f2a0aa | External systems, destructive hover (delete), SLA breach, errors. Kept rose-red (hue ≈352°) so it never reads as Deck Orange (≈21°). |
| `{colors.success}` | #e6f1ec / #17603f (solid #1d7351) | #163024 / #74d4a5 (solid #2f8f63) | Success banners, "rule matched" test result, SLA within target. The only green in the system. |
| `{colors.service}` | = primary-soft / primary-ink | = primary-soft / primary-ink | Service nodes |
| `{colors.client}` | = surface-2 / text-secondary | = surface-2 / text-secondary | Client nodes |
| `{colors.inverse}` | #1c1c1a / #ffffff | #ededea / #171716 | Gateway nodes, wordmark tile, onboarding tooltip, toast |

### Surface

- **App** (`{colors.app}` — #e9e9e6 · dark #0b0b0a): The outermost floor behind panels.
- **Surface** (`{colors.surface}` — #ffffff · dark #171716): Panels, top bar, inspector, nodes, cards, modals.
- **Surface 2** (`{colors.surface-2}` — #f4f4f1 · dark #212120): Segmented-control tracks, search fields, list-row hover, chips, stat tiles.
- **Surface 3** (`{colors.surface-3}` — #ecece8 · dark #2b2b29): Hover on Surface 2, toggle-off track, empty progress segments.
- **Canvas** (`{colors.canvas}` — #fafaf8 · dark #121211): Diagram canvas and rule-editor body.
- **Canvas Dot** (`{colors.dot}` — #d9d9d3 · dark #2a2a27): 1px dot grid at 22px pitch.
- **Group Fill** (`{colors.group}` — rgba(255,255,255,.7) · dark rgba(255,255,255,.025)): Background inside group boundaries.
- **Code** (`{colors.code}` — #f7f7f4 · dark #1c1c1b): JSON panel, condition blocks, markdown preview.

### Hairlines & Borders

- **Hairline** (`{colors.hairline}` — #ecece8 · dark #262624): Panel dividers, section separators, card borders.
- **Border** (`{colors.border}` — #deded8 · dark #35352f): Input and button outlines, node borders, dashed group boundaries.
- **Edge** (`{colors.edge}` — #c9c9c2 · dark #3d3d38): Default connector stroke on the canvas.

### Text

- **Ink** (`{colors.ink}` — #1c1c1a · dark #ededea): Titles, body and input values.
- **Secondary** (`{colors.text-secondary}` — #55554f · dark #b8b8b1): Supporting copy, inactive tabs, icon buttons.
- **Muted** (`{colors.muted}` — #72726b · dark #909089): Micro-labels, metadata, counts, placeholders. It passes 4.5:1 on Surface in both themes.

### Scrim & Shadow

- **Scrim** (`{colors.scrim}` — rgba(28,28,26,.3) · dark rgba(0,0,0,.6)): Behind the Export dialog and the ⌘K palette.
- **Shadow tint** (`{colors.shadow}` — rgba(0,0,0,.06) · dark rgba(0,0,0,.45)): Used by all elevation tiers so shadows stay visible in dark mode.

### Card Colours

Users can colour a card's fill and stroke from 13 named colours (design 105–107, built in 020). Each colour is a **fill / stroke** pair with a light and a dark value, designed in OKLCH; the hex values below are what actually ships (`packages/ui/src/styles/tokens.css`), since browsers vary in OKLCH → sRGB rounding. Tokens are `--sd-card-{name}-fill` and `--sd-card-{name}-stroke`. Fills sit behind Ink text in both themes (≥ 12:1); on a coloured fill the subtitle uses Secondary instead of Muted to stay above 4.5:1. The stroke is a 1.5px card border and the swatch ring. Colour is decoration chosen by the user, so it never carries state: selection, flow and error keep their own frame, border, badge and icon on top of any fill (a problem is a 1.5px dashed Clay outline offset 4 outside the card plus a Clay Soft count badge in the header, same on any card colour, 122). The Deck look (029) adds `chip`, `ink` and `dot` to each colour; see [Extended palette](#extended-palette) under Card system (Deck).

| Colour | Light fill | Light stroke | Light OKLCH fill | Light OKLCH stroke | Dark fill | Dark stroke | Dark OKLCH fill | Dark OKLCH stroke |
|---|---|---|---|---|---|---|---|---|
| red | #ffe4de | #d15c53 | oklch(0.95 0.045 27) | oklch(0.62 0.15 27) | #482521 | #eb8278 | oklch(0.31 0.055 27) | oklch(0.72 0.13 27) |
| orange | #ffe7d2 | #c9690c | oklch(0.95 0.045 55) | oklch(0.62 0.15 55) | #452813 | #e28d4f | oklch(0.31 0.055 55) | oklch(0.72 0.13 55) |
| amber | #ffeccd | #b47900 | oklch(0.95 0.045 80) | oklch(0.62 0.15 80) | #3f2d0a | #cf9a35 | oklch(0.31 0.055 80) | oklch(0.72 0.13 80) |
| yellow | #f4f0ce | #998800 | oklch(0.95 0.045 102) | oklch(0.62 0.15 102) | #36310b | #b5a737 | oklch(0.31 0.055 102) | oklch(0.72 0.13 102) |
| lime | #e5f5d6 | #679725 | oklch(0.95 0.045 130) | oklch(0.62 0.15 130) | #273617 | #89b559 | oklch(0.31 0.055 130) | oklch(0.72 0.13 130) |
| green | #d9f8e0 | #259f56 | oklch(0.95 0.045 152) | oklch(0.62 0.15 152) | #183822 | #5ebc7b | oklch(0.31 0.055 152) | oklch(0.72 0.13 152) |
| teal | #cff9f1 | #00a28d | oklch(0.95 0.045 182) | oklch(0.62 0.15 182) | #013932 | #00beab | oklch(0.31 0.055 182) | oklch(0.72 0.13 182) |
| cyan | #cdf7ff | #009bbe | oklch(0.95 0.045 215) | oklch(0.62 0.15 215) | #003742 | #00b8d7 | oklch(0.31 0.055 215) | oklch(0.72 0.13 215) |
| blue | #dbf1ff | #4087de | oklch(0.95 0.045 255) | oklch(0.62 0.15 255) | #1c314c | #6aa7f4 | oklch(0.31 0.055 255) | oklch(0.72 0.13 255) |
| indigo | #e7ecff | #737ade | oklch(0.95 0.045 278) | oklch(0.62 0.15 278) | #2a2d4c | #929bf5 | oklch(0.31 0.055 278) | oklch(0.72 0.13 278) |
| violet | #f4e8ff | #986dd0 | oklch(0.95 0.045 302) | oklch(0.62 0.15 302) | #352947 | #b490e8 | oklch(0.31 0.055 302) | oklch(0.72 0.13 302) |
| pink | #ffe3f3 | #c65b93 | oklch(0.95 0.045 350) | oklch(0.62 0.15 350) | #452434 | #e181b0 | oklch(0.31 0.055 350) | oklch(0.72 0.13 350) |
| slate | #e6ecf3 | #667383 | oklch(0.94 0.012 255) | oklch(0.55 0.03 255) | #292e35 | #8693a5 | oklch(0.30 0.015 255) | oklch(0.66 0.03 255) |

**Custom colours:** a deck can add up to 12 custom hex colours to its own swatches (106). Card text (`--sd-card-text-dark` #1c1c1a or `--sd-card-text-light` #ffffff) is whichever gives the higher contrast against the custom fill, switching near relative luminance 0.204; in the ≈ 0.183–0.227 band neither choice reaches WCAG AA 4.5:1, so the colour picker shows a warning, but the colour is still allowed (FR-026).

### Card system (Deck)

The card look chosen on 2026-10-03 (direction **B · Deck**, design-analysis §g-63): cards are thick paper with a solid lip, 14px corners and filled pill chips; connectors are 2px smooth curves; playing a flow deals the deck; a collapsed group is a fanned hand. Reference frames **117–127** ([design-analysis §a](docs/design/design-analysis.md), screenshots in `docs/design/screens/117-…127-…`); source `docs/design/claude-design/Sododeck Cards.dc.html` + `sododeck-cards.js` (boards A and C in the same file are history, not reference). Built by 029 (look), 031 (shapes), 032 (fields), 033 (tag colours), 034 (connections) and 035 (playback). The `node`, `edge`, handle and group entries under Components point here; this section is what the app draws since 029. Where this section and a founder decision disagree, the decision wins (§g-66–§g-80).

**Rule from the design's own risk note (§g-63):** on dense boards the lip is not drawn below 60 % zoom, and chips become 6px dots at System level. Zooming never changes a card's size (§g-58).

#### Tokens

Light / dark values; "Border-strong" is `#cfcfc7` / `#45453f`, "Surface 2" `#f4f4f1` / `#212120`, "Surface 3" `#ecece8` / `#2b2b29`, "Orange Soft" `#fdeee4` / `#3a2214`, "Orange Ink" `#b3480c` / `#ffb285`. Names are what 029 adds to `packages/ui/src/styles/tokens.css`.

| Token | Value | Use |
| --- | --- | --- |
| `--sd-deck-card-width` | 184 | Default card width; user-resizable (017), height computed from content |
| `--sd-deck-card-radius` | 14 | Card corners |
| `--sd-deck-frame-radius` | 20 | Expanded group frame |
| `--sd-deck-panel-radius` | 16 | Popovers, pickers, step player in the Deck look (inputs 10) |
| `--sd-deck-card-border` | 1.5px Border-strong, or the card's colour stroke | Card and frame border |
| `--sd-deck-lip` / `-hover` / `-drag` | `0 3px 0 0` / `0 5px 0 0` / `0 6px 0 0`, in the border colour, no blur | The lip. 5px on hover and on the current flow step (Deck Orange there); 6px while dragging, plus Float shadow |
| `--sd-deck-card-padding` | 12 vertical, 13 horizontal | Card body |
| `--sd-deck-card-gap` | 8 | Between header, title, description, fields, tags |
| `--sd-deck-tile` | 24 × 24, radius 8, Surface 2 (or colour `chip`), icon 14 / stroke 2 in Secondary (or colour `ink`) | Type tile in the header |
| `--sd-deck-title` | Geist 14 / 600 / 1.28, Ink, max 3 lines | Card title |
| `--sd-deck-type-name` | Geist 11.5 / 500, Muted (Secondary on a colour fill), one line | Type name next to the tile |
| `--sd-deck-body` | Geist 12 / 400 / 1.4, Secondary, max 3 lines | Description |
| `--sd-deck-chip` | 21 tall pill, padding 0 8 0 7, Geist 11.5 / 500, icon 12, colour `chip` fill + `ink` text | Field chips (status, select, person, date, range) |
| `--sd-deck-tag` | 18 tall pill, padding 0 6, Geist 10.5 / 500, colour `chip` + `ink` of the **tag's** colour (slate when it has none; at System a 6px dot in the tag's `dot` colour), wrap gap 4 | Tags on the card (21 tall with × in the drawer) |
| `--sd-deck-handle` / `-active` | 12 round, Surface fill, 2px Secondary border / 16 round, Deck Orange, 4px Orange Soft halo | Connection handles at the four side midpoints |
| `--sd-deck-edge` | 2px, `#b4b4ab` / `#5a5a53` | Connector line |
| `--sd-deck-edge-arrow` | filled triangle 9 long × 10 wide, 2px round-joined stroke, line colour | Connector end |
| `--sd-deck-edge-knob` | circle r 3.5, line colour | Connector start |
| `--sd-deck-lift` | `translateY(-2px)` | Hover and current flow step |
| `--sd-deck-tilt` | −2.5° (cards), −3° (shapes) | While dragging |
| `--sd-deck-grid` | 1.6px dots every 26px | Canvas dot grid |

#### Card anatomy

Top to bottom; an empty region is not drawn and the card gets shorter (120):

1. **Header**, 24 tall: type tile, type name (ellipsis), then a right-aligned badge slot: status chip (small; icon-only below 150 wide, 121), pin (12), problem badge.
2. **Title**: up to 3 lines, then "…"; a title-only tooltip appears when it is cut (121, D5).
3. **Description**: up to 3 lines.
4. **Fields** (032): chip-type fields (select, status, person, date, date range) float on one shelf with gap 4 and no label; text, number (Mono 11.5), link and bar fields are label–value rows (min 19 tall, label 11.5 Muted). Hidden fields show as a "+n fields" pill (20 tall, 1.5px dashed Border-strong) (124).
5. **Tags**: up to 10 tag pills, wrapping (121, 125).
6. **Has children**: a 24 tall Surface 2 pill "n inside" with a ⏎ key hint.

A person chip has a 16px Surface 3 avatar with Mono 7.5 / 600 initials. A bar field is an 8px Surface 3 track, radius 4, filled in Secondary, with a Mono value.

#### States (122)

Every state has a cue that does not rely on colour.

| State | Card | Shape |
| --- | --- | --- |
| Hover | lifts 2px, lip 5px, handles shown | stroke Secondary, handles |
| Selected | 2px Deck Orange outline, offset 2 | outline offset 4 |
| Editing title | same type and wrap; caret and selection (`#fbd9c3` / `#6a3315`) | same |
| Has a problem | 1.5px dashed Clay outline, offset 4, plus a Clay Soft badge (20 tall pill, ⚠ 12 + count, 11 / 600) in the header | outline offset 5, badge top-right |
| Current flow step | Deck Orange border and lip (5px), lifted 2px, step sticker | orange stroke, 9px Orange Soft halo, sticker |
| Dimmed | 22 % opacity | same |
| Being dragged | tilted −2.5°, lip 6px, Float shadow; a dashed Muted ghost stays at the origin | tilted −3° |
| Connection target | Deck Orange border, the hovered side's handle active | same |
| Has child components | "n inside ⏎" pill as the last row | pill below the shape |
| Highlighted neighbour | border and lip in Secondary; stays at 100 % while the rest dims | Secondary stroke |

Tilt and lift are paint-only: they never move the card's box for snapping, hit tests, edge anchors or export (§g-74).

#### Groups (119)

- **Collapsed group, the fanned hand:** 184 × 112. Two back sheets with the group's fill, stroke and 3px lip, rotated −7° and +4° around their bottom centre, behind a front card (padding 11 / 12, gap 7): header with a 24px tile (layers icon), "Group" (11.5 / 500 Secondary) and the member count in a 26px Ink disc (13 / 700, Surface text); the name (14 / 600); one 22px member-type tile per member (radius 7, 1.5px stroke). Each neighbour gets one merged connector with an "×n" badge; ⏎ or double-click expands. A group of shapes also stacks as cards (122).
- **Expanded group frame:** radius 20, 1.5px border in the colour stroke or Border-strong, fill in the colour fill or Surface 2. The label is a pill sitting on the top edge (left 16, top −14): 28 tall, Surface, 1.5px border, 2px lip, chevron + name (12.5 / 600) + count in an 18px Ink disc.

#### Connectors (117–119)

- **Line types** (§g-64): **curved** (default; a cubic leaving each end along the side normal with control distance max(28, 0.42 × length)), **elbow** (orthogonal, 017's route) and **straight**. The design only draws curved.
- **States:** played Secondary 2.5px; current Deck Orange 3.25px over an 8px orange halo at 18 %; upcoming dashed `2 6` with round caps; dimmed 20 % opacity; highlighted Ink 2.75px; error path Clay 2.5px dashed `7 4` ending in an × (no arrow).
- **Label:** 20 tall pill, 11 / 600, Surface fill, 1.5px Border-strong, Secondary text. Current step: solid Deck Orange with On Primary text. Error: Clay Soft fill, Clay border and text with an ⊗ icon.
- **Bundle count:** 22px Ink pill "×n" (11.5 / 700, Surface text) with a 2px canvas ring (118, 119).
- **Drill-in outside proxy** (118): 150 wide, 1.5px dashed Secondary, radius 14, canvas fill; type icon, title 12.5 / 600 and "Outside" (10, Muted). Belongs to 034.

#### Flow playback (117, owned by 035)

- **Step sticker** on the card's top-left corner (−9, −9): played = 22px Ink disc with a check; current = 26px Deck Orange disc with the step number (12.5 / 700); upcoming = 22px Surface disc with a 1.5px dashed Secondary border and the number. Played and current discs have a 2px Surface ring.
- **Token:** a 24px Deck Orange disc carrying the step number (11.5 / 700, On Primary), 2.5px Surface ring and a 3px Orange Ink lip.
- **Step player:** 560 wide panel (radius 16, 1.5px Border-strong, 3px Border-strong lip + Float shadow), 40px round play button with an Orange Ink lip, "Step 3 of 8" (14 / 700), the from → to line, a Mono speed pill, and one 8px segment per step (played Secondary, current Deck Orange, upcoming Surface 3, the next branch point outlined dashed).
- **Branch popover:** a panel next to the decision listing each path with a number key; an error path has a dashed Clay border and ⊗.

#### Zoom levels (123)

Same thresholds as the app (`levels.ts`). The card keeps one size; only detail changes.

| Level | Zoom | Card shows |
| --- | --- | --- |
| Landscape | ≤ 45 % | the type icon (30px, colour `ink` or Secondary) centred on the colour fill or Surface 2; no text. Shapes show only their geometry |
| System | 45–90 % | tile + title; chips (tags, field chips) as 6px dots (§g-63) |
| Container | 90–150 % | + type name, description, status |
| Component | > 150 % | everything |

No lip below 60 % (§g-63), whatever the level. Tags follow §g-59 (§g-70).

#### Extended palette

Each of the 13 named colours has five variants. `fill` and `stroke` are what 020 ships (unchanged, see Card Colours and §g-66); `chip`, `ink` and `dot` are new from the Deck design and computed from its OKLCH values (hex as Chromium renders them). `chip` is the solid tint behind tag and field chips and the type tile; `ink` is the same-hue text on `chip` (and the icon in a coloured tile); `dot` is the 6px dot at System level, the status-icon colour and the swatch ring. The last column is the WCAG contrast of `ink` on `chip`: all 26 pairs pass AA (≥ 4.5:1) for 10.5px / 500 text. Tokens: `--sd-card-{name}-chip`, `--sd-card-{name}-ink`, `--sd-card-{name}-dot`, next to the existing `-fill` and `-stroke`.

| Colour | Theme | fill | stroke | chip | ink | dot | chip / ink |
| --- | --- | --- | --- | --- | --- | --- | --- |
| red | light | `#ffe4de` oklch(0.95 0.045 27) | `#d15c53` oklch(0.62 0.15 27) | `#ffd3cc` oklch(0.915 0.065 27) | `#7e302a` oklch(0.42 0.11 27) | `#ca564d` oklch(0.6 0.15 27) | 6.6 |
|  | dark | `#482521` oklch(0.31 0.055 27) | `#eb8278` oklch(0.72 0.13 27) | `#69322d` oklch(0.39 0.08 27) | `#ffcdc5` oklch(0.9 0.07 27) | `#f2897e` oklch(0.74 0.13 27) | 7.1 |
| orange | light | `#ffe7d2` oklch(0.95 0.045 55) | `#c9690c` oklch(0.62 0.15 55) | `#ffd8ba` oklch(0.915 0.065 55) | `#793900` oklch(0.42 0.11 55) | `#c26300` oklch(0.6 0.15 55) | 6.6 |
|  | dark | `#452813` oklch(0.31 0.055 55) | `#e28d4f` oklch(0.72 0.13 55) | `#653815` oklch(0.39 0.08 55) | `#ffd3b2` oklch(0.9 0.07 55) | `#e99355` oklch(0.74 0.13 55) | 7.1 |
| amber | light | `#ffeccd` oklch(0.95 0.045 80) | `#b47900` oklch(0.62 0.15 80) | `#fadfb3` oklch(0.915 0.065 80) | `#6c4400` oklch(0.42 0.11 80) | `#a46a00` oklch(0.57 0.15 80) | 6.6 |
|  | dark | `#3f2d0a` oklch(0.31 0.055 80) | `#cf9a35` oklch(0.72 0.13 80) | `#5b3f01` oklch(0.39 0.08 80) | `#f7daaa` oklch(0.9 0.07 80) | `#d5a13c` oklch(0.74 0.13 80) | 7.2 |
| yellow | light | `#f4f0ce` oklch(0.95 0.045 102) | `#998800` oklch(0.62 0.15 102) | `#ede5b3` oklch(0.915 0.065 100) | `#5c4d00` oklch(0.42 0.11 100) | `#8d7700` oklch(0.57 0.15 100) | 6.5 |
|  | dark | `#36310b` oklch(0.31 0.055 102) | `#b5a737` oklch(0.72 0.13 102) | `#4f4502` oklch(0.39 0.08 100) | `#e8e0aa` oklch(0.9 0.07 100) | `#beac3d` oklch(0.74 0.13 100) | 7.2 |
| lime | light | `#e5f5d6` oklch(0.95 0.045 130) | `#679725` oklch(0.62 0.15 130) | `#d5ecbf` oklch(0.915 0.065 130) | `#385805` oklch(0.42 0.11 130) | `#59880a` oklch(0.57 0.15 130) | 6.5 |
|  | dark | `#273617` oklch(0.31 0.055 130) | `#89b559` oklch(0.72 0.13 130) | `#364d1b` oklch(0.39 0.08 130) | `#cfe8b7` oklch(0.9 0.07 130) | `#8fbb5f` oklch(0.74 0.13 130) | 7.1 |
| green | light | `#d9f8e0` oklch(0.95 0.045 152) | `#259f56` oklch(0.62 0.15 152) | `#c4f0ce` oklch(0.915 0.065 152) | `#015d2d` oklch(0.42 0.11 152) | `#1a9951` oklch(0.6 0.15 152) | 6.4 |
|  | dark | `#183822` oklch(0.31 0.055 152) | `#5ebc7b` oklch(0.72 0.13 152) | `#1d512f` oklch(0.39 0.08 152) | `#bcecc8` oklch(0.9 0.07 152) | `#65c281` oklch(0.74 0.13 152) | 7.0 |
| teal | light | `#cff9f1` oklch(0.95 0.045 182) | `#00a28d` oklch(0.62 0.15 182) | `#b3f2e6` oklch(0.915 0.065 182) | `#005f52` oklch(0.42 0.11 182) | `#009b87` oklch(0.6 0.15 182) | 6.1 |
|  | dark | `#013932` oklch(0.31 0.055 182) | `#00beab` oklch(0.72 0.13 182) | `#005248` oklch(0.39 0.08 182) | `#aaeee1` oklch(0.9 0.07 182) | `#15c5b1` oklch(0.74 0.13 182) | 7.0 |
| cyan | light | `#cdf7ff` oklch(0.95 0.045 215) | `#009bbe` oklch(0.62 0.15 215) | `#b2effe` oklch(0.915 0.065 215) | `#005a72` oklch(0.42 0.11 215) | `#0094b7` oklch(0.6 0.15 215) | 6.2 |
|  | dark | `#003742` oklch(0.31 0.055 215) | `#00b8d7` oklch(0.72 0.13 215) | `#004f60` oklch(0.39 0.08 215) | `#a8ebfb` oklch(0.9 0.07 215) | `#07bfde` oklch(0.74 0.13 215) | 7.0 |
| blue | light | `#dbf1ff` oklch(0.95 0.045 255) | `#4087de` oklch(0.62 0.15 255) | `#c6e6ff` oklch(0.915 0.065 255) | `#1d4d87` oklch(0.42 0.11 255) | `#3a81d7` oklch(0.6 0.15 255) | 6.6 |
|  | dark | `#1c314c` oklch(0.31 0.055 255) | `#6aa7f4` oklch(0.72 0.13 255) | `#25466f` oklch(0.39 0.08 255) | `#bfe1ff` oklch(0.9 0.07 255) | `#70adfb` oklch(0.74 0.13 255) | 7.1 |
| indigo | light | `#e7ecff` oklch(0.95 0.045 278) | `#737ade` oklch(0.62 0.15 278) | `#d8e0ff` oklch(0.915 0.065 278) | `#404488` oklch(0.42 0.11 278) | `#6d74d8` oklch(0.6 0.15 278) | 6.7 |
|  | dark | `#2a2d4c` oklch(0.31 0.055 278) | `#929bf5` oklch(0.72 0.13 278) | `#3b406f` oklch(0.39 0.08 278) | `#d2daff` oklch(0.9 0.07 278) | `#98a2fc` oklch(0.74 0.13 278) | 7.1 |
| violet | light | `#f4e8ff` oklch(0.95 0.045 302) | `#986dd0` oklch(0.62 0.15 302) | `#ebd9ff` oklch(0.915 0.065 302) | `#593c7e` oklch(0.42 0.11 302) | `#9267ca` oklch(0.6 0.15 302) | 6.7 |
|  | dark | `#352947` oklch(0.31 0.055 302) | `#b490e8` oklch(0.72 0.13 302) | `#4d3a68` oklch(0.39 0.08 302) | `#e6d4ff` oklch(0.9 0.07 302) | `#ba96ef` oklch(0.74 0.13 302) | 7.2 |
| pink | light | `#ffe3f3` oklch(0.95 0.045 350) | `#c65b93` oklch(0.62 0.15 350) | `#ffd2e9` oklch(0.915 0.065 350) | `#772f55` oklch(0.42 0.11 350) | `#c0558d` oklch(0.6 0.15 350) | 6.7 |
|  | dark | `#452434` oklch(0.31 0.055 350) | `#e181b0` oklch(0.72 0.13 350) | `#64324b` oklch(0.39 0.08 350) | `#ffcce5` oklch(0.9 0.07 350) | `#e887b6` oklch(0.74 0.13 350) | 7.2 |
| slate | light | `#e6ecf3` oklch(0.94 0.012 255) | `#667383` oklch(0.55 0.03 255) | `#dde4ed` oklch(0.915 0.014 255) | `#444e5a` oklch(0.42 0.024 255) | `#738294` oklch(0.6 0.033 255) | 6.6 |
|  | dark | `#292e35` oklch(0.30 0.015 255) | `#8693a5` oklch(0.66 0.03 255) | `#3f464f` oklch(0.39 0.018 255) | `#d7dfe8` oklch(0.9 0.015 255) | `#9facbd` oklch(0.74 0.029 255) | 7.1 |

Custom deck colours (106) have no `chip` / `ink` / `dot`: their chips use the hex as the fill with the flipped text colour (§g-79).

## Typography

### Font Family

- **Geist** (400 / 500 / 600) for all interface text.
- **Geist Mono** (400 / 500) for ids, JSON, edge labels, protocols, conditions, SLA numbers, rule cells, zoom %, keyboard hints.
- **Lucide** (`lucide-react`, tree-shaken SVG components) for icons: 1.5px stroke by default, 2px for small status glyphs (≤ 14px). Icons inherit `currentColor`.
- Fallback: `system-ui, sans-serif` and `ui-monospace, monospace`.

### Hierarchy

| Token | Size | Weight | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `{typography.display}` | 22px | 500 | 1.2 | -0.02em | Page titles (library folder, rule name) |
| `{typography.title-lg}` | 16px | 500 | 1.3 | 0 | Dialog titles, empty-state heading |
| `{typography.title-md}` | 15px | 500 | 1.35 | 0 | Inspector header (node / step title) |
| `{typography.title-sm}` | 14px | 500–600 | 1.3 | -0.01em | Wordmark, deck card title, tooltip title |
| `{typography.body}` | 13px | 400 | 1.5 | 0 | Default UI text, inputs, buttons (500) |
| `{typography.body-sm}` | 12.5px | 400–500 | 1.45 | 0 | List rows, node titles (500), secondary buttons |
| `{typography.caption}` | 11.5px | 400 | 1.4 | 0 | Metadata, counts, sublines |
| `{typography.node-sub}` | 11px | 400 | 1.3 | 0 | Node subtitle (tech / host / owner by view) |
| `{typography.micro-label}` | 11px | 500–600 | 1.2 | 0.07em, UPPERCASE | Inspector and panel section heads |
| `{typography.group-label}` | 10.5px | 500 | 1.2 | 0.08em, UPPERCASE | Group boundary labels on the canvas |
| `{typography.code}` | 12px | 400 | 1.6 | 0 | JSON panel (Mono) |
| `{typography.code-sm}` | 11–11.5px | 400 | 1.5 | 0 | Conditions, chips, export preview (Mono) |
| `{typography.edge-label}` | 10.5px | 400 | 1 | 0 | Edge label pills on the canvas (Mono) |

### Principles

Type stays quiet so the diagram can lead. There is no heavy display weight. Hierarchy comes from size steps of 1–2px, 500 vs 400 weight, and muted colour. Anything a developer might copy or search for is set in Mono. Long labels truncate with an ellipsis instead of wrapping in dense rows (nodes, outline, steps). Prose areas (descriptions, tooltips, empty states) use `text-wrap: pretty`.

## Layout

### Spacing System

- **Base unit:** 4px, with 2px micro-steps inside segmented controls.
- **Tokens:** `{spacing.xxs}` 2 · `{spacing.xs}` 4 · `{spacing.sm}` 8 · `{spacing.md}` 12 · `{spacing.base}` 16 · `{spacing.lg}` 24 · `{spacing.xl}` 32.
- **Panel padding:** 16px horizontal in the inspector and 10–12px in the left panel. Inspector sections use 14px vertical padding.
- **Row heights:** list rows 30–34px, editor islands and the selection toolbar 44px, library top bar 56px, JSON overlay header 42px.
- **Control heights:** buttons 34px (dialogs 36px), inputs 36px, segmented items 28–30px, chips 24–26px, icon buttons 28–34px.

### Canvas-first Editor

Designed in states 86–116 (`docs/design/screens/86-…` to `116-…`). The canvas is full-bleed: it fills the window and never resizes. All chrome floats over it and is reached from small islands. Frames 02–85 still define what the panels **contain**; 86–116 define where they **sit**.

- **Islands:** 44px tall, 4px padding, 2px gap between items, 12px from the viewport edges. Surface, 1px Hairline, 12px radius, Rest shadow.
  - **Deck island** (top-left): ≡ menu (34: All decks · Import… · Export… · Deck settings · Show JSON · Dark / Light mode · Keyboard shortcuts) → deck name (13.5/500, editable) → save-status icon (check / spinning loader / clay alert that opens the error popover) → divider → view switcher (segmented, 28px items). Chips join it when active: the **Flow chip** (Orange Soft, "Flow · {name}", ×) and the **drill breadcrumb** chip (010). The views control's menu holds view settings and Tidy layout (011).
  - **Tools island** (top-right): three 34px icon buttons with tooltips and no visible labels (§g-60): Jump to (⌘K) → Labels (connector labels) → Focus (F). Export, the theme and keyboard shortcuts live in the deck menu; the flow-notes display (dimmed / shown / hidden) lives in the step player, since it only matters while a flow plays.
  - **Undo / Redo island:** 8px below the rail.
  - **Zoom island** (bottom-right): fit diagram (`Expand`) · fit selection (`SquareDashed`, disabled with nothing selected) · − · Mono % · + · level · minimap. The minimap (182×112) opens above it. Keyboard shortcuts moved to the deck menu (`?` still opens them).
- **Left rail:** 48px wide, vertically centred, 38×38 buttons with an 18px icon and 8px radius; 22×1 dividers. Tools: select / hand toggle (§g-57), add component (palette), sticky, group, connector; then panels: outline, flows & features, rules, search. Problems (015) is a rail button with a count badge. Tooltips: Inverse, 8px radius, label plus Mono shortcut, 400ms delay, 8px right of the rail.
- **Add flyout (030, design 127):** search field with a `/` hint, a pill tablist (All plus one tab per category whose pack is on; the active tab is Inverse), sections with an uppercase Micro heading and count, tiles in a 3-column grid (type tile 28 over the name, 1px Hairline border, 12px radius; a mono 1–9 badge on the first nine visible tiles), the Note card, and a footer row "Packs · N on". "Packs in this deck" replaces the body: a back arrow, one row per pack (name, "<n> types", On / Off text, Switch) and a note that cards on the board keep rendering. Type tiles take their icon and soft / ink tone from `TYPE_STYLE`; the icon, not the tone, tells types apart.
- **Flyout:** 280px wide, left 68 (rail + 8), top 68, up to viewport height − 80. Header 46 with title (13.5/500), pin (28) and close (28); rows 30–32px. Surface, 1px Hairline, 12px radius, Float shadow. One flyout at a time. A pinned flyout stays open while the user works on the canvas and returns when a temporary one closes. Content: palette, outline, flows & features, rules, problems.
- **Detail drawer:** the inspector on demand. Right 12, top 68, bottom 12; 360px default, resizable 320–560px from a 4×48 grip on its left edge. Header 68 (40 kind tile, 15/500 title, 11.5 muted subline, More, Close); sections use 13/16px padding with hairlines. It overlays the canvas, and the canvas pans to keep the selection clear. Opened from a card's details button, ⏎ or ⌘⇧D; Esc closes and returns focus to the card.
- **JSON overlay:** hidden by default, toggled with ⌘J. A bottom island from left 68 to the right edge (or the drawer's left edge), bottom 12, 268px tall, Float shadow. Header 42: JSON · Selection / Deck tabs · "In sync with canvas" · line count · Copy · ×. Body on Code surface, Geist Mono 12/1.6. **Read-only** for now; the zoom island moves above it.
- **Selection toolbar:** 44px tall, 34px buttons, floats 12px above the selection frame and flips 12px below when it would reach the top islands. Variants for one component, a multi-selection, a connection and a group. Hidden while dragging, resizing or editing text.
- **Step player:** bottom-centre (420–560px wide). With the drawer open it centres on the remaining canvas.
- **Hide UI** (⌘\\): every island, flyout, drawer and toolbar hides; a "Show UI" pill stays bottom-right.
- **Keyboard regions:** F6 / ⇧F6 cycle deck, tools, rail, undo, canvas and zoom; hidden regions are skipped. ⇧F10 or the menu key opens the context menu.
- **Library:** 56px top bar, 236px folder sidebar, and a content grid of `repeat(auto-fill, minmax(250px, 1fr))` with 16px gaps.
- **Rule editor:** 264px table list, a fluid table area (minimum 640px), and a 320px test/usage panel.

### Canvas Geometry

- Cards are 184px wide by default, with the height computed from the content (`card-layout.ts`). Users can resize a card (017): minimum 120×44, 4px steps.
- Expanded groups are 20px-radius frames with a label pill on the top edge; collapsed groups are the fanned hand.
- Connectors are curved, elbow (8px rounded corners) or straight, start with a knob and end in an arrow. Queue connections route through a shared vertical lane.
- The canvas pads the world by 36px and fits it to the viewport on load (zoom range 30–400%, §g-60).

### Whitespace Philosophy

The chrome is dense and the canvas is airy. Panels pack 30px rows so large outlines stay scannable. The canvas keeps generous gutters between groups so flows remain readable when highlighted.

## Elevation

Three tiers plus flat. All tiers use `{colors.shadow}` so they work in both themes.

- **Flat:** panels, top bar, lists, inspector sections. Separation comes from hairlines.
- **Rest** (`0 1px 2px {colors.shadow}`): nodes, active segmented items, editor islands and the rail.
- **Float** (`0 8px 28px {colors.shadow}`): flyouts, detail drawer, JSON overlay, step player, empty-state card, hovered deck cards (hover uses `0 4px 16px`, as does the selection toolbar). Context menus and toolbar popovers use `0 12px 32px`.
- **Modal** (`0 24px 60px rgba(0,0,0,.25)`): Export dialog and ⌘K palette, over `{colors.scrim}`.
- **Selection frame** (2px Deck Orange outline, 2px **outside** the card border): selected node. It sits outside the card so it reads on any card colour. A multi-selection also gets a 1px orange rounded frame 10px outside the union.
- **Flow halo** (`0 0 0 3px {colors.primary-soft}` + 1.5px primary border): the node on the current flow step, and the chosen export format.

## Components

### Buttons

- **`button-primary`**: Deck Orange fill, On Primary (dark) 13px/500 label, 9px radius, 34px height, 11–14px horizontal padding, optional leading 19px icon. Hover uses Orange Hover.
- **`button-secondary`**: Surface fill, 1px Border outline, ink label. Hover uses Surface 2.
- **`button-icon`**: 28–34px square with a 7–9px radius. Either transparent or outlined. Icon is Secondary colour and darkens to ink on hover.
- **`button-chip`**: 24–26px pill on Surface 2 with an 11.5–12px label and a small leading icon ("Attach", "Edit rule", "New").
- **`button-toggle-active`**: Orange Soft fill, 1px primary border, Orange Ink label (Labels, Focus on).

### Inputs

- **`text-input`**: 36px tall, 10px radius, 1px Border, 11px padding. Focus turns the border Deck Orange, with no glow.
- **`textarea-md`**: Mono 12.5px/1.55 with vertical resize. Paired with a Write / Preview segmented control.
- **`inline-edit`**: transparent input with a transparent border. The border appears on hover and turns orange on focus (deck name, rule name, table cells).
- **`search-field`**: 34–36px, Surface 2 fill, leading search icon, borderless.
- **`segmented`**: Surface 2 track with 2–3px padding. The active item is Surface with a Rest shadow and a 500 label; inactive items use Secondary.
- **`toggle`**: 32×18px track (Surface 3 → Deck Orange) with a 14px white knob.
- **`tag-chip`**: 26px pill on Surface 2 with a trailing × icon. The add field is a dashed pill. With a tag colour (033) the pill takes that colour's `chip` fill and `ink` text; in the drawer tag row of a card it is the 21px deck chip (10.5 / 500) with ×, followed by a dashed "Add tag" pill that opens the tag picker (frame 125). A partial tag in the bulk drawer stays dashed with "k/n".

### Canvas

- **`node`**: the Deck card (see [Card system (Deck)](#card-system-deck)): Surface fill, 1.5px Border-strong border, 14px radius, 3px lip, header with a 24px type tile and type name, 14 / 600 title, optional description, field chips and tag pills; 184 wide by default, height from content, user-resizable (minimum 120×44, 4px steps). Optional fill and stroke from the card colours (020). States are listed under States in that section (selected, current flow step, problem, dimmed in focus and flow modes, dimmed by a saved view at `--sd-opacity-view-dim` .4, pinned, being dragged).
- **`group-boundary`**: the expanded group frame of the Deck look (20px radius, 1.5px border, label pill on the top edge); collapsed it is the fanned hand. Clicking the label drills into that level. See Groups under Card system (Deck).
- **`edge`**: a 2px connector in `--sd-deck-edge`, drawn curved, elbow or straight (the line type, 029), with a knob at the start and a 9×10 arrow at the end. Selected or in flow: Deck Orange, 2–3px. Dimmed: opacity .15–.18. It has a 12px invisible hit area. Full state list under Connectors in Card system (Deck).
- **`edge-label`**: Mono 10.5px pill, Surface fill, 1px Border. It turns solid orange with an On Primary label on the current step.
- **`flow-token`**: a numbered disc (035): 24px Deck Orange, 2.5px Surface ring, 3px Orange Ink lip, the step number in 11.5 / 700 On Primary. It animates along the current edge path (1.4s per loop at 1×); static at the label midpoint under reduced motion.
- **Playback dimming and lip (035):** off-path cards fade to 22 % (`--sd-deck-dim`), off-path connectors and labels to 20 % (`--sd-deck-dim-edge`). The current card keeps its 5px lip (`--sd-deck-lip-current`) below 60 % zoom, the one exception to the no-lip rule.
- **`minimap`**: 182×112 Surface card. Nodes and groups are drawn as rects, and the viewport is an 8-unit orange outline. Clicking pans the canvas.
- **`breadcrumb-chip`**: the drill-in path (Deck → Group level), shown as a chip in the deck island.
- **`zoom-control`**: its own island bottom-right: fit, −, Mono %, +, minimap, help.
- **`card-details-button`**: round button on a card's top-right corner on hover or focus; opens the drawer. Hidden while dragging, in flow mode, or when the card is under 80px wide on screen.
- **`inline-title-edit`**: double-click, F2 or ⏎ edits the title inside the card without changing its size.

### Flow Mode

- **`flow-chip`** (deck island): Orange Soft pill with a 1px primary border showing "Flow · {name}" and a close button.
- **`step-player`**: floating card with prev / play-pause (orange) / next, the step title, a 1×/2× speed pill, and a segmented progress bar (4px segments, filled orange up to the current step).
- **`step-row`**: 22px numbered dot (current = orange, done = Orange Soft, upcoming = Surface 2), a truncated "From → To" title, and a Mono edge label.
- **`condition-block`**: Code surface, 1px Hairline, Mono. The keyword `when` is set in amber ink.
- **`sla-meter`**: 8px track with a fill coloured success green (≤85%), amber (85–100%) or clay (>100%), and a 2px ink target tick. A status line appears below it.

### Rules

- **`decision-table`**: a two-row header. The first row is a WHEN band (amber soft/ink) over the condition columns and a THEN band (orange soft/ink) over the action columns. The second row holds editable column names. Body rows are 46px with editable Mono condition cells and Geist action cells. The matched row gets an Orange Soft background with Orange Ink 500 text. Row numbers sit in a 40px column and a delete action in a 40px trailing column.
- **`decision-table-compact`**: read-only version in the step inspector. Headers are 10.5px, cells are 11.5px, and the matched row is highlighted.
- **`rule-card`**: amber soft row with a table icon, name and forward arrow. Used in the node inspector.
- **`test-result`**: Success soft banner for a match, or clay soft for "no row matches".

### Library

- **`deck-card`**: 16px radius, 1px Hairline, Surface. It has a 148px dotted-canvas thumbnail, then the title, a "Sample" pill if applicable, and meta (nodes · flows · edited · folder). Hover adds a float shadow.
- **`new-deck-card`**: 1.5px dashed Border with a centred icon tile. Hover turns the border orange.
- **`backup-banner`**: amber soft, 14px radius, with a backup icon, a message and an amber-ink "Export backup" button. It can be dismissed.
- **`storage-meter`**: Surface 2 card with a 5px progress bar.

### Overlays

- **`export-dialog`**: 820px wide, 20px radius. A 280px format list (JSON, PNG, SVG, PDF, Mermaid) sits beside a preview panel with scope segmented control, a 250px preview, and options. The footer shows the Mono filename, size, Copy and Download.
- **`command-palette`**: 580px wide, 16px radius, 54px input row, 42px result rows (icon · title · kind) and a keyboard-hint footer.
- **`tour-tooltip`**: 300px Inverse card with a 14px radius, a 12px rotated-square arrow, "n of 3", title, body, step dots, and Skip / Back / Next buttons.
- **`toast`**: Inverse pill, bottom-centre, auto-dismisses after 2.6s.
- **`context-menu`**: min 232–252px wide, 6px padding, 30px rows with 7px radius, Mono shortcuts right-aligned, 1px dividers. Submenus open to the right and flip near edges. Disabled rows are Muted; Delete is Clay with an icon.
- **`toolbar-popover`**: 236–272px wide, 6px below its toolbar button, optional filter field (32px, Surface 2), 30px rows, selected = Orange Soft + check.
- **`colour-popover`**: 272px. Fill / Stroke tabs, No colour, 13 named swatches (28px circles, 7 per row), the deck's custom colours and a dashed "+" that opens a hue / saturation picker with a hex field. The selected swatch gets a 2px Surface gap, a 2px orange ring and a check.
- **Editing affordances** (016, 017): 8×8 resize handles with a W × H readout, connector segment and endpoint handles with side targets, 1px orange snap guides with distance labels, a marquee with 7% orange fill (9% dark), a dashed "Drop into …" group target, and an Inverse hint bar listing modifier keys. Full sizes are in `docs/design/design-analysis.md` §b.

## Theming

Both themes share token names. Dark mode does **not** invert tints. Soft fills become deep, low-chroma versions of the same hue, and the ink partners get lighter so contrast holds. Deck Orange shifts slightly lighter in dark (#f07a32) so it still reads as the single accent. Status colours (success, clay) keep their own hues in both themes, so orange stays reserved for action and selection. Shadows get a stronger tint (.45) because dark surfaces cannot show a light shadow.

## Interaction & Motion

- Transitions are short and functional: opacity .25s for dimming, width .2s for tour dots, and no bounce.
- Flyouts, the drawer, popovers and menus enter with a 120ms fade plus a 4px slide. With reduced motion they appear instantly.
- Autosave runs ~650ms after the last edit and shows a "Saving…" → "Saved in this browser" status.
- Keyboard: ⌘/Ctrl+K opens the palette, Esc closes overlays, and ←/→ step through a flow.
- The flow player advances every 1.7s at 1× (0.85s at 2×) and stops at the last step.
- The JSON overlay follows the canvas live and is read-only for now. Editing from JSON (with an inline clay error that keeps the draft) is a later feature.

## Responsive Behavior

| Name | Width | Key changes |
|---|---|---|
| Desktop | ≥ 1280px | Canvas-first editor with labelled islands. |
| Wide | ≥ 1600px | The canvas absorbs extra width. Flyout and drawer widths stay the same. |
| Narrow | 1024–1279px | Designed (116). The rail stays. The top islands drop their labels: the view switcher becomes a dropdown, and Jump to, Labels, Focus and Export become icons. The drawer covers more of the canvas. |
| Tablet / mobile | < 1024px | Out of MVP scope. The library grid reflows (auto-fill 250px), and the editor is view-only. |

### Touch & hit targets

- Primary controls are 34–36px tall. Canvas cards are 184 wide by default (at least 120×44). Edges have a 12px hit stroke. Resize handles have a 16px hit area.
- Icon buttons are at least 28px, and 34px in the top bar.

## Known Gaps

- **Edge creation UI:** drawing a new connection by dragging from node ports is not yet designed.
- **Group editing:** group from selection, rename, ungroup, drag and drop-into-group are designed (99, 101, 104, 109, 110). Resizing a group boundary is not.
- **Custom view rules:** a custom view is created with default content. The filter/field configuration UI is not designed.
- **Validation states:** only JSON and rule-match errors are defined. Field-level validation is not.
- **Dynamic card attributes:** typed fields, their on-card display and the field editor are designed (124) and built by 032; until then cards keep the existing fields.
- **Connector relationships:** the Deck design draws relationship line styles (calls, reads, writes, depends on), bundled connectors and ends that slide along a side (118); none has a schema or a decision yet (§g-76, backlog 022 / 034).
- **Card ↔ shape switch:** the two forms of decision, database and document are designed (120); the control that switches them is not.
- **Collaboration / sharing:** out of scope for the local-only MVP.
