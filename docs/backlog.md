# Sododeck implementation backlog (MVP, M1–M5)

Bounded Spec Kit features derived from the Claude Design prototype
([`docs/design/design-analysis.md`](design/design-analysis.md), screenshots in
[`docs/design/screens/`](design/screens/)) and the P0 requirements in [`docs/spec.md`](spec.md).
Each feature is 1–5 days and goes through `/speckit.specify → /speckit.plan → /speckit.tasks →
/speckit.implement`. **Do not start a feature before its dependencies are merged.**

**Database pack (039–049)** lives in its own file:
[`backlog-database.md`](backlog-database.md) (tables, columns, relationships, SQL / DBML import and
export, a new category of the 030 type registry).

Status: draft for founder review (2026-09-27). Items marked **⚠ decision** depend on the open
questions in design-analysis §g.

**Design update (2026-09-27):** Claude Design added states 41–85 (flow recording and branches,
edge drawing, multi-select, problems, cloud/partner kinds, stickies, semantic zoom, collapsible
groups, folder and deck menus, storage, multi-tab, autosave). Screens are in
`docs/design/screens/41-…` to `85-…` (light and dark); the analysis and every conflict with
DESIGN.md or the founder decisions are in design-analysis §a and §g-18–§g-32. Founder decisions
below still win over the new frames (notably: deletes ask for confirmation, SLA target only,
autosave ≤ 300 ms, owner is free text).

**Design update (2026-09-28):** Claude Design added the **canvas-first editor, states 86–116**
(project "Sododeck", files `Sododeck Canvas-first.dc.html` + `Sododeck Canvas State.dc.html` +
`sododeck-canvas.js`), covering 016–020: shell (86–94), card quick-edit (95–104), card colours
(105–107), editing affordances (108–115) and a narrow window (116), plus a component inventory and
card-colour tokens. 021 imports them into the repo before 018 starts. Deltas vs the first draft of
016–020 are written into each feature below; conflicts with founder decisions were settled in
§g-42–§g-46 (defaults accepted, 2026-09-28).

## Founder decisions (2026-09-27)

Recorded in design-analysis §g and applied to the features below.

| §g  | Decision                                                                                                                                                                                                                            | Affects                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 3   | JSON panel is **read-only** for now: it shows the canvas as JSON (selection tab + whole-deck tab), updates live, can be copied and collapsed. Editing from JSON (C-5 two-way sync) is deferred.                                     | 004                     |
| 6   | Build the **rule test panel** + catch-all check in 008; SLA shows the **target only** (no "measured" value); the 3-step tour stays in M5 (013).                                                                                     | 007, 008, 013           |
| 7   | Autosave: every change is persisted immediately; the top bar shows "Saving…" (cosmetic, held ≤ 300 ms) then "Saved in this browser", plus an error state "Couldn't save — export a backup".                                         | 005                     |
| 10  | Owner is **free text with suggestions** from owners already used in the deck (no team list).                                                                                                                                        | 001, 008                |
| 11  | Deleting asks for **confirmation**; undo (⌘Z) still works after a confirmed delete.                                                                                                                                                 | 003, 005, 006, 008, 009 |
| 12  | Library "Recent" = the **8 most recently opened** decks (opened-at kept in library metadata, not in the deck).                                                                                                                      | 005                     |
| 19  | After a confirmed delete, show the design's **Undo toast** (6 s, Undo button + ⌘Z hint); ⌘Z still works after it disappears.                                                                                                        | 003, 005, 006, 008, 009 |
| 33  | Import and export handle **one `.sododeck.json` file at a time**: no all-decks backup, no folder export/import, no multi-file or zip import.                                                                                        | 005, 012                |
| 34  | **G-5 deferred**: no backup reminder banner and no Safari 7-day warning for now.                                                                                                                                                    | 005                     |
| 35  | **Multi-tab = live sync**: every tab stays editable, edits sync between tabs and merge (Yjs); no read-only tab, lock banner or "Use here instead" (frame 82 not used). Undo is per tab.                                             | 005                     |
| 36  | Canvas drag keeps **panning**; marquee select stays **Shift+drag** (003). No switch to drag-to-select for now.                                                                                                                      | 003, 016                |
| 37  | Schema v1 may add **optional** `node.size` (resize) and `edge.route` (connector sides + segment offset). Additive only; older files stay valid.                                                                                     | 001, 002, 017           |
| 38  | **Canvas-first editor**: full-bleed canvas, floating chrome, left icon rail with flyouts, inspector as an on-demand drawer, JSON panel hidden by default. Replaces the 3-column prototype layout.                                   | 018, 019, DESIGN.md     |
| 39  | Card **fill and stroke** colours from a fixed named palette, plus a **"+"** that adds a custom hex colour to the deck's own swatches.                                                                                               | 020                     |
| 40  | **Dynamic card attributes deferred**: cards keep today's fields (tech, host, owner, tags, level, rules); user-defined fields come later.                                                                                            | 020, later              |
| 41  | 016–020 are scheduled **after M4** (after 011), not before.                                                                                                                                                                         | 016–020                 |
| 42  | JSON panel stays **read-only** in the canvas-first overlay (93); JSON editing is a later feature.                                                                                                                                   | 018                     |
| 43  | 020 also colours **groups**: optional `group.style` with the same `ColorRef`.                                                                                                                                                       | 020                     |
| 44  | No free connector ends (114 "⌥ free end" dropped); edges always have `from` and `to`.                                                                                                                                               | 017                     |
| 45  | Arrows nudge only during a drag; otherwise ⌥+arrows (1 px) / ⌥⇧+arrows (10 px). Plain arrows keep moving focus.                                                                                                                     | 016                     |
| 46  | Placement of controls missing in 86–116: view settings + Tidy in the views menu, pin in toolbar "More" / context menu, drill breadcrumb as a deck-island chip, problems as a rail badge + flyout, sticky visibility next to Labels. | 018, 015                |
| 47  | Order: **015**, then canvas-first **021 → 018 → 019 → 016 → 017 → 020**, then **012 → 013**; 014 anywhere.                                                                                                                          | all remaining           |
| 56  | **Canvas deletes do not ask** (cards, notes, connectors, cut): Undo toast + ⌘Z instead. Flows, features, branches, rules still ask. Reverses §g-11 on the canvas.                                                                   | 003, 009, 016           |
| 57  | **Select (V) + Hand (H) tools**: Select drags a marquee with an arrow cursor; Hand pans. Space+drag and scroll still pan. Reverses §g-36.                                                                                           | 003, 018                |

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
  F016[016 canvas-editing]
  F017[017 resize-edge-routing]
  F018[018 canvas-first-layout]
  F019[019 card-quick-edit]
  F020[020 card-style]
  F021[021 design-sync-canvas-first]
  F022[022 connector-style]
  F023[023 hybrid-canvas-renderer]
  F024[024 domain-kind-packs]
  F025[025 format-compatibility]
  F026[026 diagram-as-code]
  F027[027 ai-deck-skill]
  F028[028 design-sync-card-system]
  F029[029 card-look-deck]
  F030[030 card-types-and-packs]
  F031[031 shapes]
  F032[032 typed-fields]
  F033[033 deck-tag-colours]
  F034[034 connection-focus-and-drill]
  F035[035 flow-playback-deck]
  F036[036 collab-ready-document]
  F037[037 scale-bench]

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
  F011 --> F021 --> F018 --> F019
  F019 --> F016
  F016 -.-> F017
  F019 --> F020
  F017 --> F022
  F020 --> F022
  F012 -.-> F023
  F010 -.-> F023
  F020 -.-> F024
  F005 --> F025
  F004 --> F026
  F018 --> F026
  F025 --> F026
  F025 --> F027
  F024 -.-> F027
  F026 -.-> F027
  F028 --> F029
  F029 --> F030
  F030 --> F031
  F030 --> F032
  F029 --> F033
  F029 --> F034
  F029 --> F035
  F029 --> F022
  F036 --> F029
  F036 --> F037
  F037 -.-> F023
  F036 --> F038
  F029 -.-> F038
