# Sododeck design analysis

Source: the Claude Design prototype in [`claude-design/`](claude-design/) (`Sododeck.dc.html` +
`sododeck-data.js` + the `support.js` runtime), imported 2026-09-27, and its screenshots in
[`screens/`](screens/). The prototype's own design-system note (`design.md` in the Claude Design
project) is the ancestor of our [`/DESIGN.md`](../../DESIGN.md); the differences are listed in §3.

The prototype is a **single-file mock**: one React class with inline styles, hard-coded sample
data, `localStorage` persistence, React from unpkg, Google Fonts and Material Symbols. It is a
reference for **look and behavior**, never for code (see [README](README.md)).

Legend used throughout: **P0** = MVP in `docs/spec.md`, **P1/P2** = later. "ui ✅" = already in
`packages/ui`, "ui ➕" = to add to `packages/ui`, "app" = app-specific (canvas, editor).

---

## a. Screen and state inventory

The prototype has five top-level screens (`library`, `editor`, `rules`, the `empty` new-deck editor,
and the editor in flow mode) plus two overlays (export dialog, ⌘K palette), a coach-mark tour and a
toast. All screens exist in light and dark.

### Library (`/`)

| State                                       | Screenshot                                                                                       | Notes                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grid of decks, backup banner, storage meter | [01-library-light](screens/01-library-light.png) · [dark](screens/01-library-dark.png)           | Top bar: wordmark, search (Search decks), theme toggle, Import .sododeck.json, New deck (primary). Sidebar 236px: All decks / Recent / Samples + FOLDERS list + New folder + Browser storage meter. Content: title = current folder, "n decks · stored in this browser", Open sample button, grid/list toggle. First card is the dashed **New deck** card. |
| List view                                   | [07-library-list-view-light](screens/07-library-list-view-light.png)                             | Table: NAME · FOLDER · SIZE (nodes · flows) · EDITED.                                                                                                                                                                                                                                                                                                      |
| Search with no results                      | [08-library-search-no-results-light](screens/08-library-search-no-results-light.png)             | Empty state text: No decks match "…".                                                                                                                                                                                                                                                                                                                      |
| Folder selected, backup banner dismissed    | [09-library-folder-banner-dismissed-light](screens/09-library-folder-banner-dismissed-light.png) |                                                                                                                                                                                                                                                                                                                                                            |
| Import error                                | — (toast only)                                                                                   | "That file is not valid .sododeck.json". No screenshot: toast-only state.                                                                                                                                                                                                                                                                                  |
| New folder dialog, rename/move/delete deck  | —                                                                                                | **Not designed.** "New folder" is a dead row. No deck context menu.                                                                                                                                                                                                                                                                                        |

### Editor (`/deck/:id`)

Layout: top bar 56px · left panel 264px · canvas (fluid) above JSON panel (212px, 36px collapsed) ·
inspector 336px. Minimum width 1280px.

| State                              | Screenshot                                                                                                                    | Notes                                                                                                                                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node selected (default)            | [02-editor-node-selected-light](screens/02-editor-node-selected-light.png) · [dark](screens/02-editor-node-selected-dark.png) | Node inspector: header (tile, title, "Kind · Group · id", delete), TITLE, DESCRIPTION · MARKDOWN (Write/Preview), OWNER (select) + TECH, TAGS, LINKS, RULES (+ Attach), CONNECTIONS · n. JSON panel shows the node, editable. |
| Nothing selected → deck inspector  | [10-editor-deck-inspector-light](screens/10-editor-deck-inspector-light.png)                                                  | NAME, DESCRIPTION, stats (Nodes, Edges, Flows, Rules), VIEWS, STORAGE + Export .sododeck.json.                                                                                                                                |
| Edge selected                      | [11-editor-edge-selected-light](screens/11-editor-edge-selected-light.png)                                                    | "Connection · Edge · e3": From → label → To cards (clickable), LABEL, PROTOCOL select, USED IN FLOWS list (jumps to step).                                                                                                    |
| Edge labels on                     | [12-editor-labels-on-light](screens/12-editor-labels-on-light.png)                                                            | Labels toggle (top-right of canvas) shows every edge label pill.                                                                                                                                                              |
| Focus mode                         | [13-editor-focus-mode-light](screens/13-editor-focus-mode-light.png)                                                          | Selected node + neighbours at full opacity, rest at 0.2; connected edges orange with labels.                                                                                                                                  |
| Palette tab                        | [14-editor-palette-tab-light](screens/14-editor-palette-tab-light.png)                                                        | Filter field, COMPONENTS · DRAG OR CLICK (6 kinds), STRUCTURE (Group, Note — not functional).                                                                                                                                 |
| JSON panel: invalid JSON           | [15-editor-json-error-light](screens/15-editor-json-error-light.png)                                                          | Clay error inline in the panel header; draft kept.                                                                                                                                                                            |
| JSON panel: Deck tab               | [16-editor-json-deck-tab-light](screens/16-editor-json-deck-tab-light.png)                                                    | Whole deck JSON, **read-only** (except in an empty deck).                                                                                                                                                                     |
| JSON panel collapsed               | [17-editor-json-collapsed-light](screens/17-editor-json-collapsed-light.png)                                                  | 36px bar "JSON ⌃".                                                                                                                                                                                                            |
| Markdown preview                   | [18-editor-markdown-preview-light](screens/18-editor-markdown-preview-light.png)                                              | Paragraphs, bullets, inline code only.                                                                                                                                                                                        |
| Group drill-down                   | [19-editor-group-drilldown-light](screens/19-editor-group-drilldown-light.png)                                                | Click a group label → canvas shows only that group; breadcrumb gets a 3rd crumb.                                                                                                                                              |
| View: Infra                        | [20-editor-view-infra-light](screens/20-editor-view-infra-light.png)                                                          | Node subtitle = host; client nodes dimmed to 0.4.                                                                                                                                                                             |
| View: Feature                      | [21-editor-view-feature-light](screens/21-editor-view-feature-light.png)                                                      | Node subtitle = "n flows · owner".                                                                                                                                                                                            |
| New custom view + toast            | [22-editor-custom-view-toast-light](screens/22-editor-custom-view-toast-light.png)                                            | "+" adds "Custom 1"; toast "View "Custom 1" created". No configuration UI.                                                                                                                                                    |
| Inspector scrolled                 | [23-editor-inspector-scrolled-light](screens/23-editor-inspector-scrolled-light.png)                                          | Lower sections (rules, connections).                                                                                                                                                                                          |
| Dragging a node, drop from palette | —                                                                                                                             | Interaction only (grab cursor, live position).                                                                                                                                                                                |
| Delete node                        | — (toast only)                                                                                                                | Immediate, no confirm; toast "X deleted". Removes connected edges.                                                                                                                                                            |

