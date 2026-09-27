# Sododeck design analysis

Source: the Claude Design prototype in [`claude-design/`](claude-design/) (`Sododeck.dc.html` +
`sododeck-data.js` + the `support.js` runtime), imported 2026-09-27, and its screenshots in
[`screens/`](screens/). The same day the project gained **states 41–85** (`Sododeck State.dc.html`

- `sododeck-states.js`, laid out on the `Sododeck Extensions.dc.html` board): flow authoring and
  branches, edge drawing, multi-select, problems, cloud/partner kinds, stickies, semantic zoom,
  collapsible groups, folder/deck menus, storage, multi-tab and autosave states. They are listed in
  §a and checked against DESIGN.md and the founder decisions in §g-18 onward. The prototype's own design-system note (`design.md` in the Claude Design
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

### Not designed at all

Error boundary / crash screen, 404 deck, loading skeletons, **confirm dialogs** (delete
deck/node/edge/rule/folder: the new frames use an Undo toast instead, see §g-11 and §g-19),
settings, narrow (<1280px) layout, rule-editor column delete/reorder, custom view configuration,
"Tidy layout" (auto-layout) button and pin glyph, feedback entry point. Storage-quota-exceeded and
"deck open in another tab" are now covered by 85 and 82 (82 is not used, §g-35).

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
    7-day warning for now (Excalidraw ships neither). The storage card from 80–81 stays.
35. **Multi-tab** ([82](screens/82-second-tab-light.png)): the design locks the second tab
    (read-only banner, greyed fields, "Use here instead").
    **Decision (founder, 2026-09-27):** **live sync** instead: every tab showing a deck stays
    editable, edits sync between tabs within 1 s and merge without loss (Yjs), undo is per tab. No
    read-only tab, lock or take-over; frame 82 is not used.
36. **Drag on empty canvas** (003): design tools like Figma select with a plain drag; the canvas
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
    **Decision (founder, 2026-09-27):** **canvas-first** like Miro: full-bleed canvas, floating
    islands, a left icon rail with flyouts, the inspector as an on-demand drawer, the JSON panel
    hidden by default. Existing frames stay the reference for panel **content**, not placement.
    Backlog 018; needs a design pass, an ADR and a DESIGN.md update.
39. **Card colours** (not in the design): cards are coloured by kind only.
    **Decision (founder, 2026-09-27):** fill and stroke from a fixed named palette, plus a "+"
    that adds custom hex colours to the deck's swatches. Backlog 020 (schema change).
40. **Card attributes** (founder's Miro cards show year, status, date range): **deferred**. Cards
    keep the existing fields; user-defined typed fields come later.
41. **Scheduling:** 016–020 run **after M4**.