```

## Critical path

**001 → 002 → 003 → 006 → 008 → 009 → 013** ≈ 3 + 4 + 5 + 5 + 5 + 4 + 3 = **29 working days**.
000 (4 d) runs in parallel with 001–002. The M4 branch 003 → 010 → 011 → 012 (≈ 19 d after 003)
can run in parallel with M2/M3 if a second agent is available.

Total estimate: **62 working days** for one agent sequentially (≈ 12–13 weeks), vs 6–8 weeks in spec
§13. Getting to 8 weeks needs two parallel streams (flows/knowledge vs scale/export) or cutting
scope (see report).

## Remaining order (2026-09-28, §g-47)

000–011 are merged. Next: **015** model-validation (M3 leftover; its problems count gets a rail
badge in 018) → **021** design sync → **018** canvas-first layout → **019** card quick-edit →
**016** canvas editing → **017** resize and edge routing → **020** card style → **012** export →
**013** samples and onboarding. **014** analytics-feedback is independent and can run in
parallel. Canvas-first goes before M5 so export and the onboarding tour are built once, on the new
UI and card rendering.

**022** connector-style (added 2026-09-29) comes after 017 and 020; its place relative to 012 / 013
is the founder's call.

**023** hybrid-canvas-renderer and **024** domain-kind-packs (added 2026-09-30, architecture
review) are **not scheduled**. They come after M5 at the earliest and need a founder go-ahead.
023 starts with a large-deck benchmark, and that result decides whether the renderer work is
done at all. The measurement plan is in `docs/performance.md`.

**Order from 2026-10-03 (§g-64, §g-65, §g-81), every open feature:** **028** → **036** →
**037** → **029** → **035** → **033** → **022** → **030** → **032** → **031** → **034** → **025** →
**013** → **014** → **026** → **027** → **023**. 036 comes first because 029 starts the run of schema
changes (029, 033, 022, 030, 032) and 036 makes the stored document collaboration-ready while
there are no real users to migrate. 037 measures large decks early, on the new layout. 013 and 014
(paused by the founder) come after the card system, so samples and the tour show the final cards
and packs, and before a public launch. 026 and 027 wait for the schema to settle (030, 032). 023
stays last and is decided by 037's numbers. 030 supersedes 024; 032 lifts §g-40.

**025** format-compatibility (ADR 0020, deferred §g-81): no users yet, so the format changes freely
during development and old files are not handled; 025 lands before the first public release. **026** diagram-as-code
and **027** ai-deck-skill are not scheduled.

## Feature list

| ID  | Name                           | Milestone  | Depends on    | Est. | Needs design?                                                 |
| --- | ------------------------------ | ---------- | ------------- | ---- | ------------------------------------------------------------- |
| 000 | design-foundation              | M1         | —             | 4 d  | —                                                             |
| 001 | json-schema-v1                 | M1         | —             | 3 d  | ⚠ decision (§g-4)                                             |
| 002 | yjs-model                      | M1         | 001           | 4 d  | —                                                             |
| 003 | canvas-basic                   | M1         | 000, 002      | 5 d  | designed (52–59, 61); ⚠ §g-19, §g-28                          |
| 004 | json-panel-sync                | M1         | 003           | 2 d  | decided (§g-3): read-only                                     |
| 005 | local-library-autosave         | M1         | 000, 002      | 4 d  | designed (72–85); decided §g-33–§g-35                         |
| 006 | flow-authoring                 | M2         | 003           | 5 d  | designed (41–48); ⚠ §g-18                                     |
| 007 | flow-playback                  | M2         | 006           | 4 d  | — (branch picker in 46)                                       |
| 008 | inspector-rules                | M3         | 006           | 5 d  | designed (49–51, 58); ⚠ §g-24, §g-26                          |
| 015 | model-validation               | M3         | 006           | 2 d  | designed (60); ⚠ §g-23                                        |
| 009 | stickies-search                | M3         | 008           | 4 d  | designed (62, 63); ⚠ §g-21                                    |
| 010 | zoom-groups-focus              | M4         | 003           | 5 d  | designed (64–71); ⚠ §g-22                                     |
| 011 | views-autolayout               | M4         | 010           | 5 d  | custom view config, layout button (default ok)                |
| 012 | export                         | M5         | 007, 011      | 3 d  | JSON + PNG/SVG only; PDF, Mermaid later                       |
| 013 | samples-onboarding             | M5         | 005, 009      | 3 d  | —                                                             |
| 014 | analytics-feedback             | M5         | 005           | 2 d  | feedback button (small)                                       |
| 021 | design-sync-canvas-first       | after M4   | 011           | 1 d  | docs only; designed (86–116)                                  |
| 018 | canvas-first-layout            | after M4   | 021           | 5 d  | designed (86–94, 115, 116); ⚠ §g-42, §g-46                    |
| 019 | card-quick-edit                | after M4   | 018           | 3 d  | designed (95–104)                                             |
| 016 | canvas-editing                 | after M4   | 019           | 6 d  | designed (92, 99, 102–104, 108–111); §g-55; schema change     |
| 017 | resize-edge-routing            | after M4   | 003 (016)     | 4 d  | designed (112–114); ⚠ §g-44; schema change                    |
| 020 | card-style                     | after M4   | 019           | 3 d  | designed (91, 105–107); ⚠ §g-43; schema change                |
| 022 | connector-style                | after M4   | 017, 020, 029 | 8 d  | implemented (ADR 0024, frames 128–133); schema change         |
| 023 | hybrid-canvas-renderer         | later      | 010, 012      | 8 d  | ⚠ gated by a large-deck bench; far-zoom look needs design     |
| 024 | domain-kind-packs              | later      | 001, 020      | 6 d  | ⚠ founder decision (open kinds); schema change + ADR          |
| 025 | format-compatibility           | pre-launch | 005           | 2 d  | deferred (§g-81); re-confirm ADR 0020 before launch           |
| 026 | diagram-as-code                | later      | 004, 018, 025 | 8 d  | ⚠ apply-on-pause vs Apply button; importer deps               |
| 027 | ai-deck-skill                  | later      | 001, 025      | 3 d  | — (skill package + docs page)                                 |
| 028 | design-sync-card-system        | after M4   | —             | 1 d  | docs only; designed (Cards board B)                           |
| 029 | card-look-deck                 | after M4   | 028, 036      | 6 d  | implemented (2026-10-03); visual check and quickstart partial |
| 030 | card-types-and-packs           | after M4   | 029           | 5 d  | designed (B type palette); schema change + ADR                |
| 031 | shapes                         | after M4   | 030           | 6 d  | built (2026-10-03); see `specs/031-shapes/`, ADR 0026         |
| 032 | typed-fields                   | after M4   | 030           | 5 d  | designed (B typed fields); schema change + ADR                |
| 033 | deck-tag-colours               | after M4   | 029           | 3 d  | implemented (2026-10-03); visual check and quickstart partial |
| 034 | connection-focus-drill         | after M4   | 029           | 4 d  | implemented (2026-10-03)                                      |
| 035 | flow-playback-deck             | after M4   | 029           | 3 d  | built, see `specs/035-flow-playback-deck/`                    |
| 036 | collab-ready-document          | before 029 | —             | 6 d  | implemented (ADR 0021, 0022); SC-006 open                     |
| 037 | scale-bench                    | before 023 | 036           | 2 d  | —                                                             |
| 038 | card-icons                     | after 036  | 036, (029)    | 4 d  | built; lucide now, icon sets later (ADR 0028)                 |
| 053 | sticky-notes-and-connectors    | after 052  | 009, 050      | 4 d  | founder feedback 2026-10-05                                   |
| 054 | editor-chrome-polish           | after 053  | 018, 052      | 4 d  | built (2026-10-05); see `specs/054-editor-chrome-polish/`     |
| 055 | image-support                  | after 054  | 036           | 6 d  | founder feedback; ADR needed (schema, storage)                |
| 056 | file-format-and-mermaid-import | after 054  | 025, 026      | 4 d  | founder feedback; ⚠ scope of Mermaid import                   |

Changes vs the original proposal: added **015-model-validation** (C-7 had no home); moved undo/redo
and multi-select into 003 and bulk edit into 008 (C-6); ⌘K (C-3) lives in 009 with global search
(K-4) because they share one surface in the design; the whole-deck JSON export/import (G-3) is in
005 and the full export dialog (I-1) in 012.

Added after founder review (2026-09-27), all scheduled **after M4** (§g-41):
**018-canvas-first-layout** (full-bleed canvas, §g-38), **019-card-quick-edit** (inline
title, selection toolbar, context menu, detail drawer from the card), **016-canvas-editing**
(copy/paste, group from selection, drag a group, align, nudge, snap), **017-resize-edge-routing**
(resizable cards, adjustable connectors) and **020-card-style** (fill and stroke colours). 017 and
020 change the file format (optional fields only). The dashed arrow is a soft dependency (017
reuses 016's snapping). User-defined card attributes are deferred (§g-40, "Later" below 020).
**021-design-sync-canvas-first** (added 2026-09-28) brings the 86–116 design into the repo and
updates DESIGN.md / AGENTS.md so 018–020 are built against it.

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

- **Milestone:** M1 · **Depends on:** 000, 002 · **Estimate:** 4 d
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
  [38-empty-deck-node-added](design/screens/38-empty-deck-node-added-light.png); edge drawing
  [52](design/screens/52-edge-hover-light.png) hover handles, [53](design/screens/53-edge-dragging-light.png) dragging, [54](design/screens/54-edge-valid-target-light.png) valid
  target, [55](design/screens/55-edge-invalid-drop-light.png) invalid drop, [56](design/screens/56-edge-keyboard-light.png) keyboard connect,
  [57](design/screens/57-edge-popover-light.png) inline edge popover; [58](design/screens/58-multi-select-light.png) multi-select,
  [59](design/screens/59-bulk-delete-light.png) bulk delete; [61](design/screens/61-cloud-partner-light.png) cloud/partner kinds (⚠ §g-28). Each has a
  `-dark` twin. Components: node,
  group boundary, edge + label pill, minimap, zoom control, canvas breadcrumb, Labels toggle,
  outline, palette, empty-canvas card, top bar. Tokens: canvas, dot, edge, kind tints,
  shadow-rest/selection, dim 250 ms.
- **In scope:** editor shell layout (top bar, left panel with Outline/Palette, canvas, inspector
  column, JSON panel slot); React Flow nodes (164×50, kind tile, subtitle, rule glyph), group
  boundaries (bounds from members), edges (smoothstep, 8px radius, end dot, 12px hit area) with
  label pills; select node/edge, click empty to deselect; drag to move; palette drag/click to add;
  delete (Del key + inspector trash) with a confirmation dialog (§g-11; the design's delete-at-once +
  6 s Undo toast in 57/59 becomes confirm first, then the same Undo toast, §g-19), then undo via
  the toast or ⌘Z; draw an edge (designed, 52–57):
  four side handles on hover or Tab focus, dashed ghost line while dragging, valid target = dashed
  orange ring + "+", invalid (already connected or self) = dashed clay ring + ban icon + tooltip,
  release on empty canvas cancels, keyboard connect with C (type-ahead "Connect X to…" listbox,
  duplicates disabled), inline popover for label / protocol / direction after creating or on
  double-click; reconnect an endpoint (still default design); undo/redo (⌘Z/⇧⌘Z); shift-click / marquee / ⌘A multi-select with a
  selection frame and "n selected" pill (58);
  zoom −/+/fit 30–200%, fit on open; minimap with click-to-pan; Labels toggle; outline tree with
  collapse and select; empty-canvas card; minimal inspector: title for node/edge, name for deck;
  keyboard: Tab into canvas, arrow keys move selection between nodes.
- **⚠ decision (§g-28):** cloud and partner kinds (61: neutral cloud tile + AWS / GCP / AZURE
  text badge, partner handshake tile, cloud fields provider / service / region / resource id) need
  an additive schema change. Proposal: in scope here if the founder agrees (adds about half a day:
  enum values, optional fields, fixtures, parity and round-trip tests); otherwise a follow-up.
- **Out of scope:** full inspector fields (008), JSON panel (004), flows (006/007), focus mode,
  drill-down and views (010/011), stickies (009), ⌘K (009), auto-layout (011), queue-lane routing.
- **Acceptance criteria:**
  - Given an empty deck, When the user drags "Service" from the palette onto the canvas, Then a
    "New service" node appears at the drop point, is selected, and the outline lists it.
  - Given two nodes, When the user drags from one node's handle to the other, Then a new edge
    exists in the model, is selected, and the inline popover opens with focus on its label.
  - Given two nodes that are already connected, When the user drags from one onto the other, Then
    the target shows the invalid state (ban icon + text, not colour only) and releasing creates
    nothing; releasing on empty canvas also creates nothing.
  - Given a focused node, When the user presses C, types part of another node's title and presses
    Enter, Then an edge to that node is created; nodes that would duplicate an edge are listed as
    disabled "already connected".
  - Given a selected node, When the user presses Delete, Then a confirmation dialog names what will
    be removed (the node and its n edges); When confirmed, Then they disappear and a 6 s toast with
    Undo shows; When Undo (or ⌘Z, also after the toast is gone) is used, Then both come back with
    the same ids. When cancelled (or Esc), Then nothing changes.
  - Given a node is dragged, When the pointer is released and ⌘Z pressed once, Then the node returns
    to its previous position.
  - Given Labels is off, When the user turns it on, Then every edge shows its Mono label pill.
  - Given keyboard focus on the canvas, When the user presses arrow keys, Then selection moves to the
    nearest node in that direction and the focus ring is visible.
  - Given the 500-node / 1,000-edge bench deck, When `pnpm bench` runs, Then pan/zoom stays ≥ 60 fps.
- **Risks:** React Flow performance with custom nodes at 500+ nodes; keyboard connect (C) and the
  edge popover add focus-management work; keeping React Flow state derived (never authoritative)
  under drag.
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
  > 14-editor-palette-tab-light.png, 37-empty-deck-no-tour-light.png, 12-editor-labels-on-light.png
  > and 52-edge-hover … 58-multi-select (light and dark) pixel-close (lucide icons instead of
  > Material Symbols; DESIGN.md clay; confirmation dialog before delete per §g-11).

## 004-json-panel-sync

- **Milestone:** M1 · **Depends on:** 003 · **Estimate:** 2 d
- **Decision (§g-3, 2026-09-27):** the panel is **read-only** for now. It shows the canvas as
  JSON; editing from JSON (C-5 two-way sync) is deferred. `TODO(C-5)`: editable Deck/Selection
  tabs, schema autocomplete, inline parse errors, paste-a-deck.
- **Goal:** Developers see the deck as JSON next to the canvas, always in sync with what they draw,
  so "the diagram is data" is visible from day one.
- **Spec IDs:** C-5 (read-only part).
- **Design references:** [02-editor-node-selected](design/screens/02-editor-node-selected-light.png)
  (selection tab), [16-editor-json-deck-tab](design/screens/16-editor-json-deck-tab-light.png),
  [17-editor-json-collapsed](design/screens/17-editor-json-collapsed-light.png). Tokens: code
  surface, text-code. Not used now: 15-editor-json-error, 39-empty-deck-paste-json (editing).
- **In scope:** panel header (JSON label, Selection/Deck segmented tabs, status "Read-only · synced
  with canvas", line count, Copy, collapse); Selection tab for node/edge (step in 007), empty
  selection message; Deck tab = the whole `.sododeck.json` produced by `@sododeck/model`; live
  update when the canvas changes (throttled for large decks); syntax highlighting, folding, keyboard
  scroll and select; resizable/collapsible panel.
- **Out of scope:** editing JSON, schema autocomplete, parse/schema errors, paste a deck (all
  deferred with C-5); YAML view (P1); diff view.
- **Acceptance criteria:**
  - Given a selected node, When the user renames it on the canvas or in the inspector, Then the
    Selection tab shows the new `"title"` without reload.
  - Given the Deck tab, When the user adds or deletes a node on the canvas, Then the JSON updates
    and equals the model's export of the deck (same text as the exported file).
  - Given the panel, When the user tries to type in it, Then nothing changes and the status says
    "Read-only" (with an icon, not color only).
  - Given the Copy button, When pressed, Then the shown JSON is on the clipboard and a toast
    confirms it.
  - Given the panel is collapsed, When the page reloads, Then it stays collapsed (UI preference).
  - Given the JSON panel, When no network is available, Then it still renders (bundled Monaco, no
    requests).
- **Risks:** large decks make full-deck JSON slow (throttle; serialize in a worker if over 16 ms);
  keeping Monaco for a read-only view is heavier than a highlighted `<pre>`, but it makes the later
  switch to editing cheap and keeps folding/virtual scrolling for big files.
- **`/speckit.specify` prompt:**
  > Show the deck as JSON in a panel under the canvas, always in sync with the diagram. Users can
  > view the JSON of the current selection or of the whole deck, fold and scroll it, copy it, and
  > collapse or resize the panel. The panel is read-only in this version: it explains that edits
  > happen on the canvas and in the inspector. Why: developers think in text and the product
  > promise is "the diagram is data"; seeing the exact file content next to the picture builds
  > trust before two-way editing arrives.
- **`/speckit.plan` hint:**
  > apps/app/src/editor/json-panel.tsx + json-editor.tsx + monaco-setup.ts (bundled, deep imports,
  > no CDN), Monaco with `readOnly: true`. Monaco models are views: derive text from the Yjs
  > snapshot via @sododeck/model's JSON export; never keep document data in Monaco. Throttle
  > updates; move serialization to a worker if it exceeds 16 ms. Match
  > docs/design/screens/16-editor-json-deck-tab-light.png and 17-editor-json-collapsed-light.png
  > pixel-close (status text differs: "Read-only · synced with canvas").

## 005-local-library-autosave

- **Status:** implemented (2026-09-27) — see [`tasks.md`](../specs/005-local-library-autosave/tasks.md) and [ADR 0007](decisions/0007-local-deck-storage.md).

- **Milestone:** M1 · **Depends on:** 000, 002 · **Estimate:** 4 d
- **Goal:** Guests keep many decks in the browser with no account, never lose work, and are nudged to
  back up.
- **Spec IDs:** G-1, G-2, G-3 (single file only, §g-33), G-4, G-6 (live sync, §g-35). G-5 deferred (§g-34).
- **Spec:** [`specs/005-local-library-autosave/spec.md`](../specs/005-local-library-autosave/spec.md) (clarified 2026-09-27).
- **Design references:** [01-library](design/screens/01-library-light.png) ·
  [dark](design/screens/01-library-dark.png), [07-library-list-view](design/screens/07-library-list-view-light.png),
  [08-library-search-no-results](design/screens/08-library-search-no-results-light.png),
  [09-library-folder-banner-dismissed](design/screens/09-library-folder-banner-dismissed-light.png);
  editor top bar autosave status in [02](design/screens/02-editor-node-selected-light.png); deck
  inspector STORAGE section in [10](design/screens/10-editor-deck-inspector-light.png);
  [72](design/screens/72-new-folder-empty-light.png) / [73](design/screens/73-new-folder-duplicate-light.png) new-folder dialog errors,
  [74](design/screens/74-folder-menu-light.png) folder menu, [75](design/screens/75-folder-rename-light.png) folder delete + inline rename,
  [76](design/screens/76-deck-menu-card-light.png) / [77](design/screens/77-deck-menu-row-light.png) deck menus, [78](design/screens/78-recent-light.png) Recent,
  [79](design/screens/79-recent-empty-light.png) Recent empty, [80](design/screens/80-storage-off-light.png) storage off (storage card only; the Safari banner is dropped, §g-34),
  [81](design/screens/81-storage-on-light.png) storage on, [82](design/screens/82-second-tab-light.png) deck open in another tab (**not used**, §g-35),
  [83](design/screens/83-autosave-saving-light.png) / [84](design/screens/84-autosave-saved-light.png) / [85](design/screens/85-autosave-error-light.png) autosave states (each with a
  `-dark` twin). Components: deck card, new-deck card, list row, storage card,
  search field, segmented grid/list, small dialog, context menu + submenu, recent list, autosave status + error popover.
- **In scope:** IndexedDB persistence per deck (Yjs provider) + library metadata (name, folder,
  counts, updatedAt, openedAt, lastExportedAt); library grid/list, All/Recent (8 most recently opened, §g-12)/Samples/folders, search; new deck;
  open deck; rename via breadcrumb; folders (designed 72–75: New folder dialog with inline errors for empty and case-insensitive
  duplicate names, context menu Rename / Delete folder (no Export folder, §g-33), F2 inline rename; delete
  asks for confirmation per §g-11 — the design's delete-at-once becomes confirm first, then the 6 s Undo toast, §g-19; decks
  of a deleted folder move to Unfiled); deck menu on cards and rows (76–77: Open, Rename F2,
  Duplicate ⌘D, Move to folder submenu with the current folder checked, Export .sododeck.json,
  Delete) via ⋯, right-click or Shift+F10; delete deck (confirm); import one .sododeck.json at a time (validate, error toast; several files → toast, nothing added); export one deck
  (no all-decks backup, §g-33); storage card (80–81: usage bar, Persistent storage On/Off
  status with icon + text, "Request persistent storage", "Browser declined…" text) and
  `storage.persist()` request; multi-tab live sync (§g-35): every tab showing a deck stays editable,
  edits appear in the other tabs within 1 s and merge without loss, undo is per tab, the library
  updates across tabs; autosave status in the top bar (§g-7: "Saving…"
  held ≤ 300 ms → "Saved in this browser"; error state "Couldn't save — export a backup" as a clay
  pill with Export and a popover with Export .sododeck.json and Retry ⌘S (85); the design's
  "~650 ms" in 83 is overridden, §g-25); thumbnails
  (simplified, generated from positions).
- **Decisions:** Duplicate deck is in scope (§g-29); "Use here instead" is gone with the read-only
  tab (§g-35); Export folder is deferred to 012; single-file import/export (§g-33); G-5 deferred
  (§g-34).
- **Out of scope:** backup reminder and Safari 7-day warning (G-5, §g-34), all-decks backup and
  multi-file/zip/folder import or export (§g-33), read-only second tab (§g-35), sample decks content
  (013), full export dialog (012), Export folder (012), File
  System Access (P1), cloud sync.
- **Acceptance criteria:**
  - Given the user edits a deck, When 500 ms pass and the tab is closed, Then reopening shows the
    edit.
  - Given three decks in two folders, When the user selects a folder or types in search, Then only
    matching decks show, and "No decks match "x"." appears when none match.
  - Given a valid .sododeck.json file, When imported, Then it appears in the library with its node
    and flow counts; Given an invalid file, Then a toast says it is not valid and nothing is added;
    Given several files at once, Then a toast says only one file can be imported and nothing is added.
  - Given the same deck open in two tabs, When one tab makes an edit, Then the other shows it within
    1 s; When both tabs edit at the same time, Then both edits are kept in both tabs and after
    reopening; ⌘Z in one tab undoes only that tab's edits.
  - Given the New folder dialog, When Create is pressed with an empty name or a name that matches an
    existing folder ignoring case and surrounding spaces, Then an inline error with an icon shows
    under the field and no folder is created.
  - Given `storage.persist` is unavailable, When the app starts, Then it falls back silently and
    the meter shows "not persistent" (feature-detected via lib/features.ts).
  - Given nine decks opened at different times, When the user selects Recent, Then the 8 most
    recently opened show, newest first.
  - Given a save fails (e.g. quota exceeded), When the user edits, Then the top bar shows "Couldn't
    save — export a backup" with an icon (not color only) and an Export button; the state clears
    only after a later save succeeds.
  - Given no deck was ever opened, When the library shows, Then Recent shows the dashed empty
    placeholder.
- **Risks:** Safari eviction with no warning in this version (G-5 deferred, §g-34); cross-tab
  update relay must not echo or double-apply updates and must converge after a tab reloads;
  thumbnail generation cost for large decks (worker).
- **`/speckit.specify` prompt:**
  > Let guests keep a library of decks in their browser without an account. Every change is saved
  > automatically within half a second and the editor shows "Saving…" then "Saved in this browser".
  > The library shows decks as cards or a list, with folders, recent decks, samples and search; users
  > can create, open, rename, move and delete decks and manage folders. Users can import a deck
  > file and export one deck, one file at a time. The app shows how much browser storage is used and
  > asks the browser to keep the data persistently. Opening the same deck in two tabs keeps both
  > editable and in sync, and must never lose edits. Why:
  > local-first with no lock-in is a core promise, and guest data loss is a top product risk.
- **`/speckit.plan` hint:**
  > apps/app/src/storage (Dexie for library metadata), y-indexeddb provider attached to the Yjs doc,
  > src/routes/library-page.tsx, top-bar autosave status; BroadcastChannel relay of Yjs updates
  > between tabs (live sync, §g-35) and storage.persist via
  > src/lib/features.ts with fallbacks. Serialization only through @sododeck/model. Library route
  > stays light (no React Flow/Monaco imports). Thumbnails from positions, rendered as simple SVG.
  > Match docs/design/screens/01-library-light.png, 01-library-dark.png, 07-library-list-view-light.png,
  > 08-library-search-no-results-light.png and 72-… to 85-… (light and dark) pixel-close, except
  > the overrides in design-analysis §g-19 (confirm before delete), §g-25 (≤ 300 ms), §g-34 (no
  > backup or Safari banners) and §g-35 (frame 82 not used).

## 006-flow-authoring

- **Status:** implemented (2026-09-27) — see [`tasks.md`](../specs/006-flow-authoring/tasks.md) and [ADR 0008](decisions/0008-flow-branches.md).

- **Milestone:** M2 · **Depends on:** 003 · **Estimate:** 5 d
- **Goal:** Architects capture each business flow as an ordered path over existing connections,
  with conditions and branches, grouped by feature.
- **Spec IDs:** F-1, F-4, F-5, K-1 (flow/step title + description).
- **Design references:** left panel FEATURES list in
  [02-editor-node-selected](design/screens/02-editor-node-selected-light.png) and flow list/steps in
  [03-flow-mode](design/screens/03-flow-mode-light.png); recording [41](design/screens/41-rec-empty-light.png) empty,
  [42](design/screens/42-rec-mid-light.png) mid recording, [43](design/screens/43-rec-invalid-light.png) invalid click, [44](design/screens/44-rec-finished-light.png) finished;
  branches [45](design/screens/45-branch-create-light.png) creating, [46](design/screens/46-branch-tree-light.png) tree + error path; flow filter
  [47](design/screens/47-flow-filter-light.png), [48](design/screens/48-flow-filter-empty-light.png) no results (each with a `-dark` twin).
  Components: recording chip, editable step row, recording hint / error card, branch header, edge
  step badge, candidate / invalid / error-path edge styles, invalid-edge popover, flow filter.
- **In scope:** features (create/rename/delete; deletes ask for confirmation, §g-11) and flows per feature in the left panel with a
  filter field (47–48: / to focus, "n of m" count, matches bold + underlined, searches names, step
  labels and conditions; empty state with "Clear filter" and "New flow '…'"); recording mode
  (designed 41–44): "+ New flow" names the flow, top-bar chip "Recording 'name' · n steps" with
  Undo ⌘Z / Done / Cancel Esc replaces the view switcher, canvas stays at full opacity, hovering an
  edge previews it, recorded edges get numbered badges, the next start node gets a ring and its
  outgoing edges show as dotted candidates, a click on an edge that does not start where the last
  step ended is **not added** and a popover offers "Add as branch from step n" (§g-18), Tab /
  Shift+Tab + Enter pick edges by keyboard, Done disabled until one step exists, Esc asks only if
  steps exist; edit step
  condition, SLA, description; reorder (grip drag, ⌥↑/⌥↓) / delete (⌫) steps, where a reorder that breaks the chain marks
  rows with a dashed clay dot + alert icon and blocks Done; branches (45–46): B on a focused step
  adds a branch with a required label and condition and an Error path toggle, the step list indents
  branches under "◇ condition" headers with 4a/4b numbering, error paths are dashed clay + icon on
  the edge label and step badge; broken steps (edge deleted) flagged.
  Adds the step `branch` field to the file format (deferred from 001): an additive optional field
  in `packages/schema` (fixtures + Ajv/Zod parity) and `packages/model` (round-trip case), no
  version bump; shape recorded in an ADR.
- **Out of scope:** playback, token animation and step inspector visuals (007), rules on steps (008),
  flow comparison (P1), sequence/swimlane (P1).
- **Acceptance criteria:**
  - Given a deck with edges, When the user starts recording "Place order" and clicks three edges in
    order, Then the flow has three steps referencing those edges in that order.
  - Given recording, When the user clicks an edge whose source is not the previous step's target,
    Then no step is added, the edge shows the invalid state (dashed + ban icon), a popover and a
    polite live region explain why, and "Add as branch from step n" is offered when that edge
    leaves an earlier step's node. (Changed from "added but marked" to follow design 43, §g-18.)
  - Given recording with no steps, When the user looks at Done, Then it is disabled; Given steps,
    When the user presses Esc, Then a confirmation asks before discarding them.
  - Given a new branch, When the user presses Done with an empty label or condition, Then an inline
    error shows on the empty field and the branch is not saved.
  - Given a flow, When the user adds a branch at step 2 labelled "payment declined" and marks it as
    an error path, Then the branch steps render dashed with an error icon on the canvas.
  - Given ten flows in a feature, When the user types "fail" in the flow filter, Then only matching
    flows show.
  - Given an edge used by a step is deleted, When the flow is shown, Then that step shows a "broken"
    indicator with text, and undo restores it.
  - Given only the keyboard, When recording, Then edges can be chosen via Tab/arrow navigation and
    Enter.
- **Risks:** branch model complexity (keep to one level of branching in MVP, as in 46); edges reused
  by several steps; keyboard edge picking during recording.
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
  > for the branch shape. The ADR records the branch
  > shape the design settles: fork step, label, condition, `errorPath` flag. Run `pnpm bench`
  > (flow highlight < 100 ms). Match docs/design/screens/41-rec-empty … 48-flow-filter-empty
  > (light and dark) and the left-panel list of 03-flow-mode-light.png pixel-close (DESIGN.md clay
  > for error paths).

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
  [27-flow-mode-labels-dark](design/screens/27-flow-mode-labels-dark.png); [44](design/screens/44-rec-finished-light.png) flow
  mode right after recording, [46](design/screens/46-branch-tree-light.png) player with the branch picker at a fork,
  [50](design/screens/50-insp-flow-light.png) flow with numbered step badges. Components: flow chip,
  step player, step rows, flow token, highlighted edges/labels, step inspector (condition, rules
  placeholder, SLA target), step JSON. Motion: token loop 1.4 s ÷ speed, step 1.7 s ÷ speed, dim
  250 ms.
- **In scope:** enter flow mode (left list, edge "Used in flows", later ⌘K); dim non-flow nodes/edges
  (plus a non-color cue: flow edges show step numbers on their labels); current step thick edge,
  solid label, looping token; step player (prev / play-pause / next, 1×/2×, progress segments);
  ← / → keys; click step row / segment / flow edge / flow node to jump; step inspector (from → to,
  protocol, condition, description, SLA target, rules section showing attached rule names —
  table view comes with 008); step JSON read-only in the JSON panel; exit via chip × / Back / Esc;
  reduced-motion: static token; `aria-live` announcement of the current step; flows with branches
  (46): step badges 4a/4b, a branch picker ("AT STEP n" segmented control) in the player at a
  fork, ↑/↓ switch branch.
- **Out of scope:** "measured" SLA and meter fill from fake data (decided §g-6: show target only),
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
  step in [03](design/screens/03-flow-mode-light.png); [49](design/screens/49-insp-edge-light.png) edge inspector,
  [50](design/screens/50-insp-flow-light.png) flow inspector, [51](design/screens/51-insp-step-light.png) step inspector (SLA shows target only,
  §g-24), [58](design/screens/58-multi-select-light.png) bulk inspector with "Mixed" (each with a `-dark` twin). Components: micro-label sections, markdown
  Write/Preview, tag input, link rows, rule card, decision table (full + compact), test result
  banner.
- **In scope:** inspectors for node, edge, flow, step and deck with title, markdown description
  (write/preview), owner (free text + suggestions), tags, links; node tech/host; edge (49):
  title (= label), from / to, protocol segmented control, description, owner, direction, tags,
  links, "Used in flows"; flow (50): title, description, owner, feature, tags, links, summary;
  step (51): title, description, owner, edge, tags, condition, SLA target (no measured value or
  meter, §g-24), attached rules; connections list; multi-select bulk edit (58: kind, owner, tech,
  group, tags; differing values show "Mixed", tags on some nodes show dashed with "n/3", typing sets
  the value on all); rule editor route: list, create, rename, describe, hit
  policy, add/rename/remove condition and action columns, edit cells (syntax `≤ 5`, `> 20`, lists,
  `Any`), add/delete/reorder rows, delete rule; attach/detach rules on steps and nodes; "Used in"
  list; compact table on the step inspector with the matched row; rule test input panel +
  catch-all check (decided §g-6); deleting a rule asks for confirmation (§g-11).
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
  - Given three selected nodes with different owners, When the bulk inspector shows, Then Owner shows
    "Mixed" and a tag present on two of them shows as partial "2/3".
  - Given a rule used by steps, When the user deletes it, Then a confirmation dialog shows the usage
    count; When confirmed, Then the steps are detached (undo restores).
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
  > Match docs/design/screens/02-editor-node-selected-light.png, 49-insp-edge, 50-insp-flow,
  > 51-insp-step, 58-multi-select, 04-rule-editor-light.png, 28-rule-editor-no-match-light.png
  > pixel-close (success green per DESIGN.md for matches; owner is a free-text combobox styled
  > like the design's select, §g-26; SLA target only).

## 015-model-validation

- **Milestone:** M3 · **Depends on:** 006 · **Estimate:** 2 d
- **Goal:** Users see what is wrong in their model — orphan components, broken flows, duplicate
  connections — before it misleads a reader.
- **Spec IDs:** C-7.
- **Design references:** [60](design/screens/60-problems-light.png) · [dark](design/screens/60-problems-dark.png): PROBLEMS
  section in the deck inspector (orphan node, broken flow, duplicate edge, step without edge),
  amber triangle glyph on affected nodes and edges, amber "n problems" button on the canvas,
  "No problems" collapsed row. Broken-chain rows in the step list: [42](design/screens/42-rec-mid-light.png); bulk delete
  flags new problems: [59](design/screens/59-bulk-delete-light.png); overlapping branch conditions → amber warning (46).
- **In scope:** checks for orphan nodes, duplicate edges (same from/to/label), steps whose edge is
  missing, non-contiguous flows, rules referenced but missing, rules with no catch-all row; problem
  list with click / ↵ to select, ↑↓ to move, ⌘. to jump to the next problem from anywhere;
  "n problems" button on the canvas and triangle glyphs on affected objects; problems are derived
  and never written into the document or shown in the JSON panel (§g-23); computed off the main
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
- **Risks:** noise (orphans may be intentional) — allow dismissing per object later. _Resolved 2026-09-28: the orphan check was removed (founder decision, ADR 0013 amendment)._
- **`/speckit.specify` prompt:**
  > Show users the problems in their model: components with no connections, duplicate connections,
  > flow steps whose connection was deleted, flows that jump between unconnected components, and
  > missing or incomplete rules. Problems appear in a list and as small warnings on the affected
  > objects; clicking a problem takes the user to it. Checking must not slow the editor on very
  > large decks. Why: a diagram that silently contains broken flows loses the trust that makes it
  > the source of truth.
- **`/speckit.plan` hint:**
  > Pure checks in packages/model (reuse referential validation from 002), run in a Web Worker for
  > large decks; UI in the deck inspector and outline/flow list glyphs. Match
  > docs/design/screens/60-problems-light.png and 60-problems-dark.png pixel-close.

## 009-stickies-search

- **Milestone:** M3 · **Depends on:** 008 · **Estimate:** 4 d
- **Goal:** Users leave reminders on the diagram and find anything — components, flows, rules,
  notes — from one keyboard shortcut.
- **Spec IDs:** K-3, K-4, C-3.
- **Design references:** ⌘K palette [30](design/screens/30-command-palette-light.png),
  [31 filtered](design/screens/31-command-palette-filtered-light.png),
  [32 no results](design/screens/32-command-palette-no-results-dark.png); top-bar "Jump to… ⌘K"
  field; palette STRUCTURE › Note in [14](design/screens/14-editor-palette-tab-light.png); sticky
  notes [62](design/screens/62-stickies-light.png) (free, pinned with a dotted leader, collapsed; sticky inspector) and
  [63](design/screens/63-stickies-flow-light.png) during a flow (each with a `-dark` twin).
- **In scope:** stickies (62–63): amber-soft 180 px markdown card, add from the palette (drop on a node pins it,
  on empty canvas it is free) or with N at the pointer, free or pinned to a node (dotted leader +
  pin, moves with it), expanded / collapsed (one line + chevron, ⌥C), "Stay visible during flows"
  (otherwise dimmed to 35% during playback unless its node is on the current step), deck-wide
  "Notes: dimmed / shown / hidden" switch in flow mode, empty note deleted on blur, delete (with
  confirmation, §g-11), show in outline; width is fixed at 180 px in the design, so resize is
  deferred; ⚠ §g-21: `collapsed` and show-in-flows as optional `Sticky` fields (additive schema
  change with fixtures, parity and round-trip tests); ⌘K palette: commands (export, theme, focus,
  rules, library, new deck), flows, nodes, edges, rules, stickies, with matches in titles,
  descriptions, notes and rule cells (snippet line); Enter opens the first result, arrows move,
  Esc closes; results show kind; "No results".
- **Out of scope:** comments/threads (P1), glossary (P1), search across decks in the library beyond
  names.
- **Acceptance criteria:**
  - Given a sticky anchored to "Order Service", When the node is moved, Then the sticky moves with
    it; When the node is deleted, Then the sticky becomes free (not lost).
  - Given flow mode is playing, When a step is current, Then notes are dimmed except those pinned to
    a node of the current step or marked "Stay visible during flows".
  - Given a new empty note, When it loses focus, Then it is removed.
  - Given ⌘K, When the user types "reattempt", Then the rule "Reattempt policy" and the flow step
    whose condition mentions it appear, and Enter opens the first.
  - Given the palette, When the user presses ↓ twice and Enter, Then the third result opens.
  - Given a query with no matches, When typed, Then "No results" shows and Enter does nothing.
  - Given a 2,000-node deck, When typing in ⌘K, Then results update in < 50 ms per keystroke.
- **Risks:** search index size (build incrementally from Yjs updates); dimmed notes at 35% must
  stay accessible (design-analysis §g-30).
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
  > 31-command-palette-filtered-light.png, 62-stickies and 63-stickies-flow (light and dark)
  > pixel-close.

## 010-zoom-groups-focus

- **Milestone:** M4 · **Depends on:** 003 · **Estimate:** 5 d
- **Goal:** Large systems stay readable: users see one level at a time, collapse groups, and focus
  on one component's neighbourhood.
- **Spec IDs:** V-1, V-2, V-3.
- **Design references:** [13-editor-focus-mode](design/screens/13-editor-focus-mode-light.png),
  [19-editor-group-drilldown](design/screens/19-editor-group-drilldown-light.png) (breadcrumb pill);
  group boundary with label + count; semantic zoom [64](design/screens/64-zoom-landscape-light.png) landscape,
  [65](design/screens/65-zoom-system-light.png) system, [66](design/screens/66-zoom-container-light.png) container, [67](design/screens/67-zoom-component-light.png) component;
  collapsible groups [68](design/screens/68-group-expanded-light.png) expanded, [69](design/screens/69-group-collapsed-light.png) collapsed,
  [70](design/screens/70-merged-edge-hover-light.png) merged-edge hover, [71](design/screens/71-flow-collapsed-light.png) flow through a collapsed
  group (each with a `-dark` twin). Components: level indicator in the zoom control, component
  card, port pill, group label chevron, collapsed group card, merged-edge ×N pill + popover.
- **In scope:** four levels (landscape → system → container → component) from `node.level` and
  group nesting, switched by zoom (Landscape ≤ 45% · System 46–90% · Container 91–150% ·
  Component > 150% or drilled into a node) and shown in a level indicator (4 bars + name) in the
  zoom control; landscape shows groups as regions with kind tiles only, system titles only,
  container title + tech, component full cards with dashed port pills for outside connections
  (click → that node one level up); double-click a group (or its label) to drill in; breadcrumb to go up; collapse/
  expand a group (chevron in the label, Space/↵): collapsed group renders as a stacked card with
  name and counts, edges to each neighbour merge into one edge with a "×N" pill and a direction
  icon, hovering it lists the underlying edges, a flow passing through lights the card and the
  player says "inside <group>" (71); focus mode toggle (selected node + neighbours, others dimmed; connected
  edges highlighted with labels); keyboard: Enter drills in, Backspace goes up, F toggles focus.
- **Out of scope:** role-based layers (V-5), saved per-view collapse state (011).
- **Acceptance criteria:**
  - Given the Core services group, When the user double-clicks it, Then only its members show, the
    canvas fits them, and the breadcrumb reads "Deck › System view › Core services".
  - Given a collapsed group with 12 edges to another group, When rendered, Then one edge with "×12"
    connects them; When expanded, Then the 12 edges return.
  - Given a selected node and Focus on, When rendered, Then only it and its direct neighbours are at
    full opacity, and dimmed elements are also marked non-interactive for screen readers.
  - Given the zoom goes from 100% to 42%, When rendered, Then the level indicator reads
    "Landscape" and nodes show only their kind tile, each with an accessible name.
  - Given a flow step inside a collapsed group, When it is current, Then the group card shows the
    ring and the player names the group.
  - Given the bench deck with all groups collapsed, When panning, Then ≥ 60 fps.
- **Risks:** edge aggregation cost; interaction between drill-down, collapse and flow mode (71);
  where collapse state lives (§g-22: UI state now, per view in 011).
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
  > Run `pnpm bench` before/after. Match docs/design/screens/13-editor-focus-mode-light.png,
  > 19-editor-group-drilldown-light.png and 64-zoom-landscape … 71-flow-collapsed (light and dark)
  > pixel-close.

## 011-views-autolayout

- **Milestone:** M4 · **Depends on:** 010 · **Estimate:** 5 d
- **Goal:** One model, many lenses: infra, feature and system views that stay in sync, with tidy
  automatic layout that respects what the user pinned.
- **Spec IDs:** V-4, C-4.
- **Design references:** view switcher in the top bar and "+" in
  [02](design/screens/02-editor-node-selected-light.png),
  [20-editor-view-infra](design/screens/20-editor-view-infra-light.png),
  [21-editor-view-feature](design/screens/21-editor-view-feature-light.png),
  [22-editor-custom-view-toast](design/screens/22-editor-custom-view-toast-light.png); per-view
  collapse state as noted on [69](design/screens/69-group-collapsed-light.png) ("Collapse state is saved per view", §g-22).
  **Custom view configuration and the layout button are still not designed** (not in states
  41–85).
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

- **Status:** implemented in PR #37 (2026-09-29) — see [`tasks.md`](../specs/012-export/tasks.md) and [ADR 0016](decisions/0016-export-rendering.md). Later: PDF and Mermaid export (below).
- **Milestone:** M5 · **Depends on:** 007, 011 · **Estimate:** 4 d
- **Design update (2026-10-03):** implemented against the pre-Deck cards. The Deck look (029: lip,
  14px corners, filled pills; 033 tag colours; 035 flow stickers) must also appear in PNG and SVG
  exports, and the dialog preview must match the canvas. Treat this as a follow-up check owned by
  029 / 033 / 035 (their specs list the export as an acceptance item), not as a new feature.
  Screens 06 and 33–34 show the dialog, which `DESIGN.md` still describes correctly.
- **Goal:** Users take their diagrams anywhere — docs, slides, wikis, git — in open formats, generated
  entirely in the browser.
- **Spec IDs:** I-1, principle 6 (no lock-in).
- **Founder decision (2026-09-28, spec clarifications):** ship **JSON, PNG and SVG only**; PDF and
  Mermaid are deferred (see "Later: PDF and Mermaid export" below). JSON always exports the
  **whole deck**; the scope switch applies to images only and is disabled for JSON. In flow mode the
  dialog opens on PNG + "Selected flow". Spec: `specs/012-export/spec.md`.
- **Design references:** [06-export-json](design/screens/06-export-json-light.png) ·
  [dark](design/screens/06-export-json-dark.png), [33-export-png](design/screens/33-export-png-light.png),
  [33-export-svg](design/screens/33-export-svg-light.png), [33-export-pdf](design/screens/33-export-pdf-light.png),
  [33-export-mermaid](design/screens/33-export-mermaid-light.png),
  [34-export-flow-scope](design/screens/34-export-flow-scope-light.png). Components: dialog, format
  list, segmented scope, switches, scale pills, preview, footer.
- **In scope:** export dialog from the tools island, the deck menu and ⌘K; formats JSON
  (.sododeck.json, whole deck only, pretty toggle, include descriptions/links/rules), PNG
  (1×/2×/3×, transparent), SVG (transparent); image scopes whole deck / current view / selected
  flow; live preview; filename from deck name; Copy for JSON and SVG; "Nothing is uploaded" note;
  generation off the main thread for large decks.
- **Out of scope:** PDF and Mermaid export (deferred, below); partial JSON (current view / one
  flow); import of Mermaid and other diagram formats (P1), embeds (P2), per-page PDF of every flow.
- **Acceptance criteria:**
  - Given the JSON format, When downloaded and re-imported, Then the deck is identical (round-trip).
  - Given flow mode on "Place order", When the dialog opens, Then PNG is selected, scope is
    "Selected flow" and the PNG contains only the flow's nodes and edges.
  - Given JSON, When selected, Then the scope switch shows "Whole deck" and is disabled.
  - Given PNG at 3×, When exported, Then the image dimensions are 3× the diagram bounds and the
    footer showed that size beforehand.
  - Given any export, When it runs, Then no network request is made (smoke test still green).
- **Risks:** fonts embedded in SVG/PNG; large decks (worker/OffscreenCanvas).
- **`/speckit.specify` prompt:**
  > Let users export a deck as a re-importable deck file, a PNG image, an SVG vector, a print-ready
  > PDF, or a Mermaid diagram for markdown and wikis. They can export the whole deck, the current
  > view, or the selected flow; see a live preview; choose options per format (pretty JSON, include
  > descriptions and rules, image scale, transparent background, flow step details, groups as
  > subgraphs); copy text formats; and download with a file name based on the deck name. Everything
  > is generated on the user's device and nothing is uploaded. Why: users must never be locked in
  > and need diagrams in their docs, slides and repositories.
- **`/speckit.plan` hint:**

  > apps/app/src/export (pure generator: svg; JSON only via @sododeck/model serializeDeck);
  > dialog from packages/ui (000). PNG via canvas from SVG (fonts inlined from bundled files).
  > Workers for large decks. Match docs/design/screens/06-export-json-light.png,
  > 33-export-png-light.png, 33-export-svg-light.png, 34-export-flow-scope-light.png pixel-close
  > (without the PDF and Mermaid entries).

- **Later: PDF and Mermaid export** (not scheduled, founder decision 2026-09-28). Add them to the
  012 dialog's format list: PDF (A4 landscape, optional flow step details; open decision: print
  dialog vs generated PDF, which needs a dependency or a custom writer) and Mermaid (`flowchart LR`,
  one subgraph per group, kind-specific shapes, Copy). Designs: frames 33-pdf and 33-mermaid.

## 013-samples-onboarding

- **Milestone:** M5 · **Depends on:** 005, 009 · **Estimate:** 3 d
- **Goal:** New users understand the product in minutes: a realistic Delivery sample and a short
  first-run tour.
- **Spec IDs:** §13 demo deck, K-8 (lightweight first-run version; full guided tours stay P2),
  C-8 groundwork (templates are P1).
- **Design update (2026-10-03):** board B "Deck" (§g-63) changes how cards look, so the sample and
  the tour are built **after** the card system (029–035) and show the final look: frame
  [117](design/screens/117-deck-sample-board-light.png) is the reference for a played sample flow
  ("Checkout" on ~20 cards) and [120](design/screens/120-deck-sample-set-light.png) for the card
  and shape types. `sododeck-data.js` stays the source of the data (components, flows, rules), not
  of the look. The tour frames below predate the Deck look: recheck their anchors and copy
  against 018's shell and 029's cards when this is specified.
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

## 016-canvas-editing

- **Status:** implemented (2026-09-29) — see [`tasks.md`](../specs/016-canvas-editing/tasks.md) and [ADR 0017](decisions/0017-group-frames-and-clipboard.md). Groups are stored frames (`group.position` / `size`, `view.groupFrames`); copy / paste / duplicate, ⌘G, frame drag and resize, drop into / out of groups, align and distribute, snapping, ⌥ nudge, marquee refinements and the hint bar. Actions: `clipboard-actions.ts`, `group-actions.ts` (`group.create`), `align-actions.ts`; gestures in `apps/app/src/editor/editing/`.
- **Milestone:** after M4 · **Depends on:** 019 (menu and toolbar surfaces) · **Estimate:** 6 d (was 4 d before §g-55)
- **Menus and toolbar (019):** add this feature's items as an action module in
  `apps/app/src/editor/actions/` (registered in `ACTIONS`); the context menu, the selection toolbar
  and the keys pick them up (ADR 0015).
- **Goal:** Everyday diagram editing feels like a design tool: copy, paste, duplicate, group what is
  selected, move a group as one piece, and line things up without fiddling.
- **Spec IDs:** C-6 (editing ergonomics).
- **Decision (founder, 2026-09-29, §g-55):** groups become **frames** with a stored position and
  size (optional `group` geometry plus per-view group geometry in views with their own
  positions). Users drag and resize frames, which never auto-scale; a card released outside its
  group's frame leaves the group. This reverses "bounds are derived" in schema v1 (additive, no
  version bump) and needs an ADR. Spec: [`spec.md`](../specs/016-canvas-editing/spec.md).
- **Design references:** 92 bulk drawer (Align, distribute), 99 toolbar multi-selection, 102–104
  context menus (actions from here), 108 marquee, 109 dragging a group, 110 drop-into-group,
  111 alignment guides; inventory: snap guide, marquee, drop target, hint bar.
- **Design deltas (86–116):**
  - Marquee (108): count chip at the cursor; **⌥ also selects cards the box only touches**;
    releasing on empty space with nothing inside clears the selection.
  - Group drag (109): lifted group + dashed ghost of the start + offset readout (`+96, +20`);
    **Esc cancels, ⌥ duplicates, ⇧ locks the axis**; dropping a group over another group nests
    it (sets `group.parent`) with an Undo toast.
  - Drop into group (110): the group only highlights when the **pointer** is inside it; dashed
    orange boundary, "Drop into …" chip, dashed landing slot; **⌥ drops without grouping** (replaces
    "drag out with Alt").
  - Guides (111): within 6 screen px, distance labels to neighbours, equal-gap labels, **hold ⌘ to
    disable snapping**, ⇧ locks the axis. No grid toggle in the design (⇧ snaps to grid only for
    connector segments, 113).
  - Align shortcuts (99): ⌥A / ⌥D / ⌥W / ⌥S = left / right / top / bottom; ⌘G group. Copy JSON is
    ⇧⌘C (102).
  - Paste enables only when the clipboard holds Sododeck JSON (103); on an empty deck ⌘V pastes
    JSON too (86).
  - **Hint bar** (inverse pill, bottom centre, key caps) during every gesture (108–114); shared
    with 017.
  - Nudge keys: see §g-45.
- **In scope:**
  - **Copy / cut / paste / duplicate** (⌘C / ⌘X / ⌘V / ⌘D) of the selected components, the
    connections between them, and groups whose members are all selected. Paste creates new ids,
    keeps references inside the pasted set, drops connections to components that were not copied,
    and places the result at the pointer (or +24 px from the originals). The clipboard holds a
    `.sododeck.json` fragment, so paste works across tabs and decks; plain text in the clipboard is
    ignored. Alt+drag duplicates the dragged selection. Each paste/duplicate = one undo step.
  - **Group selection** (⌘G): creates a group around the selected components (nested in their
    common parent group, if any), named "New group", with its label in rename mode. **Ungroup**
    (⇧⌘G) on a selected group removes the group; members move to its parent (002 FR-014).
  - **Select and move a group:** the group boundary/label becomes selectable (click the label or
    the boundary edge); dragging it moves every member and nested group together as one undo
    step; Delete on a selected group asks for confirmation and ungroups (members are kept).
    Selecting a group is done by its **label** (101); clicks inside a group still select cards.
  - **Drop into / out of a group:** dragging components onto a group boundary and releasing
    (with a highlight while hovering) sets their group; dragging them out with Alt held removes it.
  - **Align & distribute** for ≥ 2 selected components: left / centre / right / top / middle /
    bottom, distribute horizontally / vertically; in the selection toolbar and the context menu.
  - **Nudge:** Alt+Arrow moves the selection by 1 px, Alt+Shift+Arrow by 10 px (plain arrows keep
    moving focus, 003 R3); a burst of nudges = one undo step.
  - **Snapping while dragging:** alignment guides to other components' edges and centres with
    distance labels; hold ⌘ to disable snapping (111). No grid toggle.
  - Every action above is also offered in 019's context menu and selection toolbar (Copy,
    Paste, Duplicate, Group, Ungroup, Align, Delete — only the actions that apply).
- **Out of scope:** drag-to-select without Shift (§g-36); resizing cards and routing connectors
  (017); auto-layout (011); renaming or re-parenting groups beyond the ⌘G flow (inspector, 008);
  pasting Mermaid or arbitrary JSON (M5+).
- **Acceptance criteria:**
  - Given three selected components with two connections between them and one to an outside
    component, When the user presses ⌘C then ⌘V, Then three new components and two new connections
    appear at the pointer with new ids, the outside connection is not copied, and one ⌘Z removes
    them all.
  - Given components copied in deck A, When the user pastes in deck B (other tab), Then they
    appear in deck B with new ids and nothing changes in deck A.
  - Given four selected ungrouped components, When the user presses ⌘G, Then a group "New group"
    containing exactly them exists, its label is in rename mode, and the JSON panel shows the new
    group and each node's `group`.
  - Given a selected group, When the user presses ⇧⌘G, Then the group is gone and its members
    belong to its parent group (or to none).
  - Given a group with nested groups, When the user drags its label by (100, 40), Then every
    member and nested member moves by (100, 40) and one ⌘Z moves them all back.
  - Given three selected components, When the user chooses "Align left", Then their x positions
    are equal to the leftmost one's; When "Distribute horizontally", Then the gaps are equal.
  - Given a selected component, When the user presses Alt+Shift+→ three times, Then it moved 30 px
    right and one ⌘Z restores it.
  - Given a component being dragged near another's centre line, When within 6 screen px, Then a
    guide shows and the component snaps to it.
  - Given the bench deck with 100 selected components, When dragging, Then ≥ 60 fps.
- **Risks:** clipboard permissions (async Clipboard API needs a user gesture; fall back to the
  `copy`/`paste` events); keeping one undo step per gesture; making the group boundary selectable
  without stealing clicks from components inside it; interaction with collapsed / drilled groups
  (010) and flow recording (FR-017: disabled while recording).
- **`/speckit.specify` prompt:**
  > Make everyday editing on the canvas fast. Users can copy, cut, paste and duplicate the selected
  > components together with the connections between them, also between decks in other tabs.
  > They can turn the selection into a new group with Cmd/Ctrl+G, ungroup with Shift+Cmd/Ctrl+G,
  > select a group by its label and drag it to move everything inside it, and drop components into
  > or out of a group. Selected components can be aligned and evenly distributed, nudged with
  > Alt+arrow keys, and snap to alignment guides (and optionally to the grid) while dragging. A
  > right-click menu offers the actions that apply. Every action is one undo step and works from
  > the keyboard. Dragging on empty canvas still pans; Shift+drag still draws the selection box.
  > Why: building a 30-component diagram today means placing and fixing every box by hand.
- **`/speckit.plan` hint:**
  > apps/app/src/editor: pure fragment functions (select → fragment, fragment → new ids + offset)
  > unit-tested; one `editor` transaction per gesture; group creation needs a model op in
  > packages/model (add group + set members in one transaction) with a round-trip case. Guides and
  > align maths as pure functions over `NODE_SIZE` (later `node.size`, 017). Clipboard via
  > `features.ts` detection. Run `pnpm bench` before/after.

## 017-resize-edge-routing

- **Status:** implemented (2026-09-30) — see [`tasks.md`](../specs/017-resize-edge-routing/tasks.md) and [ADR 0019](decisions/0019-card-size-and-connector-route.md). Cards resize by drag or ⌘⇧+arrow (`node.size`, clamped by `cardSize()`); connectors pin a side and move a middle segment by drag, ⌘⇧+arrow or the inspector (`edge.route`); `R` / "Reset route" clears it. Routing: `apps/app/src/editor/routing/`; resize keys and gestures in `apps/app/src/editor/editing/`.
- **Note (016):** the schema already has `$defs/Size` (reuse it for `node.size`), and the resize wrapper exists: `NodeResizeControl` handles styled as `.sd-resize-handle` in `group-boundary-node.tsx`, with the pure `editing/resize-limits.ts` (handles, ⇧ ratio, ⌥ from centre, minimum box) and `editing/frame-resize.ts` (one gesture, Esc cancels). Snapping (`editing/snap.ts`) and the hint bar (`HintBar`, `editing/gesture-hints.ts`) are ready to reuse.
- **Milestone:** after M4 · **Depends on:** 003 (soft: 016 for snapping) · **Estimate:** 4 d
- **Menus and toolbar (019):** add this feature's items as an action module in
  `apps/app/src/editor/actions/` (registered in `ACTIONS`); the context menu, the selection toolbar
  and the keys pick them up (ADR 0015).
- **Goal:** Users control the look of the diagram: make important cards bigger and route
  connectors where they want them, so busy diagrams stay tidy.
- **Spec IDs:** C-6; **schema change** decided in §g-37.
- **Design references:** 112 resizing a card, 113 dragging a connector segment, 114 endpoint side
  targets, 100 toolbar on a connection (Reset route); inventory: selection frame + resize handle,
  segment + endpoint handles, hint bar (016).
- **Design deltas (86–116):**
  - Resize (112): 8×8 handles, active one filled orange; `W × H` readout pill next to the dragged
    corner; connections re-attach live; **sizes snap to 4 px**; ⇧ keep ratio, ⌥ from centre, Esc
    cancels. Minimum 120 × 44 (as planned).
  - Segment (113): 10×24 handle; dashed ghost of the automatic route; offset readout (`−18`);
    **⇧ snaps to grid, R resets the route**; the segment **moves freely, with no 12 px stop from a
    card edge** (clarified 2026-09-29: the plan drops the design's fixed stop).
  - Endpoint (114): four side targets on the hovered card, nearest one "hot"; dashed orange live
    path + ghost of the old route; dropping on the same card only changes the side; Esc keeps the
    old target. The design's "⌥ leaves a free end" is an open question (§g-44).
  - Reset route is disabled while the route is automatic (100).
- **Schema (v1, additive, all optional):**
  - `node.size`: `{ "width": number, "height": number }` in px; absent = default card size
    (164 × 50). Minimum 120 × 44, maximum 800 × 600.
  - `edge.route`: `{ "fromSide"?: "top"|"right"|"bottom"|"left", "toSide"?: same,
"offset"?: number }`. Sides pin which side of each card the connector leaves / enters (absent =
    automatic, as today); `offset` shifts the connector's middle segment in px (horizontal or
    vertical depending on the path; absent = 0).
  - Needs an ADR (why offsets instead of free waypoints), Ajv/Zod parity and round-trip tests, and
    a note on forward compatibility (older app builds reject unknown fields).
- **In scope:**
  - **Resize a card:** 8 handles on a single selected component; Shift keeps the ratio, Alt resizes
    from the centre; snaps to guides/grid when 016 is in; double-click a handle resets to the
    default size (removes `size`); one undo step per drag. Title and details wrap / clamp inside
    the new size. Group boundaries, selection frame, minimap, search fit and layout use the real
    size.
  - **Adjust a connector:** a selected connector shows a handle on its middle segment; dragging it
    moves that segment up/down or left/right (`offset`); dragging an end onto another side of the
    same card pins that side (`fromSide`/`toSide`), dragging it to another card reconnects as
    today; "Reset route" in the edge popover clears `route`. Step badges, labels and flow
    highlights follow the adjusted path.
  - Keyboard: with a component focused, Alt+⌘+Arrow grows/shrinks it by 10 px; with a connector
    selected, Alt+Arrow moves its middle segment by 10 px.
  - Inspector shows size (W × H) and route (sides, offset) as editable fields.
- **Out of scope:** free multi-point waypoints and curve styles (bezier/straight) (later, if
  offsets are not enough); automatic obstacle-avoiding routing (011); resizing groups (they stay
  derived from members); resizing stickies (009).
- **Acceptance criteria:**
  - Given a selected component, When the user drags its bottom-right handle by (80, 30), Then it is
    244 × 80, the JSON panel shows `"size": { "width": 244, "height": 80 }`, its group boundary
    grows to fit, and one ⌘Z restores the default size and removes `size`.
  - Given a deck file without `size` or `route`, When opened, edited and exported, Then those
    fields are still absent (lossless round-trip).
  - Given a selected connector between two stacked components, When the user drags its middle
    handle 60 px right, Then the connector's middle segment moves 60 px right, `route.offset` is 60,
    and a flow highlight on that connector follows the new path.
  - Given a connector, When the user drags its source end onto the card's top side, Then it leaves
    from the top and `route.fromSide` is `"top"`; When "Reset route" is chosen, Then `route` is
    removed and the path is automatic again.
  - Given a size below the minimum, When the user keeps dragging, Then the card stops at 120 × 44.
  - Given the bench deck with every node resized and 200 routed edges, When panning, Then ≥ 60 fps.
- **Risks:** file-format change (ADR, version stays v1 because fields are optional); every place
  that assumes `NODE_SIZE` (geometry, layout worker, thumbnails, export 012) must read the real
  size; offset semantics must stay stable when the connected cards move.
- **`/speckit.specify` prompt:**
  > Let users shape the diagram. A selected component can be resized with handles (keeping its
  > proportions with Shift) and reset to the default size; its group boundary and everything that
  > measures it follow the new size. A selected connection shows a handle on its middle segment that
  > can be dragged to move that part of the line up, down, left or right, and its ends can be pinned
  > to a chosen side of each card; a reset returns it to automatic routing. Sizes and routes are
  > saved in the deck file as optional fields, so older decks open unchanged. Every change is one
  > undo step and works from the keyboard. Why: automatic lines often run through the wrong place
  > and every card is the same size, so users cannot make a busy diagram look tidy.
- **`/speckit.plan` hint:**
  > packages/schema: add optional `Node.size` and `Edge.route` to v1.json, `pnpm schema:generate`,
  > parity test; packages/model: round-trip cases incl. absent fields; ADR 0010 (edge routing as
  > side + offset). apps/app: `NodeResizer` from @xyflow/react (already a dependency), a custom
  > path builder on top of `getSmoothStepPath` that applies `offset`; replace `NODE_SIZE` reads
  > with a `nodeSize(node)` helper. Run `pnpm bench` before/after.

## 021-design-sync-canvas-first

- **Status:** implemented (2026-09-28) — see [`spec.md`](../specs/021-design-sync-canvas-first/spec.md). Design files, screenshots 86–116, design-analysis §a–§d and DESIGN.md "Canvas-first Editor" / "Card Colours" are in the repo. Importing found six more mismatches with defaults (§g-48–§g-54: ⌘. and C shortcuts, per-deck UI memory, icon-only save status, 12 custom colours, no keyboard path for resize and routing) for 018–020 to confirm.
- **Milestone:** after M4 · **Depends on:** 011 · **Estimate:** 1 d (docs only, no app code)
- **Goal:** The canvas-first design (86–116) lives in the repo and the design rules point to it,
  so 018–020 are specified and built against it rather than the 3-column prototype.
- **Design references:** Claude Design project "Sododeck": `Sododeck Canvas-first.dc.html`,
  `Sododeck Canvas State.dc.html`, `sododeck-canvas.js` (+ `sododeck-data.js`,
  `sododeck-states.js`, `support.js`).
- **In scope:**
  - Copy the new design files, read-only, into `docs/design/claude-design/`.
  - Export every state 86–116 in light and dark (1440×900; 116 at 1024×768) to
    `docs/design/screens/<id>-<slug>-{light,dark}.png` (slugs from the design list, e.g.
    `86-shell-empty`, `105-fill-popover`).
  - `docs/design/design-analysis.md`: inventory rows for 86–116, mapping to 016–020, the new
    components (island, rail button, flyout, drawer, selection toolbar, toolbar popover, context
    menu, colour popover, resize / segment / endpoint handles, snap guide, marquee, drop target,
    hint bar) and the answers to §g-42–§g-46.
  - `DESIGN.md`: "Three-panel editor" → "Canvas-first editor" (island, rail, flyout 280, drawer
    360 / 320–560, JSON overlay 268 values); selection = 2 px outside frame; narrow 1024–1279
    designed; card-colour tokens as light/dark pairs; overlay motion (120 ms fade + 4 px slide,
    none with reduced motion).
  - `AGENTS.md` Design section: frames 02–85 are the reference for panel **content**; 86–116 for
    editor **placement** and the new controls.
- **Out of scope:** any app or package code; tokens in `packages/ui` (added by 018 / 020).
- **Acceptance criteria:**
  - Given `docs/design/screens/`, When listed, Then states 86–116 exist in light and dark.
  - Given DESIGN.md, When read, Then it describes the canvas-first shell and no longer the
    264 / 336 px columns, and lists the 13 card-colour token pairs.
  - Given design-analysis §g-42–§g-46, When read, Then each has a founder decision or a default.
  - `pnpm lint` (prettier) passes.
- **Risks:** exporting 62 screenshots needs the Claude Design preview in a browser; frames 02–85
  keep old placement and must not be "fixed" to match.
- **`/speckit.specify` prompt:** not needed (docs task); do it directly.

## 018-canvas-first-layout

- **Status:** implemented (2026-09-28) — see [`tasks.md`](../specs/018-canvas-first-layout/tasks.md) and [ADR 0014](decisions/0014-canvas-first-shell.md). §g-49 (C) and §g-50 (per-deck UI memory) defaults confirmed; the Group rail tool stays disabled until 016.
- **Milestone:** after M4 · **Depends on:** 021 · **Estimate:** 5 d
- **Goal:** The drawing surface gets the whole screen. Chrome floats over the canvas in small
  islands, so a 100-component diagram has room to breathe (§g-38).
- **Spec IDs:** editor shell (spec §7); replaces the 3-column layout of the prototype (02).
- **Design references:** 86 shell (empty deck), 87 dense deck at 50 %, 88 palette flyout, 89
  outline pinned, 90 flows flyout + flow mode, 91 drawer (component), 92 drawer (bulk), 93 JSON
  overlay, 94 Hide UI, 115 keyboard regions, 116 narrow 1024×768; inventory: island, rail button,
  flyout, detail drawer. Frames 02–85 stay valid for panel **content**, not placement.
- **Design deltas (86–116):**
  - Islands: 44 tall, 12 from the edges. Deck island = ≡ · name · **save status as an icon**
    (check / spinner / clay alert that opens the 84 error popover) · views segmented control; in
    flow mode a **"Flow · <name>" chip with ×** (90). Tools island = Jump to (176 field, ⌘K) ·
    Labels · Focus · theme · Export.
  - Rail (48 wide, 38 buttons): Select **V** · Add component **C** · Sticky **S** · Group **G** ·
    Connector **L** · Outline **⌥1** · Flows **⌥2** · Rules · Search; Undo/Redo in their own island
    8 px below. Tooltips: inverse, shortcut in mono, 400 ms delay.
  - Flyouts 280 wide at left 68 / top 68; pin keeps one open; opening another flyout **swaps** and
    the pinned one returns when it closes (89); first Esc clears a filter.
  - Palette flyout (88): search, six kinds with **number keys 1–6** (add at view centre), sticky and
    group; dragging a tile shows a ghost that snaps to the grid.
  - Drawer (91): 360, **320–560** via a left grip, width remembered **per deck** (UI metadata, not
    the file); toggle **⌘⇧D** (replaces ⌘I); opening it pans the canvas so the selection stays
    clear; adds an **Appearance** section (fill and stroke, 020). Bulk drawer (92): count header,
    "Mixed" values, dashed partial tags `n/N`, Align/distribute at the end; changing Kind on mixed
    kinds asks for confirmation.
  - JSON (93): bottom island from the rail to the right edge (or the drawer's left edge); the zoom
    island moves above it. Editing shown in 93 is §g-42.
  - Zoom island: fit **⇧1**, fit selection **⇧2**, ⌘+ / ⌘−, minimap **M** (pops above the island,
    orange viewport outline), help (?).
  - Hide UI (94): selection and context menu still work; selection toolbar stays hidden.
  - Keyboard (115): **F6 / ⇧F6** order = deck island → tools → rail → undo → canvas → zoom (drawer
    when open); hidden regions are skipped.
  - Narrow 1024–1279 (116): rail stays; views become a dropdown; Jump to, Labels, Focus become
    icons; Export icon-only; drawer covers ~35 %. Below 1024 stays view-only.
  - Existing controls without a place in the design (tidy layout, pins, view settings, drill
    breadcrumb, problems): §g-46.
- **In scope:**
  - **Full-bleed canvas** under everything (no fixed sidebars, no top bar row).
  - **Top-left island:** menu (library, import, export, deck settings), deck name (rename in
    place), save status icon; view switcher (011) next to it.
  - **Top-right island:** Jump to / search (⌘K), theme, Export, flow playback controls when a flow
    is active (007).
  - **Left icon rail** (≈ 48 px, vertically centred): Select, Add component (flyout with the
    palette), Sticky (009), Group, Connector, Outline, Flows & features, Rules, then Undo / Redo.
    Each flyout opens beside the rail, overlays the canvas, closes on Esc or outside click, and
    can be pinned open; one open at a time.
  - **Detail drawer** (right, ≈ 360 px, overlays the canvas): today's inspector content. Opens
    from the card's corner icon (019), Enter / ⌘⇧D on a selection, or the toolbar; closes with Esc
    or its close button; width remembered per deck (UI metadata). The canvas never resizes
    when it opens (no layout shift).
  - **JSON panel** hidden by default; toggled from the menu, the rail or ⌘J; opens as a bottom
    overlay with the current height/collapse behaviour (004).
  - **Bottom-right island:** fit, zoom −/%/+, minimap toggle, keyboard-shortcut help (?).
  - **Hide UI** (⌘\): hides all islands except a small "show UI" button.
  - Keyboard: F6 cycles focus between islands, canvas and drawer; all flyouts are menus/dialogs
    with correct roles; light and dark themes.
- **Out of scope:** the selection toolbar, inline title edit and context menu (019); collaboration
  UI (avatars, comments); changing any panel's content.
- **Acceptance criteria:**
  - Given the editor at 1440×900 with nothing open, When measured, Then the canvas covers the full
    viewport and floating chrome covers ≤ 8% of it.
  - Given a selected component, When the user presses Enter, Then the detail drawer opens with
    its fields, the canvas does not move or resize, and Esc closes it and returns focus to the
    component.
  - Given the rail, When the user clicks Outline, Then the outline flyout opens beside the rail;
    When they click Flows, Then the outline closes and the flows flyout opens.
  - Given ⌘\, When pressed, Then only the "show UI" button remains; pressing again restores the
    previous islands.
  - Given the JSON panel was hidden, When the user presses ⌘J, Then it opens synced with the
    selection as before (004 criteria still pass).
  - Given keyboard only, When the user presses F6 repeatedly, Then focus moves top-left island →
    rail → canvas → drawer (if open) → bottom-right island.
  - The smoke e2e suite passes after its selectors are updated to the new placement.
- **Risks:** large chrome refactor touching every feature's entry point (flows, rules, search,
  JSON); DESIGN.md and AGENTS.md design rules ("match screens pixel-close") must be updated so
  later features do not follow the old layout; flyouts over the canvas must not block drag.
- **`/speckit.specify` prompt:**
  > Give the diagram the whole screen. The canvas fills the window and all controls float above
  > it in small islands: deck menu and name top-left, search and export top-right, zoom
  > bottom-right. A thin icon rail on the left holds the tools (select, add component, sticky,
  > group, connector) and opens the outline, flows and rules as flyouts beside it, one at a time.
  > Component details open in a drawer only when asked for and never resize the canvas. The JSON
  > panel is hidden until toggled. Users can hide all controls with one shortcut. Everything is
  > reachable from the keyboard. Why: architecture diagrams with 100+ components need space;
  > permanent side panels take half the screen.
- **`/speckit.plan` hint:**
  > apps/app/src/routes/editor-page.tsx loses the 3-column grid; new floating shell components
  > in apps/app/src/editor/shell/ (rail, flyout, drawer, islands) built from packages/ui
  > primitives; existing panels (outline-tree, flow list, rules, inspector, json-panel) are moved,
  > not rewritten. Open panel/flyout state in the Zustand UI store. ADR for the layout change and a
  > DESIGN.md update. Update smoke e2e selectors only.

## 019-card-quick-edit

- **Status:** implemented (2026-09-28) — see [`tasks.md`](../specs/019-card-quick-edit/tasks.md) and [ADR 0015](decisions/0015-canvas-actions-and-quick-edit.md). FR-001 option A: double-click and F2 rename, Enter keeps opening details / drilling in. The "Paste is disabled with nothing copied" criterion moved to 016 (no Paste item until 016). Menu and toolbar items live in the action list `apps/app/src/editor/actions/`.
- **Milestone:** after M4 · **Depends on:** 018 · **Estimate:** 3 d
- **Goal:** Most diagram edits need only the title; everything else is one click away on the card
  itself, without opening a panel.
- **Spec IDs:** C-6.
- **Design references:** 95 card hover + details icon, 96 inline title edit, 97 new card with an
  empty title, 98 toolbar (one component + Owner popover), 99 toolbar (multi, Tags popover with
  partial chips), 100 toolbar on a connection, 101 toolbar on a group, 102 / 103 / 104 context menu
  on a component / empty canvas / group; inventory: selection toolbar, toolbar popover, context
  menu.
- **Design deltas (86–116):**
  - Details icon (95): 22 px inverse circle on the card's top-right corner; hidden while dragging,
    in flow mode and when the card is < 80 px wide on screen; the card lifts on hover.
  - Inline edit (96): F2 or ⏎ on a selection also starts editing; **Tab saves and edits the next
    card**; saving an empty title restores the previous one; the card keeps its size.
  - New card (97): lands at the view centre (offset 24 px until free) with an empty title and the
    placeholder "Name this component"; **⌘⏎ saves and adds another of the same kind**; Esc keeps it
    as "Untitled <kind>"; the palette stays open.
  - Toolbar (98–101): 44 tall, 12 px above the frame, flips below when it would reach y < 68;
    **⌘E focuses the toolbar**; popovers 236–272 wide with a filter; group toolbar = Rename (F2),
    Ungroup (⇧⌘G), Collapse (⌘.), Select members; connection toolbar: ⏎ edit label, P protocol.
  - Menus (102–104): component menu = Open details ⏎ · Rename F2 · Copy · Paste · Duplicate ·
    Copy JSON ⇧⌘C · Group selection ⌘G · Align ▸ · Arrange ▸ · Delete; canvas menu = Paste (disabled
    with a tooltip when the clipboard has no Sododeck JSON) · Add component ▸ (1–6, lands at the
    click point) · Add sticky · Select all · Fit; group menu = Rename · Ungroup · Collapse/Expand ·
    Select members · Delete group (tooltip: members move to the parent level). Menus flip near
    edges; submenus open right with −6 overlap.
- **In scope:**
  - **Inline title edit:** double-click a card (or press Enter on a focused card, F2) edits the
    title in place; Enter / click outside commits, Esc cancels; one undo step. A new component
    from the palette starts in title edit.
  - **Detail icon:** hovering or focusing a card shows a small icon in its top-right corner that
    opens the detail drawer (018) for that card.
  - **Selection toolbar** floating above the selection (single or multi): open details, kind,
    fill/stroke colour (when 020 lands), owner, tags, tech, links, rules, and "More ⋯". Hidden
    while dragging or zooming; stays inside the viewport; keyboard reachable (Tab from the
    selection, arrow keys inside the toolbar).
  - **Context menu** (right-click, Shift+F10, ContextMenu key) on a card, a connector, a group
    and the empty canvas, listing only actions that apply: Open details, Rename, Copy, Paste,
    Duplicate, Group / Ungroup, Align (016), Arrange (bring to front / send to back), Copy JSON,
    Delete. "More ⋯" in the toolbar opens the same menu.
  - Connectors get the same toolbar/menu subset (label, protocol, direction, Reset route when 017
    lands, Delete).
- **Out of scope:** new fields or dynamic attributes (§g-40); comments, lock, share links (need a
  backend or are not in the model); AI actions.
- **Acceptance criteria:**
  - Given a card, When the user double-clicks it, types "Billing API" and presses Enter, Then the
    title is "Billing API" everywhere (card, outline, JSON) and one ⌘Z restores the old title.
  - Given title edit, When the user presses Esc, Then nothing changes.
  - Given a card under the pointer, When hovered, Then the detail icon shows; When clicked, Then
    the drawer opens on that card.
  - Given two selected cards, When the toolbar shows, Then setting Owner there updates both in
    one undo step.
  - Given a right-click on empty canvas with nothing copied, When the menu opens, Then Paste is
    disabled and card-only actions are absent.
  - Given keyboard only, When a card is focused and Shift+F10 is pressed, Then the context menu
    opens with its first item focused.
- **Risks:** double-click conflicts (drill into a group in 010 uses double-click on groups, not
  cards); toolbar placement near viewport edges; keeping one undo step per toolbar change.
- **`/speckit.specify` prompt:**
  > Let users edit a component where they see it. Double-clicking a component edits its title in
  > place. Hovering a component shows a small icon that opens its details. Selecting one or more
  > components shows a compact toolbar above them for the common fields (kind, owner, tags,
  > technology, links, rules, colours) and a "More" button. Right-clicking a component, a
  > connection, a group or the empty canvas opens a menu with the actions that apply there. All of
  > it works from the keyboard and every change is one undo step. Why: most diagram editing is
  > naming boxes; opening a side panel for every change breaks the flow.
- **`/speckit.plan` hint:**
  > apps/app/src/editor: inline edit inside deck-node.tsx via the editor (no local copy of the
  > title beyond the input draft); reuse packages/ui `inline-edit` and `context-menu`,
  > and a toolbar from Radix Toolbar (already in the `radix-ui` dependency); one action registry shared by
  > shortcuts, toolbar and menu so 016 and 017 only register actions.

## 020-card-style

- **Status:** implemented (2026-09-30) — see [`spec.md`](../specs/020-card-style/spec.md), [`tasks.md`](../specs/020-card-style/tasks.md) and [ADR 0018](decisions/0018-card-style.md).
- **Note (016):** groups now store a frame (`position`, `size`); put `group.style` next to it in the Group schema.
- **Milestone:** after M4 · **Depends on:** 019 · **Estimate:** 3 d
- **Menus and toolbar (019):** add this feature's items as an action module in
  `apps/app/src/editor/actions/` (registered in `ACTIONS`); the context menu, the selection toolbar
  and the keys pick them up (ADR 0015).
- **Goal:** Users colour cards to show meaning at a glance (team, status, phase), with colours
  that look right in light and dark themes.
- **Spec IDs:** C-6; **schema change** decided in §g-39.
- **Design references:** 105 fill popover, 106 add a custom colour, 107 coloured cards gallery, 91
  drawer Appearance section; inventory: colour popover + swatch, card on colour, card-colour
  tokens (light/dark pairs).
- **Design deltas (86–116):**
  - **13 named colours**: red, orange, amber, yellow, lime, green, teal, cyan, blue, indigo,
    violet, pink, slate → tokens `--card-<name>-fill` / `--card-<name>-stroke` (oklch values in
    the design, light and dark).
  - Popover (105): Fill / Stroke tabs, No colour, COLOURS grid (28 px swatches, 7 per row), DECK
    COLOURS row ending in "+"; selected = 2 px gap + orange ring + check; custom swatch shows a ×
    badge on hover/focus, ⌫ removes it; mixed selection shows no check.
  - Add colour (106): saturation box + hue bar + hex field + Add, live preview on the card,
    "saved to this deck as n of 12"; invalid hex disables Add.
  - **Custom colours: max 12 per deck** (not 24); "+" hides when full.
  - Text: Ink on named fills; subtitle switches Muted → Secondary on any fill; custom fills below
    **0.18 relative luminance flip text to white**.
  - **Selection style changes for all cards**: a 2 px orange outline 2 px **outside** the card
    (reads on any fill); flow keeps the 1.5 px orange border + halo; error = dashed clay ring 3 px
    outside + alert badge (107). DESIGN.md changes with this.
  - Groups get the same fill / stroke (§g-43), as in the dense deck (87): a group fill and a
    dashed coloured group stroke.
- **Schema (v1, additive, all optional):**
  - `node.style` and `group.style`: `{ "fill"?: ColorRef, "stroke"?: ColorRef }`; absent =
    today's look (§g-43).
  - `ColorRef`: a named palette key (e.g. `red`, `amber`, `green`, `teal`, `blue`, `violet`,
    `pink`, `slate` …, 13 keys) **or** a `#rrggbb` hex string.
  - `swatches` (deck level): up to 12 `#rrggbb` custom colours the user added with "+", shown
    after the fixed palette in every colour picker of this deck.
  - ADR + parity and round-trip tests (absent fields stay absent).
