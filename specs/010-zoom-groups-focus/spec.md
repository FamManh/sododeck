# Feature Specification: Semantic Zoom, Collapsible Groups and Focus Mode

**Feature Branch**: `010-zoom-groups-focus`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "010 (zoom-groups-focus) from docs/backlog.md. Keep large diagrams readable. Users see one level of detail at a time (landscape, system, container, component) and double-click a group to go inside it, with a breadcrumb to go back up. Groups can be collapsed into a single box; connections into a collapsed group merge into one connection showing how many it represents. Focus mode dims everything not directly connected to the selected component. All of this works from the keyboard. Why: 50–100 component diagrams become a tangle and get abandoned; the product rule is "never show everything at once"."

**Sources**: `docs/backlog.md` §010 (scope, acceptance criteria, risks), `docs/spec.md` §7 (V-1 semantic zoom, V-2 collapsible groups, V-3 focus mode; V-5 role-based layers is P1), `docs/design/design-analysis.md` §a (states 13, 19, 64–71), §g-22 (collapse state is UI state in 010, saved per view in 011, never on the group object), §g-23 (derived data such as members and merged edges never appears in the JSON panel or the file), `docs/design/screens/` (light and dark), `specs/003-canvas-basic/spec.md` (zoom 30–200%, fit, group boundary, outline, Delete/Backspace opens the delete confirmation, 60 fps on the benchmark deck), `specs/006-flow-authoring/spec.md` (flow path marks), `specs/007-flow-playback/spec.md` (flow mode, step player; lists flows through collapsed groups as 010), constitution v1.0.0 (principles I–VIII).

**Dependency note**: 010 depends on 003, merged on `main`. The file format already has everything this feature reads: `node.level` (landscape / system / container / component), `node.group`, `node.parent` (parent node one level up) and `group.parent` (nested groups). **No schema change.** Collapse, drill-in, focus and the current level are UI state (§g-22). 007 (flow playback: flow mode, dimming, token, step player) is merged on `main` (`b519550`); User Story 5 builds on it (FR-035–FR-039).

## Scope

**In scope**

- **Semantic zoom** (design 64–67): four detail levels chosen by zoom: Landscape ≤ 45%, System 46–90%, Container 91–150%, Component > 150% (or drilled into a component). Landscape shows groups as solid regions with large labels and components as kind tiles only, with faint connections; System shows titles only; Container shows title + tech; Component shows full cards (title, tech, owner, tags, rule marker). A level indicator (4 bars + level name) sits in the zoom control and opens a menu to jump to a level.
- **Drill-in** (design 19, 66, 67): double-click a group or its label (or Enter on a selected / focused group) to show only its members, fitted into view; drill into a component that has child components (`parent`) to see its children at Component level, with outside connections shown as dashed port pills at the edge (click → go up and select that component). The top-bar breadcrumb adds one crumb per level ("Deck › System view › Core services"); clicking a crumb, Esc or Backspace (nothing selected) goes up one level. The outline shows the drilled scope with an "Up" row.
- **Collapsible groups** (design 68–70): a chevron in the group label (on hover and keyboard focus) and Space collapse / expand a group; a collapsed group renders as a node-sized stacked card with its name and "n nodes · m edges"; connections between the group and each outside neighbour merge into one connection with a "×N" pill and a direction icon; hovering or focusing a merged connection opens a popover listing the underlying connections (label + direction); choosing a row expands the group and selects that connection. The group inspector shows a Collapsed toggle, the merged-connections list and "Expand group".
- **Focus mode** (design 13): a Focus toggle and F key; the selected component and its direct neighbours stay at full opacity, everything else is dimmed and non-interactive; connections between them are highlighted with their labels.
- **Flow through a collapsed group** (design 71): in 007 flow mode, a step inside a collapsed group lights the group card (ring + pulsing dot, static under reduced motion), merged connections on the path carry step badges (and the token when current), and the step player and its announcement say "inside Core services". Collapse / expand stays available in flow mode; drill-in and focus do not.
- Keyboard and screen-reader support for all of the above; light and dark themes.