### Flow mode (editor sub-mode)

| State                                            | Screenshot                                                                                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Step with a rule                                 | [03-flow-mode-light](screens/03-flow-mode-light.png) · [dark](screens/03-flow-mode-dark.png) | Top-bar chip "Flow mode · Place order ×". Left panel: Back to canvas, DELIVERY · FLOWS, STEPS list. Canvas: flow edges orange, current edge 3px + solid label + animated token, other nodes 0.22. Step player bottom-centre. Inspector = step: STEP n OF m, from→to tiles, protocol, CONDITION, RULES (compact decision table with matched row + "Evaluated with"), SLA meter. JSON = step, read-only. |
| Step without rule                                | [24-flow-step-no-rule-light](screens/24-flow-step-no-rule-light.png)                         | "No decision table on this step."                                                                                                                                                                                                                                                                                                                                                                      |
| SLA over target                                  | [25-flow-step-sla-over-light](screens/25-flow-step-sla-over-light.png)                       | Clay bar + "Over target by 14%".                                                                                                                                                                                                                                                                                                                                                                       |
| Playing at 2×                                    | [26-flow-playing-2x-light](screens/26-flow-playing-2x-light.png)                             | Pause icon, speed pill 2×.                                                                                                                                                                                                                                                                                                                                                                             |
| Dark, labels                                     | [27-flow-mode-labels-dark](screens/27-flow-mode-labels-dark.png)                             |                                                                                                                                                                                                                                                                                                                                                                                                        |
| Creating / editing a flow, branches, error paths | —                                                                                            | **Not designed** (see §f).                                                                                                                                                                                                                                                                                                                                                                             |

### Rule editor (`/deck/:id/rules`)

| State                                                     | Screenshot                                                                                         | Notes                                                                                                                                                                                                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Decision table, matched test                              | [04-rule-editor-light](screens/04-rule-editor-light.png) · [dark](screens/04-rule-editor-dark.png) | Left: DECISION TABLES list + New. Centre: editable name/description, Hit policy select (First match / Unique / Collect), + Condition, + Action, WHEN/THEN table, Add row, cell syntax hint. Right: TEST INPUT, match result, USED IN (jumps to flow step), CHECKS. |
| No row matches                                            | [28-rule-editor-no-match-light](screens/28-rule-editor-no-match-light.png)                         | Clay "No row matches these inputs".                                                                                                                                                                                                                                |
| Another rule                                              | [29-rule-editor-other-rule-light](screens/29-rule-editor-other-rule-light.png)                     |                                                                                                                                                                                                                                                                    |
| Delete / reorder columns, delete a rule, detach from step | —                                                                                                  | **Not designed.** Row delete exists (hover trash).                                                                                                                                                                                                                 |

### Empty deck and onboarding

| State             | Screenshot                                                                                                                 | Notes                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Tour step 1 of 3  | [05-empty-deck-tour-1-light](screens/05-empty-deck-tour-1-light.png) · [dark](screens/05-empty-deck-tour-1-dark.png)       | Inverse coach mark pointing at the palette.                                               |
| Tour step 2, 3    | [35](screens/35-empty-deck-tour-2-light.png) · [36](screens/36-empty-deck-tour-3-light.png)                                | Inspector; JSON panel + ⌘K.                                                               |
| Empty canvas card | [37-empty-deck-no-tour-light](screens/37-empty-deck-no-tour-light.png) · [40 dark](screens/40-empty-deck-no-tour-dark.png) | "This deck is empty" + Add a service / Paste JSON / Open sample / Replay the 3-step tour. |
| First node added  | [38-empty-deck-node-added-light](screens/38-empty-deck-node-added-light.png)                                               | Node selected, inspector populated.                                                       |
| Paste JSON        | [39-empty-deck-paste-json-light](screens/39-empty-deck-paste-json-light.png)                                               | Deck tab editable in an empty deck; nodes appear live.                                    |

### Overlays

| State                             | Screenshot                                                                                                                                                                   | Notes                                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export: JSON                      | [06-export-json-light](screens/06-export-json-light.png) · [dark](screens/06-export-json-dark.png)                                                                           | 820px modal: format list, SCOPE (Whole deck / Current view / Selected flow), preview, options, footer (filename, size, Copy, Download). "Exports are generated in your browser. Nothing is uploaded." |
| Export: PNG / SVG / PDF / Mermaid | [png](screens/33-export-png-light.png) · [svg](screens/33-export-svg-light.png) · [pdf](screens/33-export-pdf-light.png) · [mermaid](screens/33-export-mermaid-light.png)    | PNG scale 1×/2×/3×, transparent toggle; PDF "Append flow step details"; Mermaid "Keep groups as subgraphs".                                                                                           |
| Export from flow mode             | [34-export-flow-scope-light](screens/34-export-flow-scope-light.png)                                                                                                         | Scope defaults to Selected flow.                                                                                                                                                                      |
| ⌘K palette                        | [30](screens/30-command-palette-light.png) · [filtered](screens/31-command-palette-filtered-light.png) · [no results (dark)](screens/32-command-palette-no-results-dark.png) | Commands, flows, nodes; max 9 results; footer hints.                                                                                                                                                  |
| Toast                             | [22](screens/22-editor-custom-view-toast-light.png)                                                                                                                          | Inverse pill, bottom-centre, 2.6 s.                                                                                                                                                                   |

### Not designed at all

Error boundary / crash screen, storage-quota-exceeded, "deck open in another tab", 404 deck,
loading skeletons, confirm dialogs (delete deck/node/rule), settings, narrow (<1280px) layout.

