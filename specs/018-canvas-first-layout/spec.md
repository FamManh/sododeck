# Feature Specification: Canvas-First Layout

**Feature Branch**: `018-canvas-first-layout`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "018 (canvas-first-layout) from docs/backlog.md. Give the diagram the whole screen. The canvas fills the window and all controls float above it in small islands: deck menu and name top-left, search and export top-right, zoom bottom-right. A thin icon rail on the left holds the tools (select, add component, sticky, group, connector) and opens the outline, flows and rules as flyouts beside it, one at a time. Component details open in a drawer only when asked for and never resize the canvas. The JSON panel is hidden until toggled. Users can hide all controls with one shortcut. Everything is reachable from the keyboard. Why: architecture diagrams with 100+ components need space; permanent side panels take half the screen."

**Sources**: `docs/backlog.md` §018 (scope, design deltas, acceptance criteria, risks), `docs/design/design-analysis.md` §a states 86–94, 115, 116 and the component inventory for states 86–116 (island, rail button, flyout, detail drawer, JSON overlay, selection frame, Show UI pill), §g-38 (canvas-first decision), §g-42 (JSON stays read-only), §g-46 (homes for controls the design did not place), §g-48–§g-51 (shortcut and UI-memory mismatches), `DESIGN.md` "Canvas-first Editor", constitution v1.0.0 (principles I, IV, VI, VII, VIII).

**Dependency note**: 021 (design sync) is merged on `main` (`fb3994c`): screens 86–116, the design analysis and DESIGN.md "Canvas-first Editor" are in the repo. 003–011 and 015 already provide every panel this feature moves (palette, outline, flows & features, rules, inspector, JSON panel, save status, view switcher, tidy layout, drill breadcrumb, problems, stickies, search). This feature changes **where** they sit and how they open, not **what** they contain. No file-format change.

## Scope

**In scope**

- **Full-bleed canvas** under everything: no fixed sidebars, no top-bar row, no fixed inspector column. The canvas never resizes when chrome opens or closes.
- **Deck island** (top-left): menu (library, import, export, deck settings, JSON panel toggle), deck name (rename in place), save-status icon, view switcher (011). Chips join it when active: "Flow · <name>" with × (flow mode, 007) and the drill breadcrumb (010). The views control's menu holds view settings and Tidy layout (011, §g-46).
- **Tools island** (top-right): Jump to / search field (⌘K), Labels, sticky visibility (009, §g-46), Focus, theme, Export.
- **Left rail**: Select, Add component (palette flyout), Sticky, Group, Connector; then Outline, Flows & features, Rules, Search, and Problems with a count badge (015, §g-46). Undo / Redo sit in their own small island just below the rail.
- **Flyouts** beside the rail for palette, outline, flows & features, rules and problems: one open at a time, close on Esc or outside click, can be pinned open; a pinned flyout returns when a temporary one closes.
- **Detail drawer** (right): today's inspector content, single and bulk. Opens only when asked for, overlays the canvas, resizable, width remembered per deck as UI preference.
- **JSON panel** hidden by default; toggled from the deck menu or ⌘J; opens as a bottom overlay with today's content, tabs, copy and collapse behaviour, **read-only** (§g-42).
- **Zoom island** (bottom-right): fit, fit selection, zoom out / level / zoom in, minimap toggle, keyboard-shortcut help.
- **Hide UI** (⌘\\): hides every island, flyout, drawer and overlay except a small "Show UI" pill; canvas shortcuts keep working.
- **Keyboard regions**: F6 / ⇧F6 move focus between islands, rail, canvas and drawer; flyouts and menus use correct menu / dialog semantics.
- **Narrow windows** 1024–1279 px wide (116): compact islands; below 1024 the editor stays view-only as today.
- **Selection frame** (2 px outline outside the card) replaces today's border + halo for selection, as in every frame 86–116.
- Light and dark themes; reduced motion respected.
- Smoke e2e selectors updated to the new placement (no new e2e tests).

**Out of scope**