- **In scope:**
  - Fill and stroke pickers in the selection toolbar (019) and the detail drawer: fixed palette,
    the deck's custom swatches, "No colour" (reset), and a **"+"** that opens a colour input and
    adds the colour to `swatches`; remove a custom swatch from its menu (cards using it keep the
    hex).
  - Named colours map to tokens with light and dark variants; custom hex is used as-is in both
    themes, with text colour picked automatically for AA contrast.
  - Works on multi-selection in one undo step; the outline and minimap reflect the fill.
  - Colour is never the only cue (constitution VII): selection, flow and error states keep their
    non-colour marks on coloured cards.
- **Out of scope:** colouring connectors and stickies (later); opacity; gradients;
  user-defined attributes (§g-40).
- **Acceptance criteria:**
  - Given a selected card, When the user picks "Green" fill, Then the card is green in both themes,
    the JSON shows `"style": { "fill": "green" }`, and one ⌘Z removes it.
  - Given the "+" in the picker, When the user adds #7a3cff, Then it appears in the swatches of
    every card in this deck, is saved in `swatches`, and survives export/import.
  - Given a dark custom fill, When rendered, Then the title text switches to a light colour and
    meets 4.5:1 contrast.
  - Given three selected cards, When "No colour" is chosen, Then all three lose `style.fill` in one
    undo step.
  - Given a flow highlight on a coloured card, When rendered, Then the flow ring and badge are
    still visible and announced.
