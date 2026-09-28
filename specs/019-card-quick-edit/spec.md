# Feature Specification: Card Quick Edit

**Feature Branch**: `019-card-quick-edit`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "019 (card-quick-edit) from docs/backlog.md. Let users edit a component where they see it. Double-clicking a component edits its title in place. Hovering a component shows a small icon that opens its details. Selecting one or more components shows a compact toolbar above them for the common fields (kind, owner, tags, technology, links, rules, colours) and a "More" button. Right-clicking a component, a connection, a group or the empty canvas opens a menu with the actions that apply there. All of it works from the keyboard and every change is one undo step. Why: most diagram editing is naming boxes; opening a side panel for every change breaks the flow."

**Sources**: `docs/backlog.md` §019 (scope, design deltas, acceptance criteria, risks) and §016 (which actions 016 adds to these surfaces), `docs/design/design-analysis.md` §a states 95–104 and 115 and the component inventory (selection toolbar, toolbar popover, context menu), §g-40 (no new card fields), §g-45 (nudge keys), §g-46 (pin / unpin in "More" and the context menu), §g-48 (Space collapses a group, ⌘. stays "next problem"), `DESIGN.md` "Canvas-first Editor", `specs/018-canvas-first-layout/spec.md` (detail drawer, Hide UI, keyboard regions), constitution v1.0.0 (principles I, III, VI, VII, VIII).

**Dependency note**: 018 (canvas-first layout) is merged on `main` (`406a098`): the detail drawer, rail, palette flyout, Hide UI and F6 regions exist. 008 already provides every field this feature edits (kind, owner, tags, technology, links, attached rules, edge label / protocol / direction, group title) and the bulk editor; 010 provides group collapse and drill-in; 011 provides pins. This feature adds **new places to edit** existing fields. No file-format change.

## Scope

**In scope**

- **Inline title edit** on components (and group labels): start by double-click, F2 or the Rename command; commit, cancel, Tab-to-next, empty-title rules; one undo step.
- **New component starts in title edit**: a component added from the palette (click, number key, "Add component" menu) lands with an empty title and a caret; ⌘⏎ saves and adds another of the same kind.
- **Details icon** on the card's top-right corner on hover and keyboard focus; opens the detail drawer (018) on that card.
- **Selection toolbar** floating above the selection, in four variants: one component, several components, a connection, a group. Fields open small popovers with a filter; "More ⋯" opens the context menu.
- **Context menu** on a component, a connection, a group and the empty canvas, opened by right-click, Shift+F10, the ContextMenu key or "More ⋯"; only applicable actions are listed.
- **One shared action list** behind shortcuts, toolbar and menus, so later features (016 copy / paste / align, 017 reset route, 020 colours) add actions without new surfaces.
- Keyboard access for all of it (⌘E to the toolbar, arrows inside it, Shift+F10 for menus), screen-reader names and announcements, light and dark themes, reduced motion.

**Out of scope**

- Copy, cut, paste, duplicate, group from selection (⌘G), align / distribute and nudge: **016** adds them to the toolbar and menus built here. Until then they are not shown.
- Fill and stroke pickers (**020**); Reset route and endpoint / segment handles on a connection (**017**). Until they land these toolbar buttons are not shown.
- New card fields or user-defined attributes (§g-40); comments, lock, share links; AI actions.
- Editing text other than titles in place (descriptions stay in the drawer).
- Sticky notes: their existing editing (009) is unchanged and they get no toolbar; right-clicking a sticky opens a small menu (Open details, Copy JSON, Delete) using operations that already exist.

## Clarifications

### Session 2026-09-28

- Q: What do Enter and double-click do on a component now that double-click renames? → A: Double-click and F2 rename; Enter keeps 018 (details on a plain component, drill into one with children); double-click on a group still drills in (FR-001).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Rename a component where it is (Priority: P1)