**Out of scope**

- Role-based layers (business / technical / infra, V-5, P1).
- Saving collapse state, drill-in scope or focus per view, and the view switcher (011). Collapse state is not written to the file (§g-22).
- Creating, renaming, re-parenting or deleting groups; changing a component's `level` or `parent` from the canvas (inspector fields for these belong to 008's scope).
- Auto-layout of drilled or collapsed scopes (011).
- Export of the current level / collapsed state (012).

## Clarifications

### Session 2026-09-27

- Q: Should components with a `parent` stay hidden until their parent is drilled into, or always show in their group? → A: Hidden until the parent is drilled into; each level shows only its own components (FR-004).
- Q: 007 is not on `main`; should 010 include the flow-through-a-collapsed-group behavior? → A: 010 lights the group card and badges merged connections using 006 flow marks; the player's "inside <group>" text is added when 007 lands (FR-035). _Superseded by the next answer: 007 is now on `main`._
- Q: With 007 on `main`, what does 010 do in flow mode? → A: 010 also renders the player's "inside <group>" text; in flow mode users can collapse / expand groups, but not drill in or turn on focus (FR-035–FR-039).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Drill into a group and back out (Priority: P1)

An architect has a 70-component deck. They double-click the "Core services" group: only its members show, fitted to the screen, and the breadcrumb reads "Deck › System view › Core services". They press Backspace to go back up to the whole deck.

**Why this priority**: drilling in is the most direct way to "never show everything at once" and works without any other part of this feature.

**Independent Test**: open a deck with nested groups; drill in by double-click, by label and by Enter; go up by crumb, Esc and Backspace; check what is visible and the breadcrumb at each step.

**Acceptance Scenarios**:

1. **Given** the Core services group, **When** the user double-clicks it, **Then** only its members (and nested groups) show, the canvas fits them, and the breadcrumb reads "Deck › System view › Core services".
2. **Given** a drilled-in group, **When** the user clicks the "System view" crumb, **Then** the whole deck shows and the viewport returns to where it was before drilling in.
3. **Given** a drilled-in group and nothing selected, **When** the user presses Esc or Backspace, **Then** the canvas goes up one level.
4. **Given** a drilled-in group and a selected component, **When** the user presses Backspace, **Then** the delete confirmation opens (003 FR-017) and the level does not change.
5. **Given** a drilled-in group whose members connect to components outside it, **When** rendered, **Then** each outside connection ends at a dashed port pill naming the outside component; clicking the pill goes up and selects that component.
6. **Given** a component with child components, **When** the user drills into it, **Then** its children show at Component level with full cards and the breadcrumb adds the component's title.

---

### User Story 2 - Collapse a group into one box (Priority: P1)

The architect collapses "Core services" and "Data": each becomes one card, and the twelve connections between them become one connection with "×12". Hovering it lists the twelve; choosing one expands the group and selects that connection.

**Why this priority**: collapsing is the main tool for reading a whole large system at once (V-2, P0).

**Independent Test**: on a deck with two groups joined by 12 connections, collapse and expand with the chevron, Space and the inspector toggle; check the merged count, popover and restore.

**Acceptance Scenarios**:

1. **Given** a collapsed group with 12 connections to another group, **When** rendered, **Then** one connection with "×12" and a direction icon connects them; **When** the group is expanded, **Then** the 12 connections return.
2. **Given** a focused group label, **When** the user presses Space, **Then** the group collapses or expands and screen readers hear the new state.
3. **Given** a merged connection, **When** the user hovers or focuses it, **Then** a popover lists each underlying connection with its label and direction; **When** they choose a row, **Then** the group expands and that connection is selected.
4. **Given** a collapsed group, **When** the user selects it, **Then** the inspector shows the Collapsed toggle, the merged-connections list and "Expand group".
5. **Given** a collapsed group, **When** the user looks at the JSON panel or exports the deck, **Then** neither contains a collapsed flag, member count or merged connection.