- The selection toolbar, inline title edit on the card, the card's details button and the context menu (019). Until 019 lands, the drawer opens from the keyboard, the rail / menu and a double-click on a card.
- Copy / paste, group from selection, align / distribute, nudge, snapping, marquee styling (016); resize and connector routing (017); the drawer's **Appearance** section and card colours (020).
- Editing JSON (§g-42); changing any panel's content, fields or behaviour inside the panel.
- Collaboration UI (avatars, comments, presence).
- A layout for windows narrower than 1024 px (stays view-only).
- The library page and the rule editor screen keep their current layouts.

## Clarifications

### Session 2026-09-28

- Q: What does C do now that the rail shows "Add component C" (§g-49)? → A: C opens the palette when no card is focused; with one card focused it keeps opening the connect popover (FR-012).
- Q: How are drawer width, pinned flyout and JSON-open remembered (§g-50)? → A: Per deck in this browser's local UI preferences, restored on reopen, never in the deck file or document, not synced between open tabs (FR-026, FR-032, FR-043).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Work on a large diagram with the whole screen (Priority: P1)

An architect opens their 110-component Logistics deck. The diagram fills the window edge to edge; the only chrome is a few small floating islands: the deck name and save status top-left, search and export top-right, a thin tool rail on the left and zoom controls bottom-right. They pan and zoom across the whole diagram without any panel in the way.

**Why this priority**: space for large diagrams is the entire reason for this feature (§g-38); without the full-bleed canvas nothing else matters.

**Independent Test**: open a deck at 1440×900 with nothing open; measure that the canvas covers the full window and the floating chrome covers at most 8 % of it; every control from the old top bar and sidebar is still reachable from an island, the rail or the deck menu.

**Acceptance Scenarios**:

1. **Given** the editor at 1440×900 with no flyout, drawer or JSON panel open, **When** measured, **Then** the canvas covers the full viewport and floating chrome covers ≤ 8 % of its area.
2. **Given** the deck island, **When** the user clicks the deck name, **Then** they can rename the deck in place; Enter commits, Esc cancels.
3. **Given** autosave is saving, saved or failed, **When** the user looks at the deck island, **Then** the save icon shows a loader, a check or a clay alert, its tooltip and accessible name carry the same words as today ("Saving…", "Saved in this browser", "Couldn't save — export a backup"), and the error icon opens the existing error popover.
4. **Given** the deck island menu, **When** opened, **Then** it offers library, import, export, deck settings and "Show JSON" (with ⌘J).
5. **Given** a deck with several views, **When** the user switches view, opens the views control's menu, or triggers Tidy layout, **Then** everything from 011 works from the deck island.
6. **Given** the tools island, **When** the user clicks Jump to or presses ⌘K, **Then** the existing search / command palette opens.
7. **Given** the zoom island, **When** the user uses fit (⇧1), fit selection (⇧2), zoom in / out (⌘+ / ⌘−) or the minimap toggle (M), **Then** the canvas responds and the minimap appears above the island.

---

### User Story 2 - Open the outline, flows, rules or palette from the rail (Priority: P1)

The architect clicks Outline on the rail: the outline opens as a flyout beside the rail, over the canvas. They click a row; the component is selected and the canvas pans to it. They click Flows: the outline closes and the flows flyout opens. They pin the outline, then open the palette to add a database: when the palette closes, the pinned outline comes back.

**Why this priority**: every existing feature (flows, rules, outline, palette, problems) is entered from these flyouts; without them the full-bleed canvas would hide functionality.

**Independent Test**: from a loaded deck, open each rail flyout in turn; confirm only one is open at a time, Esc and outside click close it, pinning keeps it open while working on the canvas, and a pinned flyout returns after a temporary one closes.

**Acceptance Scenarios**:

1. **Given** the rail, **When** the user clicks Outline (or presses ⌥1), **Then** the outline flyout opens beside the rail and the Outline button shows as pressed.
2. **Given** the outline flyout is open and not pinned, **When** the user clicks Flows (or presses ⌥2), **Then** the outline closes and the flows & features flyout opens.
3. **Given** an unpinned flyout, **When** the user presses Esc or clicks the canvas, **Then** it closes and focus returns to the rail button (Esc) or stays on the canvas (click); if the flyout has a filter with text, the first Esc clears the filter and the second closes.
4. **Given** the outline is pinned, **When** the user clicks and drags on the canvas, **Then** the outline stays open and the drag works as without a flyout.
5. **Given** the outline is pinned and the user opens the palette, **When** the palette closes, **Then** the pinned outline is shown again.
6. **Given** the palette flyout, **When** the user presses a number key 1–6, **Then** a component of that kind is added at the centre of the view; dragging a tile onto the canvas adds it at the drop point.
7. **Given** the flows flyout, **When** the user opens a flow, **Then** flow mode starts as today, a "Flow · <name>" chip with × appears in the deck island, and × exits flow mode.
8. **Given** the deck has problems, **When** the user looks at the rail, **Then** the Problems button shows a count badge and opens the problems list as a flyout; ⌘. / ⇧⌘. still walk the problems (015).
9. **Given** the Rules rail button, **When** clicked, **Then** the rules list opens as a flyout, and opening a rule goes to the existing rule editor screen.
10. **Given** a rail tool (Select, Sticky, Group, Connector), **When** chosen by click or shortcut (V, S, G, L), **Then** that tool becomes active and the button shows as pressed.

---

### User Story 3 - Open component details on demand in a drawer (Priority: P1)

The architect selects "Order Service" and presses Enter. A drawer slides in from the right with the inspector fields; the canvas does not move or resize, except to pan the selection clear of the drawer if it would be covered. They edit the owner, press Esc, and focus returns to the card. Later they select three cards and open the drawer: it shows the bulk editor.

**Why this priority**: the inspector holds all knowledge editing (description, owner, rules, SLA); it must stay one keystroke away while no longer taking a permanent column.

**Independent Test**: select a component, press Enter; confirm the drawer shows its fields, the canvas size is unchanged, Esc closes it and focus returns to the component; resize the drawer, reload the deck, and confirm the width is remembered.

**Acceptance Scenarios**:

1. **Given** a selected component with no children, **When** the user presses Enter, **Then** the detail drawer opens with its fields, the canvas does not resize, and focus moves into the drawer.
2. **Given** the drawer is open, **When** the user presses Esc or its close button, **Then** it closes and focus returns to the component that was selected.
3. **Given** a selection, **When** the user presses ⌘⇧D, **Then** the drawer toggles open or closed.
4. **Given** the drawer would cover the selected component, **When** it opens, **Then** the canvas pans (not zooms, not resizes) so the component stays visible.
5. **Given** the drawer, **When** the user drags its left grip, **Then** the width changes between 320 and 560 px; **When** the deck is reopened later in the same browser, **Then** the drawer opens at that width.
6. **Given** two or more selected components, **When** the drawer opens, **Then** it shows today's bulk editor with a count header.
7. **Given** a selected group, edge, flow, step or sticky, **When** the drawer opens, **Then** it shows today's inspector for that object.
8. **Given** the drawer is open and the selection changes, **When** a new object is selected, **Then** the drawer shows that object; **When** the selection becomes empty, **Then** the drawer closes.
9. **Given** a selected component that has children or a selected group, **When** the user presses Enter, **Then** it still drills in as today (010); ⌘⇧D opens the drawer for it.
10. **Given** a flow is playing, **When** the drawer is open, **Then** the step player centres on the remaining canvas.

---

### User Story 4 - Show and hide the JSON panel (Priority: P2)

A developer presses ⌘J. The JSON panel slides up as a bottom overlay, showing the selection as JSON, in sync with the canvas. The zoom island moves above it. They copy the JSON, press Esc, and focus returns to the canvas.

**Why this priority**: JSON is valuable to technical users but not needed on screen at all times; hiding it by default gives space back without losing it.

**Independent Test**: open a deck (JSON hidden), press ⌘J, select components and confirm the panel follows; run the existing 004 acceptance scenarios against the overlay.

**Acceptance Scenarios**:

