# Sododeck design analysis

Source: the Claude Design prototype in [`claude-design/`](claude-design/) (`Sododeck.dc.html` +
`sododeck-data.js` + the `support.js` runtime), imported 2026-09-27, and its screenshots in
[`screens/`](screens/). The same day the project gained **states 41–85** (`Sododeck State.dc.html`

- `sododeck-states.js`, laid out on the `Sododeck Extensions.dc.html` board): flow authoring and
  branches, edge drawing, multi-select, problems, cloud/partner kinds, stickies, semantic zoom,
  collapsible groups, folder/deck menus, storage, multi-tab and autosave states. They are listed in
  §a and checked against DESIGN.md and the founder decisions in §g-18 onward. The prototype's own design-system note (`design.md` in the Claude Design
  project) is the ancestor of our [`/DESIGN.md`](../../DESIGN.md); the differences are listed in §3.

On 2026-09-28 the project gained the **canvas-first editor, states 86–116**
(`Sododeck Canvas State.dc.html` + `sododeck-canvas.js`, laid out on the
`Sododeck Canvas-first.dc.html` board): shell, card quick-edit, card colours and editing
affordances for backlog 016–020. They are listed in §a, their components in §b, their tokens in §c,
their data in §d, and their conflicts in §g-42–§g-54.

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
| New folder dialog, rename/move/delete deck  | → 72–77 below                                                                                    | Designed in states 72–77 (new-folder dialog with inline errors, folder and deck context menus, inline rename).                                                                                                                                                                                                                                             |

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
| Delete node                        | — (toast only); bulk delete → 59                                                                                              | Immediate, no confirm; toast "X deleted". Removes connected edges. Founder decision §g-11: ask for confirmation.                                                                                                              |

### Flow mode (editor sub-mode)

| State                                            | Screenshot                                                                                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Step with a rule                                 | [03-flow-mode-light](screens/03-flow-mode-light.png) · [dark](screens/03-flow-mode-dark.png) | Top-bar chip "Flow mode · Place order ×". Left panel: Back to canvas, DELIVERY · FLOWS, STEPS list. Canvas: flow edges orange, current edge 3px + solid label + animated token, other nodes 0.22. Step player bottom-centre. Inspector = step: STEP n OF m, from→to tiles, protocol, CONDITION, RULES (compact decision table with matched row + "Evaluated with"), SLA meter. JSON = step, read-only. |
| Step without rule                                | [24-flow-step-no-rule-light](screens/24-flow-step-no-rule-light.png)                         | "No decision table on this step."                                                                                                                                                                                                                                                                                                                                                                      |
| SLA over target                                  | [25-flow-step-sla-over-light](screens/25-flow-step-sla-over-light.png)                       | Clay bar + "Over target by 14%".                                                                                                                                                                                                                                                                                                                                                                       |
| Playing at 2×                                    | [26-flow-playing-2x-light](screens/26-flow-playing-2x-light.png)                             | Pause icon, speed pill 2×.                                                                                                                                                                                                                                                                                                                                                                             |
| Dark, labels                                     | [27-flow-mode-labels-dark](screens/27-flow-mode-labels-dark.png)                             |                                                                                                                                                                                                                                                                                                                                                                                                        |
| Creating / editing a flow, branches, error paths | → 41–46 below                                                                                | Designed in states 41–46 (recording mode, branches, error path).                                                                                                                                                                                                                                                                                                                                       |

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

### States 41–85 (`Sododeck State.dc.html`, added 2026-09-27)

Rendered one frame per state from `sododeck-states.js`; the board `Sododeck Extensions.dc.html` groups them into four sections and adds notes (user did / what changed / keyboard / empty-error-motion). Every state exists in light and dark. Frames reuse the editor layout above; the left panel now has **Outline / Palette** tabs and a FEATURES list at the bottom.

#### A · Flows (006, 007, 008)

| #   | State                         | Screenshots                                                                                     | Notes                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 41  | Record a flow · empty         | [light](screens/41-rec-empty-light.png) · [dark](screens/41-rec-empty-dark.png)                 | "+ New flow" in Features, named. Recording chip (Undo / Done / Cancel) replaces the view switcher; left panel becomes NEW FLOW name + STEPS ("No steps yet"); canvas stays at full opacity; hovering an edge previews it as step 1 (dotted orange). Done disabled until one step exists.                                                                                    |
| 42  | Record a flow · mid recording | [light](screens/42-rec-mid-light.png) · [dark](screens/42-rec-mid-dark.png)                     | Recorded edges orange with numbered step badges; next-start node gets a ring and a "Step 4 starts here" tag; its outgoing edges are dotted candidates. Step rows have grip + remove on hover; "Next: click an edge leaving …" hint. ⌘Z undo last step, ⌥↑/↓ move, ⌫ remove. A reorder that breaks the chain marks rows with a clay dashed dot + alert icon and blocks Done. |
| 43  | Record a flow · invalid click | [light](screens/43-rec-invalid-light.png) · [dark](screens/43-rec-invalid-dark.png)             | Non-contiguous edge flashes clay, dashed, with a ban icon; popover "Can't add this edge as step 5" + "Add as branch from step 2" / "Got it"; same message in the step list and a polite live region. **Nothing is added** (see §g-18).                                                                                                                                      |
| 44  | Record a flow · finished      | [light](screens/44-rec-finished-light.png) · [dark](screens/44-rec-finished-dark.png)           | Done saves the flow (5 steps) to the feature and switches to normal flow mode on step 1; toast. Save failure → autosave error (85).                                                                                                                                                                                                                                         |
| 45  | Branches · creating a branch  | [light](screens/45-branch-create-light.png) · [dark](screens/45-branch-create-dark.png)         | Focused step 3, pressed B. Step list indents "◇ payment ok" and a new "◇ payment failed" branch; inspector edits branch label, condition and an **Error path** toggle. Label + condition required (clay inline error on Done).                                                                                                                                              |
| 46  | Branches · tree + error path  | [light](screens/46-branch-tree-light.png) · [dark](screens/46-branch-tree-dark.png)             | Shared trunk, then indented branches with ◇ condition headers; step numbers 4a/5a, 4b/5b. Error branch = dashed clay edge + circle-alert icon on label and step badge; ok branch solid orange. Player gets an "AT STEP 3" branch picker (segmented); ↑/↓ switch branch at a fork. Overlapping conditions → amber Problems warning.                                          |
| 47  | Flow list filter              | [light](screens/47-flow-filter-light.png) · [dark](screens/47-flow-filter-dark.png)             | / focuses the filter; live filtering with match count "2 of 5"; matches bold + underlined (not colour only); parent feature stays visible.                                                                                                                                                                                                                                  |
| 48  | Flow list filter · no results | [light](screens/48-flow-filter-empty-light.png) · [dark](screens/48-flow-filter-empty-dark.png) | Empty state with "Clear filter" and "New flow 'refund'" actions. Filter searches names, step labels and conditions.                                                                                                                                                                                                                                                         |
| 49  | Inspector · edge              | [light](screens/49-insp-edge-light.png) · [dark](screens/49-insp-edge-dark.png)                 | Edge + both endpoints get the selection ring. TITLE (= label), FROM/TO selects, PROTOCOL segmented (HTTPS/gRPC/Kafka/SQL/WS), markdown DESCRIPTION, OWNER, DIRECTION, TAGS, LINKS, USED IN FLOWS. ⌫ deletes with an Undo toast.                                                                                                                                             |
| 50  | Inspector · flow              | [light](screens/50-insp-flow-light.png) · [dark](screens/50-insp-flow-dark.png)                 | Flow open with no step picked: all flow edges equal weight with numbered badges. TITLE, markdown DESCRIPTION, OWNER, FEATURE, TAGS, LINKS, summary. ⌘↵ plays from the start.                                                                                                                                                                                                |
| 51  | Inspector · step              | [light](screens/51-insp-step-light.png) · [dark](screens/51-insp-step-dark.png)                 | Step inspector: TITLE, markdown DESCRIPTION, OWNER, EDGE, TAGS, CONDITION, SLA TARGET + meter with "p95 86 ms · within target", ATTACHED RULES (matched row summary). **Shows a measured value** (conflicts with §g-6).                                                                                                                                                     |

#### B · Canvas editing (003, 008, 009, 015)

| #   | State                            | Screenshots                                                                                     | Notes                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 52  | Edges · hover handles            | [light](screens/52-edge-hover-light.png) · [dark](screens/52-edge-hover-dark.png)               | Four connection handles on the hovered (or Tab-focused) node; the one under the pointer grows and fills; tooltip teaches "C" to connect by keyboard. No handles in read-only or flow mode.                                                                                                                        |
| 53  | Edges · dragging                 | [light](screens/53-edge-dragging-light.png) · [dark](screens/53-edge-dragging-dark.png)         | Dashed orange ghost line follows the pointer; bottom hint bar (release / Esc). Release on empty canvas cancels silently.                                                                                                                                                                                          |
| 54  | Edges · valid target             | [light](screens/54-edge-valid-target-light.png) · [dark](screens/54-edge-valid-target-dark.png) | Target gets a dashed orange ring + "+" badge; ghost snaps to the final route and turns solid. Release creates the edge and opens the popover (57).                                                                                                                                                                |
| 55  | Edges · invalid drop             | [light](screens/55-edge-invalid-drop-light.png) · [dark](screens/55-edge-invalid-drop-dark.png) | Already-connected target: dashed clay ring + ban badge, the existing edge highlights, tooltip explains. Self-connection shows the same state.                                                                                                                                                                     |
| 56  | Edges · keyboard connect         | [light](screens/56-edge-keyboard-light.png) · [dark](screens/56-edge-keyboard-dark.png)         | Focused node + C: "Connect Order Service to…" listbox with type-ahead; highlighted option previews its edge. Duplicates listed but disabled ("already connected"); "No nodes match".                                                                                                                              |
| 57  | Edges · inline edit popover      | [light](screens/57-edge-popover-light.png) · [dark](screens/57-edge-popover-dark.png)           | After creating (or double-click): popover with label, protocol, direction; live; inspector mirrors. Delete removes the edge with an Undo toast.                                                                                                                                                                   |
| 58  | Multi-select · mixed values      | [light](screens/58-multi-select-light.png) · [dark](screens/58-multi-select-dark.png)           | Shift-click / marquee: frame with "3 selected"; bulk inspector with KIND, OWNER, TECH, GROUP, TAGS; differing values show italic "Mixed"; partial tags dashed with "2/3"; "Delete 3 nodes".                                                                                                                       |
| 59  | Multi-select · deleted with Undo | [light](screens/59-bulk-delete-light.png) · [dark](screens/59-bulk-delete-dark.png)             | ⌫ removes nodes and their edges immediately; toast "Deleted 3 nodes and 8 edges · Undo" for 6 s; ⌘Z still works after. **No confirmation** (conflicts with §g-11).                                                                                                                                                |
| 60  | Problems list                    | [light](screens/60-problems-light.png) · [dark](screens/60-problems-dark.png)                   | Deck inspector PROBLEMS section (orphan node, broken flow, duplicate edge, step without edge); amber triangle glyph on affected nodes/edges; amber "4 problems" button on the canvas; ↵ selects, ⌘. next problem. Empty: "No problems" with a check.                                                              |
| 61  | Cloud and partner kinds          | [light](screens/61-cloud-partner-light.png) · [dark](screens/61-cloud-partner-dark.png)         | Palette gets CLOUD & PARTNERS: Cloud resource (neutral cloud tile + AWS / GCP / AZURE text badge) and Partner (handshake tile + PARTNER badge); no brand logos. Inspector adds PROVIDER (AWS/GCP/Azure/Other), SERVICE, REGION, RESOURCE ID.                                                                      |
| 62  | Sticky notes                     | [light](screens/62-stickies-light.png) · [dark](screens/62-stickies-dark.png)                   | Amber-soft 180 px markdown notes; pinned note has a dotted leader + pin to its node and moves with it; collapsed = one line + chevron. Inspector: TEXT (markdown), ANCHOR Free / Pinned to node, PINNED TO, DISPLAY Expanded / Collapsed, "Stay visible during flows". N adds a note; empty note deleted on blur. |
| 63  | Sticky notes during a flow       | [light](screens/63-stickies-flow-light.png) · [dark](screens/63-stickies-flow-dark.png)         | Notes dim to 35% during playback; a note pinned to a node on the current step stays at full opacity; "Notes: dimmed" control (shown / dimmed / hidden).                                                                                                                                                           |

#### C · Scale (010)

| #   | State                                 | Screenshots                                                                                     | Notes                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 64  | Semantic zoom · landscape             | [light](screens/64-zoom-landscape-light.png) · [dark](screens/64-zoom-landscape-dark.png)       | ≤ 45%: groups become solid regions with large labels, nodes show only their kind tile, edges faint. Zoom control gains a **level indicator** (4 bars + name). Thresholds: Landscape ≤ 45% · System 46–90% · Container 91–150% · Component > 150% or drilled into a node. |
| 65  | Semantic zoom · system                | [light](screens/65-zoom-system-light.png) · [dark](screens/65-zoom-system-dark.png)             | Nodes show title only; group label hover shows the drill hint (double-click / ↵).                                                                                                                                                                                        |
| 66  | Semantic zoom · container             | [light](screens/66-zoom-container-light.png) · [dark](screens/66-zoom-container-dark.png)       | Drilled into Core services: only its members, title + tech; breadcrumb adds the level; outline lists members and an "Up" row. Esc / ⌫ goes up.                                                                                                                           |
| 67  | Semantic zoom · component             | [light](screens/67-zoom-component-light.png) · [dark](screens/67-zoom-component-dark.png)       | Drilled into Order Service: components as full cards (title, tech, owner, tags, rule glyph); outside connections as dashed **port pills** at the edge (click → that node one level up).                                                                                  |
| 68  | Collapsible group · expanded          | [light](screens/68-group-expanded-light.png) · [dark](screens/68-group-expanded-dark.png)       | Chevron appears in the group label on hover; focus ring on keyboard focus; Space / ↵ toggles.                                                                                                                                                                            |
| 69  | Collapsible group · collapsed         | [light](screens/69-group-collapsed-light.png) · [dark](screens/69-group-collapsed-dark.png)     | Node-sized stacked card with name + member count; edges to each neighbour merge into one with a count pill (×5, ×2) and a direction icon. Group inspector: Collapsed toggle, MERGED EDGES list, Expand group. "Collapse state is saved per view".                        |
| 70  | Collapsible group · merged edge hover | [light](screens/70-merged-edge-hover-light.png) · [dark](screens/70-merged-edge-hover-dark.png) | Merged edge darkens; popover lists the underlying edges (label + direction); ↵ on a row expands and selects that edge.                                                                                                                                                   |
| 71  | Collapsible group · flow through it   | [light](screens/71-flow-collapsed-light.png) · [dark](screens/71-flow-collapsed-dark.png)       | Steps inside a collapsed group light the card (ring + pulsing dot) and the player says "inside Core services"; merged edges on the path carry step badges. Reduced motion: static dot.                                                                                   |

#### D · Library and status (005)