---

### User Story 3 - Focus on one component (Priority: P2)

The architect selects "Order Service" and presses F: it and its direct neighbours stay bright, everything else fades, and the connections between them are highlighted with labels.

**Why this priority**: focus answers "what does this talk to?" on any deck, but drill-in and collapse cover more of the readability problem.

**Independent Test**: select a component, toggle Focus with F and the toolbar toggle, change the selection, and check opacity and accessibility of dimmed elements.

**Acceptance Scenarios**:

1. **Given** a selected component and Focus on, **When** rendered, **Then** only it and its direct neighbours are at full opacity, the connections between them are highlighted with their labels, and dimmed elements are hidden from screen readers and cannot be clicked or tabbed to.
2. **Given** Focus on, **When** the user selects one of the neighbours, **Then** the focus moves to that component and its neighbours.
3. **Given** Focus on, **When** the user presses F again, clicks the toggle or clears the selection, **Then** focus mode ends and everything returns to full opacity.
4. **Given** no selection, **When** the user presses F, **Then** nothing is dimmed and the app announces "Select a component to focus".

---

### User Story 4 - Level of detail follows zoom (Priority: P2)

Zooming out from 100% to 42%, the architect sees the canvas switch from titles and tech to regions and kind tiles; the level indicator in the zoom control reads "Landscape".

**Why this priority**: semantic zoom makes the whole deck readable at any zoom, but it is a presentation layer on top of stories 1–2.

**Independent Test**: step the zoom from 200% down to 30% and back; check the level name and what each component shows at each band; use the level menu to jump.

**Acceptance Scenarios**:

1. **Given** zoom goes from 100% to 42%, **When** rendered, **Then** the level indicator reads "Landscape", groups show as solid regions with large labels, and components show only their kind tile, each with an accessible name (title and kind).
2. **Given** zoom at 60%, **When** rendered, **Then** the indicator reads "System" and components show their title only.
3. **Given** zoom at 120%, **When** rendered, **Then** the indicator reads "Container" and components show title + tech.
4. **Given** zoom at 160%, **When** rendered, **Then** the indicator reads "Component" and components show full cards.
5. **Given** the level indicator, **When** the user opens its menu and picks a level, **Then** the zoom moves to the middle of that level's band (keeping the view centre) and the indicator updates.

---

### User Story 5 - Play a flow through a collapsed group (Priority: P3)

While playing "Place order" with "Core services" collapsed, step 4 happens between two components inside the group: the group card shows a ring and a pulsing dot, and the player says "inside Core services".

**Why this priority**: combines collapse with 007 flow playback; valuable for presentations, but only once stories 1–2 exist.

**Independent Test**: collapse a group that contains steps of a flow, open the flow (flow mode), step with → through the steps inside and across the group, collapse / expand during playback.

**Acceptance Scenarios**:

1. **Given** a flow step inside a collapsed group, **When** it is current, **Then** the group card shows the ring and pulsing dot, and the player and its announcement add "inside <group>".
2. **Given** a flow step on a connection that is merged, **When** it is current, **Then** the merged connection is highlighted, carries that step's badge and shows the token.
3. **Given** reduced motion, **When** a step inside a collapsed group is current, **Then** the dot is static and the ring remains.
4. **Given** flow mode, **When** the user presses Space on a focused group label or clicks its chevron, **Then** the group collapses or expands, playback keeps its current step, and the highlight follows.
5. **Given** flow mode, **When** the user clicks a collapsed card, **Then** the first played step inside it becomes current; **When** they click a merged connection, **Then** the next played step among its connections (after the current one, else the first) becomes current.
6. **Given** a drilled-in scope, **When** the user opens a flow, **Then** the canvas goes up to the whole deck first, and double-click / Enter drill-in and F do nothing until flow mode ends.