---

## b. Component inventory

`packages/ui` today has **Button** (primary / secondary / ghost; default / sm / icon / icon-sm),
**Panel** (+ header/sections) and **Tooltip**.

### Chrome and form components (target: `packages/ui`)

| Component                               | Variants / states                                                                                                          | Interactions                            | Status                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| Button                                  | primary, secondary, ghost, icon (28–34px), chip (24–26px pill on surface-2), toggle-active (primary-soft + primary border) | hover, focus ring, disabled             | ui ✅ (primary/secondary/ghost/icon); ➕ `chip`, `toggle` (pressed) variants |
| Text input                              | default, focus (primary border, no glow), inline-edit (borderless until hover)                                             |                                         | ui ➕ `Input`, `InlineEdit`                                                  |
| Textarea (markdown)                     | Mono 12.5/1.55, vertical resize                                                                                            |                                         | ui ➕ `Textarea`                                                             |
| Select                                  | native-looking 36px select                                                                                                 |                                         | ui ➕ `Select` (Radix)                                                       |
| Search field                            | surface-2, leading icon, borderless, optional kbd hint (⌘K)                                                                |                                         | ui ➕ `SearchField`                                                          |
| Segmented control                       | 2–3 items; track surface-2, active = surface + rest shadow                                                                 | keyboard arrows                         | ui ➕ `SegmentedControl` (Radix ToggleGroup)                                 |
| Toggle switch                           | 32×18, off surface-3, on primary                                                                                           |                                         | ui ➕ `Switch`                                                               |
| Tag chip                                | pill with ×; dashed "+ tag" add field                                                                                      | Enter adds (lower-cased, de-duplicated) | ui ➕ `TagChip`, `TagInput`                                                  |
| Link row                                | icon, label, url, ×                                                                                                        | Enter on "Paste a URL" adds             | app (inspector)                                                              |
| Micro-label section                     | uppercase 11px heading + hairline separator                                                                                |                                         | ui ✅ (Panel sections)                                                       |
| Kind tile                               | size 22/28/30/40, radius ≈ 0.3×size, kind soft/ink colors                                                                  |                                         | ui ➕ `KindTile`                                                             |
| Stat tile                               | value + label on surface-2                                                                                                 |                                         | ui ➕ small, or app                                                          |
| Banner                                  | amber (backup), primary-soft/success (match), clay (error)                                                                 | dismiss                                 | ui ➕ `Banner`                                                               |
| Storage meter                           | surface-2 card, 5px bar                                                                                                    |                                         | app                                                                          |
| Deck card, New-deck card, deck list row | thumbnail, Sample pill, meta; hover float shadow                                                                           | open                                    | app (library)                                                                |
| Dialog (export)                         | 820px, radius 20, modal shadow over scrim                                                                                  | Esc, click outside                      | ui ➕ `Dialog` (Radix)                                                       |
| Command palette                         | 580px, 54px input, 42px rows, hint footer                                                                                  | ⌘K, type, Enter, Esc                    | ui ➕ `Command` (shadcn/cmdk — new dep, ask)                                 |
| Toast                                   | inverse pill, 2.6 s                                                                                                        | auto-dismiss                            | ui ➕ `Toast` (sonner? new dep, ask — or tiny own)                           |
| Coach mark (tour tooltip)               | 300px inverse card, arrow, "n of 3", dots, Skip/Back/Next                                                                  |                                         | ui ➕ `CoachMark` (Radix Popover)                                            |
| Breadcrumb (top bar)                    | wordmark / folder / editable deck name                                                                                     |                                         | app                                                                          |
| Autosave status                         | Saving… / Saved in this browser                                                                                            |                                         | app                                                                          |
| Tooltip                                 |                                                                                                                            |                                         | ui ✅                                                                        |

### Canvas components (target: `apps/app/src/editor`, React Flow)

| Component                                 | Variants / states                                                                                                                                                                                                                                                                           | Interactions                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Node (164×50)                             | 6 kinds (client, gateway, service, queue, database, external); subtitle depends on view (tech / host / "n flows · owner"); rule glyph if rules attached. States: default, selected (primary border + 3px halo), in-current-step (same ring), dimmed (0.2–0.22), view-dimmed (0.4), dragging | click select, drag move, click in flow mode jumps to its first step |
| Group boundary                            | dashed border, radius 16, group fill, uppercase label + count; 0.5 opacity in flow mode                                                                                                                                                                                                     | click label → drill into group                                      |
| Edge                                      | orthogonal, 8px rounded corners, 3px end dot, 12px invisible hit stroke. States: default 1.5 edge; connected-to-selection 1.75 ink-secondary; selected 2.5 primary; focus-connected 2 primary; in flow 2 primary @0.55; current step 3 primary; dimmed 0.15–0.18                            | click select; click in flow mode jumps to step                      |
| Queue lane routing                        | edges to/from queue nodes route through one shared vertical lane                                                                                                                                                                                                                            | —                                                                   |
| Edge label pill                           | Mono 10.5, surface + border; current step = solid primary with on-primary text                                                                                                                                                                                                              | shown when Labels on, selected, focused, or in flow                 |
| Flow token                                | 5px primary dot, 2px surface stroke, 10px halo @0.2; loops along the current edge                                                                                                                                                                                                           | —                                                                   |
| Minimap                                   | 182×112 card; groups + nodes as rects; flow nodes orange; viewport outline                                                                                                                                                                                                                  | click pans (smooth)                                                 |
| Canvas breadcrumb pill                    | Deck › View (or Flow: name) › Group                                                                                                                                                                                                                                                         | click goes up                                                       |
| Canvas toolbar                            | Labels toggle, Focus toggle (hidden in flow mode)                                                                                                                                                                                                                                           |                                                                     |
| Zoom control                              | −, %, +, fit                                                                                                                                                                                                                                                                                | 10% steps, 30–200%                                                  |
| Empty-canvas card                         | icon, title, copy, Add a service, Paste JSON, Open sample, Replay tour                                                                                                                                                                                                                      |                                                                     |
| Step player                               | prev / play-pause / next, "Flow · Step n of m", step title, 1×/2× pill, segmented progress (click a segment → step)                                                                                                                                                                         |                                                                     |
| Step row                                  | numbered dot (current / done / upcoming), "From → To", Mono edge label                                                                                                                                                                                                                      | click → step                                                        |
| Condition block                           | code surface, amber `when` keyword, Mono                                                                                                                                                                                                                                                    | read-only                                                           |
| SLA meter                                 | 8px track, fill primary ≤85%, amber 85–100%, clay >100%, ink target tick, status line                                                                                                                                                                                                       | read-only                                                           |
| Decision table (full / compact)           | WHEN (amber) / THEN (primary-soft) header bands, editable column names, Mono condition cells, matched row highlight, row #, delete                                                                                                                                                          | edit cells inline, add row/condition/action                         |
| Rule card                                 | amber-soft row with table icon → opens rule                                                                                                                                                                                                                                                 |                                                                     |
| Sticky note                               | —                                                                                                                                                                                                                                                                                           | **not designed**                                                    |
| Collapsed group with aggregated edge (×N) | —                                                                                                                                                                                                                                                                                           | **not designed**                                                    |
| Branch / error-path edge                  | —                                                                                                                                                                                                                                                                                           | **not designed**                                                    |
| Port handles / edge drawing               | —                                                                                                                                                                                                                                                                                           | **not designed**                                                    |
| Multi-select marquee                      | —                                                                                                                                                                                                                                                                                           | **not designed**                                                    |