An architect sees a card called "Service 3". They double-click it, the title becomes an editable field with all text selected, they type "Billing API" and press Enter. The card, outline, drawer and JSON panel all show "Billing API". One ⌘Z brings back "Service 3". Renaming several cards in a row, they press Tab after each one to move straight to the next card's title.

**Why this priority**: naming boxes is most of diagram editing (backlog goal); this alone removes most trips to the drawer.

**Independent Test**: on a loaded deck, double-click a card, type a new title, press Enter; confirm the new title everywhere and that one undo restores the old one; repeat with Esc, Tab and an empty title.

**Acceptance Scenarios**:

1. **Given** a card, **When** the user double-clicks it, types "Billing API" and presses Enter, **Then** the title is "Billing API" in the card, outline, drawer and JSON, and one ⌘Z restores the old title.
2. **Given** title edit, **When** the user presses Esc, **Then** nothing changes and focus returns to the card.
3. **Given** title edit, **When** the user clicks elsewhere on the canvas, **Then** the edit is committed as with Enter.
4. **Given** title edit, **When** the user clears the text and commits, **Then** the previous title is kept and nothing is added to undo history.
5. **Given** title edit on a card, **When** the user presses Tab (⇧Tab), **Then** the title is saved and the next (previous) card in keyboard order enters title edit.
6. **Given** a focused card, **When** the user presses F2, **Then** title edit starts with all text selected.
7. **Given** title edit, **When** the user types a long title, **Then** the card keeps its size and the text scrolls or wraps inside it.
8. **Given** a selected group, **When** the user presses F2 or chooses Rename, **Then** the group label is edited in place with the same rules.
9. **Given** a view-only editor (window < 1024 px) or flow mode, **When** the user double-clicks a card, **Then** no title edit starts.

---

### User Story 2 - Add and name new components quickly (Priority: P1)

The architect opens the palette and presses 2. A new service card appears at the centre of the view with an empty title and a blinking caret showing "Name this component". They type "Auth", press ⌘⏎, and a second empty service card appears next to it, already in title edit. They type "Users" and press Enter.

**Why this priority**: sketching a new system is a burst of add-and-name; making it one flow is the other half of "name boxes fast".

**Independent Test**: add a component from the palette; confirm it starts in title edit with the placeholder; use ⌘⏎ to add another of the same kind; press Esc on one and confirm it is kept as "Untitled <kind>".

**Acceptance Scenarios**:

1. **Given** the palette, **When** the user adds a component (click, number key 1–6, drop, or "Add component" in the canvas menu), **Then** it appears with an empty title in title edit with the placeholder "Name this component".
2. **Given** a new component in title edit, **When** the user types a name and presses ⌘⏎, **Then** the name is saved and another component of the same kind is added next to it, already in title edit.
3. **Given** a new component in title edit, **When** the user presses Esc or commits an empty title, **Then** the component is kept with the title "Untitled <kind>" (e.g. "Untitled service").
4. **Given** a component added by number key at the view centre, **When** another card already sits at exactly that spot, **Then** it is offset by 24 px steps until the spot is free (today's placement rule).
5. **Given** a new component was added and named, **When** the user presses ⌘Z, **Then** the rename is undone first, then a second ⌘Z removes the component.
6. **Given** the palette flyout was open when the component was added, **When** title edit ends, **Then** the palette is still open (unless it closes for the reasons in 018).

---

### User Story 3 - Edit common fields from a toolbar on the selection (Priority: P1)

The architect selects "Order Service". A slim toolbar appears just above it: Open details, Kind, Owner, Tags, Tech, Links, Rules, More. They click Owner, type "pay" in the popover's filter, pick "Payments team"; the card updates. Then they shift-select two more cards: the toolbar shows "3 selected" and the fields they share. They set Tags "pci" on all three with one popover; one ⌘Z undoes it for all three.

**Why this priority**: owner, kind and tags are the next most common edits after titles; setting them on several cards at once is where the drawer is slowest.

**Independent Test**: select one card and change each toolbar field; select two cards, set Owner once, confirm both change and one undo reverts both; check the toolbar flips below the selection near the top of the window.

**Acceptance Scenarios**:

1. **Given** one selected component, **When** the toolbar shows, **Then** it offers Open details, Kind, Owner, Tags, Tech, Links, Rules and More ⋯, each with a tooltip and accessible name.
2. **Given** two selected components, **When** the user sets Owner in the toolbar, **Then** both components have that owner and one ⌘Z restores both previous owners.
3. **Given** a multi-selection whose values differ, **When** a popover opens, **Then** differing values show as "Mixed", and a tag held by only some components shows as a dashed chip with its count (e.g. "2/3"); choosing it applies it to all.
4. **Given** a popover, **When** it opens, **Then** focus is in its filter field, typing filters the options, Enter picks the highlighted option, and Esc closes it and returns focus to its toolbar button.
5. **Given** the Owner popover, **When** the user chooses "No owner", **Then** the owner is cleared.
6. **Given** the toolbar would reach the top islands (less than 68 px from the top of the window), **When** shown, **Then** it appears 12 px below the selection instead of above; it always stays inside the window horizontally.
7. **Given** the user starts dragging, zooming, panning or editing a title, **When** that happens, **Then** the toolbar hides and comes back when it ends.
8. **Given** Open details in the toolbar, **When** clicked, **Then** the detail drawer opens on the selection (018).
9. **Given** a toolbar value changed, **When** the drawer or JSON panel is open, **Then** they show the new value immediately.

---

### User Story 4 - Open details from the card itself (Priority: P2)

Hovering "Order Service" lifts the card slightly and shows a small round details button in its top-right corner. Clicking it opens the drawer on that card, without having to select it first.

**Why this priority**: gives pointer users a visible, discoverable way into the drawer now that double-click edits the title.

**Independent Test**: hover a card, confirm the icon; click it, confirm the drawer opens on that card; tab to a card, confirm the icon also shows and can be activated by keyboard.

**Acceptance Scenarios**:

1. **Given** a card under the pointer, **When** hovered, **Then** the details icon shows on its top-right corner with the tooltip "Open details"; **When** clicked, **Then** the card is selected and the drawer opens on it.
2. **Given** a card with keyboard focus, **When** focused, **Then** the icon also shows and is reachable and operable from the keyboard.
3. **Given** a card being dragged, flow mode, or a card less than 80 px wide on screen, **When** hovered, **Then** the icon does not show.

---

### User Story 5 - Right-click for the actions that apply (Priority: P2)

The architect right-clicks a component: a menu lists Open details, Rename, Copy JSON, Arrange ▸, Pin / Unpin, Delete. Right-clicking a group shows Rename, Collapse, Select members, Delete group. Right-clicking empty canvas shows Add component ▸, Add sticky, Select all, Fit. A keyboard user presses Shift+F10 on a focused card and gets the same menu with its first item focused.

**Why this priority**: gives every action a predictable home and is the keyboard path to actions that have no shortcut.

**Independent Test**: right-click each kind of target and compare the items with the lists in FR-030–FR-033; open the same menus with Shift+F10 and the ContextMenu key; use "More ⋯" in the toolbar.

**Acceptance Scenarios**:

1. **Given** a right-click on a component, **When** the menu opens, **Then** it shows, in sections: Open details (⏎), Rename (F2); Copy JSON (⇧⌘C); Arrange ▸ (Bring to front, Send to back); Pin / Unpin; Delete (in clay with an icon).
2. **Given** a right-click on empty canvas, **When** the menu opens, **Then** it shows Add component ▸ (six kinds with keys 1–6), Add sticky, Select all and Fit, and no component-only actions; a component added from it lands at the click point.
3. **Given** a right-click on a group, **When** the menu opens, **Then** it shows Open details, Rename, Collapse or Expand (Space), Select members and Delete group, whose tooltip says the members move to the parent level.
4. **Given** a right-click on a connection, **When** the menu opens, **Then** it shows Open details, Edit label (⏎), Protocol ▸, Direction ▸, Copy JSON and Delete.
5. **Given** keyboard focus on a card, **When** the user presses Shift+F10 or the ContextMenu key, **Then** the component menu opens next to the card with its first item focused.
6. **Given** the toolbar's More ⋯ button, **When** activated, **Then** the same menu as a right-click on the selection opens below it.
7. **Given** a menu near a window edge, **When** it or a submenu opens, **Then** it flips to stay fully visible; submenus open to the right and flip left near the edge.
8. **Given** a right-click on a card that is not selected, **When** the menu opens, **Then** that card becomes the selection first; a right-click inside a multi-selection keeps the selection and the menu applies to all of it.
9. **Given** an open menu, **When** the user presses Esc, **Then** it closes and focus returns to where it was.

---

### User Story 6 - Quick edit on connections and groups (Priority: P3)

Selecting a connection shows a toolbar with Label, Protocol and Direction; pressing Enter edits the label, P opens the protocol picker. Selecting a group shows Rename, Ungroup, Collapse and Select members.

**Why this priority**: connections and groups are edited less often than components, but the same surfaces should behave consistently on them.

**Independent Test**: select a connection and change label, protocol and direction from the toolbar; select a group and use each toolbar action; check each is one undo step.

**Acceptance Scenarios**:

1. **Given** a selected connection, **When** the toolbar shows, **Then** it offers Label, Protocol, Direction and More ⋯.
2. **Given** a selected connection, **When** the user presses Enter, **Then** its label becomes editable (the existing edge popover, 003); **When** they press P, **Then** the protocol popover opens.
3. **Given** a selected group, **When** the toolbar shows, **Then** it offers Rename (F2), Ungroup (⇧⌘G), Collapse / Expand (Space), Select members and More ⋯; ⇧⌘G on a selected group ungroups it.
4. **Given** a selected group, **When** the user chooses Ungroup, **Then** the group is removed, its members move to the parent level, and one ⌘Z restores it.
5. **Given** Select members, **When** chosen, **Then** the group's direct members become the selection and the toolbar switches to the multi-selection variant.

---

### User Story 7 - Do all of it from the keyboard (Priority: P2)

A keyboard-only user focuses a card with the arrow keys, presses ⌘E to jump into its toolbar, moves across it with ← →, opens Kind with Enter, picks "Database" with ↓ and Enter, and lands back on the Kind button. Esc returns them to the card.

**Why this priority**: constitution VII; the toolbar and menu must not be pointer-only.

**Independent Test**: with only the keyboard, perform every acceptance scenario of stories 1, 3, 5 and 6.

**Acceptance Scenarios**:

1. **Given** a selection with a toolbar, **When** the user presses ⌘E, **Then** focus moves to the toolbar's first button; ← / → move between buttons, Home / End jump to the ends.
2. **Given** focus in the toolbar, **When** the user presses Esc, **Then** focus returns to the selected card (or connection or group).
3. **Given** focus on a selected card, **When** the user presses Tab, **Then** focus moves into the toolbar (then back to the canvas order after its last button).
4. **Given** any toolbar button, popover or menu item, **When** read by a screen reader, **Then** it has an accessible name, the toolbar has the role and label of a toolbar for the selection, and value changes are announced ("Owner set to Payments team on 3 components").
5. **Given** the keyboard-shortcut help (018), **When** opened, **Then** it lists F2, ⌘E, ⌘⏎ (add another), ⇧⌘C, Shift+F10 and the connection keys.

### Edge Cases

- **Double-click conflicts**: double-click on a group label or a collapsed group keeps drilling in (010); on any component it renames, including one with children (drill in with Enter or "Open inside", FR-001).
- **Rename while the component is changed elsewhere** (another tab edits or deletes it): a delete ends title edit without saving; a remote title change while editing is overwritten only if the user commits.
- **Selection changes during title edit** (e.g. a click on another card): the edit commits first, then the selection changes.
- **Undo while editing**: ⌘Z inside the title field undoes typing in the field, not the document.
- **Very small zoom**: the toolbar still appears at normal size; the details icon is hidden when the card is < 80 px wide on screen; title edit still happens inside the card at the current zoom (FR-003), so the user zooms in to read it.
- **Card behind an island or the drawer**: when title edit starts on a card partly covered by chrome, the canvas pans so the card is visible (as the drawer does in 018).
- **Hide UI on** (018): toolbar and details icon are hidden; inline edit and the context menu still work.
- **Flow mode and flow recording**: no toolbar, no details icon, no inline edit; the context menu on the canvas offers only non-editing actions (Open details, Copy JSON, Fit).
- **View-only editor** (window < 1024 px): no toolbar, no inline edit, context menu limited to non-editing actions.
- **Pinned components** in a view (011): Pin / Unpin label reflects the state; for a mixed multi-selection it reads "Pin all".
- **Delete from the menu** follows the existing delete rules (confirmation and Undo toast as today).
- **Mixed selection** (components plus a connection or group): the toolbar shows only the count and More ⋯; the menu lists only actions that apply to every selected object (Delete, Copy JSON).
- **Multiple toolbars never show**: one toolbar for the whole selection, placed above its bounding box.
- **Stickies**: selecting a sticky shows no toolbar; right-clicking it (or Shift+F10 on it) opens a menu with Open details, Copy JSON and Delete (FR-033a).

## Requirements _(mandatory)_

### Functional Requirements

**Inline title edit**

- **FR-001**: Double-click on a component MUST start title edit (it no longer opens the drawer or drills in). Enter MUST keep its 018 behaviour: open the detail drawer on a plain component, drill into a component with children (010). Double-click on a group label or collapsed group MUST keep drilling in (010). Drilling into a component with children by pointer is available from its context menu ("Open inside") and by selecting it and pressing Enter.
- **FR-002**: F2 on a focused or selected component, and the Rename command, MUST start title edit with all text selected.
- **FR-003**: Title edit MUST happen inside the card; the card MUST keep its size.
- **FR-004**: Enter or a click outside MUST commit; Esc MUST cancel and leave the document unchanged.
- **FR-005**: Committing an unchanged or empty title MUST keep the previous title and MUST NOT add an undo step.
- **FR-006**: A committed rename MUST be exactly one undo step and MUST be visible immediately in every view (card, outline, drawer, JSON panel, search).
- **FR-007**: Tab / ⇧Tab during title edit MUST commit and start title edit on the next / previous component in keyboard order.
- **FR-008**: Group labels MUST support the same title edit (F2, Rename command) with the same rules.
- **FR-009**: Only the in-progress text MAY live outside the document while editing; the title MUST be written to the document only on commit.
- **FR-010**: Title edit MUST NOT start in flow mode, during flow recording, or in the view-only editor.

**New components**

- **FR-011**: A component added from the palette, a number key or the canvas menu MUST start in title edit with an empty field and the placeholder "Name this component".
- **FR-012**: Components added at the view centre MUST be offset by 24 px steps while another card sits at exactly that position (the existing placement rule); components added from the canvas menu MUST land at the click point.
- **FR-013**: ⌘⏎ in title edit on a new component MUST commit and add another component of the same kind next to it, in title edit.
- **FR-014**: Cancelling or committing an empty title on a new component MUST keep the component as "Untitled <kind>".
- **FR-015**: Adding and naming a component MUST be separate undo steps (undo the name, then the component).

**Details icon**

- **FR-016**: A card MUST show a details button on its top-right corner while hovered or keyboard-focused, with the tooltip and accessible name "Open details".
- **FR-017**: Activating it MUST select the card and open the detail drawer (018) on it.
- **FR-018**: The icon MUST be hidden while dragging, in flow mode, in Hide UI, in the view-only editor, and when the card is less than 80 px wide on screen.

**Selection toolbar**

- **FR-019**: When one or more objects are selected and no gesture or text edit is in progress, a single toolbar MUST float 12 px above the selection's bounding box, flip to 12 px below when it would come within 68 px of the window top, and stay inside the window horizontally.
- **FR-020**: The one-component toolbar MUST offer: Open details, Kind, Owner, Tags, Tech, Links, Rules, More ⋯. Fill and Stroke join it when 020 lands.
- **FR-021**: The multi-component toolbar MUST show the count and the shared fields Kind, Owner, Tags, Tech, and More ⋯; Align and Group join it when 016 lands.
- **FR-022**: The connection toolbar MUST offer Label, Protocol, Direction, More ⋯; Reset route joins it when 017 lands.
- **FR-023**: The group toolbar MUST offer Rename, Ungroup, Collapse / Expand, Select members and More ⋯.
- **FR-024**: Field buttons MUST open a popover with a filter (where there are options), the current value marked, "Mixed" for differing values, partial tags as dashed chips with counts, and an explicit "none" choice for optional fields.
- **FR-025**: Each change from the toolbar MUST be exactly one undo step, even when it changes several objects.
- **FR-026**: The toolbar MUST hide while dragging, resizing, panning, zooming, editing a title, in flow mode, during flow recording, in Hide UI and in the view-only editor, and reappear when that ends.
- **FR-027**: Toolbar edits MUST use the same fields and value rules as the drawer (008); no new fields (§g-40).

**Context menu**

- **FR-028**: A context menu MUST open by right-click, Shift+F10, the ContextMenu key, or the toolbar's More ⋯, on a component, a connection, a group, or the empty canvas.
- **FR-029**: A menu MUST list only actions that apply to its target and current mode; unavailable-but-relevant actions MAY show disabled with a tooltip explaining why.
- **FR-030**: Component menu: Open details, Open inside (only for a component with children), Rename; Copy JSON; Arrange ▸ (Bring to front, Send to back); Pin / Unpin (in a view, §g-46); Delete.
- **FR-031**: Connection menu: Open details, Edit label, Protocol ▸, Direction ▸; Copy JSON; Delete.
- **FR-032**: Group menu: Open details, Rename; Collapse / Expand; Select members; Delete group (members move to the parent level; stated in a tooltip).
- **FR-033**: Empty-canvas menu: Add component ▸ (six kinds, 1–6, landing at the click point), Add sticky (at the click point), Select all, Fit.
- **FR-033a**: Sticky menu: Open details; Copy JSON; Delete (existing sticky removal, with its Undo toast).
- **FR-034**: Right-clicking an unselected object MUST select it first; right-clicking inside a multi-selection MUST keep the selection and apply the menu to all of it.
- **FR-035**: Keyboard-opened menus MUST focus their first enabled item; menus and submenus MUST flip to stay inside the window; Esc MUST close and restore focus.
- **FR-036**: Copy JSON MUST put the selection's JSON (as shown in the JSON panel's Selection tab) on the system clipboard and confirm with a toast; nothing leaves the device.
- **FR-037**: Arrange MUST change which card is drawn on top where cards overlap, be one undo step, and survive save, reload and export.
- **FR-038**: Delete from the menu MUST behave exactly as the existing Delete key (confirmation and Undo toast rules unchanged).