- **Risks:** colour tokens for both themes; custom hex in dark mode; bench cost of per-node style
  (memoized class/inline style).
- **`/speckit.specify` prompt:**
  > Let users colour components. A selected component (or several) can get a fill colour and a
  > border colour from a fixed palette that looks right in light and dark themes, or be reset to
  > the default. A "+" at the end of the palette lets users add their own colour, which is kept
  > with the deck and offered for every component in it. Colours are saved in the deck file as
  > optional fields, so older decks open unchanged. Text stays readable on any colour, and colour
  > is never the only way a state is shown. Why: in large diagrams people use colour to show team,
  > phase or status at a glance.
- **`/speckit.plan` hint:**
  > packages/schema: `Node.style`, `ColorRef`, top-level `swatches`; `pnpm schema:generate`; model
  > round-trip cases. packages/ui: named card colour tokens (light/dark) in the Tailwind theme.
  > apps/app: colour picker component shared by toolbar and drawer; contrast helper as a pure
  > function. Run `pnpm bench`.

## 022-connector-style

- **Status (2026-10-03): implemented** (ADR 0024, `specs/022-connector-style`). Relationship types and a legend moved to the Database pack (`docs/backlog-database.md`); a free-number weight became five fixed steps (1, 1.5, 2, 3, 4) with 2 px as the default.
- **Added:** 2026-09-29, founder request during 017 clarify (richer connector options, reference
  screenshots in the conversation: a line toolbar with a Type / weight / dash popover and a
  curved line with waypoint handles). Kept out of 017 so 017 stays at 4 d.