---

## c. Design tokens

### Colors — prototype variable → our token

Every prototype color already has a `packages/ui` token. The prototype's short names map as follows
(Tailwind utility in brackets):

| Prototype                | Token (`--sd-*`)                         | Utility              | Light                                          | Dark                                           |
| ------------------------ | ---------------------------------------- | -------------------- | ---------------------------------------------- | ---------------------------------------------- |
| `--app`                  | `app`                                    | `bg-app`             | #e9e9e6                                        | #0b0b0a                                        |
| `--s`                    | `surface`                                | `bg-surface`         | #ffffff                                        | #171716                                        |
| `--s2`                   | `surface-2`                              | `bg-surface-2`       | #f4f4f1                                        | #212120                                        |
| `--s3`                   | `surface-3`                              | `bg-surface-3`       | #ecece8                                        | #2b2b29                                        |
| `--cv`                   | `canvas`                                 | `bg-canvas`          | #fafaf8                                        | #121211                                        |
| `--dot`                  | `dot`                                    | `bg-dot`             | #d9d9d3                                        | #2a2a27                                        |
| `--grp`                  | `group`                                  | `bg-group`           | rgba(255,255,255,.7)                           | rgba(255,255,255,.025)                         |
| `--code`                 | `code`                                   | `bg-code`            | #f7f7f4                                        | #1c1c1b                                        |
| `--bd`                   | `hairline`                               | `border-hairline`    | #ecece8                                        | #262624                                        |
| `--bd2`                  | `border`                                 | `border-border`      | #deded8                                        | #35352f                                        |
| `--edge`                 | `edge`                                   | `stroke-edge`        | #c9c9c2                                        | #3d3d38                                        |
| `--tx`                   | `ink`                                    | `text-ink`           | #1c1c1a                                        | #ededea                                        |
| `--tx2`                  | `text-secondary`                         | `text-ink-secondary` | #55554f                                        | #b8b8b1                                        |
| `--mu`                   | `muted`                                  | `text-ink-muted`     | #72726b                                        | #909089                                        |
| `--ac`                   | `primary`                                | `bg-primary`         | #f2661c                                        | #f07a32                                        |
| `--ach`                  | `primary-hover`                          | `bg-primary-hover`   | **#d9560f** (ours #e85d12)                     | #ff8a45                                        |
| `--acs`                  | `primary-soft`                           | `bg-primary-soft`    | #fdeee4                                        | #3a2214                                        |
| `--act`                  | `primary-ink`                            | `text-primary-ink`   | #b3480c                                        | #ffb285                                        |
| `--ams` / `--amt`        | `amber-soft` / `amber-ink`               |                      | #f6eddb / #8a6112                              | #352a14 / #e2b659                              |
| `--bls` / `--blt`        | `blue-soft` / `blue-ink`                 |                      | #e3ecf5 / #2d5b86                              | #172636 / #8fbbe3                              |
| `--rds` / `--rdt`        | `clay-soft` / `clay-ink`                 |                      | **#f7e5df / #9a3b25** (ours #f9e3e6 / #a3303f) | **#3a1f19 / #ef9f8a** (ours #3a1a20 / #f2a0aa) |
| `--ink` / `--inkt`       | `inverse` / `on-inverse`                 |                      | #1c1c1a / #fff                                 | #ededea / #171716                              |
| `--sh`                   | `shadow`                                 | (in shadows)         | rgba(0,0,0,.06)                                | rgba(0,0,0,.45)                                |
| `--ov`                   | `scrim`                                  | `bg-scrim`           | rgba(28,28,26,.3)                              | rgba(0,0,0,.6)                                 |
| literal `#fff` on orange | `on-primary`                             | `text-on-primary`    | **#fff** (ours #1c1c1a)                        | **#fff** (ours #171716)                        |
| —                        | `success`, `success-soft`, `success-ink` |                      | ours only                                      | ours only                                      |

**Differences from our DESIGN.md (deliberate on our side, see §g-1):** our DESIGN.md changed the
prototype to (1) dark text on orange because white on #f2661c fails contrast (3.1:1), (2) a rose-red
clay so errors never read as orange, (3) a green `success` family for "within SLA", "rule matched"
and success banners (the prototype uses orange for those), (4) a slightly different hover orange.
Everything else is identical.

**Kind tints** (icon tile soft/ink): client = surface-2 / text-secondary · gateway = inverse /
on-inverse · service = primary-soft / primary-ink · queue = amber · database = blue · external = clay
· note = surface-2 / muted.

### Typography

Identical to DESIGN.md and already in `theme.css` (`text-display` 22 … `text-edge-label` 10.5). Geist
for UI, Geist Mono for ids, JSON, edge labels, conditions, SLA values, rule condition cells, zoom %,
keyboard hints. Already self-hosted via @fontsource (the prototype loads Google Fonts — do not copy).