1. **Given** a newly opened deck, **When** the editor loads, **Then** the JSON panel is hidden unless the user left it open on this deck before.
2. **Given** the JSON panel is hidden, **When** the user presses ⌘J or chooses "Show JSON" in the deck menu, **Then** it opens as a bottom overlay, focus moves into it, and it shows the current selection (004 criteria still pass).
3. **Given** the JSON overlay is open, **When** the user presses Esc, **Then** focus returns to the canvas; **When** they press ⌘J again or ×, **Then** it closes.
4. **Given** the JSON overlay and the drawer are both open, **When** viewed, **Then** the overlay ends at the drawer's left edge and neither covers the other.
5. **Given** the JSON overlay is open, **When** viewed, **Then** the zoom island sits above it and stays usable.
6. **Given** the overlay, **When** the user tries to type in it, **Then** nothing changes; it stays read-only (§g-42).

---

### User Story 5 - Hide all controls for presenting or screenshots (Priority: P2)

Before a review meeting the architect presses ⌘\\. Every island, the rail, any flyout, the drawer and the JSON panel disappear; only a small "Show UI" pill remains bottom-right. They still pan, zoom, select and play a flow with the keyboard. Pressing ⌘\\ again restores exactly what was open.

**Why this priority**: clean, distraction-free views for presenting and capturing; valuable but not needed for editing.

**Independent Test**: open a flyout and the drawer, press ⌘\\, confirm only the pill is visible and canvas shortcuts work; press ⌘\\ or the pill, confirm the same flyout and drawer are back.

**Acceptance Scenarios**:

1. **Given** any combination of open chrome, **When** the user presses ⌘\\, **Then** only the "Show UI" pill remains visible.
2. **Given** Hide UI is on, **When** the user presses ⌘\\ again or clicks the pill, **Then** the previous islands, flyout, drawer and JSON panel return as they were.
3. **Given** Hide UI is on, **When** the user pans, zooms, selects, uses arrow-key focus, deletes with confirmation or steps a flow, **Then** those work as usual.
4. **Given** Hide UI is on, **When** a toast (e.g. Undo) or confirmation dialog is needed, **Then** it still appears.

---

### User Story 6 - Reach everything from the keyboard (Priority: P2)

A keyboard-only user presses F6 repeatedly: focus moves from the deck island to the tools island, the rail, Undo / Redo, the canvas, the zoom island and, when open, the drawer. Inside each region Tab and arrow keys move between its controls. Every rail button has a tooltip with its shortcut.

**Why this priority**: constitution VII requires every action to be keyboard operable; floating chrome must not become a trap or a dead end.

**Independent Test**: with only the keyboard, cycle all regions with F6 / ⇧F6, open and close every flyout, the drawer and the JSON panel, and confirm focus is always visible and returns to a sensible place.

**Acceptance Scenarios**:

1. **Given** the editor, **When** the user presses F6 repeatedly, **Then** focus moves deck island → tools island → rail → Undo / Redo → canvas → zoom island → drawer (when open) → back to the deck island; ⇧F6 goes the other way.
2. **Given** a region is hidden (Hide UI, drawer closed, narrow window), **When** F6 cycles, **Then** that region is skipped.
3. **Given** focus in a region, **When** the user presses F6, **Then** the whole region shows a visible focus ring and Tab moves between its controls.
4. **Given** a rail button, **When** it is hovered or focused for 400 ms, **Then** a tooltip shows its name and shortcut; the button's accessible name includes the name.
5. **Given** a flyout, the deck menu or the drawer, **When** read by a screen reader, **Then** each has a role and accessible name, and opening / closing is announced.
6. **Given** the "?" button or its shortcut, **When** used, **Then** a list of keyboard shortcuts opens, including the new ones in this feature.

---

### User Story 7 - Use the editor in a narrower window (Priority: P3)

On a 1024×768 laptop window, the rail stays; the view switcher becomes a dropdown; Jump to, Labels and Focus become icon buttons; Export is icon-only; the drawer covers about 35 % of the width.

**Why this priority**: smaller laptops and split screens are common, but the primary target is 1440 px.