| #   | State                            | Screenshots                                                                                           | Notes                                                                                                                                                                                                                                                                               |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 72  | New folder · empty name          | [light](screens/72-new-folder-empty-light.png) · [dark](screens/72-new-folder-empty-dark.png)         | New folder dialog; Create with empty name → 1.5 px clay border + icon + inline message; focus stays in the field.                                                                                                                                                                   |
| 73  | New folder · duplicate name      | [light](screens/73-new-folder-duplicate-light.png) · [dark](screens/73-new-folder-duplicate-dark.png) | Same inline error, specific message; case-insensitive, trimmed.                                                                                                                                                                                                                     |
| 74  | Folder menu · delete             | [light](screens/74-folder-menu-light.png) · [dark](screens/74-folder-menu-dark.png)                   | Right-click / Shift+F10 on a folder: Rename, Export folder, Delete folder.                                                                                                                                                                                                          |
| 75  | Folder deleted + rename          | [light](screens/75-folder-rename-light.png) · [dark](screens/75-folder-rename-dark.png)               | Deleted folder's decks move to Unfiled, toast with Undo (**no confirmation**); F2 turns a folder row into an inline field.                                                                                                                                                          |
| 76  | Deck menu on a card              | [light](screens/76-deck-menu-card-light.png) · [dark](screens/76-deck-menu-card-dark.png)             | ⋯ on a card: Open, Rename (F2), Duplicate (⌘D), Move to folder › (submenu, current folder checked), Export .sododeck.json (⌘E), Delete.                                                                                                                                             |
| 77  | Deck menu on a list row + delete | [light](screens/77-deck-menu-row-light.png) · [dark](screens/77-deck-menu-row-dark.png)               | Same menu on a list row. Delete: **no confirm dialog**, row disappears, toast with Undo for 6 s (conflicts with §g-11). Render glitch: the row's ⋯ button draws over the top-bar "New deck" button.                                                                                 |
| 78  | Recent decks                     | [light](screens/78-recent-light.png) · [dark](screens/78-recent-dark.png)                             | Sidebar RECENT list: 8 most recently opened decks with relative times (matches §g-12).                                                                                                                                                                                              |
| 79  | Recent · empty                   | [light](screens/79-recent-empty-light.png) · [dark](screens/79-recent-empty-dark.png)                 | Dashed placeholder explaining what will appear.                                                                                                                                                                                                                                     |
| 80  | Storage · off + Safari warning   | [light](screens/80-storage-off-light.png) · [dark](screens/80-storage-off-dark.png)                   | Storage card "Persistent storage · Off" + "Request persistent storage"; amber Safari 7-day banner with Export backup (**banner not built**, §g-34). Declined: "Browser declined. Try again after installing the app."                                                               |
| 81  | Storage · on                     | [light](screens/81-storage-on-light.png) · [dark](screens/81-storage-on-dark.png)                     | Card switches to On with a shield icon; green used only here; toast.                                                                                                                                                                                                                |
| 82  | Deck open in another tab         | [light](screens/82-second-tab-light.png) · [dark](screens/82-second-tab-dark.png)                     | 44 px amber banner "This deck is open in another tab — this tab is read-only" + "Use here instead"; status becomes "Read-only"; inspector fields greyed with a lock; handles and palette disabled; select and export still work. **Not used** (§g-35: live sync, no read-only tab). |
| 83  | Autosave · saving                | [light](screens/83-autosave-saving-light.png) · [dark](screens/83-autosave-saving-dark.png)           | Loader + "Saving…" ~650 ms after the last edit (conflicts with §g-7 ≤ 300 ms); ⌘S forces a save; reduced motion: loader doesn't spin.                                                                                                                                               |
| 84  | Autosave · saved                 | [light](screens/84-autosave-saved-light.png) · [dark](screens/84-autosave-saved-dark.png)             | "Saved in this browser" with a check.                                                                                                                                                                                                                                               |
| 85  | Autosave · error                 | [light](screens/85-autosave-error-light.png) · [dark](screens/85-autosave-error-dark.png)             | Clay pill "Couldn't save — export a backup" + Export button; popover "Couldn't save your last change" (unsaved since, error name, Export .sododeck.json, Retry ⌘S). Clears only after a successful save (matches §g-7).                                                             |

### States 86–116 (`Sododeck Canvas State.dc.html`, added 2026-09-28)

The **canvas-first editor** (§g-38). One frame per state from `sododeck-canvas.js`
(`window.SODO_CV.LIST`); the board `Sododeck Canvas-first.dc.html` groups them into four sections,
adds the notes (user did / what changed / keyboard / edge cases · contrast), a component inventory
and the card-colour tokens. Every state exists in light and dark at 1440×900; 116 is 1024×768.
These frames set editor **placement** and the new on-canvas controls; panel **content** still
follows 02–85, which are not changed to match. Where a frame conflicts with a founder decision the
decision wins (§g-42–§g-54), and the screenshot stays as rendered.

#### A · Shell (018)

| #   | State                             | Screenshots                                                                                   | Feature   | Notes                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 86  | Canvas-first shell · empty deck   | [light](screens/86-shell-empty-light.png) · [dark](screens/86-shell-empty-dark.png)           | 018       | Five floating islands 12 px from the edges: deck (≡, name, save icon, views), tools (Jump to, Labels, Focus, theme, Export), left rail, Undo/Redo, zoom. Empty-canvas card (Add component C, Import JSON). Save status is an icon (check / spinning loader / clay alert → 85 popover). |
| 87  | Dense deck at 50% zoom            | [light](screens/87-dense-50-light.png) · [dark](screens/87-dense-50-dark.png)                 | 018       | 110 components at 50 %: no side panels, canvas ≈ 94 % of the window. Minimap sits above the zoom island (M). Subtitle / block thresholds refer to 69; 010's semantic-zoom levels win.                                                                                                  |
| 88  | Palette flyout                    | [light](screens/88-palette-light.png) · [dark](screens/88-palette-dark.png)                   | 018       | Palette flyout (280 px) next to the rail: search, six kind tiles with number keys 1–6, sticky and group. Rail button pressed. Opening another flyout replaces it.                                                                                                                      |
| 89  | Outline flyout, pinned            | [light](screens/89-outline-pinned-light.png) · [dark](screens/89-outline-pinned-dark.png)     | 018       | Outline flyout pinned (⌥1): stays open while working on the canvas; row click selects and pans. One flyout at a time; a pinned one returns when a temporary one closes.                                                                                                                |
| 90  | Flows flyout with a flow selected | [light](screens/90-flows-light.png) · [dark](screens/90-flows-dark.png)                       | 018       | Flows & features flyout (⌥2) with a flow expanded into steps; off-path dimmed; step player bottom-centre; Flow chip with × in the deck island; canvas pans so the path clears the flyout.                                                                                              |
| 91  | Detail drawer on a component      | [light](screens/91-drawer-component-light.png) · [dark](screens/91-drawer-component-dark.png) | 018 · 020 | Detail drawer 360 px overlays the right side (resizable 320–560, grip on the left edge), never reflows the canvas. Inspector sections from 1–85 plus **Appearance** (fill, stroke; 020). ⏎ opens, ⌘⇧D toggles, Esc closes. Width remembered per deck (§g-50).                          |
| 92  | Drawer for a multi-selection      | [light](screens/92-drawer-bulk-light.png) · [dark](screens/92-drawer-bulk-dark.png)           | 018 · 016 | Drawer for three cards: count header, shared fields, "Mixed" values, partial tags as dashed n/3 chips; Align, distribute and bulk actions at the end (016).                                                                                                                            |
| 93  | JSON panel as a bottom overlay    | [light](screens/93-json-overlay-light.png) · [dark](screens/93-json-overlay-dark.png)         | 018       | JSON as a bottom overlay: left 68 (after the rail) to the right edge or the drawer, 268 px tall, 42 px header (Selection / Deck tabs, "In sync with canvas", line count, Copy, ×, ⌘J). Zoom island moves above it. Shows "⌘⏎ apply edits": **read-only instead** (§g-42).              |
| 94  | Hide UI                           | [light](screens/94-hide-ui-light.png) · [dark](screens/94-hide-ui-dark.png)                   | 018       | Hide UI (⌘\\): every island, flyout, drawer and toolbar hides; only a "Show UI" pill bottom-right. Canvas shortcuts and the context menu keep working.                                                                                                                                 |

#### B · Card quick-edit (019)

| #   | State                                | Screenshots                                                                                         | Feature   | Notes                                                                                                                                                                                                       |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 95  | Card hover with the details icon     | [light](screens/95-card-hover-light.png) · [dark](screens/95-card-hover-dark.png)                   | 019       | Hovering a card shows a round details button on its top-right corner (tooltip), card lifts. Same button on keyboard focus. Hidden while dragging, in flow mode, or when the card is < 80 px wide on screen. |
| 96  | Inline title edit                    | [light](screens/96-inline-edit-light.png) · [dark](screens/96-inline-edit-dark.png)                 | 019       | Double-click / F2 / ⏎ edits the title inside the card, all text selected, card keeps its size; toolbar hides. ⏎ save, Esc cancel, Tab saves and edits the next card; empty title restores the old one.      |
| 97  | New card with an empty title         | [light](screens/97-new-card-light.png) · [dark](screens/97-new-card-dark.png)                       | 019       | New card from the palette lands at the view centre (24 px offset until free) with an empty title and caret; ⌘⏎ saves and adds another; Esc keeps "Untitled service".                                        |
| 98  | Selection toolbar · one component    | [light](screens/98-toolbar-one-light.png) · [dark](screens/98-toolbar-one-dark.png)                 | 019       | Selection toolbar 12 px above the selection frame: Open details · Kind · Fill · Stroke · Owner · Tags · Tech · Links · Rules · More. Owner popover with filter and No owner. ⌘E focuses the toolbar.        |
| 99  | Toolbar · multi-selection with Align | [light](screens/99-toolbar-multi-light.png) · [dark](screens/99-toolbar-multi-dark.png)             | 019 · 016 | Multi-selection toolbar: count, shared fields, Align, Group; flips below the selection near the top islands. Partial tags as dashed chips with counts. ⌥A / ⌥D / ⌥W / ⌥S align.                             |
| 100 | Toolbar on a connection              | [light](screens/100-toolbar-connection-light.png) · [dark](screens/100-toolbar-connection-dark.png) | 019 · 017 | Toolbar on a connection: Label, Protocol, Direction, Reset route (disabled while automatic). Connection turns orange with endpoint and segment handles.                                                     |
| 101 | Toolbar on a group                   | [light](screens/101-toolbar-group-light.png) · [dark](screens/101-toolbar-group-dark.png)           | 019       | Toolbar on a group: Rename, Ungroup (⇧⌘G), Collapse, Select members. Boundary solid orange with handles, label becomes a selected chip. Collapse shows ⌘. (conflict, §g-48).                                |
| 102 | Context menu on a component          | [light](screens/102-menu-component-light.png) · [dark](screens/102-menu-component-dark.png)         | 019       | Context menu on a component: sectioned, right-aligned shortcuts, Arrange submenu, Group disabled with one card, Delete in clay with an icon. ⇧F10 / menu key; flips near edges.                             |
| 103 | Context menu on the empty canvas     | [light](screens/103-menu-canvas-light.png) · [dark](screens/103-menu-canvas-dark.png)               | 019       | Context menu on empty canvas: Paste (disabled with an explanatory tooltip when the clipboard has no Sododeck JSON), Add component submenu with 1–6; items land at the click point.                          |
| 104 | Context menu on a group              | [light](screens/104-menu-group-light.png) · [dark](screens/104-menu-group-dark.png)                 | 019       | Context menu on a group: Delete group keeps its members and moves them to the parent level (tooltip says so); Collapse / Expand.                                                                            |

#### C · Card colours (020)

| #   | State                  | Screenshots                                                                                 | Feature | Notes                                                                                                                                                                                                 |
| --- | ---------------------- | ------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 105 | Fill colour popover    | [light](screens/105-fill-popover-light.png) · [dark](screens/105-fill-popover-dark.png)     | 020     | Fill / Stroke tabs, No colour, 13 named colours, deck colours ending in "+". Selected swatch has ring + check. Hovering a custom swatch shows × (⌫ removes). Footer shows the name and token.         |
| 106 | Add a custom colour    | [light](screens/106-custom-colour-light.png) · [dark](screens/106-custom-colour-dark.png)   | 020     | "+" opens saturation box, hue bar and hex field inside the popover; live preview on the card; Add saves a deck swatch. Invalid hex disables Add. Max 12 custom colours per deck; "+" hides when full. |
| 107 | Coloured cards gallery | [light](screens/107-colour-gallery-light.png) · [dark](screens/107-colour-gallery-dark.png) | 020     | Reference board: all 13 fills with title, subtitle and rules glyph; strokes; custom fills (dark one flips text to white); selected, flow and error on colour.                                         |

#### D · Editing affordances (016, 017)

| #   | State                              | Screenshots                                                                                     | Feature   | Notes                                                                                                                                                                                                       |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 108 | Marquee selection                  | [light](screens/108-marquee-light.png) · [dark](screens/108-marquee-dark.png)                   | 016       | Shift+drag marquee: cards fully inside get the selection frame live, a count chip follows the cursor; ⌥ also selects touched cards. Plain drag pans (§g-36).                                                |
| 109 | Dragging a group                   | [light](screens/109-drag-group-light.png) · [dark](screens/109-drag-group-dark.png)             | 016       | Dragging a group label moves the group and members; dashed ghost at the start; offset readout; dropping onto another group nests it (Undo toast). Lists plain-arrow nudge: **⌥+arrows instead** (§g-45).    |
| 110 | Drop-into-group highlight          | [light](screens/110-drop-into-group-light.png) · [dark](screens/110-drop-into-group-dark.png)   | 016       | Dragging a card over a group: dashed orange boundary, soft fill, "Drop into Dispatch" chip and a dashed landing slot; hold ⌥ to drop without grouping.                                                      |
| 111 | Alignment guides                   | [light](screens/111-snap-guides-light.png) · [dark](screens/111-snap-guides-dark.png)           | 016       | Alignment guides within 6 screen px (edges and centres), distance labels, equal-gap labels; ⌘ disables snapping, ⇧ locks the axis.                                                                          |
| 112 | Resizing a card                    | [light](screens/112-resize-light.png) · [dark](screens/112-resize-dark.png)                     | 017       | Eight handles on a single selection, active one filled orange, W × H readout; ⇧ keeps ratio, ⌥ from centre. Minimum 120 × 44, 4 px steps.                                                                   |
| 113 | Dragging a connector segment       | [light](screens/113-segment-drag-light.png) · [dark](screens/113-segment-drag-dark.png)         | 017       | Dragging the middle segment moves it perpendicular; ghost of the automatic route; route becomes manual (enables Reset route, R). Segments stop 12 px from cards.                                            |
| 114 | Endpoint side targets              | [light](screens/114-endpoint-targets-light.png) · [dark](screens/114-endpoint-targets-dark.png) | 017       | Dragging an endpoint shows four side targets on the hovered card, the nearest hot; live dashed path, old route as a ghost. Lists "⌥ leaves a free end": **dropped** (§g-44).                                |
| 115 | Keyboard: regions and context menu | [light](screens/115-keyboard-light.png) · [dark](screens/115-keyboard-dark.png)                 | 018 · 019 | F6 / ⇧F6 cycle regions (deck, tools, rail, undo, canvas, zoom) with numbered badges; canvas region has an inset ring; ⇧F10 opens the context menu with the first item focused. Hidden regions are skipped.  |
| 116 | Narrow window 1024×768             | [light](screens/116-narrow-light.png) · [dark](screens/116-narrow-dark.png)                     | 018       | 1024×768 with the drawer open: rail stays; top islands drop labels (views → dropdown, Jump to / Labels / Focus / Export icon-only); drawer covers ≈ 35 % of the canvas. Below 1024 the editor is view-only. |

### Board B "Deck" rows 117–127 (`Sododeck Cards.dc.html`, added 2026-10-03)

The **card system**, direction B · Deck (§g-63). `Sododeck Cards.dc.html` draws three boards (A Ledger, B Deck, C Spec) with the same 11 rows, each in light and dark, from `sododeck-cards.js` (`window.SDC.ROWS`). Only board B is the reference; A and C stay in the file as history. Each frame is one row's B plate, 1180 px wide at its natural height. The board's token notes for B are in [DESIGN.md](../../DESIGN.md) "Card system (Deck)"; where a frame conflicts with a founder decision the decision wins (§g-66–§g-80) and the screenshot stays as rendered.