### Edge Cases

- **Nested groups**: drilling into a nested group adds one crumb per level; collapsing an outer group hides the inner groups inside its card; expanding it restores the inner groups' own collapse state.
- **Connections inside one collapsed group**: they are hidden (not merged) and counted in the card's "m edges".
- **Connection between two collapsed groups**: merged once between the two cards.
- **Mixed directions**: when merged connections go both ways, the direction icon shows both ways and the popover lists each direction.
- **Empty group**: a group with no members can be drilled into (shows "No components in this group") and collapsed ("0 nodes · 0 edges").
- **Selected component becomes hidden** (its group is collapsed or the user drills elsewhere): the selection moves to the collapsed group card, or is cleared if the component is no longer visible; Focus follows the same rule.
- **Drilled-in group is deleted or emptied by another tab or undo**: the canvas goes up to the nearest level that still exists and announces it.
- **Component added to a collapsed group** (edit in another tab): the card's counts and merged connections update live without expanding.
- **Undo/redo**: collapse, drill-in, focus and level changes are not document edits and are not undone by ⌘Z; ⌘Z of a document edit keeps the current collapse and drill-in state.
- **Parent component inside a collapsed group or outside the current scope**: its children stay hidden until the user drills into it.
- **Component with a `parent` that no longer exists** or a `parent` cycle: the component is shown at the top level of its group as if it had no parent; nothing is written to the file.
- **Component without `level`**: its level is derived from group nesting and `parent` (see FR-004).
- **Focus mode + flow mode**: entering flow mode turns focus mode off; focus cannot be turned on during flow mode (the toggle is disabled with a tooltip).
- **Esc in flow mode**: exits flow mode (007) and never goes up a level; Backspace does nothing in flow mode.
- **Collapsing during playback hides the current step's connection**: the card takes over the current-step ring and the player text updates at once; expanding gives the highlight and token back to the connection.
- **Focus on a collapsed group**: the card and the groups/components it connects to stay bright.
- **Zoom at a band boundary** (e.g. 45% / 46%): the level follows the listed thresholds exactly; zooming by trackpad does not flicker between levels (a level changes only once the new zoom settles in a band).
- **Deck reload or switching decks**: collapse, drill-in and focus are reset (UI state only, §g-22).

## Requirements _(mandatory)_

### Functional Requirements

**Levels and semantic zoom**

- **FR-001**: The canvas MUST show one of four detail levels, from widest to narrowest: Landscape, System, Container, Component.
- **FR-002**: The level MUST follow the zoom: Landscape ≤ 45%, System 46–90%, Container 91–150%, Component > 150%. When drilled into a component (FR-012), the level MUST be Component regardless of zoom.
- **FR-003**: At each level, components MUST render as: Landscape, kind tile only, with groups as solid regions with large labels and faint connections; System, title only; Container, title + tech; Component, full card (title, tech, owner, tags, rule marker). Every rendering MUST keep an accessible name with the component's title and kind.
- **FR-004**: A component with a `parent` MUST be hidden until the user drills into that parent; each scope shows only components whose `parent` is the drilled component (or no `parent` at the top level). A component with children MUST show a child-count marker so users know it can be drilled into. A component's own `level` field, when set, MUST be shown in the inspector and in the level indicator tooltip; when absent, it is derived from its depth in the `parent` chain (depth 0 → container, 1 → component).
- **FR-005**: The zoom control MUST show a level indicator (4 bars, the current level filled, plus the level name); clicking it MUST open a menu of the four levels that jumps the zoom to the middle of the chosen band, keeping the view centre.
- **FR-006**: The level change MUST be announced politely to screen readers ("Landscape level").

**Drill-in and breadcrumb**

