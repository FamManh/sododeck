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
  node: 12px
  card: 12px
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

Type is **Geist** for all UI and **Geist Mono** for anything machine-readable: ids, JSON, edge labels, conditions, SLA values and rule cells. Weights stay at 400–500, with 600 used only for the wordmark and small status headings. Display sizes are small (22px max). The diagram carries the visual weight, not the typography.

The shape language is **soft-technical**: 9px buttons, 10px inputs, 12px nodes and cards, 16px group boundaries and deck cards, 20px modals, and full pills for chips and status. Icons are **Lucide** (`lucide-react`) outline icons at 1.5px stroke, 15–21px.

Sododeck ships **light and dark** themes built from the same token names. Every surface reads from CSS variables, so a theme switch is a single swap of the variable set.

**Key characteristics:**

- Single accent: `{colors.primary}` (#f2661c). About 90% of any screen is neutral surface and ink, with one or two orange moments.
- Kind-coded icon tiles: every node shows a 30px rounded tile whose fill and ink come from its kind (service, data, queue, gateway, client, external).
- Mono for machine truth: ids, protocols, conditions, JSON and rule cells always render in Geist Mono.
- Three-panel editor: left panel (Outline / Palette + Features), centre canvas + JSON panel, right inspector. Panel widths are fixed and the canvas absorbs the rest.
- Uppercase micro-labels (11px, 0.07em tracking, muted) head every inspector section. Sections are separated by 1px hairlines, not cards.
- Flat by default. Floating shadows appear only on floating tools (player, minimap, empty-state card) and modals.
- Local-first honesty: autosave status ("Saved in this browser") is always visible, and a backup banner reminds users that data lives only in the browser.

## Colors

### Brand & Accent

- **Deck Orange** (`{colors.primary}` — #f2661c · dark #f07a32): Primary CTAs, selection border, active flow edges, flow token, active step dot, progress segments, toggle-on.
- **Deck Orange Hover** (`{colors.primary-hover}` — #e85d12 · dark #ff8a45): Hover and press state of primary buttons.
- **Orange Soft** (`{colors.primary-soft}` — #fdeee4 · dark #3a2214): Selected rows in outlines and lists, the selection halo (3px ring), matched decision-table rows, and the "THEN" column header.
- **Orange Ink** (`{colors.primary-ink}` — #b3480c · dark #ffb285): Text and icons placed on Orange Soft.
- **On Primary** (`{colors.on-primary}` — #1c1c1a · dark #171716): Labels and icons on Deck Orange fills. White fails contrast on this orange (3.1:1 light, 2.8:1 dark), so the label is dark in both themes (5.4:1 light, 6.4:1 dark).

### Kind & Semantic Tints

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
- **Row heights:** list rows 30–34px, top bar 56px, JSON panel header 40px, collapsed JSON bar 36px.
- **Control heights:** buttons 34px (dialogs 36px), inputs 36px, segmented items 28–30px, chips 24–26px, icon buttons 28–34px.

### Editor Grid

- **Top bar:** 56px, full width. From left: wordmark → breadcrumb (folder / editable deck name) → view switcher → spacer → autosave status → ⌘K field (200px) → theme toggle → Export.
- **Left panel:** 264px. Outline / Palette tabs, a scrolling body, and a Features block pinned at the bottom. In flow mode it becomes a flow list plus a step list.
- **Centre:** fluid. The canvas sits above the JSON panel (212px tall, collapsible to 36px).
- **Right inspector:** 336px. Header, a scrolling body of hairline-separated sections, and context-dependent content (node / edge / deck / flow step).
- **Canvas overlays** (14px inset): breadcrumb pill top-left, Labels/Focus top-right, zoom bottom-left, minimap bottom-right (182×112), step player bottom-centre (420–560px wide).
- **Library:** 56px top bar, 236px folder sidebar, and a content grid of `repeat(auto-fill, minmax(250px, 1fr))` with 16px gaps.
- **Rule editor:** 264px table list, a fluid table area (minimum 640px), and a 320px test/usage panel.

### Canvas Geometry

- Nodes are 164×50px with a 30px icon tile and 9px gap.
- Groups are dashed 1px boundaries with a 16px radius and an uppercase label at top-left.
- Edges use orthogonal routing with 8px rounded corners and end in a 3px dot. Queue connections route through a shared vertical lane.
- The canvas pads the world by 36px and fits it to the viewport on load (zoom range 30–200%).

### Whitespace Philosophy

The chrome is dense and the canvas is airy. Panels pack 30px rows so large outlines stay scannable. The canvas keeps generous gutters between groups so flows remain readable when highlighted.

## Elevation

Three tiers plus flat. All tiers use `{colors.shadow}` so they work in both themes.

- **Flat:** panels, top bar, lists, inspector sections. Separation comes from hairlines.
- **Rest** (`0 1px 2px {colors.shadow}`): nodes, active segmented items, zoom control, breadcrumb pill.
- **Float** (`0 8px 28px {colors.shadow}`): step player, empty-state card, hovered deck cards (hover uses `0 4px 16px`).
- **Modal** (`0 24px 60px rgba(0,0,0,.25)`): Export dialog and ⌘K palette, over `{colors.scrim}`.
- **Selection** (`0 0 0 3px {colors.primary-soft}` + 1px primary border): selected node, the node on the current flow step, and the chosen export format.

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
- **`tag-chip`**: 26px pill on Surface 2 with a trailing × icon. The add field is a dashed pill.

### Canvas

- **`node`**: Surface fill, 1px Border, 12px radius, Rest shadow, kind tile plus title (12.5/500) and subtitle (11, muted). A rule glyph appears when rules are attached. States: selected (primary border + halo), dimmed (opacity .2–.22 in focus and flow modes; `--sd-opacity-view-dim` .4 when a saved view dims its kind, e.g. clients in Infra), pinned (small pin glyph on the top-left corner, every level except Landscape), dragging (grab cursor).
- **`group-boundary`**: dashed 1px Border with a 16px radius and Group Fill. Clicking the label drills into that level.
- **`edge`**: 1.5px Edge stroke. Connected to selection: 1.75px Secondary. Selected or in flow: 2–3px Deck Orange. Dimmed: opacity .15–.18. It has a 12px invisible hit area.
- **`edge-label`**: Mono 10.5px pill, Surface fill, 1px Border. It turns solid orange with an On Primary label on the current step.
- **`flow-token`**: 5px orange dot with a 2px Surface stroke and a 10px halo at 20% opacity. It animates along the current edge path (1.4s per loop at 1×).
- **`minimap`**: 182×112 Surface card. Nodes and groups are drawn as rects, and the viewport is an 8-unit orange outline. Clicking pans the canvas.
- **`breadcrumb-pill`**: Deck → View / Flow → Group level. 32px pill with chevrons.
- **`zoom-control`**: −, Mono %, +, divider, fit.

### Flow Mode

- **`flow-chip`** (top bar): Orange Soft pill showing "Flow mode · {name}" with a round close button.
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

## Theming

Both themes share token names. Dark mode does **not** invert tints. Soft fills become deep, low-chroma versions of the same hue, and the ink partners get lighter so contrast holds. Deck Orange shifts slightly lighter in dark (#f07a32) so it still reads as the single accent. Status colours (success, clay) keep their own hues in both themes, so orange stays reserved for action and selection. Shadows get a stronger tint (.45) because dark surfaces cannot show a light shadow.

## Interaction & Motion

- Transitions are short and functional: opacity .25s for dimming, width .2s for tour dots, and no bounce.
- Autosave runs ~650ms after the last edit and shows a "Saving…" → "Saved in this browser" status.
- Keyboard: ⌘/Ctrl+K opens the palette, Esc closes overlays, and ←/→ step through a flow.
- The flow player advances every 1.7s at 1× (0.85s at 2×) and stops at the last step.
- The JSON panel stays in sync both ways: editing the selected node's JSON updates the canvas live, and invalid JSON shows a clay error inline without losing the draft.

## Responsive Behavior

| Name | Width | Key changes |
|---|---|---|
| Desktop | ≥ 1280px | Full three-panel editor. Minimum supported width. |
| Wide | ≥ 1600px | Canvas absorbs extra width. Panel widths stay fixed. |
| Narrow (planned) | 1024–1279px | Left panel collapses to a 56px icon rail. The inspector becomes an overlay sheet. |
| Tablet / mobile | < 1024px | Out of MVP scope. The library grid reflows (auto-fill 250px), and the editor is view-only. |

### Touch & hit targets

- Primary controls are 34–36px tall. Canvas nodes are 164×50. Edges have a 12px hit stroke.
- Icon buttons are at least 28px, and 34px in the top bar.

## Known Gaps

- **Edge creation UI:** drawing a new connection by dragging from node ports is not yet designed.
- **Group editing:** creating, resizing and renaming groups on the canvas is not specified.
- **Custom view rules:** a custom view is created with default content. The filter/field configuration UI is not designed.
- **Validation states:** only JSON and rule-match errors are defined. Field-level validation is not.
- **Multi-select & bulk actions:** not covered.
- **Collaboration / sharing:** out of scope for the local-only MVP.