| #   | Row                                           | Screenshots                                                                                       | Feature       | Notes                                                                                                                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 117 | Signature moment · sample board, flow playing | [light](screens/117-deck-sample-board-light.png) · [dark](screens/117-deck-sample-board-dark.png) | 029, 035      | ~20 cards from five categories, flow "Checkout" at step 3 of 8: played cards carry ✓ stickers, the current card lifts on an orange lip, upcoming cards wait with dashed numbers; numbered token on the current edge; branch popover at the decision; error path to "Payment failed"; collapsed group "Payments" dimmed; expanded frame "Fulfilment"; step player; legend. |
| 118 | Connections and focus                         | [light](screens/118-deck-connections-light.png) · [dark](screens/118-deck-connections-dark.png)   | 034, 022      | a) hover Order Service: neighbours stay with Ink lips and highlighted edges, the rest dims, relationship legend; b) 4 parallel connectors bundled with ×4 (click to fan out); c) an end dragged along a side, snapping at 25 / 50 / 75 %, "left side · 78 %" readout; d) drill-in "Inside Order Service" with dashed outside proxies and relationship counts.             |
| 119 | Groups                                        | [light](screens/119-deck-groups-light.png) · [dark](screens/119-deck-groups-dark.png)             | 029           | Collapsed group as a fanned hand with one merged connector per neighbour (×2, ×3, ×1); expanded group frame with the label pill on its top edge.                                                                                                                                                                                                                          |
| 120 | Sample set                                    | [light](screens/120-deck-sample-set-light.png) · [dark](screens/120-deck-sample-set-dark.png)     | 029, 030, 031 | Information cards (service, database in blue, task, warehouse in teal, truck route, data card with 8 coloured tags); 13 shapes (diamond, pill, actor, rectangle, rounded rectangle, ellipse, cylinder, document, parallelogram, hexagon, sticky, text, frame); decision, database and document in both forms (card ⇄ shape).                                              |
| 121 | Edge cases                                    | [light](screens/121-deck-edge-cases-light.png) · [dark](screens/121-deck-edge-cases-dark.png)     | 029           | One-line title; long title cut at 3 lines with the title-only tooltip; minimal card; 10 tags (the limit); wide card resized to 340; narrow card 132 with an icon-only status.                                                                                                                                                                                             |
| 122 | States                                        | [light](screens/122-deck-states-light.png) · [dark](screens/122-deck-states-dark.png)             | 029, 031      | Twelve states for an information card and for a shape, each labelled with its non-colour cue (DESIGN.md "Card system (Deck)" › States).                                                                                                                                                                                                                                   |
| 123 | Zoom levels                                   | [light](screens/123-deck-zoom-levels-light.png) · [dark](screens/123-deck-zoom-levels-dark.png)   | 029           | One card and one shape at Landscape / System / Container / Component at the same size; a dense board of 129 cards in six groups at ~25 % (§g-71).                                                                                                                                                                                                                         |
| 124 | Typed fields                                  | [light](screens/124-deck-typed-fields-light.png) · [dark](screens/124-deck-typed-fields-dark.png) | 032           | Nine field types and how each shows (chip or row); a card with "+3 fields"; the details-drawer field editor with show-on-card toggles, a new select field with options and the field-type menu.                                                                                                                                                                           |
| 125 | Tags                                          | [light](screens/125-deck-tags-light.png) · [dark](screens/125-deck-tags-dark.png)                 | 033           | Tag chips in all 13 colours; on-card (18px) and drawer (21px with ×) sizes; 10 tags on one card; tag picker with deck tags and counts; edit-tag popover with swatches and deck colours; drawer tag row with keyboard focus.                                                                                                                                               |
| 126 | Colour                                        | [light](screens/126-deck-colour-light.png) · [dark](screens/126-deck-colour-dark.png)             | 029           | The 13 colours with fill / stroke / chip / ink hex and contrast checks (title on fill, stroke on canvas, ink on chip), plus three custom deck colours.                                                                                                                                                                                                                    |
| 127 | Type palette                                  | [light](screens/127-deck-type-palette-light.png) · [dark](screens/127-deck-type-palette-dark.png) | 030           | The rail "Add" flyout with search, category tabs and sections; "Packs in this deck" with on / off toggles (§g-77).                                                                                                                                                                                                                                                        |

### Database board 134–168 (`Sododeck Database.dc.html`, added 2026-10-04)

The **Database pack** (features 040–049, backlog [`backlog-database.md`](../backlog-database.md)). `Sododeck Database.dc.html` draws 35 frames, each in light and dark, from `sododeck-db.js` (`window.SDDB`): Part A is 21 whole editor windows (134–154, 1440×900; A10 is 900×900) and Part B is 14 component rows (155–168, 1180 px wide at natural height). The sample deck is "Shop". A table is a board B card (§g-63) whose body is a list of column rows, so board B rules apply (DB3); the editor chrome is the canvas-first editor drawn unchanged. Values are in [DESIGN.md](../../DESIGN.md) "Database pack"; decisions are §g-83 onward. 040 is model-only and has no frame.

| #   | Screen / Row                                         | Screenshots                                                                                                             | Feature            | Notes                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 134 | New schema deck, empty                               | [light](screens/134-db-empty-schema-deck-light.png) · [dark](screens/134-db-empty-schema-deck-dark.png)                 | 043, 044, 049      | Empty-canvas card with three actions: Add table, Import, and the samples Shop, SaaS auth and Blog. First screen of a new schema deck.                                                                                                                                                        |
| 135 | Schema deck, working                                 | [light](screens/135-db-schema-deck-working-light.png) · [dark](screens/135-db-schema-deck-working-dark.png)             | 041, 043           | The reference working screen: Shop with 11 tables and 2 groups at 80 % zoom, Detail pinned to All. `orders` is selected with its toolbar (Table menu, colour, column add), the drawer is on Columns with the enum type picker open, the Outline is pinned. Drawn at 80 %, not 100 % (§g-89). |
| 136 | Relationship selected                                | [light](screens/136-db-relationship-selected-light.png) · [dark](screens/136-db-relationship-selected-dark.png)         | 042, 043           | A relationship selected: toolbar with cardinality, line type, on delete, colour and delete; the drawer shows the relationship.                                                                                                                                                               |
| 137 | Code view (DBML tab, inline error)                   | [light](screens/137-db-code-view-light.png) · [dark](screens/137-db-code-view-dark.png)                                 | 046                | The JSON overlay with a DBML tab and one inline error; the canvas keeps the last valid schema.                                                                                                                                                                                               |
| 138 | Import · dialog                                      | [light](screens/138-db-import-dialog-light.png) · [dark](screens/138-db-import-dialog-dark.png)                         | 044                | Import dialog: paste or drop, detected dialect versus the deck's, preview count, import into Orders DB or a new deck.                                                                                                                                                                        |
| 139 | Import · after                                       | [light](screens/139-db-import-after-light.png) · [dark](screens/139-db-import-after-dark.png)                           | 044                | After the import: report, skipped lines, foreign keys detected by name (accepted one solid, suggestions dashed) and the Undo toast.                                                                                                                                                          |
| 140 | Large schema (150 tables, System zoom)               | [light](screens/140-db-large-schema-light.png) · [dark](screens/140-db-large-schema-dark.png)                           | 048, 041           | 150 tables at System zoom: expanded and collapsed groups, merged ×n connectors, minimap, Jump to "invoice" over tables and columns, saved views.                                                                                                                                             |
| 141 | Architecture + schema · before                       | [light](screens/141-db-architecture-before-light.png) · [dark](screens/141-db-architecture-before-dark.png)             | 049                | The architecture deck with the Orders DB card: dialect chip, "8 inside ⏎".                                                                                                                                                                                                                   |
| 142 | Inside Orders DB · flow step 4                       | [light](screens/142-db-inside-database-step-light.png) · [dark](screens/142-db-inside-database-step-dark.png)           | 049                | Inside Orders DB at flow step 4: `orders` and `order_items` lit as the current step with W / R row markers; the flow chip and step player stay; breadcrumb island.                                                                                                                           |
| 143 | Inside Orders DB · step 5 elsewhere                  | [light](screens/143-db-inside-database-elsewhere-light.png) · [dark](screens/143-db-inside-database-elsewhere-dark.png) | 049                | Step 5 does not touch this database: tables dim and a "Back to architecture" action shows.                                                                                                                                                                                                   |
| 144 | Problems                                             | [light](screens/144-db-problems-light.png) · [dark](screens/144-db-problems-dark.png)                                   | 047                | Problems opened from the accent badge on the rail; `audit_log` selected with its fix popover; an n–n relationship flagged.                                                                                                                                                                   |
| 145 | Export                                               | [light](screens/145-db-export-light.png) · [dark](screens/145-db-export-dark.png)                                       | 045, 047           | Export dialog: SQL in the deck dialect (junction table for n–n), DBML, Mermaid ER, data dictionary, PNG / SVG / PDF / JSON; scope and lint. The format list names another tool (§g-88).                                                                                                      |
| 146 | Narrow window · 900 px                               | [light](screens/146-db-narrow-window-light.png) · [dark](screens/146-db-narrow-window-dark.png)                         | 041, 043           | Narrow window at 900 px: compact islands, view only below 1024 (frame 116 rules).                                                                                                                                                                                                            |
| 147 | Flow step · reads / writes                           | [light](screens/147-db-flow-step-reads-writes-light.png) · [dark](screens/147-db-flow-step-reads-writes-dark.png)       | 049                | Flow step drawer with the table and column picker and the R / W chips.                                                                                                                                                                                                                       |
| 148 | Flow playback                                        | [light](screens/148-db-flow-playback-light.png) · [dark](screens/148-db-flow-playback-dark.png)                         | 049                | Playback at step 4: "writes orders +1" chip on the Orders DB card.                                                                                                                                                                                                                           |
| 149 | Context menus                                        | [light](screens/149-db-context-menus-light.png) · [dark](screens/149-db-context-menus-dark.png)                         | 043, 041, 042      | Context menus for a table (with Detail level), a column row, a relationship (with cardinality), the canvas and colour.                                                                                                                                                                       |
| 150 | ≡ menu                                               | [light](screens/150-db-deck-menu-light.png) · [dark](screens/150-db-deck-menu-dark.png)                                 | 043                | The ≡ menu as the board draws it, without shortcuts (§g-83); Deck settings opens the drawer in deck mode.                                                                                                                                                                                    |
| 151 | Deck settings · drawer in deck mode                  | [light](screens/151-db-deck-settings-light.png) · [dark](screens/151-db-deck-settings-dark.png)                         | 043                | Deck settings: the details drawer in deck mode with Problems, Name, Description, Tags, Summary, Database and Storage (§g-85).                                                                                                                                                                |
| 152 | Deck settings · Database section                     | [light](screens/152-db-deck-settings-database-light.png) · [dark](screens/152-db-deck-settings-database-dark.png)       | 043, 041           | Scrolled to the Database section: dialect select open with a hint per option, notation, show-on-table and show-on-relationship switches, export.                                                                                                                                             |
| 153 | Changing the dialect                                 | [light](screens/153-db-dialect-change-light.png) · [dark](screens/153-db-dialect-change-dark.png)                       | 043                | Changing the dialect: a confirm dialog listing the converted columns over the drawer (§g-84, §g-86).                                                                                                                                                                                         |
| 154 | After conversion                                     | [light](screens/154-db-dialect-converted-light.png) · [dark](screens/154-db-dialect-converted-dark.png)                 | 043                | After the conversion: types converted on every table and the Undo toast.                                                                                                                                                                                                                     |
| 155 | Signature moment · from architecture into the schema | [light](screens/155-db-signature-moment-light.png) · [dark](screens/155-db-signature-moment-dark.png)                   | 049, 041, 042      | Signature moment: Orders DB card, Enter, then inside with outside proxies and the Checkout flow step.                                                                                                                                                                                        |
| 156 | Table card anatomy                                   | [light](screens/156-db-table-anatomy-light.png) · [dark](screens/156-db-table-anatomy-dark.png)                         | 041                | Every part of one table labelled (header, title, note, key rows, type, nullable, unique, enum column, indexes footer) and the column-row spec at 200 %. Its dimension labels overlap the caption (§g-92).                                                                                    |
| 157 | Sample set                                           | [light](screens/157-db-sample-set-light.png) · [dark](screens/157-db-sample-set-dark.png)                               | 041                | Shop at full detail, a coloured table, long names, a tiny table and a table collapsed to keys.                                                                                                                                                                                               |
| 158 | Large tables                                         | [light](screens/158-db-large-tables-light.png) · [dark](screens/158-db-large-tables-dark.png)                           | 048, 041, 042      | A 60-column table cut at 12 (PK, FK, rest), Show all open in place, in-table search with a match counter, the hidden-column anchor, and Names / Keys / System variants.                                                                                                                      |
| 159 | Relationships                                        | [light](screens/159-db-relationships-light.png) · [dark](screens/159-db-relationships-dark.png)                         | 042                | Relationship ends on curved, elbow and straight lines, self-reference, composite keys, two keys between a pair, hover, label and line types.                                                                                                                                                 |
| 160 | Authoring on the canvas                              | [light](screens/160-db-authoring-light.png) · [dark](screens/160-db-authoring-dark.png)                                 | 043, 042           | Authoring on the canvas: add, rename, reorder, drag a key onto a column, type mismatch, keyboard, multi-select, duplicate, paste, lock.                                                                                                                                                      |
| 161 | States                                               | [light](screens/161-db-states-light.png) · [dark](screens/161-db-states-dark.png)                                       | 041, 042, 043, 047 | Table states: default, hover, selected, row selected, editing, problem, current step, dimmed, dragged, connection target, collapsed to keys, locked.                                                                                                                                         |
| 162 | Zoom levels                                          | [light](screens/162-db-zoom-levels-light.png) · [dark](screens/162-db-zoom-levels-dark.png)                             | 041, 042           | Table at Landscape, System, Container and Component zoom at the same size.                                                                                                                                                                                                                   |
| 163 | Groups                                               | [light](screens/163-db-groups-light.png) · [dark](screens/163-db-groups-dark.png)                                       | 048, 041           | Groups: expanded, by schema, nested and collapsed.                                                                                                                                                                                                                                           |
| 164 | Details drawer                                       | [light](screens/164-db-details-drawer-light.png) · [dark](screens/164-db-details-drawer-dark.png)                       | 043                | Details drawer for a table (General, Columns, Indexes, Checks tabs) and the relationship drawer.                                                                                                                                                                                             |
| 165 | Enums and notes                                      | [light](screens/165-db-enums-notes-light.png) · [dark](screens/165-db-enums-notes-dark.png)                             | 041, 043           | Enum card with a dotted "used by" link to its column, the enum editor in the drawer, a sticky pinned to a table, and table and column notes.                                                                                                                                                 |
| 166 | Code panel, import and export                        | [light](screens/166-db-code-import-export-light.png) · [dark](screens/166-db-code-import-export-dark.png)               | 044, 045, 046      | Code panel: JSON overlay with DBML / SQL tabs, Selection or Whole schema, "Applied" and "Can't apply: fix 1 error"; the import dialog and the export cards. The dialog overlaps the export cards (§g-91).                                                                                    |
| 167 | Problems                                             | [light](screens/167-db-problems-lint-light.png) · [dark](screens/167-db-problems-lint-dark.png)                         | 047                | Schema lint: the Problems list with fix actions.                                                                                                                                                                                                                                             |
| 168 | Type palette                                         | [light](screens/168-db-type-palette-light.png) · [dark](screens/168-db-type-palette-dark.png)                           | 043                | The Add flyout, Database tab and Packs (on / off).                                                                                                                                                                                                                                           |

### Not designed at all