**Independent Test**: resize the window to 1024×768 and 1279×800; confirm the compact islands, that nothing overlaps or clips, and that every control remains reachable.

**Acceptance Scenarios**:

1. **Given** a window 1024–1279 px wide, **When** the editor renders, **Then** islands switch to the compact variants described above and no two islands overlap.
2. **Given** a window narrower than 1024 px, **When** the editor renders, **Then** it stays view-only as today.

### Edge Cases

- **Drawer and flyout both open**: the flyout sits at the left, the drawer at the right; both overlay the canvas; if together with the rail they would leave less than 240 px of canvas, opening one closes the other unless it is pinned.
- **Drawer open, selection deleted** (e.g. undo removes the component): the drawer closes and focus returns to the canvas.
- **Pinned flyout and Hide UI**: the pinned flyout is restored when UI is shown again.
- **Flyout open, drag from the palette onto the canvas**: the drag works; the palette stays open until the drop, then closes unless pinned.
- **Pointer over a flyout or island during a canvas drag**: the canvas drag continues; floating chrome must not swallow drags that started on the canvas.
- **Flow mode and the drawer**: when a step is selected, the drawer shows the step inspector; the flow chip × exits flow mode and closes a step inspector.
- **Rule editor round trip**: leaving the rule editor returns to the editor with the previously open flyout / drawer state.
- **Two tabs on one deck**: UI state (drawer width, pinned flyout, JSON open, Hide UI) is per tab session and per deck preference; it never syncs through the document (§g-50).
- **Deck with no components**: the empty-canvas card is centred on the canvas, not under an island; its "Add component" opens the palette flyout.
- **Keyboard focus in a text field** (deck name, flyout filter, drawer field): single-letter shortcuts (V, S, G, L, C, M, 1–6) are ignored; ⌘-shortcuts that are not text-editing shortcuts still work.
- **Reduced motion**: flyouts, drawer and overlay appear without slide; the saving icon does not spin.
- **Save error while Hide UI is on**: the save-error popover is still reachable (the Show UI pill shows an alert mark and the error is announced).

## Requirements _(mandatory)_

### Functional Requirements

**Shell and canvas**

- **FR-001**: The editor MUST render the canvas full-bleed across the whole window; no fixed columns, sidebars or top-bar row MAY reduce it.
- **FR-002**: Opening or closing any flyout, the drawer, the JSON panel, a menu or Hide UI MUST NOT resize the canvas or change its zoom.
- **FR-003**: At 1440×900 with nothing open, floating chrome MUST cover ≤ 8 % of the viewport area.
- **FR-004**: Floating chrome MUST NOT block pointer interactions that start on the canvas (pan, drag, marquee, connect), and empty space between islands MUST pass pointer events to the canvas.
- **FR-005**: Selected cards MUST show the selection frame (outline outside the card) instead of today's border + halo; flow-step highlighting keeps its current look.

**Deck island**

- **FR-006**: The deck island MUST contain a menu button, the deck name (rename in place), the save-status icon and the view switcher.
- **FR-007**: The deck menu MUST offer: back to library, import, export, deck settings and show / hide JSON; each existing command keeps its behaviour.
- **FR-008**: The save-status icon MUST show a loader while saving, a check when saved and a clay alert on error; its tooltip, accessible name and live-region announcement MUST use the same words as today; the error icon MUST open the existing save-error popover. The state MUST NOT rely on colour alone.
- **FR-009**: While flow mode is active the deck island MUST show a "Flow · <name>" chip with a close button that exits flow mode; while drilled in, it MUST show the drill breadcrumb as a chip.
- **FR-010**: The views control MUST keep all 011 behaviour; view settings and Tidy layout MUST be in its menu.

**Tools island**

- **FR-011**: The tools island MUST contain Jump to / search (⌘K), Labels, sticky visibility, Focus, theme toggle and Export, each keeping its current behaviour.

**Rail and flyouts**