### Spacing and sizes

4px base with 2px micro-steps: Tailwind's default scale covers it (`p-0.5` = 2px … `p-8` = 32px); no
new tokens needed. Fixed sizes worth naming as app-level constants, not tokens: top bar 56, left
panel 264, inspector 336, JSON panel 212 / 36 collapsed / header 40, library sidebar 236, rule list
264, rule test panel 320, node 164×50, node tile 30, minimap 182×112, step player 420–560, command
palette 580, export dialog 820 (format list 280, preview 250 tall), tour card 300, canvas overlay
inset 14, world padding 36, dot grid pitch 22.

### Radius

In theme.css: button 9, input 10, node 12, card 12, group 16, deck-card 16, modal 20, full.
Prototype also uses: 7–8px (segmented items, list rows, small icon buttons), 14px (banner, tour
card), 18px (step player). ➕ Add `rounded-segment` (7px), `rounded-row` (8px), `rounded-banner`
(14px) — or use Tailwind arbitrary values; decide in 000.

### Shadows

In theme.css: `shadow-rest`, `shadow-float`, `shadow-modal`, `shadow-selection`. Prototype also uses
**hover** `0 4px 16px shadow` (deck card hover), **selection + lift** `0 0 0 3px primary-soft, 0 2px 6px
shadow` (selected node), **tour** `0 12px 32px rgba(0,0,0,.25)`. ➕ Add `shadow-hover` and
`shadow-tour` (or reuse float/modal).

### Motion

No motion tokens exist yet. ➕ Add to `packages/ui` (CSS custom properties + TS constants):

| Name                   | Value                                                         | Use                                               |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| `--sd-dur-dim`         | 250 ms, ease (default)                                        | opacity of dimmed nodes/edges (focus, flow, view) |
| `--sd-dur-ring`        | 200 ms                                                        | node selection box-shadow; tour dot width         |
| `--sd-flow-token-loop` | 1400 ms ÷ speed, linear, infinite                             | token travelling along the current edge           |
| `--sd-flow-step`       | 1700 ms ÷ speed                                               | autoplay step interval (1× / 2× → 850 ms)         |
| `--sd-toast`           | 2600 ms                                                       | toast auto-dismiss                                |
| autosave debounce      | 650 ms (design) — **spec G-1/NFR says persist within 500 ms** | "Saving…" → "Saved in this browser"               |

No easing curves or bounce anywhere. All motion must be disabled or reduced under
`prefers-reduced-motion` (token stops moving; show a static marker at the edge midpoint).

---

## d. Data: `sododeck-data.js` vs `.sododeck.json`

### What the file contains

- **Themes**: the two color sets above (`THEMES.light/dark`).
- **Kinds**: `client, edge (=gateway), service, queue, data (=database), external` with labels,
  default icons (Material Symbols names) and tile colors.
- **6 groups** with absolute geometry (`x, y, w, h`): Clients, Edge, Core services, Messaging, Data,
  External.
- **20 nodes** `{ id, group, kind, x, y, title, icon, tech, host, owner, tags[], desc (markdown),
rules[] (rule ids), links[{label,url}] }` — the "Logistics Delivery" system.
- **28 edges** `{ id, from, to, label, proto }`, proto ∈ HTTPS, gRPC, Kafka, SQL, WebSocket (derived
  from the label by regex in the mock).
- **5 flows** `{ id, name, desc, steps[{ e (edge id), cond, sla, rule (single id|null), ctx (sample
inputs for the rule) }] }`: Place order (8), Assign driver (7), Live tracking (6), Proof of delivery
  (6), Failed delivery (7). Linear, no branches. Some steps reuse the same edge.
- **3 rules** (decision tables) `{ id, name, desc, policy (First match|Unique|Collect), conds[],
acts[], rows[{ c[], a[] }] }`: Delivery tier, Reattempt policy, Payment capture.
- **TEAMS** (owner options) and **DECKS** (8 fake library entries; only "Logistics Delivery" is real).
- **Helpers**: `route()` (orthogonal routing with a shared queue lane), `cellMatch()`/`matchRows()`
  (decision-table evaluation: `≤ 5`, `> 20`, `= x`, comma/"or" lists, `Any`/`—`/empty = wildcard),
  `mermaid()` (flowchart LR with subgraphs and kind-specific shapes), `svgString()` (static SVG
  export).