- **FR-010**: Double-clicking a group or its label, or pressing Enter with a group selected or its label focused, MUST drill into that group: only its members and nested groups are shown, and the canvas fits them (fit zoom clamped 40–130%).
- **FR-011**: The top-bar breadcrumb MUST add, after the deck-name crumb, the current view name ("System view") and one crumb per drill-in level (group or component title); clicking the view crumb or a drill crumb MUST go up to that level and restore the viewport that level had before drilling in. The deck-name crumb keeps its rename behavior.
- **FR-012**: Double-clicking a component that has child components, or pressing Enter with it selected, MUST drill into it and show its children at Component level. On a component without children, double-click MUST do nothing and Enter MUST keep 003's behavior (select it and move focus to the inspector title).
- **FR-013**: In a drilled scope, each connection to a component outside the scope MUST end at a dashed port pill at the scope's edge naming that component; activating the pill (click or Enter) MUST go up one level and select that component.
- **FR-014**: Esc (when nothing is selected and no popover or dialog is open) and Backspace (when nothing is selected and focus is not in a text field) MUST go up one level. With a selection, Backspace MUST keep opening the delete confirmation (003 FR-017) and Esc MUST keep clearing the selection.
- **FR-015**: In a drilled scope, the outline MUST list only the scope's members and show an "Up" row that goes up one level.
- **FR-016**: Group labels MUST show a drill hint on hover and keyboard focus ("Double-click or ↵ to open").

**Collapsible groups**

- **FR-020**: Each group label MUST show a collapse chevron on hover and on keyboard focus; clicking it, pressing Space on the focused label, or using the Collapsed toggle in the group inspector MUST collapse or expand the group.
- **FR-021**: A collapsed group MUST render as one node-sized stacked card showing the group title and "n nodes · m edges" (members and connections inside it, including nested groups), placed at the centre of the group's expanded bounds.
- **FR-022**: For each outside neighbour (component or collapsed group), all connections between the collapsed group and that neighbour MUST be shown as one merged connection with a "×N" pill and a direction icon (one way or both ways). Connections entirely inside the group MUST be hidden.
- **FR-023**: Hovering or keyboard-focusing a merged connection MUST open a popover listing each underlying connection (label, or "from → to" when unlabeled, and direction); ↑ / ↓ move and Enter on a row MUST expand the group and select that connection.
- **FR-024**: Selecting a collapsed group MUST show in the inspector its Collapsed toggle, the merged-connections list and an "Expand group" button.
- **FR-025**: Collapse state MUST be UI state for the open deck in this tab: it MUST NOT be written to the document, the JSON panel or the file (§g-22, §g-23), and MUST reset on reload.
- **FR-026**: The collapsed card, the merged pill and the chevron MUST expose their state to screen readers (e.g. "Core services, collapsed group, 8 nodes, 14 edges"; "12 connections to Data").

**Focus mode**

