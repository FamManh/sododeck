# Sododeck implementation backlog (MVP, M1–M5)

Bounded Spec Kit features derived from the Claude Design prototype
([`docs/design/design-analysis.md`](design/design-analysis.md), screenshots in
[`docs/design/screens/`](design/screens/)) and the P0 requirements in [`docs/spec.md`](spec.md).
Each feature is 1–5 days and goes through `/speckit.specify → /speckit.plan → /speckit.tasks →
/speckit.implement`. **Do not start a feature before its dependencies are merged.**

Status: draft for founder review (2026-09-27). Items marked **⚠ decision** depend on the open
questions in design-analysis §g.

## Dependency graph

```mermaid
flowchart LR
  F000[000 design-foundation]
  F001[001 json-schema-v1]
  F002[002 yjs-model]
  F003[003 canvas-basic]
  F004[004 json-panel-sync]
  F005[005 local-library-autosave]
  F006[006 flow-authoring]
  F007[007 flow-playback]
  F008[008 inspector-rules]
  F015[015 model-validation]
  F009[009 stickies-search]
  F010[010 zoom-groups-focus]
  F011[011 views-autolayout]
  F012[012 export]
  F013[013 samples-onboarding]
  F014[014 analytics-feedback]

  F001 --> F002 --> F003
  F000 --> F003
  F000 --> F005
  F002 --> F005
  F003 --> F004
  F003 --> F006 --> F007
  F006 --> F008 --> F009
  F006 --> F015
  F003 --> F010 --> F011
  F007 --> F012
  F011 --> F012
  F009 --> F013
  F005 --> F013
  F005 --> F014
```

## Critical path

**001 → 002 → 003 → 006 → 008 → 009 → 013** ≈ 3 + 4 + 5 + 5 + 5 + 4 + 3 = **29 working days**.
000 (4 d) runs in parallel with 001–002. The M4 branch 003 → 010 → 011 → 012 (≈ 19 d after 003)
can run in parallel with M2/M3 if a second agent is available.

Total estimate: **64 working days** for one agent sequentially (≈ 13 weeks), vs 6–8 weeks in spec
§13. Getting to 8 weeks needs two parallel streams (flows/knowledge vs scale/export) or cutting
scope (see report).

## Feature list

| ID  | Name                   | Milestone | Depends on | Est. | Needs design?                                  |
| --- | ---------------------- | --------- | ---------- | ---- | ---------------------------------------------- |
| 000 | design-foundation      | M1        | —          | 4 d  | —                                              |
| 001 | json-schema-v1         | M1        | —          | 3 d  | ⚠ decision (§g-4)                              |
| 002 | yjs-model              | M1        | 001        | 4 d  | —                                              |
| 003 | canvas-basic           | M1        | 000, 002   | 5 d  | edge drawing (default ok)                      |
| 004 | json-panel-sync        | M1        | 003        | 4 d  | ⚠ decision (§g-3)                              |
| 005 | local-library-autosave | M1        | 000, 002   | 5 d  | New-folder, multi-tab (small)                  |
| 006 | flow-authoring         | M2        | 003        | 5 d  | **yes** (F-1, F-4)                             |
| 007 | flow-playback          | M2        | 006        | 4 d  | —                                              |
| 008 | inspector-rules        | M3        | 006        | 5 d  | edge/flow/step inspector (default ok)          |
| 015 | model-validation       | M3        | 006        | 2 d  | small (default ok)                             |
| 009 | stickies-search        | M3        | 008        | 4 d  | **yes** (stickies)                             |
| 010 | zoom-groups-focus      | M4        | 003        | 5 d  | **yes** (V-1 levels, V-2 collapse)             |
| 011 | views-autolayout       | M4        | 010        | 5 d  | custom view config, layout button (default ok) |
| 012 | export                 | M5        | 007, 011   | 4 d  | —                                              |
| 013 | samples-onboarding     | M5        | 005, 009   | 3 d  | —                                              |
| 014 | analytics-feedback     | M5        | 005        | 2 d  | feedback button (small)                        |

Changes vs the original proposal: added **015-model-validation** (C-7 had no home); moved undo/redo
and multi-select into 003 and bulk edit into 008 (C-6); ⌘K (C-3) lives in 009 with global search
(K-4) because they share one surface in the design; the whole-deck JSON export/import (G-3) is in
005 and the full export dialog (I-1) in 012.

## Shared definition of done (every feature)

- [ ] **Constitution check** in `plan.md` against all eight principles; deviations justified in
      Complexity Tracking and approved by the founder. In particular: document data only in Yjs via
      `@sododeck/model` (I); schema + round-trip test for any file-format change (II); stable ids
      and rename-safe references (III); no network with content, all assets bundled (IV); heavy work
      in workers (V); keyboard operable + non-color state cues (VII); no new runtime dependency
      without approval (VIII).
- [ ] **Tests:** Vitest unit tests for every pure function and store; Testing Library component
      tests by role/label for user-visible behavior; model changes add a round-trip case in
      `packages/model/test`. A bug fix starts with a failing test.