Error boundary / crash screen, 404 deck, loading skeletons, **confirm dialogs** (delete
deck/node/edge/rule/folder: the new frames use an Undo toast instead, see §g-11 and §g-19),
settings, rule-editor column delete/reorder, custom view configuration,
"Tidy layout" (auto-layout) button and pin glyph, feedback entry point. Storage-quota-exceeded and
"deck open in another tab" are now covered by 85 and 82 (82 is not used, §g-35). The narrow window (1024–1279 px) is now designed (116).

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
| Banner                                  | amber (backup — deferred, §g-34), primary-soft/success (match), clay (error)                                               | dismiss                                 | ui ➕ `Banner`                                                               |
| Storage meter                           | surface-2 card, 5px bar                                                                                                    |                                         | app                                                                          |
| Deck card, New-deck card, deck list row | thumbnail, Sample pill, meta; hover float shadow                                                                           | open                                    | app (library)                                                                |
| Dialog (export)                         | 820px, radius 20, modal shadow over scrim                                                                                  | Esc, click outside                      | ui ➕ `Dialog` (Radix)                                                       |
| Command palette                         | 580px, 54px input, 42px rows, hint footer                                                                                  | ⌘K, type, Enter, Esc                    | ui ➕ `Command` (shadcn/cmdk — new dep, ask)                                 |
| Toast                                   | inverse pill, 2.6 s                                                                                                        | auto-dismiss                            | ui ➕ `Toast` (sonner? new dep, ask — or tiny own)                           |
| Coach mark (tour tooltip)               | 300px inverse card, arrow, "n of 3", dots, Skip/Back/Next                                                                  |                                         | ui ➕ `CoachMark` (Radix Popover)                                            |
| Breadcrumb (top bar)                    | wordmark / folder / editable deck name                                                                                     |                                         | app                                                                          |
| Autosave status                         | Saving… / Saved in this browser (+ saving / error in 83–85; read-only from 82 not used, §g-35)                             |                                         | app                                                                          |
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
| Sticky note                               | see below                                                                                                                                                                                                                                                                                   | designed: 62, 63                                                    |
| Collapsed group with aggregated edge (×N) | see below                                                                                                                                                                                                                                                                                   | designed: 69–71                                                     |
| Branch / error-path edge                  | see below                                                                                                                                                                                                                                                                                   | designed: 43, 45, 46                                                |
| Port handles / edge drawing               | see below                                                                                                                                                                                                                                                                                   | designed: 52–57                                                     |
| Multi-select marquee                      | see below                                                                                                                                                                                                                                                                                   | designed: 58                                                        |

### Components added by states 41–85

Names follow the component list on the `Sododeck Extensions.dc.html` board. Target: "ui ➕" =
`packages/ui`, "app" = `apps/app` (editor/library). Status is "to build" for all of them; the
feature that owns each is in brackets.

| Component                          | Variants / states                                                                                                                                             | Interactions                                               | Screens          | Target                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------- | ------------------------------------------ |
| Recording chip                     | "Recording 'name' · n steps" with Undo ⌘Z / Done / Cancel Esc; "Editing … · adding branch" variant                                                            | Done disabled until ≥ 1 step; Esc asks only if steps exist | 41–45            | app (006)                                  |
| Step row (editable)                | numbered dot, from → to, Mono edge label; grip + remove on hover; broken-chain dot (dashed clay + icon)                                                       | drag grip, ⌥↑/⌥↓ move, ⌫ remove                            | 42, 43           | app (006)                                  |
| Recording hint / error card        | dashed orange "Next: click an edge leaving …"; clay "Edge not added" card                                                                                     | —                                                          | 42, 43           | app (006)                                  |
| Branch header                      | "◇ condition" Mono label, indented; error variant (clay + circle-alert, "error path")                                                                         | select branch                                              | 45, 46           | app (006)                                  |
| Edge step badge                    | numbered dot inside the edge label (1, 4a, 4b); error variant                                                                                                 | —                                                          | 42, 46, 50       | app (006/007)                              |
| Edge states                        | candidate (dotted orange), invalid (clay dash 3 3 + ban), error path (clay dash 7 4 + icon), merged (×N pill + direction icon), ghost (dashed while dragging) | hover, click                                               | 42–46, 53–55, 69 | app (003/006/010)                          |
| Branch picker (step player)        | "AT STEP n" + segmented control of branches, error branch with icon                                                                                           | ↑/↓ at a fork                                              | 46               | app (007)                                  |
| Invalid-edge popover               | ban icon, title, explanation, "Add as branch from step n", "Got it Esc"                                                                                       | Esc closes, focus back to the edge; polite live region     | 43               | app (006) on ui ➕ `Popover`               |
| Flow filter field                  | search field with "n of m" count; matches bold + underlined; empty state with two actions                                                                     | / focus, ↓ into results, Esc clear then blur               | 47, 48           | app (006) on ui ➕ `SearchField`           |
| Connection handle                  | 10px ring on four sides; 14px filled when hot                                                                                                                 | hover or Tab focus shows; drag to connect                  | 52–54            | app (003)                                  |
| Node badges                        | warning (amber triangle), valid target (+), invalid target (ban), provider text badge (AWS/GCP/AZURE/PARTNER)                                                 | —                                                          | 54, 55, 60, 61   | app (003/015)                              |
| Connect listbox                    | "Connect X to…" with type-ahead, kind icon + group per option, disabled "already connected"                                                                   | C open, ↑↓, ↵ create, Esc                                  | 56               | app (003) on ui ➕ `Command`/listbox       |
| Keyboard hint bar                  | bottom-centre pill of `kbd` + label pairs                                                                                                                     | —                                                          | 53, 56           | ui ➕ `KbdHint`                            |
| Edge popover                       | label, protocol, direction; Delete                                                                                                                            | ↵/⌘↵ close, Esc close                                      | 57               | app (003) on ui ➕ `Popover`               |
| Inverse tooltip                    | dark tooltip with kbd hint                                                                                                                                    | —                                                          | 52, 55, 64       | ui ✅ `Tooltip` (inverse variant ➕)       |
| Selection frame                    | dashed orange frame + "n selected" pill                                                                                                                       | shift-click, marquee, ⌘A                                   | 58               | app (003)                                  |
| Mixed-value field                  | italic muted "Mixed"; partial tag chip (dashed + "n/3")                                                                                                       | typing sets the value on all                               | 58               | ui ➕ (`Input`/`TagChip` variants)         |
| Undo toast                         | inverse pill, outlined "Undo" button + shortcut, 6 s                                                                                                          | Undo / ⌘Z                                                  | 59, 75, 77       | ui ➕ `Toast` (action variant)             |
| Problems list + canvas button      | rows with icon, title, detail, chevron; amber "n problems" canvas button; "No problems" collapsed row                                                         | ↑↓, ↵ select, ⌘. next                                      | 60               | app (015)                                  |
| Palette card (cloud/partner)       | kind tile + text badge; "CLOUD & PARTNERS" section                                                                                                            | drag or ↵                                                  | 61               | app (003)                                  |
| Sticky note                        | amber-soft 180px markdown card; free / pinned (dotted leader + pin) / collapsed (one line + chevron); dimmed 35% in flows                                     | N add, ↵ edit, Esc stop, ⌥C collapse                       | 62, 63           | app (009)                                  |
| Level indicator                    | 4 bars + level name (Landscape / System / Container / Component) inside the zoom control, with menu                                                           | click opens level menu                                     | 64–67            | app (010)                                  |
| Component card + port pill         | full node card (title, tech, owner, tags, rule glyph); dashed port pill at the level border                                                                   | click port → node one level up                             | 67               | app (010)                                  |
| Group label chevron                | chevron in the group label on hover / focus                                                                                                                   | Space/↵ toggle                                             | 68               | app (010)                                  |
| Collapsed group card               | stacked card, name + "n nodes · m edges"; flow-through variant with ring + pulsing dot                                                                        | Space expands                                              | 69, 71           | app (010)                                  |
| Merged-edge popover                | list of underlying edges with label + direction                                                                                                               | ↵ pins, ↑↓, ↵ expands + selects                            | 70               | app (010) on ui ➕ `Popover`               |
| Field error                        | 1.5px clay border + circle-alert + message under the field                                                                                                    | focus stays in field                                       | 72, 73           | ui ➕ (`Input` error state)                |
| Dialog (small, New folder)         | title, one field, Cancel / Create                                                                                                                             | ↵ create, Esc cancel                                       | 72, 73           | ui ➕ `Dialog`                             |
| Context menu + submenu             | icon, label, shortcut; checked item; destructive item in clay                                                                                                 | right-click / Shift+F10 / ⋯, arrows, → submenu             | 74, 76, 77       | ui ➕ `ContextMenu`/`DropdownMenu` (Radix) |
| Folder inline rename row           | row turns into an input                                                                                                                                       | F2, ↵ save, Esc cancel                                     | 75               | app (005)                                  |
| Recent list                        | clock icon, name, relative time; dashed empty placeholder                                                                                                     | ↵ opens                                                    | 78, 79           | app (005)                                  |
| Storage card                       | usage bar, On (shield + green pill) / Off (dashed pill) status, "Request persistent storage", declined text                                                   | request                                                    | 80, 81           | app (005)                                  |
| Safari banner                      | reuses the amber backup banner with Safari copy                                                                                                               | Export backup, dismiss                                     | 80               | deferred (§g-34)                           |
| Read-only banner + read-only field | 44px amber banner with "Use here instead"; greyed fields with lock icon; "Read-only" status pill                                                              | take the lock                                              | 82               | not built (§g-35)                          |
| Autosave status                    | saving (loader) / saved (check) / error (clay pill + Export) + error popover (read-only state not built, §g-35)                                               | ⌘S save / retry                                            | 82–85            | app (005)                                  |

### Components added by states 86–116

From the component inventory on the `Sododeck Canvas-first.dc.html` board. Sizes in px at 100 % UI
scale. Shared rules: focus ring 2 px Deck Orange with 2 px offset (−2 px inside menus and
popovers); disabled = 40 % opacity for icon buttons, Muted text for menu rows, no hover; flyouts,
drawer and popovers enter with a 120 ms fade + 4 px slide, instant with reduced motion.