- **FR-012**: The rail MUST contain, in order: Select (V), Add component (C — opens the palette when no card is focused; with one card focused C keeps opening the connect popover, §g-49), Sticky (S), Group (G), Connector (L), then Outline (⌥1), Flows & features (⌥2), Rules, Search, Problems (count badge); Undo and Redo in a separate island directly below.
- **FR-013**: Clicking a panel button on the rail MUST open its flyout beside the rail; clicking it again MUST close it; the button MUST show as pressed while its flyout is open.
- **FR-014**: At most one flyout MUST be visible at a time; opening another MUST replace it.
- **FR-015**: A flyout MUST close on Esc (first Esc clears a non-empty filter) and on a click outside it, unless pinned.
- **FR-016**: A flyout MUST have a pin control; a pinned flyout stays open during canvas work; when a temporary flyout opened over it closes, the pinned one MUST return.
- **FR-017**: Flyout content (palette, outline, flows & features, rules list, problems) MUST be the existing panel content, unchanged in behaviour.
- **FR-018**: The palette flyout MUST add a component of kind 1–6 at the view centre on number keys 1–6 while it is open, and at the drop point when a tile is dragged onto the canvas.
- **FR-019**: Tool buttons (Select, Sticky, Group, Connector) MUST reflect the active tool and be operable by click and by their shortcut.
- **FR-020**: Every rail button MUST have a tooltip (name + shortcut, 400 ms delay) and an accessible name.

**Detail drawer**

- **FR-021**: The drawer MUST show today's inspector content for the current selection (component, group, edge, flow, step, sticky, bulk).
- **FR-022**: The drawer MUST open only on request: Enter on a selected component without children, ⌘⇧D (toggle), double-click on a card, or an "Open details" command; it MUST NOT open by itself on selection. ⌘⇧D replaces today's inspector shortcut.
- **FR-023**: The drawer MUST overlay the canvas; when it would cover the selection, the canvas MUST pan to keep the selection visible.
- **FR-024**: Esc or the close button MUST close the drawer and return focus to the object that was selected.
- **FR-025**: The drawer MUST be resizable from its left edge between 320 and 560 px (default 360) by pointer and by keyboard (arrow keys on the grip).
- **FR-026**: The drawer width MUST be remembered per deck in this browser as a UI preference, never in the deck file or the shared document.
- **FR-027**: When the selection becomes empty the drawer MUST close; when it changes, the drawer MUST show the new selection.

**JSON panel**