- [ ] **E2E:** the existing smoke suite (`apps/app/tests/e2e/smoke.spec.ts`, incl. "no third-party
      requests") passes. New Playwright specs are **deferred** by constitution VI (TODO(e2e)); add
      one only if the founder amends the constitution.
- [ ] **Visual check:** screenshots of the implemented screens at 1440×900, light and dark, placed
      next to the matching `docs/design/screens/*.png` in the PR description; differences are
      either fixed or listed (allowed differences: DESIGN.md token overrides, lucide icons instead of
      Material Symbols — see design-analysis §g-1/§g-2).
- [ ] **Performance:** for canvas-touching features (003, 006, 007, 009, 010, 011), `pnpm bench`
      before and after, numbers in the report, no regression below 60 fps at 500 nodes / 1,000
      edges; flow highlight < 100 ms.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass.
- [ ] Docs: package `CLAUDE.md` updated when boundaries/APIs change; ADR for significant decisions.
- [ ] Small Conventional Commits; final report: what changed, what was skipped, what is uncertain.

---

## 000-design-foundation

- **Milestone:** M1 · **Depends on:** — · **Estimate:** 4 d
- **Goal:** Every screen can be built from shared, token-driven building blocks that look exactly
  like the design in light and dark, so feature work never re-invents buttons, inputs or tiles.
- **Spec IDs:** NFR accessibility (WCAG 2.1 AA), design system (DESIGN.md). Enables all others.
- **Design references:** all screens; tokens in design-analysis §c; components in §b "Chrome and form
  components"; e.g. [02-editor-node-selected](design/screens/02-editor-node-selected-light.png)
  (inputs, select, tags, segmented), [14-editor-palette-tab](design/screens/14-editor-palette-tab-light.png)
  (search field, kind tiles), [01-library](design/screens/01-library-light.png) (banner),
  [06-export-json](design/screens/06-export-json-light.png) (dialog, switch),
  [30-command-palette](design/screens/30-command-palette-light.png),
  [05-empty-deck-tour-1](design/screens/05-empty-deck-tour-1-light.png) (coach mark).
- **In scope:** motion tokens (dim 250 ms, ring 200 ms, token loop 1.4 s, step 1.7 s, toast 2.6 s,
  reduced-motion); extra shadows (hover, tour) and radii (segment 7, row 8, banner 14); lucide icon
  mapping table for the ~70 Material glyphs and the 6 node kinds; components: Input, InlineEdit,
  Textarea, Select, SearchField (with kbd hint), SegmentedControl, Switch, TagChip/TagInput,
  KindTile, Banner, Dialog, Toast, CoachMark, Button `chip` and `toggle` variants; a `/design`
  gallery route (dev only) showing every component in both themes.
- **Out of scope:** app screens, canvas components (React Flow nodes/edges live in the app), command
  palette behavior (009), changing DESIGN.md colors.
- **Acceptance criteria:**
  - Given the gallery in light theme, When compared with the design screenshots, Then buttons,
    inputs, select, segmented control, switch, tags, kind tiles, banner, dialog and coach mark match
    size, radius, type and color (except the DESIGN.md token overrides).
  - Given the theme is switched to dark, When the gallery re-renders, Then every component uses the
    dark token values with no hard-coded colors (lint rule or grep check passes).
  - Given keyboard only, When tabbing through the gallery, Then every interactive component shows a
    visible focus indicator and is operable (Space/Enter/arrows as appropriate).
  - Given `prefers-reduced-motion: reduce`, When motion tokens are read, Then durations resolve to 0
    and looping animations are disabled.
  - Given a kind name (client, gateway, service, queue, database, external), When rendering a
    KindTile, Then it shows the mapped lucide icon with that kind's soft/ink colors at 22/28/30/40 px.
  - Given a TagInput, When the user types "PII" and presses Enter twice, Then one tag "pii" exists.
- **Risks:** Command (cmdk) and Toast (sonner) are new runtime deps → need approval, or build small
  own versions; lucide lacks some glyphs (e.g. brand clouds); visual drift between Geist Variable
  (ours) and static Geist (design).
- **`/speckit.specify` prompt:**
  > Create the shared visual building blocks for Sododeck so every screen looks like the approved
  > design in both light and dark themes. Users should see consistent buttons (primary, secondary,
  > ghost, icon, chip, toggle), text fields, inline-editable text, multi-line text, selects, search
  > fields with a keyboard hint, segmented controls, switches, removable tag chips with an add
  > field, colored "kind" tiles for the six component kinds, banners (warning, success, error),
  > modal dialogs, toasts and a step-by-step coach-mark tooltip. Motion must be short and calm and
  > must respect the user's reduced-motion setting. Every control must be usable by keyboard with a
  > visible focus indicator and meet WCAG 2.1 AA contrast. Why: feature screens are built by
  > different agents over many weeks and must stay visually identical to the design and to each
  > other; accessibility must be built in from the start. Include a hidden gallery page that shows
  > every building block in every state and theme for visual review.
- **`/speckit.plan` hint:**
  > packages/ui only (plus a dev-only `/design` gallery route in apps/app). Follow
  > packages/ui/CLAUDE.md: shadcn conventions, Radix primitives already allowed, tokens only, no
  > `dark:` overrides. Add motion/shadow/radius tokens to tokens.css + theme.css and to the
  > tailwind-merge config in utils.ts. Icons: lucide-react; write the Material→lucide mapping table
  > in packages/ui (docs + a typed `kindIcon` map). Ask before adding cmdk/sonner; prefer Radix
  > Dialog/Popover. DESIGN.md token values win over the prototype (on-primary dark text, clay,
  > success). Match docs/design/screens/02-editor-node-selected-light.png,
  > 14-editor-palette-tab-light.png, 06-export-json-light.png, 05-empty-deck-tour-1-light.png
  > pixel-close for the components they contain. Component tests by role/label for each component.

## 001-json-schema-v1

- **Milestone:** M1 · **Depends on:** — · **Estimate:** 3 d
- **Goal:** A complete, versioned `.sododeck.json` format that can hold everything the design shows,
  so decks round-trip, validate and can be read by other tools.
- **Spec IDs:** §6 data model, G-3, I-1 (JSON), C-5 (schema for autocomplete), ADR 0002.
- **Design references:** design-analysis §d (field mapping table); data in
  [`claude-design/sododeck-data.js`](design/claude-design/sododeck-data.js); JSON shown in
  [16-editor-json-deck-tab](design/screens/16-editor-json-deck-tab-light.png) and
  [06-export-json](design/screens/06-export-json-light.png).
- **In scope:** full schema for deck metadata (name, description, tags), Node (type enum, title,
  group, level, owner, tags, description, tech, host, icon, links, rules, position), Group (title,
  parent), Edge (from, to, protocol enum, label, direction, description, links), View (type, title,
  subtitle field, includes, position overrides), Feature, Flow (feature, title, description, steps,
  trigger, outcome), Step (own id, edge, condition, sla, rules[], payload, notes, sample
  inputs), Rule (title, description, hit policy, inputs, outputs, rows with ids), Sticky (text,
  anchor, position, color); per-object key order; examples incl. a minimal deck and a deck with a
  flow + rule; Ajv/Zod parity; fix `sododeck.dev` vs `.com` in spec §6.
- **Out of scope:** step branches (moved to 006, added there as an optional field — no version
  bump), YAML import, comments/ADRs/state machines (P1), migrations (none yet), the Delivery
  sample (013).
- **Acceptance criteria:**
  - Given each example file, When validated with Ajv and with the generated Zod schema, Then both
    accept it, and both reject the same set of invalid fixtures (parity test).
  - Given a deck whose node has no `tech`, `host`, `icon`, `links` or `position`, When validated,
    Then it is valid (all additions are optional).
  - Given a rule, When it has a row whose number of `when` cells differs from its inputs, Then
    validation fails with a readable message.
  - Given a flow step, When it has no `id`, Then validation fails (every object has a stable id).
  - Given the schema file changed, When `pnpm test` runs without `pnpm schema:generate`, Then the
    staleness test fails.
- **Decisions (2026-09-27):** node kinds closed list `client, gateway, service, queue, database,
external`; protocol families `http, grpc, event, sql, websocket, other` (specifics in the label);
  positions on nodes with per-view overrides; structured rule tables; `rules[]` arrays; branches
  deferred to 006. See `specs/001-json-schema-v1/spec.md`.
- **Risks:** Zod generator limits (no recursive refs) for nested groups.
- **`/speckit.specify` prompt:**
  > Define version 1 of the Sododeck deck file (.sododeck.json) so that a deck can hold everything
  > an architect models: deck name and description; components with a kind, title, owner, tags,
  > markdown description, technology, hosting, links, attached rules and position; groups;
  > connections with protocol, label and direction; views; features; flows made of ordered steps
  > over existing connections, each step with a condition, SLA, attached rules and sample rule
  > inputs; business rules as decision tables with a hit policy, input and output
  > columns and rows; and sticky notes that are free or attached to an object. Every object has a
  > stable id that never changes when it is renamed, and all references are by id. The format must
  > be strict, documented and validated, so the app, a future CLI and AI agents can trust it, and
  > must stay readable in git diffs. Why: the file is the public contract and the only way data
  > leaves the browser; if it cannot express the design, users lose work on export.
- **`/speckit.plan` hint:**
  > packages/schema only. Edit schema/v1.json (draft 2020-12, local non-recursive $refs), run
  > `pnpm schema:generate`, extend examples/ and test/ (Ajv/Zod parity, invalid fixtures). Use
  > design-analysis §d as the field list; record the enum and table-shape decisions in an ADR
  > (0004; 0003 is the UI foundation ADR). Keep `rules` as an object keyed by id (ADR 0002). Every step and rule row gets an id.
  > No Yjs, no React. Update packages/schema/CLAUDE.md "Status".

## 002-yjs-model

- **Milestone:** M1 · **Depends on:** 001 · **Estimate:** 4 d
- **Goal:** One document model that every view edits safely, with undo, reference integrity and a
  lossless round-trip to the file.
- **Spec IDs:** §11 (Yjs source of truth), C-6 (undo/redo), C-7 (reference checks, groundwork), G-1.
- **Design references:** behavior in design-analysis §e (every edit in inspector, canvas, JSON and
  rule editor goes through the model); delete-node removes its edges
  ([02-editor-node-selected](design/screens/02-editor-node-selected-light.png)).
- **In scope:** Yjs layout for every v1 object; typed mutations (add/update/remove node, edge,
  group, flow, step, rule, row, column, sticky, view); cascade rules (deleting a node removes its
  edges and marks affected steps; deleting a rule detaches it); id generation; UndoManager scopes
  and grouping (one drag = one undo step); `toJSON`/`fromJSON` with per-object key order;
  referential validation report (edge → node, step → edge, rule refs, anchors).
- **Out of scope:** storage providers (005), UI, schema migrations.
- **Acceptance criteria:**
  - Given any valid example file, When `toJSON(fromJSON(x))` runs, Then the result deep-equals `x`
    (one round-trip case per object type).
  - Given a node referenced by two edges and a flow step, When the node is renamed, Then all
    references still resolve; When it is deleted, Then both edges are removed and the step is
    reported as broken.
  - Given ten title keystrokes followed by undo, When undo runs once, Then the title returns to its
    value before the edit burst (grouped by the capture timeout).
  - Given a new node is added, When its id is inspected, Then it is unique, not derived from the
    title, and unchanged after rename.
  - Given the model package, When run in Node without DOM, Then all tests pass (worker-safe).
- **Risks:** Yjs layout is persisted in IndexedDB from 005 on — later changes need an ADR and a
  migration; ordering of steps/rows in Y.Array under concurrent edits.
- **`/speckit.specify` prompt:**
  > Provide a single deck model that all editing surfaces (canvas, inspector, JSON panel, rule
  > editor) change, so they can never disagree. Users can add, edit, move and delete components,
  > groups, connections, flows, steps, rules and sticky notes; deleting a component also removes its
  > connections and flags any flow step that used them; renaming never breaks a reference. Users can
  > undo and redo their edits, where a burst of typing or one drag counts as a single step. Saving
  > and loading a deck file must never lose or change data. Why: two-way sync between picture and
  > text, undo, multi-tab safety and later collaboration only work with one trustworthy model.
- **`/speckit.plan` hint:**
  > packages/model only (depends on @sododeck/schema). Document the Yjs layout at the top of
  > src/deck.ts; typed accessors/mutations; Y.UndoManager with captureTimeout; referential
  > validation returns a typed problem list (used by 015). Round-trip tests in packages/model/test
  > per object type. No React/DOM/storage. Update packages/model/CLAUDE.md.

## 003-canvas-basic

- **Milestone:** M1 · **Depends on:** 000, 002 · **Estimate:** 5 d
- **Goal:** Architects can draw a system on a blank canvas: add, connect, move, select and delete
  components, and navigate large diagrams.
- **Spec IDs:** C-1, C-2, C-6 (undo/redo, multi-select), NFR performance, a11y.
- **Design references:** [02-editor-node-selected](design/screens/02-editor-node-selected-light.png) ·
  [dark](design/screens/02-editor-node-selected-dark.png),
  [10-editor-deck-inspector](design/screens/10-editor-deck-inspector-light.png),
  [11-editor-edge-selected](design/screens/11-editor-edge-selected-light.png),
  [12-editor-labels-on](design/screens/12-editor-labels-on-light.png),
  [14-editor-palette-tab](design/screens/14-editor-palette-tab-light.png),
  [37-empty-deck-no-tour](design/screens/37-empty-deck-no-tour-light.png),
  [38-empty-deck-node-added](design/screens/38-empty-deck-node-added-light.png). Components: node,
  group boundary, edge + label pill, minimap, zoom control, canvas breadcrumb, Labels toggle,
  outline, palette, empty-canvas card, top bar. Tokens: canvas, dot, edge, kind tints,
  shadow-rest/selection, dim 250 ms.
- **In scope:** editor shell layout (top bar, left panel with Outline/Palette, canvas, inspector
  column, JSON panel slot); React Flow nodes (164×50, kind tile, subtitle, rule glyph), group
  boundaries (bounds from members), edges (smoothstep, 8px radius, end dot, 12px hit area) with
  label pills; select node/edge, click empty to deselect; drag to move; palette drag/click to add;
  delete (Del key + inspector trash) with undo toast; draw an edge by dragging from a node handle and
  reconnect an endpoint (default design); undo/redo (⌘Z/⇧⌘Z); shift-click / marquee multi-select;
  zoom −/+/fit 30–200%, fit on open; minimap with click-to-pan; Labels toggle; outline tree with
  collapse and select; empty-canvas card; minimal inspector: title for node/edge, name for deck;
  keyboard: Tab into canvas, arrow keys move selection between nodes.
- **Out of scope:** full inspector fields (008), JSON panel (004), flows (006/007), focus mode,
  drill-down and views (010/011), stickies (009), ⌘K (009), auto-layout (011), queue-lane routing.
- **Acceptance criteria:**
  - Given an empty deck, When the user drags "Service" from the palette onto the canvas, Then a
    "New service" node appears at the drop point, is selected, and the outline lists it.
  - Given two nodes, When the user drags from one node's handle to the other, Then a new edge
    exists in the model and is selected.
  - Given a selected node, When the user presses Delete, Then the node and its edges disappear and a
    toast offers Undo; When ⌘Z is pressed, Then both come back with the same ids.
  - Given a node is dragged, When the pointer is released and ⌘Z pressed once, Then the node returns
    to its previous position.
  - Given Labels is off, When the user turns it on, Then every edge shows its Mono label pill.
  - Given keyboard focus on the canvas, When the user presses arrow keys, Then selection moves to the
    nearest node in that direction and the focus ring is visible.
  - Given the 500-node / 1,000-edge bench deck, When `pnpm bench` runs, Then pan/zoom stays ≥ 60 fps.
- **Risks:** React Flow performance with custom nodes at 500+ nodes; edge-drawing UX is undesigned
  (default used); keeping React Flow state derived (never authoritative) under drag.
- **`/speckit.specify` prompt:**
  > Let an architect draw a system from a blank canvas. They pick component kinds (client, gateway,
  > service, queue, database, external) from a palette by dragging or clicking, connect components
  > by dragging from one to another, move them, select one or several, delete them, and undo or redo
  > any of that. Components show a colored kind tile, a title and a short subtitle; groups show a
  > dashed boundary with a label; connections show their label on demand. Users can zoom, fit the
  > diagram, pan with a minimap and browse all components in an outline tree. An empty deck explains
  > how to start. Everything must work with the keyboard and stay smooth with 500 components and
  > 1,000 connections. Why: designing a solution before code exists is the first job of the primary
  > user, and diagrams in this domain get large.
- **`/speckit.plan` hint:**
  > apps/app/src/editor (canvas.tsx, deck-node.tsx, deck-to-flow.ts, left-sidebar.tsx, top-bar.tsx
  > exist as M0 placeholders), reuse packages/ui (000). React Flow state is derived from
  > useDeckSnapshot and never authoritative; writes via @sododeck/model mutations; selection/zoom/
  > labels in the Zustand UI store. Edges: smoothstep, 8px radius (no custom queue lane). Run
  > `pnpm bench` before/after. Match docs/design/screens/02-editor-node-selected-light.png,
  > 14-editor-palette-tab-light.png, 37-empty-deck-no-tour-light.png and 12-editor-labels-on-light.png
  > pixel-close (lucide icons instead of Material Symbols).

## 004-json-panel-sync

- **Milestone:** M1 · **Depends on:** 003 · **Estimate:** 4 d
- **Goal:** Developers can read and edit the deck as JSON next to the canvas, and both stay in sync
  both ways, with errors that never lose their draft.
- **Spec IDs:** C-5.
- **Design references:** [02-editor-node-selected](design/screens/02-editor-node-selected-light.png)
  (selection tab), [15-editor-json-error](design/screens/15-editor-json-error-light.png),
  [16-editor-json-deck-tab](design/screens/16-editor-json-deck-tab-light.png),
  [17-editor-json-collapsed](design/screens/17-editor-json-collapsed-light.png),
  [39-empty-deck-paste-json](design/screens/39-empty-deck-paste-json-light.png). Tokens: code
  surface, text-code, clay for errors.
- **In scope:** panel header (JSON label, Selection/Deck segmented tabs, status "Editable · synced
  with canvas" / error line, line count, Copy, collapse); selection tab for node/edge (step in 007);
  Deck tab editable (⚠ decision §g-3); schema validation + autocomplete; invalid JSON or schema
  errors shown inline, draft kept, model untouched; id changes rejected with a message; paste a full
  deck into an empty deck; resizable/collapsible panel.
- **Out of scope:** YAML view (P1), diff view, multi-file features.
- **Acceptance criteria:**
  - Given a selected node, When the user changes `"title"` in the JSON panel to valid JSON, Then the
    canvas node title updates without leaving the editor.
  - Given the user types invalid JSON, When they pause, Then the header shows the parse error in
    clay with an icon (not color only), the draft stays, and the canvas is unchanged.
  - Given the user changes a node `id` in JSON, When applied, Then the change is refused with "id
    cannot be changed" and the model keeps the old id.
  - Given the user drags a node on the canvas, When the JSON panel shows that node, Then its position
    updates without moving the text cursor of an unrelated edit.
  - Given an empty deck, When a valid .sododeck.json is pasted into the Deck tab, Then all nodes,
    edges and flows appear on the canvas.
  - Given the JSON panel, When no network is available, Then autocomplete still works (bundled
    schema; no requests).
- **Risks:** cursor/selection jumps when remote-like updates rewrite Monaco content; large decks
  make full-deck JSON slow (throttle, apply diffs); ⚠ Deck tab editable vs read-only.
- **`/speckit.specify` prompt:**
  > Show the deck as JSON in a panel under the canvas that stays in sync with the diagram in both
  > directions. Users can view the JSON of the current selection or of the whole deck, edit it with
  > suggestions from the file format, and see their change on the canvas immediately. If the JSON is
  > invalid or breaks the format, the panel explains the problem inline and keeps the user's draft
  > without changing the diagram. Ids cannot be changed from the text. The panel can be collapsed
  > and the text copied. Pasting a whole deck into an empty deck creates it. Why: developers think in
  > text and the product promise is "the diagram is data"; losing a half-typed edit would break
  > trust.
- **`/speckit.plan` hint:**
  > apps/app/src/editor/json-panel.tsx + json-editor.tsx + monaco-setup.ts (bundled, deep imports,
  > no CDN). Monaco models are views: derive text from the Yjs snapshot, apply parsed edits through
  > @sododeck/model; never keep document data in Monaco. Validation via @sododeck/schema; JSON
  > Schema bundled with `enableSchemaRequest: false`. Heavy parse/diff for large decks in a worker if it
  > takes over 16 ms. Match docs/design/screens/15-editor-json-error-light.png,
  > 16-editor-json-deck-tab-light.png, 17-editor-json-collapsed-light.png pixel-close.

## 005-local-library-autosave

- **Milestone:** M1 · **Depends on:** 000, 002 · **Estimate:** 5 d
- **Goal:** Guests keep many decks in the browser with no account, never lose work, and are nudged to
  back up.
- **Spec IDs:** G-1, G-2, G-3, G-4, G-5, G-6.
- **Design references:** [01-library](design/screens/01-library-light.png) ·
  [dark](design/screens/01-library-dark.png), [07-library-list-view](design/screens/07-library-list-view-light.png),
  [08-library-search-no-results](design/screens/08-library-search-no-results-light.png),
  [09-library-folder-banner-dismissed](design/screens/09-library-folder-banner-dismissed-light.png);
  editor top bar autosave status in [02](design/screens/02-editor-node-selected-light.png); deck
  inspector STORAGE section in [10](design/screens/10-editor-deck-inspector-light.png). Components:
  deck card, new-deck card, list row, backup banner, storage meter, search field, segmented grid/list.
- **In scope:** IndexedDB persistence per deck (Yjs provider) + library metadata (name, folder,
  counts, updatedAt, lastBackupAt); library grid/list, All/Recent/Samples/folders, search; new deck;
  open deck; rename via breadcrumb; folders (create/rename/delete — default small dialog); move deck
  to folder; delete deck (confirm); import .sododeck.json (validate, error toast); export one deck
  and "Export backup" of all decks; storage usage meter and `storage.persist()` request; backup
  reminder after N days (+ Safari eviction copy); multi-tab: BroadcastChannel so two tabs never
  overwrite (second tab read-only or live-merged); autosave status in the top bar; thumbnails
  (simplified, generated from positions).
- **Out of scope:** sample decks content (013), full export dialog (012), File System Access (P1),
  cloud sync.
- **Acceptance criteria:**
  - Given the user edits a deck, When 500 ms pass and the tab is closed, Then reopening shows the
    edit.
  - Given three decks in two folders, When the user selects a folder or types in search, Then only
    matching decks show, and "No decks match "x"." appears when none match.
  - Given a valid .sododeck.json file, When imported, Then it appears in the library with its node
    and flow counts; Given an invalid file, Then a toast says it is not valid and nothing is added.
  - Given the last backup is older than the reminder threshold, When the library opens, Then the
    amber banner shows with "Export backup"; When dismissed, Then it stays hidden for this session.
  - Given the same deck open in two tabs, When one tab edits, Then the other tab never overwrites it
    (it updates or shows a read-only notice).
  - Given `storage.persist` is unavailable, When the app starts, Then it falls back silently and
    the meter shows "not persistent" (feature-detected via lib/features.ts).
- **Risks:** Safari eviction; quota errors mid-save need a visible error state (not designed);
  thumbnail generation cost for large decks (worker).
- **`/speckit.specify` prompt:**
  > Let guests keep a library of decks in their browser without an account. Every change is saved
  > automatically within half a second and the editor shows "Saving…" then "Saved in this browser".
  > The library shows decks as cards or a list, with folders, recent decks, samples and search; users
  > can create, open, rename, move and delete decks and manage folders. Users can import a deck
  > file, export one deck, and export a backup of all decks. The app shows how much browser storage
  > is used, asks the browser to keep the data persistently, and reminds users to back up because
  > data lives only on this device. Opening the same deck in two tabs must never lose edits. Why:
  > local-first with no lock-in is a core promise, and guest data loss is a top product risk.
- **`/speckit.plan` hint:**
  > apps/app/src/storage (Dexie for library metadata), y-indexeddb provider attached to the Yjs doc,
  > src/routes/library-page.tsx, top-bar autosave status; BroadcastChannel and storage.persist via
  > src/lib/features.ts with fallbacks. Serialization only through @sododeck/model. Library route
  > stays light (no React Flow/Monaco imports). Thumbnails from positions, rendered as simple SVG.
  > Match docs/design/screens/01-library-light.png, 01-library-dark.png, 07-library-list-view-light.png,
  > 08-library-search-no-results-light.png pixel-close.

## 006-flow-authoring

- **Milestone:** M2 · **Depends on:** 003 · **Estimate:** 5 d
- **Goal:** Architects capture each business flow as an ordered path over existing connections,
  with conditions and branches, grouped by feature.
- **Spec IDs:** F-1, F-4, F-5, K-1 (flow/step title + description).
- **Design references:** left panel FEATURES list in
  [02-editor-node-selected](design/screens/02-editor-node-selected-light.png) and flow list/steps in
  [03-flow-mode](design/screens/03-flow-mode-light.png); step row and condition block components.
  **Recording a flow, editing steps and branches are not designed** — request designs or accept the
  default below.
- **In scope:** features (create/rename/delete) and flows per feature in the left panel with a
  filter field; "Record flow" mode (default design): top-bar chip "Recording · name", click edges in
  order to append steps, step list builds on the left, undo last step, Done/Cancel; edit step
  condition, SLA, description; reorder/delete steps; branches: a step can start an alternative path
  from a previous step with a label; error paths marked as such and styled dashed + icon; broken
  steps (edge deleted) flagged.
  Adds the step `branch` field to the file format (deferred from 001): an additive optional field
  in `packages/schema` (fixtures + Ajv/Zod parity) and `packages/model` (round-trip case), no
  version bump; shape recorded in an ADR.
- **Out of scope:** playback, token animation and step inspector visuals (007), rules on steps (008),
  flow comparison (P1), sequence/swimlane (P1).
- **Acceptance criteria:**
  - Given a deck with edges, When the user starts recording "Place order" and clicks three edges in
    order, Then the flow has three steps referencing those edges in that order.
  - Given recording, When the user clicks an edge whose source is not connected to the previous
    step's target, Then it is still added but marked "not contiguous" (warning, not blocked).
  - Given a flow, When the user adds a branch at step 2 labelled "payment declined" and marks it as
    an error path, Then the branch steps render dashed with an error icon on the canvas.
  - Given ten flows in a feature, When the user types "fail" in the flow filter, Then only matching
    flows show.
  - Given an edge used by a step is deleted, When the flow is shown, Then that step shows a "broken"
    indicator with text, and undo restores it.
  - Given only the keyboard, When recording, Then edges can be chosen via Tab/arrow navigation and
    Enter.
- **Risks:** **undesigned UX** (biggest design gap); branch model complexity (keep to one level of
  branching in MVP); edges reused by several steps.
- **`/speckit.specify` prompt:**
  > Let architects record business flows on top of the existing diagram. A feature (for example
  > "Delivery") groups many flows. To create a flow, the user starts recording and clicks existing
  > connections in order; each click adds a step, without redrawing anything. Each step can have a
  > title, description, condition and SLA target. A flow can branch at a step into an alternative
  > path with its own condition, and error paths look clearly different from the happy path (not by
  > color alone). Users can reorder, remove and edit steps, rename and delete flows and features,
  > and filter the flow list. If a connection used by a step is deleted, the step is shown as broken
  > instead of silently disappearing. Why: a feature with 10–20 flows is unreadable as one blob;
  > flows must be first-class objects, and creating them must be fast.
- **`/speckit.plan` hint:**
  > apps/app/src/editor (left panel flow list, recording mode in the Zustand UI store as UI state
  > only; steps written via @sododeck/model mutations from 002). Step shape per the 001 schema;
  > add the optional step `branch` field to packages/schema/schema/v1.json (run
  > `pnpm schema:generate`, fixtures, parity) and a round-trip case in packages/model, with an ADR
  > for the branch shape. Reuse step-row and condition-block visuals from the design. Run
  > `pnpm bench` (flow highlight < 100 ms). Default recording UI must be approved or replaced by a Claude Design screen
  > before implementation; match the left-panel list styling of
  > docs/design/screens/03-flow-mode-light.png pixel-close.

## 007-flow-playback

- **Milestone:** M2 · **Depends on:** 006 · **Estimate:** 4 d
- **Goal:** Anyone can select a flow and watch it light up end to end, step by step, while
  explaining it to a colleague.
- **Spec IDs:** F-2, F-3.
- **Design references:** [03-flow-mode](design/screens/03-flow-mode-light.png) ·
  [dark](design/screens/03-flow-mode-dark.png),
  [24-flow-step-no-rule](design/screens/24-flow-step-no-rule-light.png),
  [25-flow-step-sla-over](design/screens/25-flow-step-sla-over-light.png),
  [26-flow-playing-2x](design/screens/26-flow-playing-2x-light.png),
  [27-flow-mode-labels-dark](design/screens/27-flow-mode-labels-dark.png). Components: flow chip,
  step player, step rows, flow token, highlighted edges/labels, step inspector (condition, rules
  placeholder, SLA target), step JSON. Motion: token loop 1.4 s ÷ speed, step 1.7 s ÷ speed, dim
  250 ms.
- **In scope:** enter flow mode (left list, edge "Used in flows", later ⌘K); dim non-flow nodes/edges
  (plus a non-color cue: flow edges show step numbers on their labels); current step thick edge,
  solid label, looping token; step player (prev / play-pause / next, 1×/2×, progress segments);
  ← / → keys; click step row / segment / flow edge / flow node to jump; step inspector (from → to,
  protocol, condition, description, SLA target, rules section showing attached rule names —
  table view comes with 008); step JSON read-only in the JSON panel; exit via chip × / Back / Esc;
  reduced-motion: static token; `aria-live` announcement of the current step.
- **Out of scope:** "measured" SLA and meter fill from fake data (⚠ §g-6: show target only),
  compact decision table (008), export of a flow (012).
- **Acceptance criteria:**
  - Given a flow with 8 steps, When the user opens it, Then flow edges are highlighted, other
    elements dimmed, step 1 is current, and highlight appears in < 100 ms on the bench deck.
  - Given step 4 is current, When the user presses →, Then step 5 becomes current, its edge gets the
    token, and a screen reader announces "Step 5 of 8: Order Service → Payment Service".
  - Given play at 1×, When 1.7 s elapse, Then the player advances one step; at 2× every 0.85 s; on
    the last step playback stops.
  - Given play is pressed on the last step, When playback starts, Then it restarts from step 1.
  - Given `prefers-reduced-motion`, When a step is current, Then no token moves and the current
    edge is still distinguishable by width and label.
  - Given flow mode, When the user clicks a node that belongs to the flow, Then the first step
    touching that node becomes current.
- **Risks:** SVG animateMotion along React Flow edge paths when edges re-route; many dimmed
  elements repainting on each step (perf).
- **`/speckit.specify` prompt:**
  > Let users play a flow like a presentation. Selecting a flow highlights its path, dims
  > everything else, and a token travels along the current step's connection. A player lets users
  > go to the previous or next step, play and pause at normal or double speed, and jump to any step
  > from the progress bar, the step list, or by clicking the diagram; arrow keys also step through
  > the flow. A side panel shows the current step's from and to components, protocol, condition,
  > description, SLA target and attached rules. The current step is clear without relying on color,
  > is announced to screen readers, and animation stops for users who prefer reduced motion. Why:
  > tracing one flow end to end is the core value and the north-star metric ("flows played").
- **`/speckit.plan` hint:**
  > apps/app/src/editor: flow mode + current step in the Zustand UI store (UI state); derived
  > highlight sets memoized; token as an SVG overlay along the React Flow edge path; timers cleaned
  > up on exit. Inspector step view in inspector.tsx. Motion values from 000 tokens. Run `pnpm
bench` before/after (flow highlight < 100 ms). Match docs/design/screens/03-flow-mode-light.png,
  > 03-flow-mode-dark.png, 24-flow-step-no-rule-light.png, 26-flow-playing-2x-light.png pixel-close
  > (SLA section shows target only).

## 008-inspector-rules

- **Milestone:** M3 · **Depends on:** 006 · **Estimate:** 5 d
- **Goal:** Knowledge lives next to what it describes: every object has rich details, and business
  rules are decision tables reused across flow steps.
- **Spec IDs:** K-1, K-2, C-6 (bulk edit).
- **Design references:** node inspector in [02](design/screens/02-editor-node-selected-light.png),
  [18-editor-markdown-preview](design/screens/18-editor-markdown-preview-light.png),
  [23-editor-inspector-scrolled](design/screens/23-editor-inspector-scrolled-light.png); edge
  inspector [11](design/screens/11-editor-edge-selected-light.png); deck inspector
  [10](design/screens/10-editor-deck-inspector-light.png); rule editor
  [04](design/screens/04-rule-editor-light.png) · [dark](design/screens/04-rule-editor-dark.png),
  [28-rule-editor-no-match](design/screens/28-rule-editor-no-match-light.png),
  [29-rule-editor-other-rule](design/screens/29-rule-editor-other-rule-light.png); compact table on a
  step in [03](design/screens/03-flow-mode-light.png). Components: micro-label sections, markdown
  Write/Preview, tag input, link rows, rule card, decision table (full + compact), test result
  banner.
- **In scope:** inspectors for node, edge, flow, step and deck with title, markdown description
  (write/preview), owner (free text + suggestions), tags, links; node tech/host; edge label,
  protocol, direction, "Used in flows"; step condition, SLA, attached rules; connections list;
  multi-select bulk edit (type, tags, owner); rule editor route: list, create, rename, describe, hit
  policy, add/rename/remove condition and action columns, edit cells (syntax `≤ 5`, `> 20`, lists,
  `Any`), add/delete/reorder rows, delete rule; attach/detach rules on steps and nodes; "Used in"
  list; compact table on the step inspector with the matched row; ⚠ optional: test input panel +
  catch-all check (§g-6).
- **Out of scope:** comments (P1), ADRs (P1), glossary (P1), full rule simulator across flows (A-1).
- **Acceptance criteria:**
  - Given a selected node, When the user edits title, description, owner, tags and links, Then the
    canvas, outline and JSON reflect each change and one ⌘Z undoes the last field edit.
  - Given a description with bullets and `code`, When Preview is chosen, Then bullets and inline
    code render; an empty description shows "Nothing to preview."
  - Given rule "Delivery tier" attached to two steps, When a cell is edited in the rule editor,
    Then both steps show the updated table (single shared rule).
  - Given test inputs Distance 5, Weight 10, Priority Express, When evaluated with First match, Then
    row 1 is highlighted and its actions listed; with Weight empty, Then "No row matches these
    inputs" shows in clay with an error icon.
  - Given three selected nodes, When the user sets owner "Dispatch" in the bulk inspector, Then all
    three change in one undo step.
  - Given a rule used by steps, When it is deleted, Then the user is warned with the usage count and
    the steps are detached (undo restores).
- **Risks:** scope is large (inspectors + rule editor) — split into 008a inspectors / 008b rules if
  it exceeds 5 days; cell-syntax parsing edge cases; markdown rendering must be safe (no raw HTML).
- **`/speckit.specify` prompt:**
  > Let users attach knowledge to everything on the diagram. Selecting a component, connection,
  > flow, step or the deck itself shows a side panel where they edit its title, a markdown
  > description with preview, owner, tags and links, plus type-specific fields (technology and
  > hosting for components; label, protocol and direction for connections; condition and SLA for
  > steps). Several components can be edited at once. Business rules are decision tables: named,
  > described, with a hit policy, condition and action columns and rows; conditions accept
  > comparisons, lists and "any". A rule is shared: attach it to any flow step or component and
  > edits apply everywhere; the rule shows where it is used, and a step shows its table with the
  > row that matches. Users can try inputs and see which row matches. Why: complex business rules
  > (thresholds, retries, SLAs) get lost in scattered docs; they must live on the exact step they
  > govern.
- **`/speckit.plan` hint:**
  > apps/app/src/editor/inspector.tsx (split per object type), new route /deck/:id/rules;
  > rule evaluation (cell matching, hit policy) as a pure, unit-tested module in packages/model
  > (no UI); markdown rendering without raw HTML (ask before adding a markdown dependency; the
  > design only needs paragraphs, bullets, inline code). Owner suggestions derived from the deck.
  > Match docs/design/screens/02-editor-node-selected-light.png, 11-editor-edge-selected-light.png,
  > 04-rule-editor-light.png, 28-rule-editor-no-match-light.png pixel-close (success green per
  > DESIGN.md for matches).

## 015-model-validation

- **Milestone:** M3 · **Depends on:** 006 · **Estimate:** 2 d
- **Goal:** Users see what is wrong in their model — orphan components, broken flows, duplicate
  connections — before it misleads a reader.
- **Spec IDs:** C-7.
- **Design references:** not designed; closest patterns: rule CHECKS list in
  [04-rule-editor](design/screens/04-rule-editor-light.png), clay error line in
  [15](design/screens/15-editor-json-error-light.png). Default: "Problems" section in the deck
  inspector + warning glyph on affected nodes and flows.
- **In scope:** checks for orphan nodes, duplicate edges (same from/to/label), steps whose edge is
  missing, non-contiguous flows, rules referenced but missing, rules with no catch-all row; problem
  list with click-to-select; badge count in the top bar or deck inspector; computed off the main
  thread for large decks.
- **Out of scope:** custom lint rules (Q-4, P2), auto-fix.
- **Acceptance criteria:**
  - Given a node with no edges, When the Problems list is opened, Then it lists "Orphan: <title>"
    and clicking it selects and centers the node.
  - Given two identical edges, When validation runs, Then one "Duplicate connection" problem is
    listed.
  - Given a flow whose edge was deleted, When validation runs, Then "Broken flow: <flow> step n" is
    listed and the flow row shows a warning icon.
  - Given a 2,000-node deck, When validation runs, Then the UI stays responsive (runs in a worker).
- **Risks:** noise (orphans may be intentional) — allow dismissing per object later.
- **`/speckit.specify` prompt:**
  > Show users the problems in their model: components with no connections, duplicate connections,
  > flow steps whose connection was deleted, flows that jump between unconnected components, and
  > missing or incomplete rules. Problems appear in a list and as small warnings on the affected
  > objects; clicking a problem takes the user to it. Checking must not slow the editor on very
  > large decks. Why: a diagram that silently contains broken flows loses the trust that makes it
  > the source of truth.
- **`/speckit.plan` hint:**
  > Pure checks in packages/model (reuse referential validation from 002), run in a Web Worker for
  > large decks; UI in the deck inspector and outline/flow list glyphs. No design exists — use the
  > rule CHECKS row style from docs/design/screens/04-rule-editor-light.png; get founder sign-off on
  > the default before implementing.

## 009-stickies-search

- **Milestone:** M3 · **Depends on:** 008 · **Estimate:** 4 d
- **Goal:** Users leave reminders on the diagram and find anything — components, flows, rules,
  notes — from one keyboard shortcut.
- **Spec IDs:** K-3, K-4, C-3.
- **Design references:** ⌘K palette [30](design/screens/30-command-palette-light.png),
  [31 filtered](design/screens/31-command-palette-filtered-light.png),
  [32 no results](design/screens/32-command-palette-no-results-dark.png); top-bar "Jump to… ⌘K"
  field; palette STRUCTURE › Note in [14](design/screens/14-editor-palette-tab-light.png).
  **Sticky notes are not designed** (default: amber-soft card, markdown text, anchor badge).
- **In scope:** stickies: add from palette or context, free or anchored to a node (moves with it),
  edit markdown text, resize, delete, show in outline; ⌘K palette: commands (export, theme, focus,
  rules, library, new deck), flows, nodes, edges, rules, stickies, with matches in titles,
  descriptions, notes and rule cells (snippet line); Enter opens the first result, arrows move,
  Esc closes; results show kind; "No results".
- **Out of scope:** comments/threads (P1), glossary (P1), search across decks in the library beyond
  names.
- **Acceptance criteria:**
  - Given a sticky anchored to "Order Service", When the node is moved, Then the sticky moves with
    it; When the node is deleted, Then the sticky becomes free (not lost).
  - Given ⌘K, When the user types "reattempt", Then the rule "Reattempt policy" and the flow step
    whose condition mentions it appear, and Enter opens the first.
  - Given the palette, When the user presses ↓ twice and Enter, Then the third result opens.
  - Given a query with no matches, When typed, Then "No results" shows and Enter does nothing.
  - Given a 2,000-node deck, When typing in ⌘K, Then results update in < 50 ms per keystroke.
- **Risks:** undesigned sticky visuals; search index size (build incrementally from Yjs updates).
- **`/speckit.specify` prompt:**
  > Let users put sticky notes on the diagram for reminders and open questions, either free on the
  > canvas or attached to a component so the note moves with it; notes support simple markdown and
  > can be edited, resized and deleted. Add a command palette opened with Cmd/Ctrl+K that finds any
  > component, connection, flow, rule or note by title or by text in descriptions, notes and rule
  > cells, and also runs common commands (export, switch theme, focus mode, open rules, go to the
  > library, new deck). It is fully keyboard driven and fast on large decks. Why: knowledge is only
  > useful if it can be found, and annotations need a home on the diagram.
- **`/speckit.plan` hint:**
  > Sticky as a React Flow node type in apps/app/src/editor; anchor handled in the model (position
  > relative to anchor). Command palette component from 000 (cmdk only if approved); search index
  > as a pure module (packages/model or app lib) updated from snapshots, off the main thread if
  > large. Match docs/design/screens/30-command-palette-light.png and
  > 31-command-palette-filtered-light.png pixel-close; sticky visuals need a design or founder
  > approval of the default.

## 010-zoom-groups-focus

- **Milestone:** M4 · **Depends on:** 003 · **Estimate:** 5 d
- **Goal:** Large systems stay readable: users see one level at a time, collapse groups, and focus
  on one component's neighbourhood.
- **Spec IDs:** V-1, V-2, V-3.
- **Design references:** [13-editor-focus-mode](design/screens/13-editor-focus-mode-light.png),
  [19-editor-group-drilldown](design/screens/19-editor-group-drilldown-light.png) (breadcrumb pill);
  group boundary with label + count. **Semantic zoom levels and collapsed groups with ×N edges are
  not designed.**
- **In scope:** four levels (landscape → system → container → component) from `node.level` and
  group nesting; double-click a group (or its label) to drill in; breadcrumb to go up; collapse/
  expand a group on the canvas: collapsed group renders as one card, edges crossing it merge into
  one edge with a "×N" pill; focus mode toggle (selected node + neighbours, others dimmed; connected
  edges highlighted with labels); keyboard: Enter drills in, Backspace goes up, F toggles focus.
- **Out of scope:** role-based layers (V-5), saved per-view collapse state (011).
- **Acceptance criteria:**
  - Given the Core services group, When the user double-clicks it, Then only its members show, the
    canvas fits them, and the breadcrumb reads "Deck › System view › Core services".
  - Given a collapsed group with 12 edges to another group, When rendered, Then one edge with "×12"
    connects them; When expanded, Then the 12 edges return.
  - Given a selected node and Focus on, When rendered, Then only it and its direct neighbours are at
    full opacity, and dimmed elements are also marked non-interactive for screen readers.
  - Given the bench deck with all groups collapsed, When panning, Then ≥ 60 fps.
- **Risks:** undesigned V-1/V-2 visuals; edge aggregation cost; interaction between drill-down and
  flow mode.
- **`/speckit.specify` prompt:**
  > Keep large diagrams readable. Users see one level of detail at a time (landscape, system,
  > container, component) and double-click a group to go inside it, with a breadcrumb to go back up.
  > Groups can be collapsed into a single box; connections into a collapsed group merge into one
  > connection showing how many it represents. Focus mode dims everything not directly connected to
  > the selected component. All of this works from the keyboard. Why: 50–100 component diagrams
  > become a tangle and get abandoned; the product rule is "never show everything at once".
- **`/speckit.plan` hint:**
  > apps/app/src/editor + a pure "visible graph" derivation (level, collapsed groups, aggregation)
  > unit-tested and memoized; collapse/drill state is UI state (Zustand) until 011 saves it in views.
  > Run `pnpm bench` before/after. Match docs/design/screens/13-editor-focus-mode-light.png and
  > 19-editor-group-drilldown-light.png pixel-close; collapsed-group visuals need a design or
  > founder approval of the default.

## 011-views-autolayout

- **Milestone:** M4 · **Depends on:** 010 · **Estimate:** 5 d
- **Goal:** One model, many lenses: infra, feature and system views that stay in sync, with tidy
  automatic layout that respects what the user pinned.
- **Spec IDs:** V-4, C-4.
- **Design references:** view switcher in the top bar and "+" in
  [02](design/screens/02-editor-node-selected-light.png),
  [20-editor-view-infra](design/screens/20-editor-view-infra-light.png),
  [21-editor-view-feature](design/screens/21-editor-view-feature-light.png),
  [22-editor-custom-view-toast](design/screens/22-editor-custom-view-toast-light.png). **Custom view
  configuration and the layout button are not designed.**
- **In scope:** views stored in the deck (System, Feature, Infra + custom): which nodes/kinds/groups
  are included, subtitle field (tech / "n flows · owner" / host), dimmed kinds, per-view position
  overrides and collapse state; create, rename, delete views; edits to objects propagate to all
  views; ELK auto-layout in a worker ("Tidy layout" button, default), pinned nodes keep position,
  pin/unpin action with a visible pin glyph; undo of a layout in one step.
- **Out of scope:** role-based layers (V-5), sequence/swimlane (V-6).
- **Acceptance criteria:**
  - Given the Infra view, When selected, Then node subtitles show host and client nodes are dimmed;
    When a node title is edited there, Then the System view shows the new title too.
  - Given a new custom view, When the user excludes the "Clients" group, Then those nodes are hidden
    only in that view.
  - Given 200 nodes with 5 pinned, When "Tidy layout" runs, Then it completes in < 2 s off the main
    thread, the 5 pinned nodes do not move, and one ⌘Z restores all previous positions.
  - Given a view with moved nodes, When switching views, Then each view keeps its own positions.
- **Risks:** ELK bundle size (worker, lazy); positions per view vs base positions (schema decision
  in 001); custom view configuration is undesigned.
- **`/speckit.specify` prompt:**
  > Let users look at the same model through different saved views: a system view, a feature view,
  > an infrastructure view and their own custom views. A view decides which components appear,
  > which detail each component shows under its title (technology, hosting, or number of flows and
  > owner), and can keep its own layout; editing a component in any view updates it everywhere.
  > Users can create, rename and delete views. An automatic layout tidies the diagram in under two
  > seconds for 200 components, never moves components the user pinned, and can be undone in one
  > step. Why: infrastructure, feature and system diagrams otherwise live in different tools and
  > drift apart.
- **`/speckit.plan` hint:**
  > Views in the model (packages/schema View + packages/model mutations); apps/app/src/layout with
  > ELK.js in a Web Worker (dependency already planned in the constitution; confirm version), lazy
  > loaded. Visible-graph derivation from 010 takes the view as input. Run `pnpm bench`. Match
  > docs/design/screens/20-editor-view-infra-light.png, 21-editor-view-feature-light.png,
  > 22-editor-custom-view-toast-light.png pixel-close; custom-view config panel and layout button
  > need design or founder approval.

## 012-export

- **Milestone:** M5 · **Depends on:** 007, 011 · **Estimate:** 4 d
- **Goal:** Users take their diagrams anywhere — docs, slides, wikis, git — in open formats, generated
  entirely in the browser.
- **Spec IDs:** I-1, principle 6 (no lock-in).
- **Design references:** [06-export-json](design/screens/06-export-json-light.png) ·
  [dark](design/screens/06-export-json-dark.png), [33-export-png](design/screens/33-export-png-light.png),
  [33-export-svg](design/screens/33-export-svg-light.png), [33-export-pdf](design/screens/33-export-pdf-light.png),
  [33-export-mermaid](design/screens/33-export-mermaid-light.png),
  [34-export-flow-scope](design/screens/34-export-flow-scope-light.png). Components: dialog, format
  list, segmented scope, switches, scale pills, preview, footer.
- **In scope:** export dialog from the top bar and ⌘K; formats JSON (.sododeck.json, pretty toggle,
  include descriptions/links/rules), PNG (1×/2×/3×, transparent), SVG (transparent), PDF (landscape,
  optional flow step details), Mermaid (flowchart with subgraphs); scopes whole deck / current view /
  selected flow; live preview; filename from deck name; Copy for text formats; "Nothing is uploaded"
  note; generation in a worker for large decks.
- **Out of scope:** import of Mermaid/draw.io (P1), embeds (P2), per-page PDF of every flow.
- **Acceptance criteria:**
  - Given the JSON format, When downloaded and re-imported, Then the deck is identical (round-trip).
  - Given flow mode on "Place order", When the dialog opens, Then scope is "Selected flow" and the
    PNG contains only the flow's nodes and edges.
  - Given Mermaid with "Keep groups as subgraphs", When copied, Then the text is a valid
    `flowchart LR` with one subgraph per group and kind-specific shapes.
  - Given PNG at 3×, When exported, Then the image dimensions are 3× the diagram bounds and the
    footer showed that size beforehand.
  - Given any export, When it runs, Then no network request is made (smoke test still green).
- **Risks:** PDF without a dependency (print dialog vs generated PDF — decision); fonts embedded in
  SVG/PNG; large decks (worker/OffscreenCanvas).
- **`/speckit.specify` prompt:**
  > Let users export a deck as a re-importable deck file, a PNG image, an SVG vector, a print-ready
  > PDF, or a Mermaid diagram for markdown and wikis. They can export the whole deck, the current
  > view, or the selected flow; see a live preview; choose options per format (pretty JSON, include
  > descriptions and rules, image scale, transparent background, flow step details, groups as
  > subgraphs); copy text formats; and download with a file name based on the deck name. Everything
  > is generated on the user's device and nothing is uploaded. Why: users must never be locked in
  > and need diagrams in their docs, slides and repositories.
- **`/speckit.plan` hint:**
  > apps/app/src/export (pure generators: mermaid, svg; JSON only via @sododeck/model
  > serializeDeck); dialog from packages/ui (000). PNG via canvas from SVG (fonts inlined from
  > bundled files); PDF: browser print of the SVG unless a dependency is approved. Workers for large
  > decks. Match docs/design/screens/06-export-json-light.png, 33-export-png-light.png,
  > 33-export-mermaid-light.png, 34-export-flow-scope-light.png pixel-close.

## 013-samples-onboarding

- **Milestone:** M5 · **Depends on:** 005, 009 · **Estimate:** 3 d
- **Goal:** New users understand the product in minutes: a realistic Delivery sample and a short
  first-run tour.
- **Spec IDs:** §13 demo deck, K-8 (lightweight first-run version; full guided tours stay P2),
  C-8 groundwork (templates are P1).
- **Design references:** data in
  [`claude-design/sododeck-data.js`](design/claude-design/sododeck-data.js) (20 nodes, 28 edges,
  5 flows, 3 rules); "Open sample" / Samples in [01](design/screens/01-library-light.png); tour
  [05](design/screens/05-empty-deck-tour-1-light.png), [35](design/screens/35-empty-deck-tour-2-light.png),
  [36](design/screens/36-empty-deck-tour-3-light.png); empty card "Replay the 3-step tour" in
  [37](design/screens/37-empty-deck-no-tour-light.png). Components: coach mark (000).
- **In scope:** convert `sododeck-data.js` into `delivery.sododeck.json` (schema v1: kinds renamed,
  Material icons → lucide keys, steps with ids, rules keyed by id with structured tables, groups
  without stored geometry, 5 flows under feature "Delivery", step sample inputs, deck description
  "Order-to-doorstep delivery for the Berlin and Amsterdam regions."); bundle it; "Open sample"
  creates a copy in the library (Samples filter, "Sample" pill); spec §13 names 5 different flows
  (cross-dock, address change, cancel after pickup) — ⚠ decide whether to add them; 3-step tour on
  first new deck, skippable, replayable, keyboard accessible, remembered as seen (UI pref).
- **Out of scope:** template gallery (C-8, P1), system guided tours for new joiners (K-8 full).
- **Acceptance criteria:**
  - Given the bundled sample, When validated, Then it passes schema and model validation with zero
    problems from 015 (except intended ones).
  - Given the library, When "Open sample: Logistics Delivery" is clicked twice, Then two independent
    copies exist and editing one does not change the other or the bundled original.
  - Given the sample, When compared to the prototype, Then it has the same 20 components, 28
    connections, 5 flows with the same step order, and 3 rules with the same rows.
  - Given the first new deck, When it opens, Then the tour shows "1 of 3" anchored to the palette;
    adding a node advances to step 2; Skip ends it; it does not show again on the next new deck.
  - Given the tour, When navigated by keyboard, Then focus moves into the coach mark and Esc skips.
- **Risks:** mapping ambiguities (step `ctx`, owner teams); sample ≠ spec §13 flow list.
- **`/speckit.specify` prompt:**
  > Ship a realistic sample deck, "Logistics Delivery", that shows what Sododeck can do: about twenty
  > components in six groups (clients, edge, core services, messaging, data, external), five flows
  > (place order, assign driver, live tracking, proof of delivery, failed delivery) with conditions
  > and SLAs, and three decision tables (delivery tier, reattempt policy, payment capture). Users
  > open it from the library as their own editable copy. When a user creates their first deck, a
  > short three-step tour shows how to add components, describe them, and use the JSON panel and
  > command palette; it can be skipped, replayed and used with the keyboard, and it does not repeat.
  > Why: activation (five components and one flow in the first session) depends on users seeing the
  > value immediately.
- **`/speckit.plan` hint:**
  > Sample JSON under apps/app (e.g. src/samples/delivery.sododeck.json) validated in a unit test
  > via @sododeck/schema + @sododeck/model; write a one-off conversion script (not shipped) from
  > docs/design/claude-design/sododeck-data.js and commit its output. Tour: CoachMark from 000; "seen"
  > flag is a UI preference (localStorage via features.ts), not document data. Match
  > docs/design/screens/05-empty-deck-tour-1-light.png, 35-empty-deck-tour-2-light.png,
  > 36-empty-deck-tour-3-light.png pixel-close.

## 014-analytics-feedback

- **Milestone:** M5 · **Depends on:** 005 · **Estimate:** 2 d
- **Goal:** The founder learns whether the product works (north star: flows played) without ever
  seeing user content, and users can send feedback easily.
- **Spec IDs:** §14 metrics, §12 privacy; AGENTS.md M5 "analytics, feedback button".
- **Design references:** **not designed** (no feedback entry point in the prototype). Default: "Send
  feedback" in ⌘K and a small help menu in the top bar; opt-in toggle in a settings popover.
- **In scope:** opt-in analytics (off by default) with a documented event list (deck created, node
  count bucket, flow created, flow played, export format) — no titles, ids, text or content;
  settings toggle; feedback link/button (mailto or form URL, user-initiated); error reporting stays
  off by default and content-free.
- **Out of scope:** session replay (forbidden), A/B tests, in-app surveys.
- **Acceptance criteria:**
  - Given a fresh install, When the app is used, Then no analytics request is made (smoke test
    green).
  - Given analytics enabled, When a flow is played, Then one "flow_played" event is sent whose
    properties contain no strings from the deck (unit test over the event builder).
  - Given the feedback button, When clicked, Then it opens the feedback destination without
    attaching deck content.
- **Risks:** accidental content leakage via error messages or URLs (deck ids in routes) — scrub.
- **`/speckit.specify` prompt:**
  > Let users opt in to anonymous usage analytics and send feedback. Analytics are off by default,
  > can be turned on or off at any time, and only record product events such as "a flow was played"
  > or "a deck was exported as PNG", never names, text or any diagram content. Users can open a
  > feedback channel from the app. Why: the team needs to measure activation and "flows played"
  > while keeping the promise that diagram content never leaves the device.
- **`/speckit.plan` hint:**
  > apps/app/src/telemetry (PostHog/Sentry already lazy and off by default per apps/app/CLAUDE.md);
  > typed event builder that only accepts enums/numbers; settings stored as a UI preference. Keep
  > the "no third-party requests" smoke test green (telemetry disabled in tests; if enabled, assert
  > no content). Feedback entry point needs founder approval of the default placement.