- **Extension points (017, ADR 0019):** `apps/app/src/editor/routing/route-path.ts`'s
  `resolveSides` / `middleSegment` already resolve each end's side and the movable middle segment;
  build line type, waypoints, dash and weight on top of them, not beside them. `Edge.route`
  (`fromSide`, `toSide`, `offset`) is where a schema change for free waypoints or curves goes;
  keep the three existing keys' meaning unchanged so 017 decks stay valid.
- **Milestone:** after M4 · **Depends on:** 017 (route model, handles, hint bar), 020 (colour
  picker, `ColorRef`, deck swatches) · **Estimate:** 5 d (split at `/speckit.specify` if it grows)
- **Menus and toolbar (019):** add this feature's items as an action module in
  `apps/app/src/editor/actions/` (registered in `ACTIONS`), so the connection toolbar (100), the
  connection menu, the drawer and the keys pick them up (ADR 0015).
- **Goal:** Users style connectors with a familiar line toolbar: pick the line shape, the dash,
  the weight and the colour, place the label where it reads best, and make a connector "run" to
  show the direction of a flow at a glance.
- **Spec IDs:** C-6; **schema change** (reverses part of §g-37: 017 stores only sides + one
  middle-segment offset; this feature adds free waypoints (curves moved to 029), so it needs a founder
  decision and an ADR).