- **FR-031**: A Focus toggle in the canvas toolbar and the F key (outside text fields) MUST turn focus mode on and off.
- **FR-032**: In focus mode, the selected component (or collapsed group) and its direct neighbours MUST be at full opacity; all other components, groups, connections and notes MUST be dimmed (the design's 0.2 opacity) and MUST also be marked hidden from assistive technology and not clickable or focusable; connections between the focused element and its neighbours MUST be highlighted with their labels visible.
- **FR-033**: Changing the selection in focus mode MUST move the focus; clearing the selection, entering flow mode or starting a flow recording MUST end focus mode; with no selection, F MUST announce "Select a component to focus" and change nothing.
- **FR-034**: Dimming MUST not rely on opacity alone for meaning: the focused element MUST also carry a visible ring or outline.

**Flow through a collapsed group**

- **FR-035**: In flow mode, a collapsed group MUST show a ring when any played step's connection is hidden inside it, and a ring plus a pulsing dot (static under reduced motion) when the current step's is; it MUST be marked as on the path so flow-mode dimming does not dim it.
- **FR-036**: A merged connection with played steps MUST carry their step badges in step order and be marked as on the path; when the current step is one of them, it MUST get 007's current-step look (thicker line, filled label, token).
- **FR-037**: When the current step's connection is hidden in a collapsed group, the step player MUST add "inside <group title>" after the step title, and the step announcement MUST end with ", inside <group title>".
- **FR-038**: In flow mode, collapse / expand MUST stay available (chevron, Space, merged-row Enter) and MUST NOT change the current step; drill-in (double-click, Enter), going up (Backspace) and focus mode (F, toggle) MUST do nothing; Esc keeps 007's meaning (exit flow mode). Clicking a collapsed card MUST make the first played step inside it current; clicking a merged connection MUST make the next played step among its connections current (after the current step, else the first).
- **FR-039**: Opening a flow while drilled in MUST first go up to the whole deck (restoring its viewport) so every step is reachable; collapse state is kept.

**General**

- **FR-040**: Every action in this feature MUST be reachable by keyboard: Enter drills in, Esc / Backspace go up (FR-014), Space collapses / expands the focused group, F toggles focus, the level menu and merged-connection popover are keyboard operable; all controls have accessible names and visible focus.
- **FR-041**: None of these actions MUST change the document or add undo steps; document edits (move, rename, delete) remain available in drilled, collapsed and focused states and follow their 003 rules.
- **FR-042**: The visible scene (level, drilled scope, collapsed groups, merged connections, focus) MUST update live when the document changes in this tab or another tab.
- **FR-043**: The screens MUST match design frames 13, 19 and 64–71 (light and dark) except where DESIGN.md or founder decisions differ.

### Key Entities

- **Level**: one of Landscape, System, Container, Component; UI state derived from zoom and drill-in; a component's own `level` field is document data (existing).
- **Drill scope**: the stack of groups/components the user has drilled into, with the viewport saved for each; UI state per open deck.
- **Collapsed groups**: the set of group ids collapsed in this tab; UI state (saved per view in 011).
- **Merged connection**: a derived connection between a collapsed group and one neighbour, carrying the ids of the underlying connections, a count and a direction; never stored.
- **Focus**: on/off plus the focused element id; UI state.
- **Port pill**: a derived marker at the edge of a drilled scope for a connection leaving it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On the 500-component / 1,000-connection benchmark deck with all groups collapsed, panning and zooming stay at 60 frames per second or better on a typical laptop.
- **SC-002**: On the benchmark deck, collapsing or expanding one group, drilling in or out, toggling focus and crossing a level threshold each update the canvas within 100 ms.
- **SC-003**: A user can go from the whole benchmark deck to one group's members and back in 2 actions each way (double-click in, one crumb or key out).
- **SC-004**: With every group collapsed, the benchmark deck shows at most one connection per pair of neighbouring cards, and each merged count equals the number of underlying connections (verified on fixtures).
- **SC-005**: The document, the JSON panel and an exported file are byte-identical before and after any sequence of zoom, drill-in, collapse and focus actions.
- **SC-006**: Every story can be completed with the keyboard only, and an automated accessibility check reports no violations in the drilled, collapsed and focus states, in light and dark themes.
- **SC-007**: In moderated tests with a 70-component deck, at least 4 of 5 users find which components a given service talks to within 30 seconds using focus or collapse.

## Assumptions

- The "System view" crumb is the current view's name; until 011 adds views, it is the fixed default view name "System view".
- Zoom range (30–200%), 10% steps, fit and minimap stay as in 003; the level thresholds are UI constants from design 64.
- A merged connection's direction icon is derived from the underlying connections' `from`/`to` (and `direction` when set).
- Group bounds stay derived from members (no stored geometry); the collapsed card sits at the centre of those bounds, so collapsing never moves any component.
- Sticky notes (009, not yet on `main`) are dimmed in focus mode if present; notes pinned to a component inside a collapsed group are hidden with it.
- Performance-sensitive changes are measured with `pnpm bench` before and after (AGENTS.md).
- Collapse state lives in the tab only; syncing it between tabs is not expected (multi-tab sync, §g-35, covers document edits only).