**Shared actions**

- **FR-039**: Shortcuts, the toolbar and the menus MUST run the same actions with the same availability rules, so an action is enabled in the menu exactly when its shortcut works.
- **FR-040**: Later features MUST be able to add actions (016 copy / paste / duplicate / group / align, 017 reset route, 020 fill / stroke) to the toolbar and menus without changing these surfaces.

**Keyboard and accessibility**

- **FR-041**: ⌘E MUST move focus to the toolbar; ← / → / Home / End MUST move within it; Esc MUST return focus to the selection; Tab from a selected object MUST reach the toolbar.
- **FR-042**: On a selected connection, Enter MUST edit its label and P MUST open the protocol popover; on a selected group, Space MUST collapse / expand (§g-48), and ⇧⌘G MUST ungroup it (same operation as the toolbar's Ungroup).
- **FR-043**: The toolbar, its buttons, popovers, menus and the details icon MUST have roles and accessible names; value changes and renames MUST be announced through the existing live region.
- **FR-044**: Single-key shortcuts MUST be ignored while a title, filter or other text field has focus.
- **FR-045**: The keyboard-shortcut help MUST list every shortcut added by this feature.
- **FR-046**: All new surfaces MUST follow DESIGN.md tokens in light and dark themes, never signal state by colour alone (selected, mixed, partial, disabled, destructive), and appear without motion under reduced motion.

**Document and state**

- **FR-047**: Every change MUST go through the shared document; the toolbar, menus and inline edit MUST NOT keep their own copy of document values beyond the in-progress text or filter.
- **FR-048**: Whether the toolbar, a popover or a menu is open MUST be UI-only state, never in the deck file or undo history.
- **FR-049**: No file-format change; renames MUST NOT change any id or break any reference.

### Key Entities

- **Title edit session**: which object is being renamed, its draft text, whether it is a new component (for ⌘⏎ and "Untitled <kind>"). UI only.
- **Selection toolbar**: variant (component, multi, connection, group), placement (above / below), which popover is open. UI only.
- **Context menu**: target (component, connection, group, canvas, selection), anchor point, open submenu. UI only.
- **Action**: a named editing command (id, label, shortcut, icon, when it applies, what it does) shared by shortcuts, toolbar and menus.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Renaming a component takes one gesture plus typing (double-click or F2, type, Enter), with no panel opened, in 100 % of the tested cases.
- **SC-002**: Adding and naming five components of the same kind takes at most 5 names typed plus 6 keystrokes beyond the text (palette key, then ⌘⏎ ×4, then Enter).
- **SC-003**: Setting owner, kind, tags or technology on a selection of up to 50 components takes at most 3 clicks (or 4 keystrokes) and produces exactly one undo step.
- **SC-004**: The toolbar appears within 100 ms of a selection change and never overlaps the top islands or leaves the window.
- **SC-005**: Every action in the toolbar and menus can be completed with the keyboard alone; a keyboard-only tester completes every acceptance scenario of stories 1, 3, 5 and 6.
- **SC-006**: Every menu item shown is applicable: zero menu items that do nothing or show an error when chosen, across the four menu targets.
- **SC-007**: Canvas pan / zoom stays at 60 fps at 500 components / 1,000 connections with a selection and its toolbar visible (no regression vs the benchmark measured before this change).
- **SC-008**: The implemented states 95–104 and the context-menu part of 115 match the design screenshots in light and dark, with differences either fixed or listed (excluding parts owned by 016, 017 and 020).

## Assumptions

- Frames 95–104 set the look of these surfaces; frames 02–85 still set field content and value rules; founder decisions in design-analysis §g win over frames.
- Copy / paste / duplicate / group / align / nudge (016), reset route (017) and fill / stroke (020) are not shown until those features land; the canvas menu therefore has no Paste item in 019, and the backlog criterion "Paste is disabled with nothing copied" moves to 016.
- Arrange uses the order of components already stored in the deck (later in the list draws on top); no new field is needed.
- Ungroup on a group and "Delete group" are the same existing operation (members move to the parent level, 002); both are shown because the design has both.
- Pin / Unpin appear only while a view is active, as in 011.
- Links and Rules popovers edit the component's existing links and attached-rule list; creating a new rule still happens in the rule editor.
- Group collapse keeps Space (§g-48); ⌘. stays "next problem" (015).
- No new runtime dependency: the menu, popover, inline-edit and toolbar build on primitives already in `packages/ui` and the existing Radix dependency.
- New e2e tests are not added (constitution VI); behavior is covered by unit and component tests, and the smoke suite keeps passing.