- **Design references:** none yet (needs design: connection toolbar "Type" popover, weight
  slider, dash row, colour swatch, label drag, waypoint handles). The founder's line-popover
  screenshots are the reference; the prompt is
  [`claude-design-prompt-connector-style.md`](design/claude-design-prompt-connector-style.md).
- **In scope:**
  - **Line type:** moved to 029 (curved, elbow, straight, §g-64); waypoints below build on it.
  - **Free waypoints** for elbow and curved lines: drag a midpoint handle to add a bend point,
    drag a bend point to move it, double-click (or ⌫) to remove it; Reset route (017) clears them.
    Founder feedback (2026-10-02): 017's segment only moves along one axis (horizontal or
    vertical) and that feels rigid; bends must be free to move in any direction.
  - **Lighter handles** (founder feedback, 2026-10-02): 017's 10×24 px segment pill and endpoint
    grips look heavy. Show small round handles (≈ 8 px) only on hover or while the connector is
    selected, with a larger invisible hit area so they stay easy to grab.
  - **Free anchor points** (founder feedback, 2026-10-03): an end can attach anywhere along a
    card's side, not only at its middle. Dragging an end along a side moves its anchor (stored
    as the side plus a 0–1 fraction, snapping to the middle and the corners); dropping it on the
    card body keeps today's automatic side. Extends 017's `fromSide` / `toSide` (schema change,
    additive, same ADR as waypoints). Interaction from frame 118 c (moved here from 034,
    2026-10-03): the end snaps at 25 / 50 / 75 %, a "left side · 78 %" readout follows the
    pointer, the old route shows dashed until release, Esc cancels.
  - **Bundles (034):** a connector with waypoints, a non-automatic anchor or a style of its own
    never joins a 034 bundle, same as a 017 adjusted route; 034's hover highlight sets colour
    and weight in separate rules, so 022 can keep a styled connector's colour and still thicken it.
  - **Dash:** solid (default), dashed, dotted.
  - **Weight:** a slider with a few fixed steps (e.g. 1–6 px); default = today's 1.5 px.
  - **Colour:** 020's palette, the deck's custom swatches and "No colour".
  - **Label position:** drag the label along the line (stored as a fraction of the path length,
    0–1, default 0.5), so it can sit near an end or away from a bend; it stays on the line when
    cards move.
  - **Animated line:** a per-connector toggle that makes the dashes run from source to target (or
    both ways for bidirectional connectors), to show flow direction. Off by default; static under
    reduced motion and in PNG / SVG export.
  - Applies to a multi-selection of connectors in one undo step; drawer fields and keyboard
    access for every option; round-trip and parity tests.
- **Later (not in this feature unless cheap):** **line jumps** (small arcs where two connectors
  cross); arrowhead shapes; line styles for sticky leaders.