| Component                  | Sizes and tokens                                                                                                                                                                                                                                                                | States                                                                                                                                                                                                                                                                                                              | Screens         | Target      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------- |
| Island                     | 44 tall, 4 padding, 2 gap, 12 from the viewport edges. Surface, 1 px Hairline, 12 radius, Rest shadow. Deck island: ≡ 34 · name 13.5/500 · save icon 15 · divider · segmented views (28 items). Tools island: Jump to field 176 · Labels · Focus · theme · Export (primary 34). | F6 focus: 2 px orange ring on the island, then Tab inside. Compact under 1280: labels drop, views become a dropdown. Hover / pressed / disabled: none on the island itself; its buttons use `button-icon` states.                                                                                                   | 86–94, 115, 116 | ui ➕ (018) |
| Rail button                | 38×38 in a 48-wide rail, 8 radius, icon 18; dividers 22×1 with 4 margin; Undo/Redo in a separate island 8 below. Icon Secondary.                                                                                                                                                | Hover Surface 2; active tool / open flyout Orange Soft + Orange Ink icon; pressed Surface 3; focus ring; disabled 40 %. Tooltip: Inverse, 8 radius, 12/500 label + Mono shortcut, 400 ms delay.                                                                                                                     | 86–90           | ui ➕ (018) |
| Flyout                     | 280 wide, left 68 (rail + 8), top 68, up to viewport − 80. Header 46: title 13.5/500, pin 28, close 28. Surface, 1 px Hairline, 12 radius, Float shadow. Rows 30–32, 8 radius.                                                                                                  | One open at a time. Selected row Orange Soft. Pinned: pin Orange Soft, stays open on canvas clicks. Esc closes (first Esc clears a filter). Rows: hover Surface 2 (list-row hover), keyboard focus = shared ring, ↑↓ move. Pressed / disabled: not designed for rows (no disabled rows appear).                     | 88–90           | ui ➕ (018) |
| Detail drawer              | 360 default, 320–560 via the left grip (4×48 Border pill, orange on hover / drag); right 12, top 68, bottom 12. Surface, Float shadow, 12 radius. Header 68: 40 kind tile, 15/500 title, 11.5 muted subline, More, Close. Sections 13/16 padding with hairlines.                | Overlays the canvas, never resizes it; the canvas pans to keep the selection clear. Esc closes and returns focus to the card. Grip hover / drag orange. Fields use the DESIGN.md input states. Pressed / disabled: none on the drawer itself.                                                                       | 91, 92, 116     | ui ➕ (018) |
| JSON overlay               | Left 68 to right 12 (or the drawer's left edge), bottom 12, 268 tall, Float shadow. Header 42: braces icon, JSON, Selection / Deck segmented, "In sync with canvas", line count, Copy, ×, ⌘J. Body on Code surface, Mono 12/1.6.                                                | Read-only (§g-42). The zoom island moves above it. ⌘J moves focus into it, Esc returns it to the canvas; header buttons use `button-icon` states. Hover / pressed / disabled: none on the panel.                                                                                                                    | 93              | app (018)   |
| Selection toolbar          | 44 tall, 4 padding, 34 buttons, 1×20 dividers; 12 above the selection frame, flips 12 below when it would reach y < 68. Surface, 1 px Hairline, 12 radius, shadow 0 4px 16px Shadow.                                                                                            | Hover Surface 2; open popover Orange Soft + Orange Ink; focus ring; disabled 40 %. Hidden while dragging, resizing, editing text and in Hide UI. Variants: component, multi, connection, group. Pressed: not designed; default Surface 3 (as the rail button).                                                      | 98–101          | app (019)   |
| Toolbar popover            | 236–272 wide, 6 below the toolbar, aligned to its button; 6–8 padding, rows 30. Surface, 1 px Hairline, 12 radius, shadow 0 12px 32px Shadow. Filter field 32 on Surface 2.                                                                                                     | Row hover Surface 2; selected Orange Soft + check; partial tag = dashed 1 px Secondary chip with n/N. Opens with ⏎ / Space with focus on the filter; Esc returns to its button. Pressed: not designed; default Surface 3. Disabled rows: Muted, no hover (as the context menu).                                     | 98, 99          | ui ➕ (019) |
| Context menu               | Min 232–252 wide, 6 padding, rows 30 with 7 radius, 13 px labels, Mono 10.5 shortcuts right-aligned, full-bleed 1 px dividers with 5 margin. Surface, 1 px Hairline, 12 radius, 0 12px 32px Shadow.                                                                             | Hover / open submenu Surface 2; keyboard focus Surface 2 + inset 2 px ring; disabled Muted; danger Clay + trash icon. Submenu opens right with −6 overlap, flips left / up near edges. Pressed: not designed; default = hover (Surface 2).                                                                          | 102–104, 115    | ui ➕ (019) |
| Colour popover and swatch  | 272 wide. Swatch 28 circle, 8 gap, 7 per row. Fill / Stroke tabs 26; No colour 32. Picker: 118 saturation box, 8 hue bar, 32 hex field + Add. Swatch fill = card fill token, 1 px ring = card stroke token.                                                                     | Selected: 2 px Surface gap + 2 px orange ring + check (never colour alone). Hover tooltip with the name. Custom swatch hover / focus: 16 px Inverse × badge, ⌫ removes. "+" dashed 1 px Border, pressed Orange Soft. Disabled: Add is disabled on an invalid hex (106); "+" is hidden, not disabled, at 12 colours. | 105–107         | app (020)   |
| Selection frame            | 2 px Deck Orange outline, 2 px outside the card border (reads on any fill). Multi-selection: 1 px orange rounded frame 10 outside the union.                                                                                                                                    | Replaces border + halo for selection; flow-step cards keep the 1.5 px orange border + halo. Not interactive: no hover, focus, pressed or disabled state.                                                                                                                                                            | 91, 98–116      | app (018)   |
| Resize handle              | 8×8, 2 radius, Surface fill, 1.5 px orange; hit area 16; 8 per single selection. Readout: Inverse pill, Mono 11, 22 tall, 10 from the dragged corner, "W × H".                                                                                                                  | Hover Orange Soft + resize cursor; active orange fill. Minimum card 120×44, 4 px steps. Pressed = the active (orange-filled) handle. Not keyboard-focusable and no disabled state; no keyboard resize is designed (§g-54).                                                                                          | 112             | app (017)   |
| Segment handle             | 10×24 (vertical) or 24×10, 5 radius. Rest Surface + 1.5 px orange; dragging orange fill with 2 px Surface ring. ew / ns cursor.                                                                                                                                                 | Live path 2 px orange dash 6 4; old route Muted dash 4 4 at 55 %. Hover: not designed beyond the cursor. Pressed = the dragging style. No disabled state. Not keyboard-focusable; no keyboard routing is designed (§g-54).                                                                                          | 100, 113        | app (017)   |
| Endpoint handle and target | Endpoint 12 circle, 2 px orange, Surface fill. Side target 10 circle Surface + 1.5 px orange at each side midpoint of the hovered card.                                                                                                                                         | Nearest target grows to 14, orange, 4 px Orange Soft halo. Not keyboard-focusable; no keyboard reconnect is designed (§g-54). No pressed / disabled state.                                                                                                                                                          | 100, 114        | app (017)   |
| Snap guide                 | 1 px Deck Orange hairline across aligned cards, within 6 screen px. Distance label Mono 10.5 on an orange pill (18 tall) with On Primary text; gap ticks 1 px dashed orange.                                                                                                    | ⌘ disables snapping; ⇧ locks the axis. Not interactive: no hover, focus, pressed or disabled state.                                                                                                                                                                                                                 | 111             | app (016)   |
| Marquee                    | 1 px orange border, 2 radius, orange fill at 7 % (9 % dark). Count chip Inverse 22 at the cursor.                                                                                                                                                                               | Cards fully inside get the frame live; ⌥ also selects touched cards; Esc cancels. Not interactive: no hover, focus, pressed or disabled state.                                                                                                                                                                      | 108             | app (016)   |
| Drop target                | Group gets a 1.5 px dashed orange border, 7 % orange fill, a "Drop into …" orange chip and a dashed slot where the card lands.                                                                                                                                                  | Only while the pointer is inside the group; ⌥ drops without grouping. Not interactive: no hover, focus, pressed or disabled state.                                                                                                                                                                                  | 110             | app (016)   |
| Hint bar                   | Inverse pill 30 tall, bottom-centre, Mono key caps on 28 % grey.                                                                                                                                                                                                                | Shown during marquee, drags, resizes and route edits, and in the keyboard-regions state; lists the modifier keys. Not interactive: no hover, focus, pressed or disabled state.                                                                                                                                      | 108–115         | ui ➕ (016) |
| Card on colour             | Fill = `--card-{name}-fill`; border stays Border unless a stroke is set; stroke 1.5 px `--card-{name}-stroke`. Title Ink 12.5/500; subtitle Secondary 11 (Muted on plain cards); rules glyph Amber Ink (white on dark customs).                                                 | Selected = outside frame. Flow = 1.5 px orange border + 3 px Orange Soft halo + step badge. Error = dashed Clay ring 3 px outside + Clay alert badge. Dim .22. Hover = card lift + details button (95); focus = focus frame (115); pressed / disabled: none. Same as a plain card.                                  | 105–107         | app (020)   |
| Show UI pill               | 34 tall pill bottom-right, eye icon, "Show UI", ⌘\ key cap. Float shadow.                                                                                                                                                                                                       | Only visible in Hide UI mode. Hover / focus / pressed follow `button-secondary`; no disabled state.                                                                                                                                                                                                                 | 94              | app (018)   |

### Components added by board B (117–127)

Values are in [DESIGN.md](../../DESIGN.md) "Card system (Deck)"; this list maps them to features. Sizes in px at 100 % zoom.

| Component                     | Sizes and tokens                                                                                                | States                                                                                                                          | Feature                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Deck card frame               | 184 wide, radius 14, 1.5px Border-strong or colour stroke, 3px lip in the border colour, padding 12 / 13, gap 8 | hover, selected, editing, problem, current step, dimmed, dragging, connection target, has children, highlighted neighbour (122) | 029                       |
| Card header                   | 24 tall: 24px type tile (radius 8), type name 11.5 / 500, badge slot (status, pin, problem)                     | status icon-only under 150 wide                                                                                                 | 029                       |
| Field chip / row              | chip 21 tall pill 11.5 / 500; row min 19 with label 11.5 Muted; "+n fields" dashed pill 20                      | —                                                                                                                               | 032                       |
| Tag pill                      | 18 tall on the card, 21 with × in the drawer, colour `chip` + `ink`                                             | drawer: focus ring 2px orange; ⌫ removes, ⏎ opens the picker                                                                    | 029 (look), 033 (colours) |
| Problem badge                 | 20 tall Clay Soft pill, ⚠ 12 + count 11 / 600                                                                   | —                                                                                                                               | 029                       |
| Handle                        | 12 round knob, 2px Secondary border                                                                             | active 16, Deck Orange, 4px halo                                                                                                | 029                       |
| Connector                     | 2px, `#b4b4ab` / `#5a5a53`, curved / elbow / straight, rounded filled arrow, 3.5 start knob                     | played, current, upcoming, dimmed, highlighted, error                                                                           | 029, 035                  |
| Connector label               | 20 tall pill 11 / 600, 1.5px Border-strong                                                                      | current (solid orange), error (Clay Soft)                                                                                       | 029                       |
| Bundle count                  | 22 Ink pill "×n" 11.5 / 700                                                                                     | —                                                                                                                               | 034                       |
| Collapsed group (fanned hand) | 184 × 112, two back sheets at −7° / +4°, 26px count disc, 22px member tiles                                     | selected, dimmed, neighbour                                                                                                     | 029                       |
| Expanded group frame          | radius 20, label pill 28 tall on the top edge, 18px count disc                                                  | —                                                                                                                               | 029                       |
| Shape                         | true geometry, 1.5 stroke, lip = the path offset 3px, text 13 / 600 centred, max 3 lines                        | as cards (122)                                                                                                                  | 031                       |
| Step sticker                  | 22 / 26 (current) disc at the top-left corner                                                                   | played, current, upcoming                                                                                                       | 035                       |
| Flow token                    | 24 orange disc with the step number, 3px Orange Ink lip                                                         | —                                                                                                                               | 035                       |
| Step player                   | 560 panel, radius 16, 40 play button, 8px segments                                                              | —                                                                                                                               | 035                       |
| Outside proxy                 | 150 wide, 1.5px dashed Secondary, radius 14                                                                     | —                                                                                                                               | 034                       |
| Tag picker / edit tag         | panel radius 16 with lip; search, deck tags with counts, 13 swatches + deck colours, delete                     | —                                                                                                                               | 033                       |
| Field editor                  | drawer rows with drag grip, value and show-on-card toggle; field-type menu                                      | —                                                                                                                               | 032                       |
| Add flyout / packs            | type grid tiles with lip, category tabs, packs list with toggles                                                | —                                                                                                                               | 030                       |

### Components added by the Database pack (134–168)

Values are in [DESIGN.md](../../DESIGN.md) "Database pack"; this list maps them to features. Sizes in px at 100 % zoom.

| Component                       | Frames        | Sizes and tokens                                                                                                               | States                                              | Feature                 |
| ------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ----------------------- |
| Table card                      | 156, 157, 161 | `tblW` 240 wide; Deck card frame (border 1.5, radius 14, 3px lip); header 24, title 18, gap 8, padding 12                      | the 12 table states (161)                           | 041                     |
| Column row                      | 156           | `colH` 24, fill inset `colInset` 4 radius 8; key slot `keyW` 16 or 30; name Geist 12 / 500 (PK 600)                            | hover, highlight, problem, selected, editing, R / W | 041                     |
| Key glyphs                      | 156           | PK `key-round`, FK `link-2`, unique 12 square "U", PK + FK pair                                                                | —                                                   | 041                     |
| Nullable marker and type text   | 156           | "?" in a 7px slot; type Mono 11 Muted, right-aligned, at most 58 % of the row                                                  | cut with ellipsis before the name                   | 041                     |
| Row separator                   | 156           | one hairline above the column list; spacing between rows                                                                       | —                                                   | 041                     |
| Indexes footer                  | 156           | list icon + "n indexes", 11.5 Muted, 24 tall                                                                                   | —                                                   | 041                     |
| Show all / Show fewer           | 158           | dashed 1.5 Border-strong, width − 24, 24 tall, radius 8, 11.5 / 500 Secondary                                                  | saved per table; hot spot for hidden-column anchors | 048 (limit), 041 (look) |
| In-table column search          | 158           | search field in the header with "3/60" counter; matches Orange Soft                                                            | ⌘F on the selected table                            | 048                     |
| Enum card                       | 165           | small card, type tile, "n values", value chips in palette colours                                                              | selected                                            | 041                     |
| Enum value chip                 | 165, 164      | 21 tall Deck chip in a palette colour; enum column shows the enum name as a chip                                               | —                                                   | 041, 043                |
| Enum link                       | 165           | dotted line with "used by" label, no crow's feet, shown on hover or selection of either end                                    | —                                                   | 042                     |
| Crow's foot ends                | 159           | `crowLen` 12, `crowSpread` 6, `crowBar` 16, `crowRing` 4; one / zero-or-one / one-or-many; on curved, elbow and straight lines | hover, selected                                     | 042                     |
| Relationship ports              | 159, 158      | anchors on both card sides at the row centre; composite key: 6px stub per member plus one joining segment                      | hidden column anchors at Show all                   | 042                     |
| Relationship label              | 159           | connector label pill (as board B) with the relationship name                                                                   | Follow Labels / Hover / Always / Off                | 042                     |
| Type-mismatch chip              | 160           | chip on a dragged key whose types differ                                                                                       | —                                                   | 042, 043                |
| Names · Keys · All control      | 135, 146, 162 | segmented cells inside the zoom island; dropdown at 900 px                                                                     | pinned per deck or view                             | 041                     |
| Dialect chip                    | 141, 134      | neutral chip 21 tall, Surface 2, database icon 12, 11.5 / 500                                                                  | read-only                                           | 043                     |
| Deck settings, Database section | 152           | dialect select, notation, show-on-tables, show-on-relationships, export                                                        | dialect select open                                 | 043                     |
| Details drawer, table tabs      | 164           | General, Columns, Indexes, Checks; relationship drawer                                                                         | —                                                   | 043                     |
| Type palette entries            | 168           | Add flyout Database tab and Packs toggles                                                                                      | pack on / off                                       | 043                     |
| R / W row markers               | 142, 147      | 16 × 16, radius 5, Mono 9.5 / 600; W Deck Orange fill, R orange outline; row Orange Soft                                       | playback only                                       | 049                     |
| "writes" chip                   | 148           | chip on the database card ("writes orders +1")                                                                                 | step 4                                              | 049                     |
| Outside proxy                   | 142, 155      | 150 wide dashed proxy for a connection that leaves the database                                                                | —                                                   | 049                     |
| Breadcrumb island               | 142, 143      | island under the deck island when inside a database, with "Back to architecture"                                               | —                                                   | 049                     |
| Table zoom variants             | 162           | Landscape icon, System name + key dots + count, Container keys + "+n columns", Component all columns                           | —                                                   | 041                     |
| Group variants                  | 163           | expanded, by schema, nested, collapsed (merged ×n connectors)                                                                  | —                                                   | 048                     |
| Sticky and notes on tables      | 165           | pinned sticky with dotted tether; table note 2 lines; column note glyph 11px with tooltip                                      | hidden at Container and below                       | 041                     |
| Problem row and lint list       | 144, 167      | Clay soft row, `triangle-alert`; Problems list with fix popover                                                                | —                                                   | 047                     |
| Code panel tabs                 | 137, 166      | JSON / DBML / SQL tabs, Selection / Whole schema, status pill ("Applied" / "Can't apply")                                      | inline error                                        | 046                     |
| Import dialog and report        | 138, 139, 166 | dialect detect, preview count, convert notice, target choice, FK detect switch; report with Undo toast                         | —                                                   | 044                     |
| Export dialog                   | 145           | format list, scope, lint summary                                                                                               | —                                                   | 045                     |

---

### Chrome reused unchanged (Database board)

The board draws these from `sododeck-canvas.js` / `sododeck-states.js` without restyling. 041–049 must use the app's existing components for them, not new ones.

- **Shell:** deck island (≡, name, save icon, views control), tools island (Jump to, Labels, Focus, theme, Export), rail with its Problems badge, undo / redo island, zoom island, minimap, dot grid.
- **Panels:** flyout, drawer with `dHead`, section label, selection toolbar, context menu and submenus, popover, tooltip, pill.
- **Controls:** primary and secondary buttons, input and select, chips, toggle 32 × 18, segmented control 26, dialog (420–840 wide, radius 20, padding 20).
- **Flow:** step player (32px buttons, "Step n of 8 · title", 1× pill, 4px progress segments), Undo toast (40 tall, ⌘Z hint, 6 s).
- **Added, not restyled:** Names · Keys · All cells in the zoom island; breadcrumb island.

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

### Tokens introduced by states 41–85

`sododeck-states.js` builds its themes from the same `THEMES` in `sododeck-data.js` and adds three
variables; the board lists a few more values. Mapping:

| Design (states 41–85)                                                                 | Our token / proposal                                                                                                                                                            |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--onac` #1c1c1a · dark #171716 (label on Deck Orange)                                | `on-primary` — **now identical to DESIGN.md**; the older frames 01–40 still use white.                                                                                          |
| `--gns` / `--gnt` #e3efe1 / #2f6a38 · dark #16281a / #8fd09a ("success only")         | `success-soft` / `success-ink` (#e6f1ec / #17603f · dark #163024 / #74d4a5). Use ours; values differ slightly. The design uses green only for "Persistent storage: On" (§g-20). |
| clay from `THEMES` (#f7e5df / #9a3b25 brick)                                          | `clay-soft` / `clay-ink` (rose #f9e3e6 / #a3303f). DESIGN.md wins (§g-1); error paths, invalid edges and field errors use our clay.                                             |
| `--focus-ring`: 2px solid Deck Orange, 2px offset (−2px inside menus)                 | ➕ `--sd-focus-ring` (+ `ring-focus` utility) in 000. DESIGN.md has no focus-ring token yet.                                                                                    |
| `--edge-error` clay ink, 2px, dash 7 4 (current step 3px)                             | app constant (edge style), colour `clay-ink`                                                                                                                                    |
| `--edge-candidate` orange, 1.75px, dash 2 4, round caps                               | app constant, colour `primary`                                                                                                                                                  |
| `--edge-invalid` clay ink, 2.5px, dash 3 3                                            | app constant, colour `clay-ink`                                                                                                                                                 |
| ghost edge while dragging: orange 1.75px dash 5 4; merged edge: text-secondary 2.25px | app constants                                                                                                                                                                   |
| `--dim-note` .35 (stickies during a flow)                                             | ➕ `--sd-dim-note` next to the existing dim values (.2–.22 flow, .4 view)                                                                                                       |
| `--toast-undo-ms` 6000                                                                | ➕ `--sd-toast-undo` 6000 ms (normal toast stays 2600 ms)                                                                                                                       |
| popovers: 120 ms fade + 4px rise; dim 250 ms ease-out; no bounce                      | ➕ `--sd-dur-popover` 120 ms; `--sd-dur-dim` already proposed (250 ms). Reduced motion: instant, token/loaders/pulse static.                                                    |
| Icons: lucide line set, stroke 1.5, 12–20px                                           | matches `ICON_STROKE_WIDTH` 1.5; new glyphs in [icon-mapping.md](icon-mapping.md) "lucide glyphs in states 41–85"                                                               |
| Sticky note: amber-soft card, 180px wide                                              | `amber-soft` / `amber-ink`; schema already has `StickyColor` (amber, blue, green, clay, grey) — design only shows amber                                                         |
| Read-only banner 44px, amber; recording/branch chip uses primary-soft                 | existing `amber-*`, `primary-soft` tokens                                                                                                                                       |

### Tokens introduced by states 86–116

`sododeck-canvas.js` extends the 41–85 themes with 26 card-colour variables (13 colours × fill and
stroke, each with a light and a dark value) and two selection variables. Values are OKLCH. Fill
tokens sit behind Ink text in both themes (≥ 12:1); on a coloured fill the subtitle switches from
Muted to Secondary to stay above 4.5:1. Stroke tokens are the 1.5 px card border and the swatch
ring. The full table is in [DESIGN.md](../../DESIGN.md) "Card colours".

| Design (states 86–116)                                                                                                         | Our token / proposal                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--card-{red, orange, amber, yellow, lime, green, teal, cyan, blue, indigo, violet, pink, slate}-{fill, stroke}`, light + dark | ➕ same names with the `--sd-` prefix in `packages/ui` (added by 020). Light fill `oklch(.95 .045 h)`, stroke `oklch(.62 .15 h)`; dark fill `oklch(.31 .055 h)`, stroke `oklch(.72 .13 h)`; slate is lower chroma. |
| Custom deck colours stored as hex (samples: Navy #1F2A44, Sand #E8D5B7, Mint #C9E7DC)                                          | document data (020, §g-39); text flips to white below 0.18 relative luminance; max 12 per deck (§g-52)                                                                                                             |
| `--seltx` rgba(242,102,28,.26) · dark rgba(240,122,50,.36) (selected text in the inline title edit)                            | ➕ `--sd-selection-text` (018 / 019)                                                                                                                                                                               |
| `--marq` orange at 7 % · dark 9 % (marquee fill)                                                                               | ➕ `--sd-marquee-fill` (016)                                                                                                                                                                                       |
| Island Rest shadow, flyout / drawer / JSON Float shadow `0 8px 28px`; toolbar `0 4px 16px`; popovers and menus `0 12px 32px`   | existing Rest / Float tiers; the two in-between shadows are app constants on `{colors.shadow}`                                                                                                                     |
| Overlay motion 120 ms fade + 4 px slide, instant with reduced motion                                                           | `--sd-dur-popover` 120 ms (proposed for 41–85), now also used by flyouts and the drawer                                                                                                                            |

### Tokens introduced by board B (117–127)

`sododeck-cards.js` derives every colour from OKLCH (`PAL`): each of the 13 colours gets `fill`, `stroke`, `chip`, `ink` and `dot` for light and dark. The geometry and type tokens are in its `TK('B', theme)` table and the board notes. Both are written up in [DESIGN.md](../../DESIGN.md) "Card system (Deck)" (tokens table and Extended palette). B's own `fill` / `stroke` values differ slightly from what 020 ships; 020's stay (§g-66).

### Tokens introduced by the Database pack (134–168)

`sododeck-db.js` reuses the board B tokens and the canvas-first chrome tokens, and adds a small set of table geometry and glyph tokens: `tblW`, `colH`, `colInset`, `keyW`, `colMax`, the crow's foot constants and the R / W marker size. They are written up with their values, mapping and source frames in [DESIGN.md](../../DESIGN.md) "Database pack"; no colour is new.

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

### Data implied by states 41–85

Checked against the **current** `packages/schema/schema/v1.json` (001 has landed since the table
above was written: nodes already have `level`, `parent`, `tech`, `host`, `icon`, `links`, `rules`,
`position`; edges `direction`, `description`, `owner`, `tags`, `links`; steps `id`, `title`,
`ruleInputs`; stickies `text`, `color`, `anchor`, `position`). Nothing here changes
`packages/schema` now; rows marked **needs schema** go to the owning feature (additive optional
fields, no version bump, per 001/002 rules).

| Design (JSON panel / inspector)                                                                   | Kind of data                        | Schema v1 today                  | Action                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step branch: fork step, branch label, condition, **Error path** toggle (45, 46)                   | document                            | missing (`Step` has no `branch`) | **needs schema (001/002)** — already planned in 006 with an ADR; the design settles the shape: label + condition + `errorPath: boolean`, forking at a step |
| Step numbering `n` / "4a, 4b" in JSON and badges                                                  | derived                             | steps have stable `id`           | display only; never stored (constitution III)                                                                                                              |
| Step `from` / `to` in the step JSON                                                               | derived from `edge`                 | —                                | display only                                                                                                                                               |
| Flow `name` in the flow JSON                                                                      | document                            | `Flow.title`                     | mock naming; keep `title`                                                                                                                                  |
| Node kinds `cloud`, `partner` (61)                                                                | document                            | `NodeKind` has 6 kinds           | **needs schema (001/002)**: add `cloud`, `partner` to the enum (spec C-1 also lists `actor`, not designed)                                                 |
| Cloud fields `provider` (aws/gcp/azure/other + free text), `service`, `region`, `resourceId` (61) | document                            | missing                          | **needs schema (001/002)**, optional, only meaningful for `cloud`                                                                                          |
| Sticky `collapsed`, "Stay visible during flows" (62)                                              | document (per note)                 | missing                          | **needs schema (001/002)** for `collapsed` (and a `pinnedInFlows`-style flag), or decide they are view/UI state — §g-21                                    |
| Sticky `offset {x,y}` relative to the anchor (62 JSON)                                            | document                            | `Sticky.position`                | reuse `position`, interpreted relative to `anchor` when set (model rule, no new field)                                                                     |
| Group `collapsed` (69 JSON); board note says "saved per view"                                     | view state                          | missing on `View`                | **needs schema (001/002)** as `View.collapsed: Id[]` in 011; until then UI state (Zustand). Not on the group object — §g-22                                |
| Group `members` count (69 JSON)                                                                   | derived                             | —                                | display only (the frame shows 9 in JSON but "8 nodes" in the header — mock inconsistency)                                                                  |
| Node `problems: ["orphan"]` (60 JSON)                                                             | derived                             | —                                | computed by 015, **never stored** in the document — §g-23                                                                                                  |
| Multi-selection JSON `{ selection: [...], owner: { mixed: [...] } }` (58)                         | UI                                  | —                                | JSON panel view only, not document                                                                                                                         |
| Merged edges ×N (69, 70)                                                                          | derived                             | —                                | from the visible-graph derivation (010)                                                                                                                    |
| Semantic zoom level + thresholds (64–67)                                                          | UI (zoom) + document (`node.level`) | `Level` enum exists              | thresholds are UI constants                                                                                                                                |
| "Notes: dimmed / shown / hidden" during flows (63)                                                | UI preference                       | —                                | Zustand / localStorage                                                                                                                                     |
| Recent = `openedAt` (78), folders (72–75), last export, persistent-storage status (80, 81)        | library metadata                    | —                                | Dexie (`apps/app/src/storage`), **not** in the deck file                                                                                                   |
| Multi-tab sync (82 not used, §g-35)                                                               | runtime                             | —                                | BroadcastChannel relay of Yjs updates between tabs, never stored in the deck                                                                               |

### Data implied by states 86–116

| Design                                                                     | Kind of data | Schema v1 today | Action                                                                              |
| -------------------------------------------------------------------------- | ------------ | --------------- | ----------------------------------------------------------------------------------- |
| Card fill and stroke (91, 98, 105–107); JSON in 93 shows `fill` / `stroke` | document     | missing         | **needs schema (020)**: optional `ColorRef` on nodes, and on groups (§g-43)         |
| Deck custom colours (105, 106), up to 12                                   | document     | missing         | **needs schema (020)**: deck-level swatch list (§g-39, §g-52)                       |
| Card size (112)                                                            | document     | missing         | **needs schema (017)**: optional `node.size` (§g-37)                                |
| Manual connector route: sides + segment offset (100, 113, 114)             | document     | missing         | **needs schema (017)**: optional `edge.route` (§g-37); endpoints always set (§g-44) |
| Drawer width, pinned flyout, Hide UI, JSON overlay open (89, 91, 93, 94)   | UI only      | —               | never in the deck file or Yjs (§g-50)                                               |

---

## e. Behavior (from the prototype's logic and the `support.js` runtime)

Behavior of states 41–85 (keyboard paths, empty and error states) is in the §a notes for each
frame; this section covers `Sododeck.dc.html`.

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
  (Not built: G-5 deferred and no all-decks backup, §g-33, §g-34.)
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

| Req                                       | Design coverage                                            | Feature          |
| ----------------------------------------- | ---------------------------------------------------------- | ---------------- |
| C-1 blank canvas + palette                | palette with 6 kinds, drag/click to add, empty-canvas card | 003              |
| C-3 command palette                       | ⌘K over commands, flows, nodes (not edges/rules)           | 009              |
| C-5 JSON panel two-way sync               | selection + deck tabs, inline error, copy, collapse        | 004              |
| V-3 focus mode                            | Focus toggle                                               | 010              |
| V-4 saved views                           | System / Feature / Infra tabs + custom                     | 011              |
| F-2 flow highlight + token                | full                                                       | 007              |
| F-3 step player + step panel              | full (condition, rules, SLA; no payload)                   | 007              |
| F-5 flow list per feature                 | list, no search/filter                                     | 006 / 007        |
| K-1 title, markdown, owner, tags, links   | on nodes (edge: label only)                                | 008              |
| K-2 decision tables reusable across steps | full rule editor + compact table on steps                  | 008              |
| G-1 autosave                              | Saving… / Saved                                            | 005              |
| G-2 local library, folders, search        | full (except New folder dialog)                            | 005              |
| G-3 export/import                         | Import button + Export dialog                              | 005 / 012        |
| G-4 storage usage                         | storage meter                                              | 005              |
| G-5 backup reminder                       | backup banner + Export backup                              | deferred (§g-34) |
| I-1 export JSON/PNG/SVG/PDF/Mermaid       | full dialog                                                | 012              |

### In the design but not P0 → backlog "later"

| Design element                               | Spec                                                             | Note                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Rule test input + checks (catch-all warning) | A-1 rule simulator (P1), Q-4 linter (P2)                         | Small and already designed; proposed as **optional** in 008 — decision §g-5 |
| SLA "measured" value + meter                 | R-1 runtime overlay (P2), A-4 (P1)                               | Mock data. Keep target only; decision §g-5                                  |
| Onboarding 3-step coach marks                | K-8 guided tours (P2) — but AGENTS.md M5 lists "onboarding tour" | Treat as M5 013 (lightweight first-run hints), not K-8 system tours         |
| Step "Evaluated with" sample inputs          | A-1 (P1)                                                         | tied to the test input                                                      |
| Views dimming clients in Infra               | V-5 role-based views (P1)                                        | M4 011 can include the simple version                                       |

### P0 in the spec but missing from the design

| Req                                                       | What's missing                                                                   | Proposal                                                                                                                                    | Status after states 41–85                                                                                                                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-1 cloud icons (AWS/GCP/Azure), actor, partner kinds     | only 6 generic kinds                                                             | **needs design** for cloud kinds; lucide has no brand icons — use generic `cloud` + a provider badge text (sensible default)                | ✅ covered: [61](screens/61-cloud-partner-light.png) (cloud + provider text badge, partner). `actor` kind still missing.                                                                                                  |
| C-2 draw / reconnect edges; edit direction inline         | no ports, no edge creation at all (design.md "Known Gaps")                       | **needs design**; default: React Flow handles on node sides on hover, drag to connect, drag endpoint to reconnect                           | ✅ covered: [52](screens/52-edge-hover-light.png)–[57](screens/57-edge-popover-light.png) (handles, drag, valid/invalid target, keyboard connect, popover). Reconnecting an existing endpoint still missing (default ok). |
| C-4 auto-layout with pinning                              | no button, no pin indicator                                                      | sensible default: "Tidy layout" button in canvas toolbar + pin icon on pinned nodes                                                         | ❌ still missing (default ok)                                                                                                                                                                                             |
| C-6 undo/redo, multi-select, bulk edit                    | none                                                                             | default: ⌘Z/⇧⌘Z (Yjs UndoManager), shift-click + marquee; **bulk-edit inspector needs design**                                              | ✅ covered: [58](screens/58-multi-select-light.png) bulk inspector, [59](screens/59-bulk-delete-light.png) undo toast. Delete-without-confirm conflicts with §g-11.                                                       |
| C-7 validation (orphans, broken flows, duplicate edges)   | only rule checks + JSON parse error                                              | default: a "Problems" list in the deck inspector + warning glyph on nodes/flows                                                             | ✅ covered: [60](screens/60-problems-light.png)                                                                                                                                                                           |
| V-1 semantic zoom, 4 levels, double-click drill           | one group drill-down + breadcrumb                                                | **needs design** for levels; default: reuse drill-down + breadcrumb, add level from `node.level`                                            | ✅ covered: [64](screens/64-zoom-landscape-light.png)–[67](screens/67-zoom-component-light.png)                                                                                                                           |
| V-2 collapsible groups with aggregated edge (×N)          | groups can't collapse on canvas                                                  | **needs design** (small); default: chevron on group label, collapsed group = node-sized card, edges merged with "×N" pill                   | ✅ covered: [68](screens/68-group-expanded-light.png)–[71](screens/71-flow-collapsed-light.png)                                                                                                                           |
| F-1 create a flow by clicking edges                       | **no flow authoring at all** ("+" in Features does nothing)                      | **needs design** (biggest gap); default: "Record flow" mode — click edges in order, step list builds on the left, Done/Cancel in a top chip | ✅ covered: [41](screens/41-rec-empty-light.png)–[44](screens/44-rec-finished-light.png) — the design matches the default                                                                                                 |
| F-4 branches + conditions, error paths styled differently | flows are linear; no error style                                                 | **needs design**; default: step has optional `branchOf` + label; error path = dashed clay edge + "error" icon (non-color cue)               | ✅ covered: [45](screens/45-branch-create-light.png), [46](screens/46-branch-tree-light.png)                                                                                                                              |
| F-5 search/filter in flow list                            | none                                                                             | default: filter field above the list (as in palette)                                                                                        | ✅ covered: [47](screens/47-flow-filter-light.png), [48](screens/48-flow-filter-empty-light.png)                                                                                                                          |
| K-1 on edges, flows, steps                                | edge: label/protocol only; step inspector read-only; flow has no editable fields | default: reuse node inspector sections for edge/flow/step; condition & SLA become editable fields                                           | ✅ covered: [49](screens/49-insp-edge-light.png), [50](screens/50-insp-flow-light.png), [51](screens/51-insp-step-light.png) (step SLA shows a measured value — §g-6/§g-24)                                               |
| K-3 sticky notes (free or anchored)                       | "Note" in palette only; no visual                                                | **needs design**; default: amber-soft card, 180px, markdown, anchor badge                                                                   | ✅ covered: [62](screens/62-stickies-light.png), [63](screens/63-stickies-flow-light.png)                                                                                                                                 |
| K-4 global search across titles, notes, rules             | ⌘K searches titles only                                                          | default: extend ⌘K results with rules, edges, stickies and description matches (snippet line)                                               | ❌ still missing (⌘K unchanged; default ok)                                                                                                                                                                               |
| G-4 `storage.persist()` request                           | meter only                                                                       | default: request on first save; show "Persistent storage: on/off" in the meter card                                                         | ✅ covered: [80](screens/80-storage-off-light.png), [81](screens/81-storage-on-light.png)                                                                                                                                 |
| G-5 Safari 7-day warning                                  | generic banner                                                                   | default: add Safari-specific copy when detected                                                                                             | ✅ covered: [80](screens/80-storage-off-light.png); deferred (§g-34)                                                                                                                                                      |
| G-6 multi-tab via BroadcastChannel                        | none                                                                             | default: "Open in another tab — read-only here" banner (needs a quick design pass)                                                          | ✅ covered: [82](screens/82-second-tab-light.png); replaced by live sync (§g-35)                                                                                                                                          |
| NFR a11y: keyboard canvas navigation, non-color cues      | not addressed                                                                    | default: arrow-key node traversal, focus ring = selection ring, dimmed items keep labels; error path dashed                                 | ◐ partly: focus-ring token, keyboard paths on every new frame, dash + icon for error/invalid, live region for invalid clicks. Arrow-key canvas traversal not shown.                                                       |

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
   **Resolved (2026-09-27):** designed in states 41–71 (see §a). Remaining gaps: auto-layout
   button, custom view configuration, edge endpoint reconnect, `actor` kind, confirm dialogs.
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
   backup". The error state is now designed ([85](screens/85-autosave-error-light.png)); the
   saving frame still says ~650 ms (§g-25).
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
    after a confirmed delete. States 41–85 contradict this (§g-19).
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

### Mismatches found in states 41–85 (2026-09-27)

Each item names the frames, the rule it breaks and a proposal. Where DESIGN.md or a founder
decision already covers it, that rule wins and the proposal only says how to apply it.

18. **Non-contiguous step is blocked** ([43](screens/43-rec-invalid-light.png)): the design refuses
    an edge that doesn't start where the last step ended and offers "Add as branch from step n".
    The backlog default (006) was "add it, mark it not contiguous". _Applied in the backlog: follow
    the design (block + offer branch); steps that become non-contiguous later (reorder, edge
    deleted) are still shown as broken rows, as in 42 and 60. Founder may revert._
19. **Deletes without confirmation** ([49](screens/49-insp-edge-light.png),
    [57](screens/57-edge-popover-light.png), [58](screens/58-multi-select-light.png),
    [59](screens/59-bulk-delete-light.png), [75](screens/75-folder-rename-light.png),
    [77](screens/77-deck-menu-row-light.png) says "No confirm dialog"): nodes, edges, bulk
    selections, folders and decks are deleted at once with a 6 s Undo toast. **Conflicts with §g-11.**
    _Founder decision stands: a confirmation dialog first (not designed; use the small dialog from
    72 with a clay destructive button), then ⌘Z still works. Recording-mode Esc already
    "asks only if steps exist" (41), which matches §g-11._
    **Decision (founder, 2026-09-27):** confirm first, **and** keep the design's Undo toast (6 s,
    Undo button + ⌘Z hint) after every confirmed delete; ⌘Z keeps working after the toast is gone.
20. **Success green** ([81](screens/81-storage-on-light.png)): the design adds its own green
    (#e3efe1 / #2f6a38) and uses it **only** for "Persistent storage: On". DESIGN.md defines
    `success` (#e6f1ec / #17603f) and also uses it for "rule matched" and SLA within target. _Use
    DESIGN.md tokens and usage; the design's hex values are not adopted._
21. **Sticky `collapsed` and "Stay visible during flows"** ([62](screens/62-stickies-light.png)): the
    design writes `collapsed` into the note's JSON. _Proposal: both are document data per note
    (they are authored choices that should travel with the file): add optional `collapsed` and
    `showInFlows` to `Sticky` in 009 (additive). The deck-wide "Notes: dimmed / shown / hidden"
    switch (63) is a UI preference._
22. **Group collapse location** ([69](screens/69-group-collapsed-light.png)): the JSON shows
    `"collapsed": true` on the group, the board note says "saved per view". _Proposal: per view
    (`View.collapsed: Id[]`, 011); UI state in 010. Never on the group object._
23. **Derived data in the JSON panel** ([60](screens/60-problems-light.png) node JSON has
    `"problems": ["orphan"]`; [58](screens/58-multi-select-light.png) shows a selection object;
    [69](screens/69-group-collapsed-light.png) `members`): the panel shows the document (§g-3),
    so computed values must not appear there or in the file. _Proposal: JSON panel shows only the
    `@sododeck/model` export; problems/members/selection are shown in the inspector only._
24. **Measured SLA** ([51](screens/51-insp-step-light.png) "p95 86 ms · within target" with a filled
    meter): fake runtime data. **Conflicts with §g-6.** _Show the SLA target field only; no meter, no
    p95. (The meter fill is also orange, where DESIGN.md `sla-meter` says green ≤ 85%.)_
25. **Autosave timing** ([83](screens/83-autosave-saving-light.png) "~650 ms after the last edit"):
    **conflicts with §g-7** (persist immediately, "Saving…" held ≤ 300 ms). _Founder decision
    stands. The design's ⌘S "force save / retry" is fine to keep (it is a no-op when saved)._
26. **Owner rendered as a select with a chevron** (42, 49, 51, 56, 58, 67, 82, 85): §g-10 says free
    text with suggestions. _Build a combobox (free text + suggestions from the deck) that looks like
    the design's select; "Mixed" placeholder in bulk edit (58) still applies._
27. **Old prototype colours in the new frames**: clay is still the brick #9a3b25 and primary-hover
    #d9560f (from `THEMES` in `sododeck-data.js`). On-primary is now dark (good). _DESIGN.md wins
    (§g-1): rose clay for error paths, invalid edges and field errors; our hover orange._
28. **New node kinds** ([61](screens/61-cloud-partner-light.png)): `cloud` (provider AWS / GCP /
    Azure / Other + service, region, resource id) and `partner`. Spec C-1 also lists `actor`, which
    is still undesigned. _Proposal: add `cloud` and `partner` to `NodeKind` and the optional cloud
    fields in 003 (additive schema change with fixtures, parity and round-trip tests); `actor`
    reuses the client tile with a `user` glyph (default) until designed._
29. **Library scope additions** ([74](screens/74-folder-menu-light.png),
    [76](screens/76-deck-menu-card-light.png), [82](screens/82-second-tab-light.png)): Duplicate
    deck (⌘D), Export folder, "Use here instead" (take the edit lock), ⌘E export, ⌘S. Not in the
    005 scope. _Proposal: include Duplicate and "Use here instead" in 005 (small, and 82 needs a
    way out of read-only); defer Export folder to 012._
    **Decision (founder, 2026-09-27):** Duplicate is in 005; Export folder deferred; "Use here
    instead" is dropped together with the read-only tab (§g-35).
30. **Accessibility (constitution VII)**: the new frames are mostly good — error paths and invalid
    edges use dash + icon, invalid clicks go to a live region, filter matches are bold + underlined,
    storage On has a shield icon and text, read-only fields have a lock, problems have a triangle
    glyph, every frame lists keyboard paths. Frames to watch:
    [64](screens/64-zoom-landscape-light.png) and [65](screens/65-zoom-system-light.png) show nodes
    as tiles only (landscape) → each node still needs an accessible name and a tooltip;
    [63](screens/63-stickies-flow-light.png) dims notes by opacity only → dimmed notes must stay
    readable (35% text is below contrast) or be marked `aria-hidden` with the "Notes: dimmed"
    control as the cue; the 6 s Undo toast ([59](screens/59-bulk-delete-light.png)) must not be the
    only way back (⌘Z works — keep it). Arrow-key traversal between nodes is still not shown.
31. **Different lucide glyph choices** for things we already mapped: the design uses `receipt`
    (ours `ReceiptText`), `wallet` (`Banknote`), `message-square` (`MessageSquareText`), `activity`
    (`ChartNoAxesGantt`), `network` for hub (`Waypoints`), `scan` for focus (`Focus`) and
    `workflow` for the wordmark/flow icon (`Spline` / `Route`). _Proposal: keep
    `packages/ui/src/lib/icons.ts` as the source of truth; the new glyphs are listed in
    [icon-mapping.md](icon-mapping.md)._
32. **Mock glitches, not design intent**: in [77](screens/77-deck-menu-row-light.png) the row's ⋯
    button draws over the top-bar "New deck" button; the JSON panel says "1 lines"; in
    [69](screens/69-group-collapsed-light.png) JSON `members: 9` vs "8 nodes"; flow JSON uses
    `name` instead of `title`.

### Decisions from the 005 clarification (2026-09-27)

33. **Import/export granularity** ([01](screens/01-library-light.png) backup banner,
    [74](screens/74-folder-menu-light.png) Export folder): the design exports "all decks as one
    JSON file" and whole folders; neither fits the one-deck `.sododeck.json` format.
    **Decision (founder, 2026-09-27):** import and export handle **one deck file at a time**; no
    all-decks backup, no folder export or import, no multi-file or zip import.
34. **Backup reminder and Safari warning** ([01](screens/01-library-light.png),
    [09](screens/09-library-folder-banner-dismissed-light.png), [80](screens/80-storage-off-light.png)):
    **Decision (founder, 2026-09-27):** **G-5 deferred**: no backup reminder banner and no Safari
    7-day warning for now (common drawing tools ship neither). The storage card from 80–81 stays.
35. **Multi-tab** ([82](screens/82-second-tab-light.png)): the design locks the second tab
    (read-only banner, greyed fields, "Use here instead").
    **Decision (founder, 2026-09-27):** **live sync** instead: every tab showing a deck stays
    editable, edits sync between tabs within 1 s and merge without loss (Yjs), undo is per tab. No
    read-only tab, lock or take-over; frame 82 is not used.
36. **Drag on empty canvas** (003): most design tools select with a plain drag; the canvas
    pans with a plain drag and draws the selection box with Shift+drag.
    **Decision (founder, 2026-09-27):** keep it: plain drag pans, **Shift+drag** selects. Revisit
    later if users ask. Copy/paste, group from selection, group drag, align and snap go in backlog 016.
37. **Card size and connector routing** (not in the design): every card is 164 × 50 and connectors
    are always routed automatically, so users cannot fix a line that runs through the wrong place.
    **Decision (founder, 2026-09-27):** schema v1 may add **optional** `node.size` and
    `edge.route` (sides + middle-segment offset); additive only, older files stay valid. Backlog
    017; needs an ADR.
38. **Editor layout** (02 and every editor frame): three fixed columns (sidebar 264 px, inspector
    336 px) plus the JSON panel leave about half the screen for the canvas.
    **Decision (founder, 2026-09-27):** **canvas-first**: full-bleed canvas, floating
    islands, a left icon rail with flyouts, the inspector as an on-demand drawer, the JSON panel
    hidden by default. Existing frames stay the reference for panel **content**, not placement.
    Backlog 018; needs a design pass, an ADR and a DESIGN.md update.
39. **Card colours** (not in the design): cards are coloured by kind only.
    **Decision (founder, 2026-09-27):** fill and stroke from a fixed named palette, plus a "+"
    that adds custom hex colours to the deck's swatches. Backlog 020 (schema change).
40. **Card attributes** (founder's reference cards show year, status, date range): **deferred**. Cards
    keep the existing fields; user-defined typed fields come later.
41. **Scheduling:** 016–020 run **after M4**.
42. **JSON overlay editing** (93): the canvas-first frame shows the JSON panel with "⌘⏎ apply
    edits" and invalid-JSON markers, but §g-3 keeps the panel **read-only**.
    **Decision (founder, 2026-09-28):** default accepted: 018 moves the panel as-is, read-only; JSON editing stays a separate later
    feature.
43. **Group colours** (87): the dense deck shows a group with a teal fill and a group with a dashed
    red stroke; 020 colours components only.
    **Decision (founder, 2026-09-28):** default accepted: add optional `group.style` (same `ColorRef`) to 020, since the schema change
    and picker are shared; otherwise groups stay out of scope.
44. **Free connector end** (114 "⌥ leaves a free end"): an edge must have `from` and `to` in schema
    v1.
    **Decision (founder, 2026-09-28):** default accepted: drop it; ⌥ does nothing on endpoint drags.
45. **Nudge keys** (109 lists arrows 1 px / ⇧ arrows 10 px): plain arrows move focus between cards
    (003).
    **Decision (founder, 2026-09-28):** default accepted: arrows nudge only while a drag is in progress; otherwise ⌥+arrows (1 px) and
    ⌥⇧+arrows (10 px) nudge the selection.
46. **Controls without a place in 86–116:** Tidy layout and pins (011), view settings popover
    (011), drill-in breadcrumb (010), problems / validation (015, not built yet), sticky
    visibility (009).
    **Decision (founder, 2026-09-28):** default accepted: view settings and Tidy layout in the views control's menu in the deck
    island; pin / unpin in the selection toolbar "More" and the context menu; the drill breadcrumb
    as a chip in the deck island (like the Flow chip in 90); problems as a count badge on a rail
    button that opens a flyout; sticky visibility in the tools island next to Labels.
47. **Order after M4:** canvas-first before M5.
    **Decision (founder, 2026-09-28):** 015 (left over from M3) first, then 021 → 018 → 019 → 016
    → 017 → 020, then 012 → 013; 014 can go anywhere.

### Mismatches found in states 86–116 (2026-09-28)

§g-42–§g-46 above were raised from the brief and the first review of 86–116. Importing the frames
into the repo (021) found the following as well. Each has a default; the founder confirms or
changes them before the owning feature is specified.

48. **⌘. collapses a group** ([101](screens/101-toolbar-group-light.png)): 015 already uses
    ⌘. / Ctrl+. for "next problem" (⇧⌘. previous), and 010 collapses a focused group with Space.
    **Default:** keep ⌘. for problems; the group toolbar and context menu show Space for Collapse.
49. **C opens the palette** ([86](screens/86-shell-empty-light.png),
    [88](screens/88-palette-light.png)): in the app today (003) C on a focused card opens the
    connect popover.
    **Default:** C opens the palette when no card is focused; with one card focused it keeps
    opening the connect popover. The rail tooltip reads "Add component C". 018 confirms it with
    the founder before building.
50. **Per-deck UI memory** ([91](screens/91-drawer-component-light.png) "width is remembered per
    deck", [89](screens/89-outline-pinned-light.png) pinned flyout, [93](screens/93-json-overlay-light.png),
    [94](screens/94-hide-ui-light.png)): drawer width, pinned flyout, JSON overlay and Hide UI are
    UI state.
    **Default:** keep them in local UI preferences keyed by deck id, never in the deck file or the
    Yjs document (Principle I); they do not sync between tabs.
51. **Save status is an icon** ([86](screens/86-shell-empty-light.png)): check / spinning loader /
    clay alert, where §g-7 shows the words "Saving…" and "Saved in this browser".
    **Default:** icon in the deck island with the same words as its tooltip and accessible name
    (and in the polite live region); the error icon opens the 85 popover. Reduced motion: the
    loader does not spin.
52. **Custom colour limit** ([106](screens/106-custom-colour-light.png)): at most 12 custom colours
    per deck; "+" hides when full. §g-39 set no limit.
    **Default:** accept 12; 020 validates it in the model, not in the schema.
53. **Mock values that are not decisions**: 87 names subtitle / block thresholds (40 % / 25 %);
    010's semantic-zoom levels win. 93's header shows "⌘⏎ apply edits" and invalid-JSON markers
    (read-only instead, §g-42). 109 lists plain arrows for nudge (§g-45). 114 lists "⌥ free end"
    and its hint bar "⌥ Free end" (§g-44). The screenshots stay as rendered.
54. **No keyboard path for resize and routing** ([112](screens/112-resize-light.png)–[114](screens/114-endpoint-targets-light.png)):
    the handles are pointer-only, and the design gives no keyboard alternative. Principle VII
    requires every action to be keyboard operable.
    **Default:** 017 specifies one before it is built (for example W / H fields in the drawer's
    Appearance section, and Reset route plus a side picker in the connection toolbar); the
    handles themselves stay pointer-only.

### Decisions from the 016 clarification (2026-09-29)

55. **Groups as frames** (109, 110): 002 and schema v1 derive a group's box from its members, so
    the box grows when a member moves and a card cannot be dragged out of a group.
    **Decision (founder, 2026-09-29):** a group is a frame with a stored position and size, like a
    card. Users drag it and resize it, and it never auto-scales. A card released with the pointer
    outside its group's frame leaves the group (⌥ keeps membership). A view with its own
    component positions (011) stores its own frame per group. Older decks get fitted frames on
    open. The fields are additive and optional (no version bump). 016 builds it, with an ADR, and
    017 reuses the size shape and the resize handles.

### Founder fixes after 020 (2026-10-02)

56. **Canvas deletes no longer ask.** Reverses §g-11 for canvas objects. Deleting cards, notes,
    connectors (and cutting a group) happens at once; the Undo toast (§g-19) and ⌘Z are the
    safety net. Flows, features, branches and rules are off-canvas and still ask first.
57. **Select and Hand tools** (reverses §g-36). Select (V) is the default: an arrow cursor, and a
    drag on empty canvas draws a selection marquee. Hand (H) pans with a drag (grab cursor).
    Space+drag and the middle mouse button still pan while Select is active. Select and Hand
    share one rail button that shows the current mode; a click switches (founder, 2026-10-02).
58. **Cards keep one size at every zoom level** (changes 67). The Component level no longer
    grows cards to 164×104 with owner and tag rows; it reads like Container (kind tile, title,
    subtitle) at 164×50. Landscape and System still hide the tile or text. Owner and tags stay
    in the details drawer. Tidy and group fitting keep the roomier 104 px layout cell.
59. **Tags show on the card** (founder, 2026-10-03). Up to ten tags wrap as small chips under the
    title at every level but Landscape, and the card grows to fit them (`card-tags.ts`; computed,
    not measured, so `cardSize` stays the one size source). Zooming never changes the size. Tag
    inputs stop at ten per card. Tags stay lower-cased (existing rule); tag colours are not part
    of this change. (Superseded by 033: tags keep their case and take their own tag colour,
    slate when none; the pill follows the tag, no longer the card colour.)
60. **Leaner floating chrome** (founder, 2026-10-03). Zoom goes to 400 %. The tools island keeps
    only Jump to, Labels and Focus as icons with tooltips; Export, the theme switch and keyboard
    shortcuts move to the deck menu; the flow-notes display moves into the step player. Fit
    diagram and fit selection get distinct icons (`Expand`, `SquareDashed`).
61. **Card system direction** (founder brainstorm, 2026-10-03). Five category packs a deck turns
    on (Architecture, Process, Logistics, Basic shapes, Data cards); two families, information
    cards and true shapes, with a card ↔ shape switch for in-between types; typed user fields with
    a "show on card" choice (lifts §g-40); deck-level tag colours; one shared palette; titles and
    descriptions up to 3 lines with a title-only tooltip; data-driven card types so a Canvas 2D
    renderer can draw them. Claude Design draws three directions; requirements and the prompt are
    in `claude-design-prompt-card-system.md`.
62. **Card system signature** (founder, 2026-10-03). Flow playback is the signature moment every
    card direction must show; the "deck of cards" metaphor may drive the look. A collapsed group
    reads as a stack, with its connectors rerouted to it. Reference video ideas: hover highlights
    a card's connections, bundled connectors with counts, drill-in with outside proxies. Connector
    ends may attach anywhere on a side (backlog 022).
63. **Card direction B "Deck"** (founder, 2026-10-03), from `Sododeck Cards.dc.html`: thick-paper
    cards with a solid 3px lip, 14px corners, solid-tint pill chips, 2px curved connectors,
    playback that deals the deck, a collapsed group as a fanned hand. The design's risk note
    becomes a rule: lip off below 60 % zoom, chips as dots at System. Backlog 028–035.
64. **Card system follow-ups** (founder, 2026-10-03). Connectors offer three user-chosen line types,
    curved (default), elbow and straight, in 029 (moved from 022). Tags keep the case the user
    typed; matching ignores case. 030 and 032 schema changes approved in principle (ADRs at
    their specs). Order: 028 → 025 → 029 → 035 → 033 → 022 → 030 → 032 → 031 → 034.
65. **Format, scale and collaboration review** (founder, 2026-10-03). Before the schema changes of
    029–032 and while there are no real users: backlog 036 makes the Yjs document
    collaboration-ready (collections keyed by id with order keys, long text as `Y.Text`, integrity
    on receive, one schema roadmap ADR) with the `.sododeck.json` format unchanged; 037 measures
    decks up to 10,000 nodes before 023 is decided. Server sync is explained in the diagram
    handbook §6.

### Mismatches found in board B (2026-10-03)

Found while importing board B (028). Each has a default; the founder confirms or changes it before the owning feature is specified.

66. **Palette fill and stroke** ([126](screens/126-deck-colour-light.png)): B computes `fill` at L .955 C .035 and `stroke` at L .60 C .14 (yellow, lime, amber stroke L .57; yellow hue 100), while 020 ships L .95 C .045 and L .62 C .15 (yellow hue 102); every hex differs by a few units. **Default:** keep 020's shipped `fill` / `stroke` (existing decks look the same, and 020's values are contrast-tested); add B's `chip`, `ink` and `dot` as new tokens. B's values for reference:

| Colour | B light fill | B light stroke | B dark fill | B dark stroke |
| ------ | ------------ | -------------- | ----------- | ------------- |
| red    | `#ffe8e4`    | `#c65a51`      | `#462622`   | `#e6867b`     |
| orange | `#ffebda`    | `#be6517`      | `#442916`   | `#de8f57`     |
| amber  | `#fdeed6`    | `#a26b00`      | `#3e2d10`   | `#cc9c42`     |
| yellow | `#f5f1d7`    | `#8b7700`      | `#363110`   | `#b6a643`     |
| lime   | `#e8f5dd`    | `#5b871d`      | `#283519`   | `#8cb460`     |
| green  | `#e0f7e5`    | `#2a9754`      | `#1b3824`   | `#66ba7f`     |
| teal   | `#d8f8f2`    | `#009a86`      | `#093832`   | `#2bbdaa`     |
| cyan   | `#d7f7ff`    | `#0093b4`      | `#083740`   | `#26b7d3`     |
| blue   | `#e1f2ff`    | `#4081d2`      | `#1e3149`   | `#6fa7ee`     |
| indigo | `#eaeeff`    | `#6e75d2`      | `#2a2e49`   | `#939cef`     |
| violet | `#f4ebff`    | `#9069c5`      | `#352a45`   | `#b392e3`     |
| pink   | `#ffe7f3`    | `#bc598c`      | `#432534`   | `#dd84af`     |
| slate  | `#edf0f5`    | `#748193`      | `#2d3136`   | `#9aa6b5`     |

67. **Card width 184** (B) vs 164 (§g-58, D9). **Default:** 029 makes 184 the default width for cards without a stored size, as backlog §029 says; cards the user resized (017) keep their width. The JSON does not change because the default size is computed.
68. **Weight 600** for card titles, chips and count discs vs DESIGN.md "weights 400–500, 600 only for the wordmark and small status headings". **Default:** allowed in the Deck card look only; chrome keeps 400–500 (DESIGN.md Typography updated).
69. **Problem state** ([122](screens/122-deck-states-light.png)): B draws a 1.5px dashed Clay outline at offset 4 and a Clay Soft count badge in the header; DESIGN.md (020, 107) has a 3px dashed ring 3px outside and an alert badge. **Default:** B's, as backlog §029 already lists. Still readable without colour (dashed line + ⚠ icon).
70. **Detail per zoom level** ([123](screens/123-deck-zoom-levels-light.png)): B shows fields only at Component and no tags below Component; §g-58 makes Component read like Container and §g-59 shows tags at every level but Landscape. **Default:** keep §g-58 / §g-59: the card has one size at every level; tags show from System up (as dots at System, §g-63); field visibility per level is decided with 032.
71. **Lip at Landscape** ([123](screens/123-deck-zoom-levels-light.png)): the dense board at ~25 % still draws lips. **Default:** the §g-63 rule wins: no lip below 60 %.
72. **Connector stroke**: B uses 2px `#b4b4ab` / `#5a5a53`; DESIGN.md `edge` is 1.5px Edge `#c9c9c2` / `#3d3d38`. **Default:** B's values in the Deck look (a darker line keeps 2px curves readable on the paper cards); the Edge token stays for chrome.
73. **Flow marks** ([117](screens/117-deck-sample-board-light.png)): B's token is a 24px numbered disc and steps get corner stickers; DESIGN.md `flow-token` is a 5px dot with a halo. **Default:** B's, built by 035; DESIGN.md `flow-token` is updated by 035. **Built** by 035 (stickers, numbered token, connector states; the branch picker stays inline, see `specs/035-flow-playback-deck/visual-check.md`).
74. **Tilt, lift and fan are paint-only.** Hover lifts 2px, dragging tilts −2.5° (−3° for shapes), and the fanned hand rotates −7° / +4°. **Default:** none of these moves the card's box: snapping, hit tests, edge anchors, minimap and export use the unrotated, unlifted box (backlog §029 risk).
75. **Tag size** ([125](screens/125-deck-tags-light.png)): backlog §028 said "chips 11.5/500"; in B that is the field chip (21 tall), while tags on a card are 18 tall at 10.5 / 500, and 21 tall with × in the drawer (DESIGN.md `tag-chip` is 26 tall on Surface 2). **Default:** the design wins; backlog §028 corrected; the drawer tag chip follows B in 033.
76. **Connector relationships, bundles and side-sliding ends** ([118](screens/118-deck-connections-light.png)): calls / reads / writes / depends-on line styles, ×n bundles, ends that slide along a side snapping at 25 / 50 / 75 %, and drill-in proxies are drawn but have no schema. **Default:** not decided here; 022 (ends) and 034 (focus, bundles, drill-in) specify them; relationship types need a founder decision before any schema change.
77. **More packs than D1** ([127](screens/127-deck-type-palette-light.png)): the packs list shows C4 model, BPMN and Cloud · AWS (off) beyond D1's five, and counts Basic shapes as 13 types. **Default:** 030 ships D1's five packs; the others illustrate the list, not scope.
78. **The board's "suggested path"** (start from A, use B's lip only on the current flow step) is superseded by the founder's pick of B (§g-63).
79. **Custom colours in the Deck look** ([126](screens/126-deck-colour-light.png)): custom deck colours have no `chip` / `ink` / `dot`; chips use the hex as fill with the flipped text colour, and light customs (Sand, Mint) fail 3:1 as a stroke on the canvas. **Default:** as designed; colour is decoration and the existing text-contrast warning (FR-026) stays the only check.
80. **Sizes inside the states row** ([122](screens/122-deck-states-light.png)): the states frame draws cards 164 wide to fit six per row. **Default:** measure from the other rows (184); 122 is the reference for state styling only.

### Founder decisions on format compatibility (2026-10-03)

81. **ADR 0020 deferred** (founder, 2026-10-03). There are no users yet and the app is in development, so the `.sododeck.json` format and the stored deck can change freely: no format revision, no read-only guard, no handling of files or tabs from older builds. Backlog 025 moves to just before the first public release, where ADR 0020 is re-confirmed; 036 no longer depends on it.
82. **036 decisions** (founder, 2026-10-03). Decks stored in the browser before 036 are not migrated and get no layout version (export before upgrading, import after). Collapsed groups stay shared document data per view. The 036 spec keeps anything a person wrote when concurrent edits clash (reported in Problems) and repairs only content-free leftovers.

### Mismatches found in the Database board (2026-10-04)

Found while importing the Database board (039). The first four are deviations the founder decided on 2026-10-03 (the app wins; fix them while implementing); the rest have a default the founder confirms or changes before the owning feature is specified.

83. **≡ menu** ([150](screens/150-db-deck-menu-light.png)): the board draws its own menu without shortcuts and with its own icons. **Decision (founder, 2026-10-03):** `apps/app/src/editor/shell/deck-menu.tsx` wins, with Show JSON ⌘J, Keyboard shortcuts ? and the app's icons.
84. **Dialect convert confirm** ([153](screens/153-db-dialect-change-light.png)): a local dialog (`dlgP`) with its own shadow and a second dim layer. **Decision (founder, 2026-10-03):** the `packages/ui` `dialog.tsx` confirm with one standard overlay, no second dim layer.
85. **Deck drawer sections** ([151](screens/151-db-deck-settings-light.png), [152](screens/152-db-deck-settings-database-light.png)): the board redraws Problems, Summary and Storage. **Decision (founder, 2026-10-03):** they stay as `apps/app/src/editor/inspector/deck-inspector.tsx` draws them; only the Database section is new (043).
86. **Local control copies** ([138](screens/138-db-import-dialog-light.png), [145](screens/145-db-export-light.png), [151](screens/151-db-deck-settings-light.png), [152](screens/152-db-deck-settings-database-light.png), [153](screens/153-db-dialect-change-light.png)): `ctog` with a hard-coded `#fff` knob and `rgba(0,0,0,.2)` shadow, `check`, `seg` / `SEGI`, `dlgP` (shadow `rgba(0,0,0,.25)`), and window shadows `rgba(0,0,0,.08)`. **Decision (founder, 2026-10-03):** use `packages/ui` `switch`, `checkbox`, `segmented-control` and `dialog` plus the elevation tokens.
87. **Table width** ([156](screens/156-db-table-anatomy-light.png)): tables are 240 wide against the card default of 184 (§g-67). **Default:** `db-table` defaults to 240 and other cards keep 184. The size is computed, so the JSON does not change.
88. **Tool name in the board** ([145](screens/145-db-export-light.png)): the DBML row of the export list carries a subtitle that names another tool. **Default:** repo docs and UI copy say "DBML" only (the subtitle is dropped or reads "Database markup"). The prototype file is still copied byte-for-byte.
89. **A2 zoom** ([135](screens/135-db-schema-deck-working-light.png)): drawn at 80 % although the prompt said 100 %. **Default:** accept; the frame is the reference for content, not for zoom.
90. **Type text contrast on tinted rows** ([156](screens/156-db-table-anatomy-light.png), [161](screens/161-db-states-light.png)): the board draws the type text and the nullable "?" (Mono 11, Muted) on hovered (Surface 2) and matched or R / W (Orange Soft) rows. In the light theme this is 4.40 and 4.27:1, below 4.5:1 (dark passes: 5.02 and 4.61). The problem row is fine: it draws Clay ink on Clay soft (5.62 / 7.70). **Default:** use Secondary on those two row fills (6.81 and 6.62:1) and keep Muted on Surface.
91. **Import dialog overlaps export cards** ([166](screens/166-db-code-import-export-light.png)): the dialog is absolutely positioned over the export plates in the same frame, so part of the export cards is hidden. **Default:** use 138 and 139 for the dialog and 145 for export; take only the code panel from 166.
92. **Caption overlaps** ([156](screens/156-db-table-anatomy-light.png), [160](screens/160-db-authoring-light.png)): in 156 the dimension labels of the column-row spec (4, 16, name, type < 58 %, 7) overlap the caption below them; in 160 the paste caption (I) overlaps the indexes footer and the locked tooltip (J) runs past the plate edge. **Default:** read values from DESIGN.md "Database pack" and the text of the frame, not from the overlapping labels.
93. **Table height per zoom level** ([162](screens/162-db-zoom-levels-light.png)): the caption says card height follows the detail level as the zoom changes (Container keys only, Component all rows). **Decision (041 planning, ADR 0030):** a table's size follows its effective detail (its own, else the deck's; Auto = All) and the display toggles, never the zoom; below 90 % it draws System or Landscape content inside the same box. "Keys at Container" is reached by pinning Keys.