The prototype's own export (`deckJson()`) writes `{ sododeck: 1, name, views: ["System",…], groups:
[{id,label}], nodes: [{ id, type, title, group, tech, owner, tags, position:{x,y}, description,
links, rules }], edges: [{ id, from, to, label, protocol }], flows: [{ id, name, steps: [{ edge,
condition, sla, rule }] }], rules: [ … ] }` — close to, but not, our schema.

### Mapping to `packages/schema` v1 (currently a skeleton: `{ id, ...anything }`)

| Design field                                          | Schema v1 today                                       | Proposal for 001-json-schema-v1                                                                                               |
| ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| deck `name`, `description`                            | **missing** (no top-level metadata)                   | add optional `name`, `description`, `tags` (spec §6 "Deck")                                                                   |
| `node.kind`                                           | `Node.type` (TODO)                                    | `type` enum; values need a decision (§g-4): design `edge`/`data` vs spec/example `gateway`/`database`                         |
| `node.title`, `group`, `owner`, `tags`, `description` | planned (TODO)                                        | as planned; `group` = group id                                                                                                |
| `node.tech`, `node.host`                              | **missing**                                           | add optional `tech`, `host` (drive the System / Infra subtitle)                                                               |
| `node.icon`                                           | **missing**                                           | add optional `icon` (icon key from our icon set, not Material names)                                                          |
| `node.links[{label,url}]`                             | **missing** (K-1 says links on every object)          | add `links` on node, edge, flow, step                                                                                         |
| `node.rules[]` (rule ids on a node)                   | **missing** (spec only has rules on steps)            | add optional `rules: Id[]` on node                                                                                            |
| `node.x, y`                                           | **missing**                                           | position: in the node (`position`) or per view (spec V-4 "pinned positions") — §g-4                                           |
| `node.level` (spec)                                   | planned                                               | not shown in design (semantic zoom not designed)                                                                              |
| group `label`, `x,y,w,h`                              | `Group` TODO (title, children)                        | `title`; geometry — derived from children + padding, or stored; `collapsed` state is UI/view                                  |
| `edge.label`, `from`, `to`                            | planned                                               | as planned                                                                                                                    |
| `edge.proto`                                          | `protocol` planned                                    | enum decision: design HTTPS/gRPC/Kafka/SQL/WebSocket vs spec HTTP/gRPC/event vs example `http`,`sql`                          |
| edge direction, `contract`                            | planned                                               | not in design                                                                                                                 |
| `views: ["System","Feature","Infra","Custom n"]`      | `View` TODO (type, includes, pinned positions)        | `{ id, title, type: system                                                                                                    | feature | infra | custom, includes?, subtitleField? }` — design only shows subtitle field + dimming |
| feature "Delivery" (hard-coded)                       | `Feature` TODO                                        | `{ id, title, description, owner }`; flows reference `feature`                                                                |
| `flow.name`, `desc`                                   | `Flow` TODO (feature, title, steps, trigger, outcome) | `title`, `description`, `feature`; trigger/outcome not in design                                                              |
| `step.e`, `cond`, `sla`                               | planned                                               | `{ id, edge, condition, sla }` — **steps need their own stable id** (constitution III)                                        |
| `step.rule` (single)                                  | spec `rules: []` (array)                              | array `rules: Id[]`; design shows one                                                                                         |
| `step.ctx` (rule sample inputs)                       | **missing**                                           | add optional `ruleInputs` / `context` map — or drop (belongs to the simulator, A-1 P1)                                        |
| step `branch`, `payload`                              | spec §6                                               | **not in design**                                                                                                             |
| rules `{id,…}[]` array                                | object keyed by id                                    | keep keyed object (ADR 0002)                                                                                                  |
| `rule.name`, `desc`                                   | `title`, `notes` planned                              | `title`, `description`                                                                                                        |
| `rule.policy`, `conds[]`, `acts[]`, `rows[{c,a}]`     | spec example `table: [{when, then}]` (free text)      | structured table: `hitPolicy`, `inputs[]`, `outputs[]`, `rows[{ id, when[], then[] }]` — design wins, needs a decision (§g-4) |
| TEAMS                                                 | —                                                     | not stored; owner is free text with suggestions from existing owners                                                          |
| theme                                                 | —                                                     | UI preference (localStorage), **not** document data — the mock saves it in the deck                                           |
| DECKS (folder, edited, sample)                        | —                                                     | library metadata in Dexie (`apps/app/src/storage`), not in the file                                                           |

**Schema fields the design does not show:** `$schema`, `version` (only implicit), `node.level`,
`edge.contract`, edge direction, `flow.trigger`, `flow.outcome`, `step.branch`, `step.payload`,
`stickies` (entire concept), `view.includes` / pinned positions, `feature.owner`, entity state
machines, ADRs, comments.

---

## e. Behavior (from the prototype's logic and the `support.js` runtime)

`support.js` is only the prototype runtime (template parsing, `sc-if`/`sc-for`, loading React from a
CDN, design-mode messaging). It holds **no product behavior**; all behavior lives in the component
script in `Sododeck.dc.html`. Described as user-facing behavior:

**Global**

- ⌘/Ctrl+K toggles the command palette anywhere; Esc closes the palette and the export dialog.
- Theme toggle (sun/moon) switches light/dark instantly.
- Toasts confirm actions (export, copy, delete, view created, import) and vanish after 2.6 s.
- Any edit shows "Saving…" in the top bar, then "Saved in this browser" ~650 ms after the last edit.

**Library**

- Search filters decks by name as you type. Sidebar filters: All decks, Recent (4 most recent),
  Samples, or a folder. Grid ↔ list toggle.
- Import .sododeck.json: pick a file; valid → it appears first in "Unsorted" with a toast; invalid →
  toast "That file is not valid .sododeck.json".
- New deck → empty editor with the palette open and the 3-step tour started.
- Backup banner: "Export backup" downloads all decks as one JSON file; × dismisses the banner.
- Clicking a card opens that deck.

**Canvas**

- On open (and on drill-down) the canvas fits the world into view (fit zoom clamped 40–130%).
- Zoom − / + in 10% steps, range 30–200%; fit button re-fits. Scroll pans.
- Click a node to select it; drag to move (3px threshold); click empty canvas to deselect.
- Click an edge (12px hit area) to select it.
- Drag a component from the palette and drop it on the canvas, or click it to add at an automatic
  position; the new node is selected.
- Labels toggle shows all edge labels. Focus toggle dims everything not connected to the selection.
- Click a group label to drill into that group; breadcrumb crumbs go back up.
- Minimap click pans (smoothly) to that point.
- Views (System / Feature / Infra) change node subtitles (tech / "n flows · owner" / host); Infra
  dims clients. "+" creates "Custom n" (no configuration).

**Inspector**

- Node: edit title, markdown description (Write/Preview), owner (select), tech; add tag with Enter
  (lower-cased, unique), remove with ×; paste a URL + Enter adds a link (protocol stripped, label =
  domain); Attach adds the next unattached rule; rule row opens the rule editor; connection rows
  select that edge; trash deletes the node and its edges immediately (toast, no undo).
- Edge: edit label and protocol; From/To cards select that node; "Used in flows" rows open the flow
  at that step.
- Deck (nothing selected): edit name and description; stats; Export .sododeck.json backup.

**JSON panel**

- Tabs: selection (node / edge / step) and Deck. Selected node JSON is editable: valid edits update
  the canvas live; invalid JSON shows the parser error inline and keeps the draft; changing `id`
  is rejected ("id cannot be changed"). Edge, step and Deck JSON are read-only — except in an empty
  deck, where the Deck tab accepts a pasted deck. Copy button; collapse to a 36px bar.

**Flow mode**

- Open a flow from the left panel, the palette, ⌘K, an edge's "Used in flows" or a rule's "Used in".
- The flow's edges turn orange, everything else dims; the current step's edge is thicker, its label
  solid orange, and a token loops along it (1.4 s at 1×).
- ← / → step backward/forward (not while typing); prev/next buttons; click a step row, a progress
  segment, a flow edge or a flow node to jump.
- Play advances every 1.7 s (0.85 s at 2×) and stops on the last step; play on the last step
  restarts from step 1. Changing speed pauses.
- The inspector shows the step's condition, attached decision table with the matching row for the
  step's sample inputs, and the SLA target vs a "measured" value (**fake in the mock**).
- Edit rule opens the rule editor pre-filled with the step's inputs. × or Back to canvas exits.

**Rule editor**

- Edit rule name, description, hit policy; add condition/action columns (existing rows get "Any" /
  empty); rename columns inline; edit cells inline; add row; delete row (hover trash).
- Test input: one field per condition; the matching row highlights live and the result card lists
  the actions (or "No row matches"). Hit policy First match / Unique returns the first match; Collect
  returns all.
- Used in: flow steps using the rule (click → flow at that step). Checks: warns when there is no
  catch-all row; explains the hit policy.

**Export**

- Choose format (JSON, PNG, SVG, PDF, Mermaid) and scope (Whole deck, Current view, Selected flow —
  disabled outside flow mode); preview updates live; per-format options. Download names the file
  from the deck name (`logistics-delivery.sododeck.json`). PDF opens the print dialog. Copy for
  text formats.

**Onboarding**

- New deck starts a 3-step coach-mark tour (Add components → Connect and describe → Everything is
  JSON). Adding a node on step 1 advances to step 2. Skip / Back / Next / Done; "Replay the 3-step
  tour" on the empty canvas card.

---

## f. Gap analysis vs `docs/spec.md`

### In the design AND P0 → build

| Req                                       | Design coverage                                            | Feature   |
| ----------------------------------------- | ---------------------------------------------------------- | --------- |
| C-1 blank canvas + palette                | palette with 6 kinds, drag/click to add, empty-canvas card | 003       |
| C-3 command palette                       | ⌘K over commands, flows, nodes (not edges/rules)           | 009       |
| C-5 JSON panel two-way sync               | selection + deck tabs, inline error, copy, collapse        | 004       |
| V-3 focus mode                            | Focus toggle                                               | 010       |
| V-4 saved views                           | System / Feature / Infra tabs + custom                     | 011       |
| F-2 flow highlight + token                | full                                                       | 007       |
| F-3 step player + step panel              | full (condition, rules, SLA; no payload)                   | 007       |
| F-5 flow list per feature                 | list, no search/filter                                     | 006 / 007 |
| K-1 title, markdown, owner, tags, links   | on nodes (edge: label only)                                | 008       |
| K-2 decision tables reusable across steps | full rule editor + compact table on steps                  | 008       |
| G-1 autosave                              | Saving… / Saved                                            | 005       |
| G-2 local library, folders, search        | full (except New folder dialog)                            | 005       |
| G-3 export/import                         | Import button + Export dialog                              | 005 / 012 |
| G-4 storage usage                         | storage meter                                              | 005       |
| G-5 backup reminder                       | backup banner + Export backup                              | 005       |
| I-1 export JSON/PNG/SVG/PDF/Mermaid       | full dialog                                                | 012       |

### In the design but not P0 → backlog "later"

| Design element                               | Spec                                                             | Note                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Rule test input + checks (catch-all warning) | A-1 rule simulator (P1), Q-4 linter (P2)                         | Small and already designed; proposed as **optional** in 008 — decision §g-5 |
| SLA "measured" value + meter                 | R-1 runtime overlay (P2), A-4 (P1)                               | Mock data. Keep target only; decision §g-5                                  |
| Onboarding 3-step coach marks                | K-8 guided tours (P2) — but AGENTS.md M5 lists "onboarding tour" | Treat as M5 013 (lightweight first-run hints), not K-8 system tours         |
| Step "Evaluated with" sample inputs          | A-1 (P1)                                                         | tied to the test input                                                      |
| Views dimming clients in Infra               | V-5 role-based views (P1)                                        | M4 011 can include the simple version                                       |

### P0 in the spec but missing from the design

| Req                                                       | What's missing                                                                   | Proposal                                                                                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| C-1 cloud icons (AWS/GCP/Azure), actor, partner kinds     | only 6 generic kinds                                                             | **needs design** for cloud kinds; lucide has no brand icons — use generic `cloud` + a provider badge text (sensible default)                |
| C-2 draw / reconnect edges; edit direction inline         | no ports, no edge creation at all (design.md "Known Gaps")                       | **needs design**; default: React Flow handles on node sides on hover, drag to connect, drag endpoint to reconnect                           |
| C-4 auto-layout with pinning                              | no button, no pin indicator                                                      | sensible default: "Tidy layout" button in canvas toolbar + pin icon on pinned nodes                                                         |
| C-6 undo/redo, multi-select, bulk edit                    | none                                                                             | default: ⌘Z/⇧⌘Z (Yjs UndoManager), shift-click + marquee; **bulk-edit inspector needs design**                                              |
| C-7 validation (orphans, broken flows, duplicate edges)   | only rule checks + JSON parse error                                              | default: a "Problems" list in the deck inspector + warning glyph on nodes/flows                                                             |
| V-1 semantic zoom, 4 levels, double-click drill           | one group drill-down + breadcrumb                                                | **needs design** for levels; default: reuse drill-down + breadcrumb, add level from `node.level`                                            |
| V-2 collapsible groups with aggregated edge (×N)          | groups can't collapse on canvas                                                  | **needs design** (small); default: chevron on group label, collapsed group = node-sized card, edges merged with "×N" pill                   |
| F-1 create a flow by clicking edges                       | **no flow authoring at all** ("+" in Features does nothing)                      | **needs design** (biggest gap); default: "Record flow" mode — click edges in order, step list builds on the left, Done/Cancel in a top chip |
| F-4 branches + conditions, error paths styled differently | flows are linear; no error style                                                 | **needs design**; default: step has optional `branchOf` + label; error path = dashed clay edge + "error" icon (non-color cue)               |
| F-5 search/filter in flow list                            | none                                                                             | default: filter field above the list (as in palette)                                                                                        |
| K-1 on edges, flows, steps                                | edge: label/protocol only; step inspector read-only; flow has no editable fields | default: reuse node inspector sections for edge/flow/step; condition & SLA become editable fields                                           |
| K-3 sticky notes (free or anchored)                       | "Note" in palette only; no visual                                                | **needs design**; default: amber-soft card, 180px, markdown, anchor badge                                                                   |
| K-4 global search across titles, notes, rules             | ⌘K searches titles only                                                          | default: extend ⌘K results with rules, edges, stickies and description matches (snippet line)                                               |
| G-4 `storage.persist()` request                           | meter only                                                                       | default: request on first save; show "Persistent storage: on/off" in the meter card                                                         |
| G-5 Safari 7-day warning                                  | generic banner                                                                   | default: add Safari-specific copy when detected                                                                                             |
| G-6 multi-tab via BroadcastChannel                        | none                                                                             | default: "Open in another tab — read-only here" banner (needs a quick design pass)                                                          |
| NFR a11y: keyboard canvas navigation, non-color cues      | not addressed                                                                    | default: arrow-key node traversal, focus ring = selection ring, dimmed items keep labels; error path dashed                                 |

---

## g. Open questions and conflicts

1. **Tokens: prototype vs DESIGN.md.** The prototype uses white text on orange, a brick-red clay,
   no success green and a darker hover. Our DESIGN.md changed these for contrast. _Proposal:
   DESIGN.md wins; the prototype's look is matched "pixel-close" except these four tokens._
2. **Icons: Material Symbols (prototype) vs `lucide-react` (AGENTS.md, constitution).** ~70
   Material glyphs are used, including per-node icons (`receipt_long`, `local_shipping`, …).
   _Proposal: lucide with a mapping table in 000; node `icon` stores a lucide key. Stroke weight
   1.5 to match Material weight 300._
3. **JSON panel scope and engine.** Design: plain textarea, only the selected node is editable;
   Deck/edge/step JSON read-only. Spec C-5 + constitution: Monaco with JSON Schema autocomplete,
   full two-way sync. _Proposal: Monaco for both tabs; Deck tab editable too (it is the core promise
   of C-5), keeping the design's header, error line and selection tab._
   **Decision (founder, 2026-09-27):** read-only for now. The panel shows the canvas as
   JSON (Selection + Deck tabs), live, with Copy and collapse; editing from JSON is deferred
   (backlog 004).
4. **Schema shape.** (a) node kind enum names (`gateway`/`database` vs `edge`/`data`), (b) protocol
   enum, (c) positions in nodes vs per view (V-4 "pinned positions"), (d) structured decision table
   (design) vs free-text `when/then` (spec §6 example), (e) step `rule` single vs `rules[]`, (f) new
   fields: deck name/description, tech, host, icon, links, node-level rules, step sample inputs.
   _Proposal: design-driven structured tables, `gateway`/`database`, positions on nodes with
   optional per-view overrides later, `rules[]` arrays, all new fields optional._
5. **Flow authoring, branches, stickies, edge drawing, semantic zoom, collapsible groups are
   undesigned** but P0 (F-1, F-4, K-3, C-2, V-1, V-2). _Decision: request designs from Claude
   Design before 006/009/010, or accept the defaults in §f._
6. **Designed features that are P1/P2 in the spec**: rule test panel + checks (A-1/Q-4), measured
   SLA (R-1), onboarding tour (K-8 is P2, but M5 lists it). _Proposal: include the rule test panel
   (cheap, already designed), drop "measured" SLA (show target only, no fake data), keep the 3-step
   first-run tour in M5._
   **Decision (founder, 2026-09-27):** as proposed: rule test panel + catch-all check in 008,
   SLA target only, 3-step tour in M5 (013).
7. **Autosave timing**: design debounce 650 ms vs spec/constitution "persist within 500 ms".
   _Proposal: Yjs + y-indexeddb persists each update immediately; the "Saving…" label is purely
   cosmetic with a ≤ 300 ms hold._
   **Decision (founder, 2026-09-27):** as proposed, plus an error state "Couldn't save — export a
   backup" (not designed yet).
8. **Group geometry**: design stores fixed group rectangles; resizing/creating groups isn't
   designed. _Proposal: group bounds computed from member nodes + padding (no stored geometry)._
9. **Edge routing**: the mock uses custom orthogonal routing with a shared queue lane. _Proposal:
   React Flow `smoothstep` with 8px radius; no queue lane in MVP (ELK can add orthogonal routing in
   011)._
10. **Owner field**: design uses a fixed team list (`TEAMS`). _Proposal: free text with a datalist of
    owners already used in the deck._
    **Decision (founder, 2026-09-27):** as proposed.
11. **Delete without confirm/undo** in design. Constitution-friendly default: no confirm, but undo
    (C-6) and a toast with "Undo".
    **Decision (founder, 2026-09-27):** deleting **asks for confirmation**; undo (⌘Z) still works
    after a confirmed delete.
12. **Library "Recent"** = first 4 in the mock. _Proposal: last 7 days by `updatedAt`._
    **Decision (founder, 2026-09-27):** the 8 most recently **opened** decks (`openedAt` in library
    metadata, not in the deck).
13. **Theme in document**: the mock saves the theme inside the deck. It is a UI preference
    (localStorage), never document data (constitution I).
14. **Third-party requests**: the mock loads React (unpkg) and fonts/icons (Google). The app must
    bundle everything (constitution IV) — already true for fonts; icons via lucide.
15. **Accessibility**: flow state relies on orange; dimming is opacity only; tour/coach marks trap
    no focus. Constitution VII requires non-color cues and keyboard operability. Additions: step
    numbers on edge labels in flow mode, dashed style for error paths, visible focus rings on
    nodes/edges, arrow-key navigation, `aria-live` for step changes and toasts.
16. **E2E tests**: the task's shared DoD asks for e2e tests; the constitution (VI, TODO(e2e)) defers
    new Playwright tests. The backlog follows the constitution: existing smoke suite must pass, no
    new e2e specs, visual check against screenshots is manual/screenshot-based.
17. **Spec §6 schema URL** (`sododeck.dev`) vs ADR 0002/code (`sododeck.com`) — known, unrelated to
    the design; fix in 001.