- **Out of scope:** automatic obstacle-avoiding routing (011); per-view styles (styles are shared
  by every view, like 017's size and route); flow-mode styling (006/007 keep their own
  highlight, which wins over the connector's style while a flow is shown).
- **Schema (v1, additive, all optional, names to be settled in the ADR):** `edge.style` (created
  by 029 with `shape`, ADR 0022): `{ "dash"?: "solid"|"dashed"|"dotted", "width"?: number,
"color"?: ColorRef, "animated"?: boolean }`; `edge.route.waypoints?: Position[]` (how they relate
  to 017's `offset` is decided in the ADR); `edge.labelAt?: number` (0–1). Absent = today's look.
- **Acceptance criteria (draft):**
  - Given a selected connector, When the user picks "Curved", Then the line is a smooth curve
    between the same sides, the JSON shows `"style": { "shape": "curved" }`, and one ⌘Z restores it.
  - Given an elbow connector, When the user drags its midpoint handle, Then a bend point is added
    where it is dropped and stored in `route.waypoints`; double-clicking it removes it.
  - Given three selected connectors, When the user picks "Dashed" and weight 3, Then all three
    change in one undo step.
  - Given a connector label, When the user drags it towards the source end, Then it stays on the
    line at that fraction when either card moves.
  - Given "Animated" on, When reduced motion is set, Then the line is drawn static; the direction
    stays readable from the end dots / arrowheads (not from motion alone).
  - Given a deck without any of these fields, When opened, edited and exported, Then they are
    still absent.
  - Given the bench deck with 200 animated connectors, When panning, Then ≥ 60 fps.
- **Risks:** waypoints vs 017's offset (one route model, not two); curves and labels in export
  (012); animation cost on large decks (CSS-only, paused off-screen); colour on connectors must
  not be the only cue for flow, error or selection states (constitution VII).

## 023-hybrid-canvas-renderer

- **Added:** 2026-09-30, architecture review ("the app feels boxed in for dense graphs such as
  logistics networks"). Not scheduled; needs a founder go-ahead.
- **Milestone:** later (after M5) · **Depends on:** 010 (levels, visible graph), 012 (export
  scene) · **Estimate:** 8 d (split at `/speckit.specify`: gate + culling, then far-zoom layer,
  then bundling)
- **Goal:** Decks with thousands of components and connections stay smooth to pan, zoom and
  read, without changing how anyone edits a diagram.
- **Why hybrid, not a rewrite:** ADR 0006 / 0011 already make the canvas a pure view
  (Yjs → snapshot → `visibleGraph` → `deck-to-flow` → React Flow), and ADR 0016's
  `editor/export/scene.ts` already turns a deck into positioned shapes without React Flow. A
  second, non-interactive layer can draw from that scene. React Flow keeps every interaction
  (drag, connect, marquee, snapping, frames, roving tabindex, quick edit, popovers), so model,
  schema, storage, flows, rules, JSON panel and inspector do not change.
- **In scope:**
  - **Step 0 (gate):** the plan in `docs/performance.md` (fix today's misses, measure load,
    snapshot, derivation, autosave and memory at 2,000 / 5,000 / 10,000 nodes, bench budget in
    CI). If React Flow with culling meets the targets at the sizes users need, stop here and
    record that in the ADR.
  - **Viewport culling off the main thread:** a spatial index (R-tree) over the derived scene,
    built and queried in a worker, feeding `visibleGraph` the ids inside the viewport plus a
    margin. It is also used for hit-testing the far-zoom layer.
  - **Far-zoom layer:** at `landscape` / `system` levels (or above a node-count threshold),
    draw components and connections as Canvas 2D shapes from the export scene; nothing is
    mounted in React Flow. Zooming in or selecting hands over to the DOM layer at the same
    positions, with no visible jump. WebGL only if Canvas 2D is measured too slow.
  - **Accessibility:** the far-zoom layer is `aria-hidden`; the canvas keeps one Tab stop and
    the roving focus moves over the same ids, and focusing a component zooms to the DOM layer
    (constitution VII).
  - **Edge bundling (last, optional):** a pure bundling pass in a worker for plain edges at far
    zoom. Merged edges of collapsed groups (010) stay as they are. Off in flow mode.
- **Out of scope:** replacing React Flow for editing; WebGL text; changing the file format;
  new semantic zoom levels (024 may make them configurable).
- **Acceptance criteria (draft):**
  - Given the bench deck at the size agreed in step 0, When panning and zooming at fit, Then
    ≥ 60 fps and p95 frame ≤ 16.7 ms.
  - Given 500 / 1,000, When a flow is selected, Then its marks are painted in < 100 ms.
  - Given the far-zoom layer is shown, When the user zooms into a component, Then the DOM card
    appears at the same place and the JSON panel and export are byte-identical before and after.
  - Given keyboard focus on the canvas at far zoom, When the user presses an arrow key, Then
    focus moves to the nearest component and it is announced as today.
  - Given the smoke suite, When run against the production build, Then it passes and no
    third-party request is made.
- **Risks:** two drawings of the same card drifting apart (one scene, one palette, a visual test
  against export); hand-over jank between layers; new runtime dependency for the R-tree
  (`rbush` or similar, needs approval, or a small in-repo index); worker transfer cost on every
  drag (index updates must be incremental).
- **`/speckit.plan` hint:**
  > apps/app: bench generator sizes + report rows; `editor/scene-index` worker (build, update,
  > query); `Canvas` gets a far-zoom `<canvas>` under React Flow drawn from `export/scene.ts`
  > and `export-palette.ts` (dark palette needed); level selector decides which layer is live.
  > ADR "hybrid canvas renderer". Run `pnpm bench` before and after every step.

## 024-domain-kind-packs

- **Superseded by 030-card-types-and-packs (2026-10-03).** Kept for its analysis of where kinds
  are hard-coded and the schema options.
- **Added:** 2026-09-30, architecture review. Not scheduled; needs a founder decision on open
  kinds before `/speckit.specify`.
- **Milestone:** later (after M5) · **Depends on:** 001 (schema), soft: 020 (colour tokens,
  swatches) · **Estimate:** 6 d
- **Goal:** Model systems other than software architecture (logistics networks, business
  processes, org and data flows) with their own component kinds, icons and zoom levels, while
  every existing deck opens and behaves exactly as today.
- **Today:** `NodeKind` is a closed enum (`client`, `gateway`, `service`, `queue`, `database`,
  `external`) and `Level` is C4-shaped (`landscape` → `component`). Kinds are hard-coded in
  `packages/ui/src/lib/icons.ts`, `editor/palette-order.ts`, `editor/export/icon-paths.ts`,
  `export-palette.ts`, views (`hiddenKinds` / `dimmedKinds`), the library thumbnail and the
  connection rules.
- **In scope:**
  - **Kind pack:** a named set of kind definitions (id, label, icon from `lucide-react`, default
    colour token, allowed connections) plus the level names for semantic zoom. The built-in
    "Software architecture" pack is today's six kinds and four levels, byte for byte.
  - **Deck-level choice:** a deck uses one pack (default: software architecture). A few more
    built-in packs (e.g. logistics: hub, warehouse, carrier, route point, customer, supplier;
    business process: actor, activity, decision, document, system).
  - **Custom kinds in the deck:** the deck file can define extra kinds (id, label, icon key,
    colour); the palette, views, inspector, export and thumbnails read kinds from one registry
    instead of the enum.
  - **Migration:** decks without the new fields are software-architecture decks; no rewrite on
    open.
- **Out of scope:** user-defined typed attributes (see "Later" below); a pack marketplace or
  sharing packs between decks; per-pack validation rules beyond allowed connections.
- **Schema (decision needed, ADR):** option A, additive in v1: keep `kind` as the enum and add
  optional `node.type` referring to a top-level `kinds` array (`kind` stays the fallback for
  older builds). Option B, v2: `kind` becomes a string resolved against the pack, with a v1 → v2
  migration in `@sododeck/model`. A is safer for existing files; B is cleaner long term. Either
  way: Ajv/Zod parity, round-trip cases, and stable kind ids (renaming a kind label never breaks
  references, constitution III).
- **Acceptance criteria (draft):**
  - Given a deck saved before 024, When opened, edited and exported, Then its JSON has no new
    fields and every card looks as before.
  - Given a new deck with the logistics pack, When the user opens the add palette, Then it lists
    the pack's kinds with their icons, and the semantic zoom levels use the pack's names.
  - Given a custom kind "Cold storage" added to the deck, When it is renamed "Cold room", Then
    every card of that kind keeps it and the JSON shows the same kind id.
  - Given a view that hides a custom kind, When the view is applied, Then those cards are hidden
    as with built-in kinds.
- **Risks:** file-format change (older builds reject unknown kinds under option B); every
  hard-coded kind lookup must move to the registry (easy to miss one, so add a test that no app
  code imports the enum values directly); icons must stay bundled (constitution IV);
  "allowed connections" may overlap with 015's problems.
- **`/speckit.plan` hint:**
  > packages/schema: kinds / pack fields, `pnpm schema:generate`, parity test; packages/model:
  > round-trip + migration cases; packages/ui: icon registry keyed by icon id, not kind;
  > apps/app: `kind-registry.ts` (pure) used by palette, views, inspector, export, thumbnail,
  > connection rules. ADR "domain kind packs".

## 025-format-compatibility

- **Added:** 2026-09-30, architecture review. Implements ADR 0020 once the founder accepts it.
- **Deferred** (founder, 2026-10-03, §g-81): no users yet, so files from older builds are not
  handled during development. Picked up before the first public release; spec draft in
  `specs/025-format-compatibility/`.
- **Milestone:** before the first public release (ideally before 022 ships more optional fields;
  017 and 020 already have) · **Depends on:** 005 (library, deck channel) · **Estimate:** 2 d
- **Goal:** A deck written by a newer Sododeck never breaks an older one: an older tab, a
  rolled-back deploy or an older import opens it read-only with a clear "Reload to edit" banner,
  instead of rejecting edits with no explanation.
- **Spec IDs:** G-3 (import/export); **schema change** (optional root `revision`).
- **In scope:** `FORMAT_REVISION` in `@sododeck/schema` plus a hash test on `v1.json`; optional
  root `revision` written on export; `formatRevision` on the Dexie deck record, raised on flush;
  `hello` on the deck channel carries the revision; read-only editor mode + banner (canvas, JSON
  panel, playback and export still work); import of a newer-revision file stores it unchanged and
  opens it read-only; model test that ops keep unknown keys.
- **Out of scope:** tolerant schema, per-field feature flags, migrations (ADR 0002 §6 covers
  breaking changes).
- **Acceptance criteria (draft):**
  - Given a file with `"revision"` higher than the app's, When it is imported, Then it is stored,
    opens read-only with the banner, and exporting it gives the same file.
  - Given two tabs on the same deck where one has a newer build, When the older tab receives the
    `hello`, Then it goes read-only with the banner and Reload brings it to the new build.
  - Given a deck without `revision`, When it is opened, edited and exported, Then the JSON panel
    never shows `revision` and the export carries the app's revision.
  - Given a change to `v1.json` without a `FORMAT_REVISION` bump, When CI runs, Then a test fails.
- **Risks:** the read-only mode must cover every write path (canvas, quick edit, drawer,
  shortcuts, paste, layout); do it with one flag checked in `DeckEditor`, not per surface.

## 026-diagram-as-code

- **Added:** 2026-09-30, architecture review. Picks up the deferred part of 004 (`TODO(C-5)`,
  §g-3, §g-42).
- **Milestone:** later (after M5) · **Depends on:** 004, 018 (JSON overlay), 025 · **Estimate:**
  8 d (split at `/speckit.specify`: editable JSON, then importers)
- **Goal:** The deck is data that people and tools can write, not only draw. Developers edit the
  JSON directly and bring existing diagrams in, so a new user starts from their real system
  instead of an empty canvas.
- **Spec IDs:** C-5 (two-way sync), G-3 (import).
- **In scope:**
  - **Editable JSON panel:** Monaco with the bundled schema (autocomplete, inline errors, no
    schema request); edits apply to Yjs on a valid parse as one undo step through
    `@sododeck/model` (the only JSON → Yjs path, constitution I–II); invalid JSON never touches
    the document; selection tab edits one object, deck tab edits all.
  - **Paste a deck:** pasting a whole `.sododeck.json` on the canvas or library imports it.
  - **Importers (run in a worker):** Mermaid `flowchart` (nodes, edges, subgraphs → groups),
    Structurizr DSL (people, systems, containers, components → kinds and levels), OpenAPI (one
    service, its endpoints as notes or features). Each maps to the schema, gives stable ids from
    the source ids, and lays out nodes without positions with the ELK worker.
  - An import report: what was mapped, what was skipped and why.
- **Out of scope:** export to those formats (Mermaid export is already in M5 "later"); live
  sync with an external file; Terraform / Kubernetes importers (later, if asked).
- **Acceptance criteria (draft):**
  - Given the deck tab of the JSON panel, When the user changes a node's `title` and the JSON is
    valid, Then the card updates, and one ⌘Z restores it in both places.
  - Given invalid JSON, When the user types, Then the error is shown inline and the canvas does
    not change.
  - Given a Mermaid flowchart with 30 nodes and 2 subgraphs, When imported, Then the deck has 30
    components, 2 groups, the same edges, and a readable automatic layout.
  - Given an import, When it completes, Then no network request has been made (constitution IV).
- **Risks:** two-way sync fighting the user's cursor (apply on pause or explicit Apply, decided
  in the ADR); the importers are new parsers (new dependencies need approval; prefer small
  in-repo parsers for the subsets we support).

## 027-ai-deck-skill

- **Added:** 2026-09-30, founder request: a skill, like the diagram skills for AI agents, that
  lets users generate a deck with their own AI and then just import it.
- **Milestone:** later · **Depends on:** 001 (schema), 025 (revision); soft: 024 (kind packs),
  026 (paste a deck) · **Estimate:** 3 d
- **Goal:** Users describe a system (or point their agent at a codebase) and get a valid
  `.sododeck.json` with components, connections, groups, flows and rules, ready to import. The AI
  runs on the user's side, so Sododeck still never sends diagram content anywhere
  (constitution IV).
- **In scope:**
  - **A skill package** (`SKILL.md` + references + scripts) for Claude Code / Claude.ai skills
    and similar agents (Codex, others via a plain `AGENTS.md`-style prompt):
    - how to model a system as a deck: kinds and levels, groups, flows with steps and branches,
      decision tables, stickies; stable, readable ids (never from titles, constitution III);
      when to omit positions so the app lays out;
    - the bundled `v1.json` and a few example decks (small, logistics once 024 exists);
    - `validate` script (Node, bundled Ajv or the generated Zod, no network) that checks the file
      and prints fixable errors, so the agent loops until it is valid;
    - modes: from a description, from a codebase (read services, queues, databases, calls), from
      an existing Mermaid / C4 text.
  - **Generated, not hand-kept:** a build step in this repo writes the skill's schema, examples
    and `revision` from `packages/schema`, so the skill is never behind the app. Lives in
    `skills/sododeck-deck/` (or `packages/skill/`), published as a public download or repo
    while the app stays closed source.
  - **App side:** import already exists (005). Make sure a deck without positions is laid out on
    import (check; add if missing) and that the import error lists schema issues with paths, so
    the user can paste them back to their AI.
  - **Docs page** on sododeck.com: install the skill, a prompt example, import.
- **Out of scope:** an AI feature inside the app or any hosted AI (would send content, and needs
  its own decision); an MCP server (later, next to the CLI).
- **Acceptance criteria (draft):**
  - Given the skill and the prompt "an e-commerce checkout with web, API gateway, order service,
    payment provider, Kafka and Postgres, plus the checkout flow", When an agent runs it, Then it
    writes a file that passes `validate` and imports without errors.
  - Given that file imported, When opened, Then components are laid out automatically and the
    checkout flow plays step by step.
  - Given a schema change in this repo, When the skill build runs, Then its bundled schema and
    `revision` match the app's (test).
- **Risks:** quality of AI-written decks (examples and the validate loop matter more than prose);
  skill formats differ per agent (keep the core as plain Markdown + a Node script); publishing the
  schema publicly (ADR 0002 already plans `https://sododeck.com/schema/v1.json`).

## Card system, direction B "Deck" (028–035)

Founder picked direction **B · Deck** on 2026-10-03 (§g-63) from the three Claude Design boards in
`Sododeck Cards.dc.html` + `sododeck-cards.js` (Claude Design project "Sododeck"). Requirements:
[`claude-design-prompt-card-system.md`](design/claude-design-prompt-card-system.md) (§g-61,
§g-62). B in one line: cards are thick paper (a solid 3px lip in the stroke colour, 14px corners,
filled pill chips), connectors are 2px smooth curves, and playing a flow **deals the deck** (✓
stickers on played cards, the current card lifts on an orange lip, upcoming cards wait with a
dashed number); a collapsed group is a fanned hand of cards. The design's own risk note is kept as
a rule: on dense boards drop the lip below 60 % zoom and show chips as dots at System level.

Order (§g-64, §g-65, §g-81): **028 → 036 → 037 → 029 → 035 → 033 → 022 → 030 → 032 → 031 → 034**,
then 025 → 013 → 014 → 026 → 027 → 023. 030 supersedes 024.

## 028-design-sync-card-system

- **Status:** implemented (2026-10-03) — see [`spec.md`](../specs/028-design-sync-card-system/spec.md). Design files, screenshots 117–127, design-analysis §a–§c and DESIGN.md "Card system (Deck)" with the extended palette are in the repo. Importing found fifteen mismatches (§g-66–§g-80: palette fill / stroke vs 020, card width, weight 600, problem state, detail per zoom level, tag size and others), each with a default for 029–035 to confirm.
- **Added:** 2026-10-03 · **Milestone:** after M4 · **Depends on:** — · **Estimate:** 1 d
- **Goal:** The card system design is in the repo as the reference for 029–035, like 021 did for
  the canvas-first frames.
- **In scope:** read-only copies of `Sododeck Cards.dc.html` and `sododeck-cards.js` in
  `docs/design/claude-design/`; screenshots of **board B** (every row, light and dark) as
  `docs/design/screens/117-…`; design-analysis §a entries for the new frames and §g notes for
  every mismatch with DESIGN.md or founder decisions; a **DESIGN.md "Card system (Deck)"** section
  with B's tokens (radius 14 card / 20 frame / pill chips; 1.5px Border-strong `#cfcfc7` /
  `#45453f` or the colour stroke; lip `0 3px 0` in the stroke colour, 5px hover and current, 6px
  dragging, no blur; title 14/600 1.28, type name 11.5/500, body 12, field chips 11.5/500 and tags 10.5/500 (§g-75); 184 wide,
  12 padding, 8 gap; solid-tint chips at L .915 / .39 with same-hue ink L .42 / .90; 12px round
  handles, 16px orange with a 4px halo when active; 2px curved connectors with a rounded filled
  arrow and a 3.5px start knob) and the extended palette (each of the 13 colours gains `chip`,
  `ink` and `dot` next to `fill` / `stroke`, light and dark, from the design's OKLCH values).
- **Out of scope:** code.
- **Acceptance criteria:** every B row has a light and dark screenshot in `screens/`; DESIGN.md
  names every token 029 uses; the palette table lists hex + OKLCH for all five variants.

## 029-card-look-deck

- **Status:** implemented (2026-10-03), see [`spec.md`](../specs/029-card-look-deck/spec.md).
  Bench (`bench-after.md`): pan 52 to 54 fps vs 54 to 55 before (about 1 to 2 fps lower, same long
  frames), drag, group drag and playback at baseline. A first run showed pan 45 fps and drag 29 fps
  from the arrow `rotate()` transform; fixed by baking the rotation into the path. Open items:
  palette search at 2,000 cards is 51 ms vs 37 ms (target 50); the visual check
  (`visual-check.md`) and quickstart walk (`quickstart-results.md`) cover only the card, colours,
  selection and line types, not groups, zoom levels, tags, problem and drag states, nor a
  greyscale capture; T063 and T064 stay open.

- **Added:** 2026-10-03 · **Milestone:** after M4 · **Depends on:** 028, 036 · **Estimate:** 6 d
- **Goal:** Today's cards, groups, handles and connectors take B's look; connectors get a
  user-chosen line type (the only schema change).
- **In scope:**
  - **Card frame:** 184 × content, 14px radius, 1.5px border, the solid lip (stroke colour; 5px on
    hover and the current flow step, 6px and a −2.5° tilt while dragging), header with the type
    icon in a 24px rounded tile and the type name, title up to 3 lines (14/600), description up
    to 3 lines, tags as solid-tint pills. `cardSize` / `card-tags.ts` switch to B's metrics, still
    computed, still the same at every zoom (§g-58, §g-59).
  - **States:** selected (2px orange outline, offset 2), problem (1.5px dashed Clay outline,
    offset 4, plus a Clay-soft badge with the count), dimmed 22 %, connection target (orange
    border, handles shown), has children, hover (lip 5px, lift 2px).
  - **Handles:** 12px round knobs, 16px orange with a 4px halo when active; never React Flow's
    grey dots.
  - **Collapsed group:** a fanned hand (the design's `stack`), name and member count; merged
    connectors meet it (§g-62).
  - **Connectors:** 2px, B's edge colour, rounded filled arrow, 3.5px start knob.
  - **Line type, chosen by the user (founder, 2026-10-03, §g-64):** **curved** (B's default),
    **elbow** (orthogonal, today's routing with 017's movable segment) and **straight**. Picked
    per connector from the connection toolbar, the context menu and the drawer, for a
    multi-selection in one undo step. Stored as optional `edge.style.shape`
    (`'curved' | 'elbow' | 'straight'`, additive schema change, ADR). Absent = curved, except an
    edge with a stored 017 `route.offset`, which stays elbow so its tweak is kept. 017's segment
    handle only shows on elbow lines. Moved here from 022.
  - **Zoom rules:** lip off below 60 %; chips become dots at System; Landscape shows the type
    icon on the colour fill (B's `land` plate).
  - **Palette:** the 13 colours get B's `chip` / `ink` / `dot` tokens (light, dark), contrast-tested.
  - **Export:** PNG / SVG draw B's frame, lip and tags (today's export leaves the tag area empty).
- **Out of scope:** flow playback styling (035), shapes (031), typed fields (032), deck tag colours
  (033).
- **Acceptance criteria (draft):**
  - Given any existing deck, When opened, Then every card renders in the Deck look and the JSON is
    unchanged.
  - Given a card on the bench deck, When zooming from 30 % to 400 %, Then its on-canvas size never
    changes; the lip disappears below 60 % and chips turn into dots at System.
  - Given a card selected with a problem, Then the selection and the problem read without colour
    (outline style and badge icon).
  - `pnpm bench` before / after: no regression in pan FPS or long frames (200 lips are one extra
    box-shadow each).
- **Risks:** noise on dense boards (the design's own warning); cards ~20 % taller, so fewer fit
  per screen; the tilt while dragging must not affect snapping or hit tests.

## 030-card-types-and-packs

- **Status:** built (2026-10-03, `specs/030-card-types-and-packs`, ADR 0025). Basic shapes, start / end and actor, and default fields per type stay with 031 and 032.
- **Added:** 2026-10-03 · **Milestone:** after M4 · **Depends on:** 029 · **Estimate:** 5 d
  · **Supersedes:** 024
- **Goal:** Card types are data, grouped in packs a deck turns on (§g-61 D1, D10).
- **In scope:**
  - **Type registry:** a type is `{ id, family: 'card' | 'shape', shape?, icon, name, category,
accent, defaultFields, fieldsOnCard }`. Built-in packs: Architecture (service, database,
    gateway, client, queue, external, component), Process (task, decision, document, start/end,
    actor), Logistics (warehouse, truck route), Data cards (issue), Basic shapes. Today's six kinds
    map to Architecture types byte for byte.
  - **Packs per deck:** on / off (`deck.packs`); turning a pack off hides its types from Add, and
    cards already on the board keep rendering (design copy).
  - **Add flyout** (B's "Card type palette" row): search with `/`, category tabs (All ·
    Architecture · Process · Logistics · Data · Shapes), sections of 3-column tiles, "Packs · N on"
    footer opening the packs panel.
  - Everything that switches on the kind today (icons, palette order, export icons and palette,
    views' hidden / dimmed kinds, thumbnails, connection rules) reads the registry.
- **Schema:** change + ADR (024's options A / B): stable type ids, older decks read as the
  Architecture pack, Ajv/Zod parity and round-trip cases.
- **Out of scope:** user-defined types, a pack marketplace, BPMN / C4 / cloud packs (shown "off" in
  the design as future packs).
- **Acceptance criteria (draft):** a deck saved before 030 opens unchanged; turning Logistics on
  lists its types in Add; turning it off hides them while existing warehouse cards still render;
  renaming a type label never changes the stored type id.

## 031-shapes

- **Status:** built (2026-10-03, `specs/031-shapes`, ADR 0026): eleven shapes, Show as card / shape (`node.display`), the Frame tool (Frame = Group), Sticky and Text tiles, empty groups drawn.
- **Added:** 2026-10-03 · **Milestone:** after M4 · **Depends on:** 030 · **Estimate:** 5 d
- **Goal:** The shape family: real geometry with centred text (§g-61 D2).
- **In scope:** rectangle, rounded rectangle, ellipse, diamond, pill (start / end), cylinder,
  document, parallelogram, hexagon, actor, sticky, text, frame, in B's look (1.5px stroke, lip
  where the outline allows it); text up to 3 lines; connectors meet the outline, not the bounding
  box; resize keeps the geometry; in-between types (decision, database, document) switch "show as
  card ↔ show as shape" from the toolbar and drawer, keeping id, fields and connections.
- **Out of scope:** free drawing, arbitrary SVG shapes, rotation.
- **Acceptance criteria (draft):** a decision shown as a diamond connects at its points; switching
  it to a card and back keeps every connection and field; export draws the geometry.

## 032-typed-fields

- **Status:** built (2026-10-03, `specs/032-typed-fields`, ADR 0027). Field definitions per type with defaults (frame 120), Tech / Host / Owner in the list, the drawer field editor, the card's fields block and export, search, bulk, clipboard and Problems. Values are stored one document key per card and field (ADR 0027 §5).
- **Added:** 2026-10-03 · **Milestone:** after M4 · **Depends on:** 030 · **Estimate:** 5 d
  (split at `/speckit.specify` if it grows) · **Lifts:** §g-40
- **Goal:** Users add typed fields to cards and choose which show on the card (§g-61 D3).
- **In scope:** field definitions per type in the deck (default fields from the type plus user
  fields); kinds text, number, coloured select, status, person (free text with initials), date,
  date range, link, progress; "show on card" per field; B's display (status, select, person, date,
  range as pills in a wrapping row; number, link, progress, text as label–value rows; a dashed
  "+N fields" pill when more stay in the drawer); the field editor in the drawer (add field, pick
  its kind, toggle "show on card"); card height follows the fields shown.
- **Schema:** change + ADR (deck-level `fields` definitions, `node.values`); today's tech, host,
  owner become built-in fields with unchanged storage (ADR 0022).
- **Out of scope:** formulas, relations between cards, per-view field visibility.
- **Acceptance criteria (draft):** a "Status" select added to the Task type shows as a pill on
  every task with a value; toggling "show on card" off moves it to the drawer and shrinks the
  card; older decks open unchanged.

## 033-deck-tag-colours

- **Added:** 2026-10-03 · **Milestone:** after M4 · **Depends on:** 029 · **Estimate:** 3 d
- **Goal:** Tags are defined once per deck with a colour (§g-61 D7).
- **In scope:** a deck-level colour per tag (`tagColors`, named colour or deck custom hex);
  B's tag picker (search, the deck's tags with colour and usage count, "Create tag “…” ⏎",
  pencil to edit); tag editor (name, 13 swatches plus deck colours, "Delete tag · used on N
  cards"); drawer tag row (pills with ×, focus ⌫ removes, ⏎ opens the picker); cards show the tag
  colour as a solid-tint pill; still max 10 per card. **Tags keep the case the user typed**
  ("PIC", "Lan"; founder, §g-64): matching and uniqueness ignore case, so "pic" picks the
  existing "PIC", and the first spelling wins. Existing lower-cased tags stay as they are.
- **Schema:** additive (root `tagColors`: tag text → `ColorRef`, ADR 0022; the deck's own `tags`
  are unchanged; a tag with no colour stays valid and renders slate).
- **Acceptance criteria (draft):** colouring `pci` violet recolours it on every card in one undo
  step; deleting a tag removes it from every card after showing the usage count; older decks
  open unchanged.

## 034-connection-focus-and-drill

- **Status:** implemented (2026-10-03), see [`spec.md`](../specs/034-connection-focus-and-drill/spec.md) and [ADR 0023](decisions/0023-derived-connector-bundles.md). Only automatic-route connectors bundle: a connector with its own route or style (a line type today; waypoints, anchors and a style with 022) always draws on its own, and 022 decides whether a styled connector keeps its colour under the Ink highlight (034 sets colour and weight as two rules, so only the colour rule changes).
- **Added:** 2026-10-03 · **Milestone:** after M4 · **Depends on:** 029 (only; runs in parallel with 033 and 035) · **Estimate:** 4 d
- **Goal:** B's "Connections and focus" row (§g-62, from the founder's reference video).
- **In scope:** hovering or selecting a card highlights its connections and neighbours and dims
  the rest (today's focus mode, on hover, without a toggle); parallel connectors between the same
  cards bundle into one curve with a count; drill-in shows "Inside <card>" with dashed **outside**
  proxy cards for its external connections (restyle today's port pills).
- **Out of scope / later:** an end moved along a side (frame 118 c) belongs to 022's free anchors
  (founder, 2026-10-03); relationship types with their own colour and dash (calls, reads,
  writes, depends on) and the header legend with counts: needs `edge.relation` (schema) and
  belongs with 022.
- **Acceptance criteria (draft):** hovering a card on the bench deck dims non-neighbours within one
  frame and restores on leave; three connectors between two cards draw as one bundle "×3".

## 035-flow-playback-deck

- **Status:** specified and planned (2026-10-03) — see [`spec.md`](../specs/035-flow-playback-deck/spec.md), [`plan.md`](../specs/035-flow-playback-deck/plan.md), [`tasks.md`](../specs/035-flow-playback-deck/tasks.md). **Open:** the branch picker stays inline in the step player (007) instead of the popover of frame 117; confirm or open a follow-up.
- **Added:** 2026-10-03 · **Milestone:** after M4 · **Depends on:** 029 · **Estimate:** 3 d
- **Goal:** The signature moment (§g-62): playing a flow deals the deck.
- **In scope:** played cards get a ✓ sticker (top-left, 22px), the current card lifts 2px on a 5px
  orange lip with a 26px orange number sticker, upcoming cards show a dashed number; the token
  is a numbered disc; branch points and error paths in B's style; dimmed rest at 22 %; static
  under reduced motion (stickers and lip stay, no lift animation); readable without colour.
- **Acceptance criteria (draft):** stepping through "Checkout" moves the orange lip and sticker to
  the current card and adds ✓ to played ones; under reduced motion nothing animates; `pnpm bench`
  "next step → current painted" stays within target.

## 036-collab-ready-document

- **Status:** implemented (2026-10-03) — see [`spec.md`](../specs/036-collab-ready-document/spec.md), [`plan.md`](../specs/036-collab-ready-document/plan.md), [`tasks.md`](../specs/036-collab-ready-document/tasks.md), [ADR 0021](decisions/0021-collab-ready-document-layout.md) (layout 2) and [ADR 0022](decisions/0022-schema-roadmap.md) (schema roadmap). **Open:** storage load is 31–35% slower than before, beyond SC-006's 10% ([`bench-after.md`](../specs/036-collab-ready-document/bench-after.md)); needs the founder's acceptance before merge. The two-tab manual walk ([`quickstart-results.md`](../specs/036-collab-ready-document/quickstart-results.md)) is still to do.
  The spec narrows "integrity on receive": content is kept and reported, only content-free
  leftovers are repaired (FR-020 / FR-021).
- **Added:** 2026-10-03, schema / scale / collaboration review with the founder (§g-65). No real
  users yet, so the stored layout can change now at almost no cost.
- **Milestone:** before 029 · **Depends on:** — · **Estimate:** 6 d (split at
  `/speckit.specify` if it grows)
- **Goal:** The Yjs document and the file format are ready for the schema changes of 029–032 and
  for a later server and real-time collaboration, without changing what users see.
- **In scope:**
  - **Collections keyed by id.** `nodes`, `groups`, `edges`, `stickies`, `views`, `features`,
    `flows` and each flow's `steps` become `Y.Map<id, Y.Map>` with an `order` key (fractional
    index) instead of `Y.Array<Y.Map>`. Lookups stop being linear; a reorder changes one key
    instead of delete + re-insert, so a concurrent edit of the moved object is kept and two
    clients moving it cannot duplicate it (ADR 0005 consequences).
  - **Long text as `Y.Text`.** Descriptions, step notes, sticky text and other markdown fields
    merge letter by letter (ADR 0005 §2 upgrade path). Short fields (titles, labels) stay plain
    strings, last write wins (decide the exact list in the ADR).
  - **Integrity on receive.** Updates from another tab (later another client) are not validated
    by the writer's Zod check. After each remote transaction, run the integrity check, report
    breakage as problems (ADR 0013) and repair what is safe to repair automatically (e.g. a
    duplicated id from a concurrent paste gets a fresh id and its references follow).
  - **No layout version and no migration** (founder, 2026-10-03, §g-81 / §g-82): decks stored
    before 036 are not supported; export to `.sododeck.json` before upgrading and import after.
    Opening an old stored deck ends in the existing "can't open" outcome, never a crash.
  - **One schema roadmap ADR** naming every field 029, 033, 022, 030 and 032 will add
    (`edge.style.shape`, waypoints, free anchors, dash / width / colour, `labelAt`; deck tag
    definitions; the card type registry and packs; field definitions and values), so the format
    grows by design rather than five separate patches.
  - **Deck identity.** Deck ids are already `crypto.randomUUID()`; record in the ADR that they are
    the global id (the future server room name) and never reused.
  - **Collapsed groups stay shared** document data per view (founder, 2026-10-03, §g-82);
    recorded in the ADR.
- **Unchanged:** the `.sododeck.json` file format (arrays in file order, canonical key order,
  ADR 0004 / 0005 §6): `toJSON` / `serializeDeck` output is byte-identical before and after.
- **Out of scope:** a server, accounts, presence (awareness), sharing, permissions.
- **Acceptance criteria (draft):**
  - Given any valid file, When imported and exported, Then the text is byte-identical to the
    export before 036.
  - Given two tabs, When one reorders a flow's steps while the other edits a step's title, Then
    both changes survive and no step is duplicated.
  - Given two tabs typing into the same node description at once, Then both texts survive.
  - Given a remote update that leaves an edge pointing at a deleted node, Then the problems panel
    lists it within one change event.
  - Round-trip and Ajv / Zod parity tests stay green; `pnpm bench` shows no regression.
- **Risks:** every model op touches the layout (large diff, keep the public API unchanged so
  surfaces do not move); fractional-index keys need tests for interleaved inserts; `Y.Text` must
  not leak into the snapshot API (surfaces keep reading plain strings).

## 037-scale-bench

- **Added:** 2026-10-03 (§g-65) · **Milestone:** before 023 · **Depends on:** 036 · **Estimate:**
  2 d
- **Goal:** Know where Sododeck slows down as decks grow, before deciding on 023.
- **In scope:** `docs/performance.md` §1 and §2: stabilise the flaky flow scenario (warm-up,
  median of more runs), then measure at 500 / 2,000 / 5,000 / 10,000 nodes (edges ×2) with
  `onlyRenderVisibleElements` on and off: load (IndexedDB → Yjs → first paint), snapshot update
  per transaction, `visibleGraph` + `toFlowNodes` / `toFlowEdges`, autosave flush and compaction,
  update-log bytes, multi-tab convergence after a large paste, JSON panel, export, ELK layout,
  JS heap. Record the baseline and a target per row in `docs/performance.md`.
- **Out of scope:** fixes (each miss becomes its own item), CI budget (§3, later).
- **Acceptance criteria:** the table in `docs/performance.md` §2 has numbers for every row at
  every size, from a run anyone can repeat with `pnpm bench`.

## 038-card-icons

- **Status:** built (2026-10-04) — see [`specs/038-card-icons/`](../specs/038-card-icons/) and
  ADR 0028.
- **Added:** 2026-10-03, founder request: cards only show the icon of their type; users want to
  pick their own.
- **Milestone:** after 036 · **Depends on:** 036 (model writes), coordinate with 029 (card header
  tile) and 030 (type registry) · **Estimate:** 4 d
- **Goal:** A user picks an icon for one or more cards from a searchable picker. Lucide is the only
  icon pack for now; the format and the code accept more packs later (e.g. Simple Icons for brand
  logos) without a file format change or a migration.
- **Founder decisions (2026-10-03):**
  - **Lucide only for now** (ISC, already a dependency, matches the stroke style). Simple Icons
    (CC0, brand logos, trademark rules) is a later pack, not part of 038.
  - **Curated set of about 300 lucide icons** grouped by category, not the whole set; adding
    an icon is a data change.
  - **Extensible by design:** an icon reference names its pack and its icon (`"lucide:server"`);
    a reference without a pack means lucide, so the existing `icon: "server"` stays valid.
  - **The type name stays.** A custom icon replaces the icon in the card's type tile (and the
    Landscape plate of 029); the type name next to it is unchanged.
- **In scope:**
  - Icon picker (search by name and keywords, groups, "Used in this deck", "Reset to type icon")
    from the selection toolbar, the context menu and the drawer's Appearance section;
    multi-selection in one undo step; full keyboard access.
  - One resolver used by every surface (card, outline, drawer, search, Landscape, minimap if it
    draws icons, PNG / SVG export): custom icon → type icon (030 later) → kind icon → fallback.
  - Icon packs as data: id, name, licence, line or solid drawing, entries with keywords. Unknown
    pack or icon: show the type icon, keep the stored reference on save.
  - Export draws icons from the pack data (replaces the hand-copied `icon-paths.ts`).
  - Third-party licence notices for the bundled packs (in the shipped notices file; where they
    show in the app is deferred until the open-source decision, clarified 2026-10-04).
- **Out of scope:** Simple Icons or other packs, uploaded custom icons, icon colour separate from
  the card colours, icons on groups, stickies or connectors.
- **Split to avoid conflicts:** the pack system, resolver, picker component and export can start
  while 036 is in progress (they live in `packages/ui` and the export code); wiring the model and
  the card render waits for 036 to merge and for 029's header tile.
- **Acceptance criteria (draft):**
  - Given a selected card, When the user picks "Server", Then the tile shows it, the type name is
    unchanged, the JSON shows `"icon": "lucide:server"` and one ⌘Z removes it.
  - Given a file with `"icon": "simple:kafka"` (pack not available), When opened and saved, Then
    the card shows its type icon and the saved file still has `"simple:kafka"`.
  - Given a deck with custom icons, When exported to SVG, Then every card shows its custom icon.
  - Round-trip and Ajv / Zod parity green; `pnpm bench` shows no regression.
- **Risks:** bundle size if the whole lucide set is loaded up front; lucide renaming icons between
  versions (aliases needed); solid icons (later packs) must not render as a filled blob in a
  line-drawing renderer.

## Founder feedback batch (2026-10-05, 053–056)

Source: founder's manual testing. Split into four features; small fixes are bundled, the large
ones (images, Mermaid import) stand alone. Suggested order: 053 → 054 → 056 → 055.

## 053-sticky-notes-and-connectors

- **Status:** implemented on `feat-sticky-note-and-connections` (spec `specs/053-sticky-notes-and-connectors/`, ADR 0036); screenshots, quickstart run and the PR (T055, T056) are open.
- **Goal:** A sticky note looks like a sticky note, can be resized, takes part in connections and
  has its own toolbar; several connectors can be selected and edited together.
- **In scope:**
  - Sticky look distinct from a card (shape and paper feel) so it reads as a note at a glance.
  - Resize a sticky.
  - Drag a connector from a sticky to any other item (e.g. comment on a card by linking a sticky
    to it).
  - Sticky stack in the Add flyout (click or drag a note from the pad onto the canvas).
  - Auto-fit text: size follows note size and text length, never cut off (readable minimum);
    optional fixed size.
  - Sticky toolbar: text size, bold, alignment, link, 16-colour palette, expand / collapse,
    pin, lock, delete.
  - Multi-select connectors (shift / marquee) with a floating toolbar (arrow ends, type, colour,
    weight, lock); changes apply to all in one undo step.
- **Out of scope:** new sticky types, sticky templates, comments or threads, convert-to, owner / tags / reactions on stickies.
- **Prompt:** `/speckit.specify 053 from docs/backlog.md: sticky notes and connector multi-select.`

## 054-editor-chrome-polish

- **Status:** built (`specs/054-editor-chrome-polish`). Views are Overview and Flows (no Infra preset); the DBML / SQL drawer always shows the whole schema, and the Selection / Whole schema switch is parked (`TODO(selection-scope)`).
- **Goal:** Fix the editor chrome issues found in manual testing.
- **In scope:**
  - Board settings out of the hamburger menu into a visible place.
  - Views: one "General" and one "Feature" view (names that fit any kind of deck, not only
    architecture).
  - Focus moves into the toolbar, below the Select tool.
  - Auto / Names / Keys / All control: explain it or make it smaller (it takes too much space).
  - "Spread ends evenly": explain it in the UI (label or tooltip).
  - Lock: select all then lock, and lock a group, not only one card at a time.
  - DBML editor in its own right-side drawer, separate from the JSON panel.
- **Out of scope:** new settings, redesigning the toolbar.
- **Prompt:** `/speckit.specify 054 from docs/backlog.md: editor chrome polish.`

## 055-image-support

- **Status:** not started. **Needs an ADR** (file format, storage size, no network with content).
- **Goal:** Upload images, and paste them with Ctrl+V.
- **Open questions:** is an image its own canvas object, or also usable inside cards? Size limits,
  how images are stored in IndexedDB and in the `.sododeck` file, export (PNG / SVG).
- **Prompt:** `/speckit.specify 055 from docs/backlog.md: image support.`

## 056-file-format-and-mermaid-import

- **Status:** not started.
- **Goal:** File extension `.sododeck` (drop the trailing `.json`; old `.sododeck.json` files
  still open) and import of Mermaid text.
- **Open questions:** which Mermaid diagram types (flowchart only, or also ER and sequence).
- **Prompt:** `/speckit.specify 056 from docs/backlog.md: file extension and Mermaid import.`

### Later: user-defined card attributes (not scheduled, §g-40)

Deck-defined typed fields (text, number, select with coloured options, status, date, date range,
person) with values per component and a per-deck choice of which fields show as chips on the card
(like the founder's reference cards: year, status, date range). Needs its own schema design and ADR.
Until then cards show the existing fields. **Now scheduled as 032-typed-fields (§g-61).**