- **FR-028**: The JSON panel MUST be hidden by default and toggle with ⌘J, the deck menu and its × button.
- **FR-029**: When open, it MUST appear as a bottom overlay between the rail and the right edge (or the drawer's left edge) and keep all 004 behaviour: Selection / Deck tabs, live sync, copy, collapse, read-only.
- **FR-030**: ⌘J MUST move focus into the panel when opening it; Esc MUST return focus to the canvas without closing it.
- **FR-031**: When the JSON panel is open the zoom island MUST move above it.
- **FR-032**: Whether the JSON panel is open MUST be remembered per deck as a UI preference.

**Zoom island**

- **FR-033**: The zoom island MUST provide fit (⇧1), fit selection (⇧2), zoom out (⌘−), current zoom level, zoom in (⌘+), minimap toggle (M, minimap above the island) and keyboard-shortcut help (?); existing shortcuts (⌘0 fit) MUST keep working.

**Hide UI**

- **FR-034**: ⌘\\ MUST hide every island, flyout, drawer and the JSON panel, leaving only a "Show UI" pill; ⌘\\ or the pill MUST restore exactly the previous state.
- **FR-035**: While hidden, canvas shortcuts, selection, delete confirmation, toasts, flow playback keys and the command palette MUST keep working.

**Keyboard and accessibility**

- **FR-036**: F6 / ⇧F6 MUST cycle focus through deck island → tools island → rail → Undo / Redo → canvas → zoom island → drawer (when open), skipping hidden regions.
- **FR-037**: Flyouts, the deck menu, the views menu and the drawer MUST use appropriate roles (menu, dialog or complementary region) with accessible names; opening and closing MUST be announced through the existing live region.
- **FR-038**: Single-key shortcuts MUST be ignored while focus is in a text input.
- **FR-039**: The keyboard-shortcut help MUST list every shortcut introduced or moved by this feature.
- **FR-040**: All chrome MUST follow DESIGN.md tokens in light and dark themes; overlay motion MUST be disabled under reduced motion.

**Narrow windows**

- **FR-041**: Between 1024 and 1279 px wide the editor MUST switch to compact islands (views as a dropdown; Jump to, Labels, Focus as icons; Export icon-only) and the drawer MUST cover at most about 35 % of the width.

**UI state**

- **FR-042**: Open flyout, pinned flyout, drawer open / width, JSON open and Hide UI MUST be UI-only state; none of it MAY enter the deck file, the shared document or undo history.
- **FR-043**: Per-deck UI preferences (drawer width, pinned flyout, JSON open) MUST be restored when the deck is reopened in the same browser, kept in local UI preferences keyed by deck id; they MUST NOT sync between open tabs (§g-50).

**Compatibility**

- **FR-044**: Every existing feature entry point (flows, flow playback, rules, search, outline, inspector, JSON, views, tidy layout, drill-in, focus mode, stickies, problems, export, import) MUST remain reachable by pointer and keyboard.
- **FR-045**: The existing smoke e2e suite MUST pass with only its selectors updated.

### Key Entities

- **Island**: a floating group of controls at a fixed screen position (deck, tools, undo / redo, zoom, JSON overlay, Show UI pill).
- **Rail**: the vertical tool and panel launcher on the left.
- **Flyout**: a panel opened from the rail; attributes: which panel, pinned or not.
- **Detail drawer**: the on-demand inspector; attributes: open, width.
- **Shell UI state** (UI only, never in the document): open flyout, pinned flyout, drawer open and width, JSON panel open, Hide UI, and per-deck preferences for the persistent ones.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: With nothing open at 1440×900, the canvas area available for the diagram is at least 92 % of the window (today ≈ 50 %).
- **SC-002**: Opening or closing any flyout, the drawer or the JSON panel changes the canvas size by 0 px in every case.
- **SC-003**: Every control available in the previous layout is reachable in at most 2 clicks or 1 shortcut from the new shell (checked against a list of all previous entry points).
- **SC-004**: A keyboard-only user can reach every island, the rail, the canvas and the drawer with F6 alone, in at most 7 presses from any starting point.
- **SC-005**: The drawer opens with the selected component's fields within 150 ms of Enter, and the canvas does not move unless the selection would be covered.
- **SC-006**: Canvas pan / zoom stays at 60 fps with 500 components / 1,000 connections with a flyout, the drawer and the JSON panel open (no regression vs the performance baseline measured before this change).
- **SC-007**: The implemented screens 86–94, 115 and 116 match the design screenshots in light and dark, with differences either fixed or listed.
- **SC-008**: All acceptance criteria of 004 (JSON panel), 007 (flow playback) and 011 (views) still pass with the new placement.

## Assumptions

- Frames 86–116 set placement; frames 02–85 still set panel content; where the backlog prose and a frame differ on placement (e.g. F6 order), frame 115 wins, and founder decisions in design-analysis §g win over both.
- §g-42, §g-46 and §g-48 defaults apply: JSON stays read-only; controls without a designed place go where §g-46 says; ⌘. stays "next problem" and Space collapses a group.
- §g-51 default applies: save status is an icon, with the old words as tooltip, accessible name and announcement.
- Until 019 adds the card's details button and context menu, the drawer is opened by Enter, ⌘⇧D, double-click on a card or an "Open details" command in the command palette.
- The Appearance section of the drawer (020) and the bulk drawer's Align / distribute (016) are not added here; the bulk drawer shows today's bulk editor.
- The rule editor (`/deck/:id/rules`) and the library keep their own layouts; the Rules rail button opens a rules list and hands off to the rule editor.
- Under 1024 px the editor remains view-only, as today.
- No new runtime dependency is needed; floating chrome is built from existing UI primitives.
- An ADR records the layout change; DESIGN.md already describes the canvas-first editor (021).
