# Feature Specification: Saved Views and Auto-Layout

**Feature Branch**: `011-views-autolayout`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "011 (views-autolayout) from docs/backlog.md. Let users look at the same model through different saved views: a system view, a feature view, an infrastructure view and their own custom views. A view decides which components appear, which detail each component shows under its title (technology, hosting, or number of flows and owner), and can keep its own layout; editing a component in any view updates it everywhere. Users can create, rename and delete views. An automatic layout tidies the diagram in under two seconds for 200 components, never moves components the user pinned, and can be undone in one step. Why: infrastructure, feature and system diagrams otherwise live in different tools and drift apart."

**Sources**: `docs/backlog.md` §011 (scope, acceptance criteria, risks), `docs/spec.md` §5 (View entity: type, includes, pinned positions), §7 (V-4 saved views, C-4 auto-layout respecting pinned positions; V-5 role layers and V-6 sequence/swimlane are P1), `docs/design/design-analysis.md` §a rows for states 02, 20, 21, 22 (view switcher, Infra subtitle = host with clients dimmed to 0.4, Feature subtitle = "n flows · owner", "+" adds "Custom n" with a toast and no configuration UI), row 634 (no "Tidy layout" button or pin glyph designed; sensible default accepted), §g-22 (collapse state saved per view in 011, never on the group), `docs/decisions/0004-schema-v1-shape.md` (positions on the node, views may override per node, group bounds derived), `docs/decisions/0011-visible-graph.md` (visible graph derived from deck + UI state), `specs/010-zoom-groups-focus/spec.md` (drill-in, collapse, focus, "System view" crumb placeholder), constitution v1.0.0 (principles I–VIII; auto-layout of 200 nodes < 2 s off the main thread).

**Dependency note**: 010 is merged on `main` (`8ab6052`). The file format already has `View` with `type` (system / feature / infra / custom), `title`, `subtitleField`, `feature`, `includes` (node ids) and `positions` (per-node overrides). This feature needs **additive, optional** view fields for: pinned components, collapsed groups, excluded groups and kinds, and dimmed kinds. Older files stay valid; the schema, model mutations and a round-trip test cover them (constitution II).

## Scope

**In scope**

- **View switcher** in the top bar (design 02, 20, 21, 22): one tab per view in deck order, the current one highlighted, a "+" to add a custom view; the canvas breadcrumb's view crumb shows "<view title> view" (replacing 010's fixed "System view").
- **Built-in presets**: System (subtitle = tech), Feature (subtitle = "n flows · owner"), Infra (subtitle = host, client components dimmed); **custom views** with their own settings. Presets differ from custom views only in their default settings: views stay domain-neutral so the same mechanism serves BA, QA, PO and PM decks later (see Clarifications).
- **What a view stores**: which components it shows (excluded groups, kinds and tags, an optional feature, or an explicit component list), the subtitle field, dimmed kinds, its own component positions, pinned components and collapsed groups.
- **Create, rename, delete, configure** views; each is a document edit (undoable, synced across tabs, visible in the JSON panel's deck tab).
- **Edits propagate**: renaming, re-describing, re-connecting or deleting a component in any view changes the one model, so every view shows the change.
- **Search and hidden components**: ⌘K / global search results for components hidden in the current view are marked and offer "Show in <view>" instead of switching automatically.
- **Per-view layout**: moving a component in a view changes its position in that view only.
- **Tidy layout** (auto-layout): a canvas toolbar button arranges the components visible in the current view (or the drilled scope) without blocking the editor; pinned components keep their place; the whole layout is one undo step.
- **Pin / unpin**: a pinned component shows a pin glyph, keeps its position during Tidy layout and can still be moved by hand.
- **Per-view collapse state** (§g-22): 010's collapsed groups are remembered per view and saved in the deck.
- Keyboard and screen-reader support; light and dark themes.

**Out of scope**

- Role-based layers (V-5) and sequence / swimlane renderings (V-6), both P1.
- Saving drill-in scope, focus mode, zoom or viewport per view (they stay UI state as in 010).
- Layout algorithm choices or options exposed to users (direction, spacing); one default layout only.
- Per-view titles or descriptions for components (a view never forks component data).
- Sharing or exporting a single view (012 handles "current view" export scope).
- Reordering views by drag (views keep creation order; see Assumptions).

## Clarifications

### Session 2026-09-28

- Q: When are the built-in System, Feature and Infra views written into a deck that has none? → A: Only on the first view change; the switcher always shows them and opening a deck never changes it (FR-001, Edge Cases). Refined below: all three are written together.
- Q: Is "pinned" per view or one flag on the component? → A: Per view, matching per-view positions (FR-022).
- Q: Where does view configuration live (undesigned)? → A: "View settings…" popover from the view tab's menu (FR-043).
- Q: Will views still work when Sododeck becomes general-purpose (BA, QA, PO, PM, many component categories)? → A: Views must stay domain-neutral: System / Feature / Infra are presets (default settings only, no special behaviour); filters work by group, kind and tag; the kind and tag lists in settings come from the deck's own content (FR-002a, FR-012, FR-014, FR-020, FR-043).
- Q: When a deck with no saved views gets its first view change, what is written? → A: All three presets are written at once with their defaults, then the change is applied; from then on the saved list is the only source of views (FR-001). _Amended after analysis (2026-09-28): writing the presets is never an undo step, so ⌘Z undoes only the change and never removes saved views (keeps FR-050 true)._
- Q: Now that collapse is saved per view, is collapsing an undo step and synced across tabs? → A: Saved and synced across tabs, but never an undo step; ⌘Z skips it (FR-050, FR-044, User Story 5).
- Q: What happens when a component hidden in the current view is picked from ⌘K search? → A: Stay in the view; the result is marked "Hidden in this view" and a toast offers "Show in <view>" to switch (FR-016, Edge Cases).
- Q: What happens when ⌘Z undoes a change made in a different view? → A: Undo in place, stay in the current view, toast "Undid <action> in <view>" with "Go to <view>" (FR-045, Edge Cases).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Switch between System, Feature and Infra views of one model (Priority: P1)

An architect opens their Logistics deck. In the System view each component shows its technology. They click "Infra": subtitles switch to where each component runs, and the client apps fade. They rename "Order Service" to "Orders API" while in Infra, click "System", and the new name is there too.

**Why this priority**: one model seen through several lenses is the core promise of V-4 and stops infra and system diagrams from drifting apart.

**Independent Test**: on a deck with tech, host, owner and flows filled in, switch between the three built-in views and check subtitles, dimming and that an edit in one view shows in the others.

**Acceptance Scenarios**:

1. **Given** the Infra view, **When** it is selected, **Then** component subtitles show the host and client components are dimmed (reduced opacity plus a non-colour cue in their accessible name, "dimmed in this view").
2. **Given** the Infra view, **When** the user edits a component title there, **Then** the System and Feature views show the new title too.
3. **Given** the Feature view, **When** it is selected, **Then** each component's subtitle reads "<n> flows · <owner>" (n = flows with a step through that component; owner omitted when empty).
4. **Given** the System view, **When** it is selected, **Then** subtitles show tech, as before this feature.
5. **Given** any view, **When** the user switches views, **Then** the switch is announced ("Infra view") and selection, drill-in scope and focus reset.

---

### User Story 2 - Each view keeps its own layout (Priority: P1)

The architect moves the databases to the right in the Infra view to match their cloud regions. The System view keeps its original arrangement. Switching back and forth, each view shows its own positions.

**Why this priority**: without per-view positions, arranging one lens wrecks the others, and users stop using views.

**Independent Test**: move components in two views, switch between them, reload the deck, and check each view kept its positions.

**Acceptance Scenarios**:

1. **Given** a view with moved components, **When** the user switches views, **Then** each view shows its own positions.
2. **Given** a component never moved in a view, **When** that view is shown, **Then** the component appears at its base position (the System view's position).
3. **Given** positions changed in several views, **When** the deck is reloaded or exported and re-imported, **Then** every view shows the same positions as before.
4. **Given** a move in the Infra view, **When** the user presses ⌘Z, **Then** the component returns to its previous Infra position and no other view changes.

---

### User Story 3 - Tidy the layout without losing pinned components (Priority: P1)

The deck has grown to 200 components and looks messy. The architect pins the five they arranged carefully, then clicks "Tidy layout". Within two seconds the rest is neatly arranged by group and connection, the five pinned components have not moved, and one ⌘Z brings back the old arrangement.

**Why this priority**: large decks become unreadable without automatic layout (C-4, P0); pinning makes it safe to use.

**Independent Test**: on a 200-component deck with 5 pinned, run Tidy layout, measure time and editor responsiveness, check pinned positions and undo.

**Acceptance Scenarios**:

1. **Given** 200 components with 5 pinned, **When** "Tidy layout" runs, **Then** it completes in under 2 seconds, the editor stays responsive (panning and typing keep working) while it runs, the 5 pinned components do not move, and one ⌘Z restores all previous positions.
2. **Given** a selected component, **When** the user chooses "Pin position" (inspector toggle or canvas toolbar), **Then** a pin glyph appears on its card, its accessible name includes "pinned", and the change is one undo step.
3. **Given** a pinned component, **When** the user drags it, **Then** it moves and stays pinned.
4. **Given** several selected components, **When** the user pins them, **Then** all are pinned in one undo step; **When** some were already pinned and the user unpins, **Then** all selected become unpinned.
5. **Given** Tidy layout finishes, **When** the result is shown, **Then** members of each group stay together, no two components overlap, and the canvas fits the result.
6. **Given** a drilled-in group (010), **When** "Tidy layout" runs, **Then** only the members of that scope are arranged.
7. **Given** Tidy layout is running, **When** the document changes (edit in this or another tab), **Then** the result is still applied to the components that exist, components added meanwhile keep their positions, and deleted ones are skipped.

---

### User Story 4 - Create and manage custom views (Priority: P2)

The architect clicks "+", gets "Custom 1" with the toast 'View "Custom 1" created', renames it to "Checkout path", opens "View settings…" from the tab's menu, excludes the "Clients" group, the "external" kind and the "deprecated" tag, and sets the subtitle to owner. Those components are hidden only in this view. Later they delete an old custom view, confirm, and undo it from the toast.

**Why this priority**: custom lenses serve audiences the three built-ins don't, but the built-ins already deliver most of the value.

**Independent Test**: create, rename, configure and delete custom views; check what each shows, the toast, the confirmation, undo, and that other views are unaffected.

**Acceptance Scenarios**:

1. **Given** the view switcher, **When** the user clicks "+", **Then** a custom view "Custom <n>" (next free number) is added after the last view, becomes current, starts with all components at base positions, and the toast 'View "Custom <n>" created' shows.
2. **Given** a custom view, **When** the user excludes the "Clients" group, **Then** those components are hidden only in that view, and connections to them are hidden there too.
3. **Given** a view, **When** the user renames it (double-click its tab, or "Rename" in the tab's menu), **Then** the tab, breadcrumb and JSON panel show the new title; an empty title is rejected and the old title kept.
4. **Given** a view other than the last remaining one, **When** the user chooses "Delete view" and confirms, **Then** the view is removed, the switcher selects the view to its left (or the first), and the 6-second Undo toast shows (§g-11, §g-19); ⌘Z also restores it.
5. **Given** a component added while a view that excludes its group is current, **When** it is created, **Then** it stays visible in the view where it was created until the view is left (see Edge Cases) and the app says "Hidden in this view" when the user leaves.
6. **Given** any view, **When** the user picks a feature in its settings, **Then** only components touched by that feature's flows are shown; choosing "All features" shows every component.

---

### User Story 5 - Collapse state is remembered per view (Priority: P3)

In the System view the architect collapses "Core services"; in the Infra view it stays expanded. After reload both views look as they left them.

**Why this priority**: completes 010's collapse (§g-22) so a view is a durable lens; useful, but not essential for switching and layout.

**Independent Test**: collapse different groups in two views, switch, reload, export and re-import; check each view's collapse state.

**Acceptance Scenarios**:

1. **Given** "Core services" collapsed in System and expanded in Infra, **When** switching views, **Then** each view shows its own collapse state.
2. **Given** collapsed groups in a view, **When** the deck is reloaded, **Then** the same groups are collapsed in that view.
3. **Given** a rename followed by a collapse in a view, **When** the user presses ⌘Z, **Then** the rename is undone and the group stays collapsed (collapse is saved and synced, but never an undo step).
4. **Given** the same deck open in two tabs showing the same view, **When** a group is collapsed in one tab, **Then** it is collapsed in the other tab too.
5. **Given** the JSON panel's deck tab, **When** a group is collapsed, **Then** the view's collapsed list shows the group id and the group object itself is unchanged.

### Edge Cases

- **Deck with no views** (new or imported older file): the switcher shows System, Feature and Infra with their default settings; opening a deck never changes the document. The first view change (move in a non-base view, pin, collapse, rename, delete, settings or adding a view) writes all three presets with their defaults, then applies that change. Writing the presets is never an undo step: ⌘Z undoes only the change, and the saved views stay (FR-001, FR-050).
- **Deleting the first (base) view**: the next view becomes the base view. It keeps showing its own positions where it has them and base positions elsewhere, so its layout does not change; moving a component in it from then on changes the base position and drops its own position for that component (FR-020, FR-021).
- **Last view**: cannot be deleted; "Delete view" is disabled with the reason "A deck needs at least one view".
- **Deleting the current view**: the view to the left becomes current; its positions and collapse state apply.
- **Component deleted**: it disappears from every view, and its per-view positions, pins and inclusion entries are removed in the same undo step (existing reference-cleanup rules).
- **Group deleted**: it is removed from every view's excluded and collapsed lists in the same undo step.
- **Feature deleted** that a view points to: the view falls back to "All features" and the settings show that the feature is gone.
- **Component hidden in the current view** (excluded group, kind or tag): it is not drawn on the canvas in that view; ⌘K / global search still lists it, marked "Hidden in this view" (FR-016).
- **New component created in a view that hides its kind, group or tag**: it stays visible (with a "Hidden in this view" note on the card) until the user switches views, so a just-created component never vanishes under the pointer.
- **Flow through hidden components**: in flow mode (007) the steps touching hidden components are still listed in the player; their connections are not drawn and the player says "hidden in this view".
- **Flow mode and recording**: switching views is allowed in flow mode (the flow stays open); during flow recording the view switcher is replaced by the recording chip (design 41) as today; Tidy layout is disabled in both modes with a tooltip.
- **Tidy layout on an empty view or a view where every component is pinned**: the button is disabled with a tooltip ("Nothing to arrange" / "All components are pinned").
- **Tidy layout on a very large deck** (500 components): it may take longer than 2 seconds but the editor stays responsive, a progress indicator shows, and the user can cancel; cancelling changes nothing.
- **Tidy layout with collapsed groups**: a collapsed group is arranged as one card; its members move with it and keep their arrangement inside.
- **Two tabs edit views at once**: view creation, rename, delete, positions and pins merge like other edits (§g-35); the current view is per tab, so if another tab deletes the view this tab shows, this tab switches to the view on its left and announces it.
- **Undo across views**: ⌘Z (or redo) of a change made only in another view (its positions, pins, settings or Tidy layout) applies in place without switching views and shows a toast "Undid <action> in <view>" with a "Go to <view>" action (FR-045).
- **Duplicate view titles**: allowed (ids are stable); the tab tooltip shows the view type to tell them apart.
- **Many views**: tabs that do not fit collapse into a "More views" menu; the current view is always visible.
- **Old file with `positions` for unknown ids**: handled by existing integrity checks (015); nothing breaks.

## Requirements _(mandatory)_

### Functional Requirements

**Views and switching**

- **FR-001**: Every open deck MUST have at least one view and exactly one current view per tab. A deck without stored views MUST show the System, Feature and Infra presets with default settings. The first view change (any change to a view's settings, positions in a non-base view, pins, collapse state, title, or adding or deleting a view) MUST first write all three presets with their defaults and then apply that change. Writing the presets MUST NOT be an undo step (whatever the change is): ⌘Z undoes only the change, so undo never removes saved views or their collapse state (FR-050). From then on the stored list is the only source of views. Opening or switching views MUST NOT change the document.
- **FR-002a**: Views MUST be domain-neutral: a view's stored type MUST only choose its default settings when created and its tab tooltip; no behaviour (filtering, base positions, settings available) may depend on it.
- **FR-002**: The top bar MUST show a view switcher with one tab per view in stored order, the current view highlighted, and a "+" button (design 02, 20, 21, 22). The switcher MUST be keyboard operable as a tab list (←/→ move, Enter/Space select) and each tab MUST have an accessible name "<title>, <type> view".
- **FR-003**: Switching views MUST change which components and connections show, their subtitles, dimming, positions and collapse state, and MUST announce "<title> view". Switching MUST clear selection, drill-in scope and focus mode (010) and fit the canvas to the view's visible components, with the fit zoom clamped to 40–130% (as 010's drill-in fit).
- **FR-004**: The canvas breadcrumb's view crumb (010 FR-011) MUST read "<view title> view".
- **FR-005**: The current view MUST be tab-local UI state: it MUST NOT be written to the document; when a deck is opened, the first view is current.

**What a view shows**

- **FR-010**: A view's subtitle field MUST be one of: tech, host, "flows · owner", owner, none. Defaults: System = tech, Feature = "flows · owner", Infra = host, Custom = tech.
- **FR-011**: "flows · owner" MUST read "<n> flows · <owner>" where n is the number of flows with at least one step whose connection touches the component (singular "1 flow"); the owner part is omitted when empty, and "0 flows" is shown when none.
- **FR-012**: A view MUST be able to hide components by group (including nested groups inside it), by kind, by tag, or by an explicit list of included components; connections with a hidden end MUST be hidden in that view. Hiding never changes the components themselves.
- **FR-013**: A view MUST be able to dim components by kind (design 20: 0.4 opacity). Dimmed components MUST stay interactive and MUST carry a non-colour cue ("dimmed in this view" in the accessible name). Infra MUST default to dimming clients.
- **FR-014**: Any view MUST be able to point at one feature; it then MUST show only components touched by that feature's flows. Without a feature it shows all components.
- **FR-015**: Every edit to a component, group, connection, flow, rule or note MUST change the one model and MUST show in every view immediately (same tab and other tabs).
- **FR-016**: ⌘K / global search (009) MUST keep listing components hidden in the current view, marked "Hidden in this view" (text, not colour only). Choosing such a result MUST keep the current view and show a toast "<title> is hidden in this view" with the action "Show in <view>", where <view> is the first view in the list that shows it; that action (or pressing Enter again while the toast shows) MUST switch to that view and select the component. If no view shows it, the toast says so and offers no action.

**Positions and pins**

- **FR-020**: Each component MUST have a base position; the base view (the first view in the list) MUST use and edit the base positions. Every view, the base view included, MUST show a component at its own view-specific position if it has one, else at its base position.
- **FR-021**: Moving components in a non-base view MUST store view-specific positions for them in that view only; moving them in the base view MUST change base positions (and so every view without its own position for them) and MUST drop the base view's own position for those components, if it has one.
- **FR-022**: Each view MUST keep its own set of pinned components: a component pinned in one view is not pinned in the others, and Tidy layout in another view may move it there.
- **FR-023**: Users MUST be able to pin and unpin the selected components from the inspector ("Pin position" toggle) and from the canvas toolbar; each action is one undo step. Pinned components MUST show a pin glyph on the card at every detail level except Landscape, and "pinned" in their accessible name.
- **FR-024**: Dragging a pinned component MUST move it and keep it pinned.

**Tidy layout**

- **FR-030**: The canvas toolbar MUST have a "Tidy layout" button (with a tooltip and accessible name) that arranges the components visible in the current view, or only the drilled scope's members when drilled in (010).
- **FR-031**: Tidy layout MUST NOT move pinned components, MUST keep each group's members together, MUST avoid overlapping components, MUST lay out along connections (readable left-to-right flow), and MUST treat a collapsed group as one card whose members move together.
- **FR-032**: Tidy layout MUST NOT freeze the editor: panning, zooming, selection and typing MUST keep working while it runs, and a progress indicator with Cancel MUST show if it takes longer than 500 ms. Cancel MUST leave positions unchanged.
- **FR-033**: The positions written by one Tidy layout MUST be a single undo step; ⌘Z MUST restore every moved component's previous position in that view.
- **FR-034**: Tidy layout MUST write positions for the current view only (base positions in the base view, view-specific positions otherwise).
- **FR-035**: Tidy layout MUST be disabled, with a tooltip explaining why, during flow mode and flow recording, when the view has no visible components, and when every visible component is pinned.
- **FR-036**: When Tidy layout finishes, the canvas MUST fit the result and announce "Layout tidied, <n> components moved".

**Create, rename, delete, configure**

- **FR-040**: "+" MUST add a custom view titled "Custom <n>" (lowest unused n) after the last view, make it current, and show the toast 'View "Custom <n>" created' (design 22, 2.6 s).
- **FR-041**: Users MUST be able to rename a view by double-clicking its tab or choosing "Rename" from the tab's menu (right-click or the ⋯ / context-menu key); Enter commits, Esc cancels; empty or whitespace-only titles MUST be rejected.
- **FR-042**: Users MUST be able to delete a view from the tab's menu after a confirmation; afterwards the 6-second Undo toast MUST show (§g-11, §g-19) and ⌘Z MUST restore the view with all its settings, positions, pins and collapse state. The last remaining view MUST NOT be deletable.
- **FR-043**: Users MUST be able to change a view's settings from "View settings…" in the tab's menu, which opens a popover anchored to the tab with: subtitle field, groups to hide, kinds to hide, tags to hide, kinds to dim and the feature to limit to. The kind and tag choices MUST list only kinds and tags used in the deck (plus any already chosen), so new categories appear without changes to this feature. Each change applies at once and is one undo step; Esc or clicking outside closes the popover and returns focus to the tab.
- **FR-044**: Creating, renaming, deleting and configuring views, moving components in a view, pinning and Tidy layout MUST be document edits: undoable, autosaved (005), synced across tabs (§g-35) and shown in the JSON panel's deck tab. Collapse state follows FR-050.
- **FR-045**: When undo or redo reverses a change that affects only another view, the app MUST stay in the current view, announce it, and show a toast "Undid <action> in <view>" (or "Redid …") with a "Go to <view>" action that switches to that view. Changes to shared data (components, connections, base positions) and to the current view show no extra toast.

**Per-view collapse state**

- **FR-050**: 010's collapsed groups MUST be stored per view in the deck (§g-22), never on the group object; switching views MUST apply that view's collapse state. Collapsing and expanding MUST be saved (autosave), synced across tabs and shown in the JSON panel, but MUST NOT create undo steps: ⌘Z skips them like zoom or selection, and undoing other edits MUST NOT change collapse state (restoring a deleted view or group restores its collapse entries with it).
- **FR-051**: Drill-in scope, focus mode and zoom MUST remain UI state (010 FR-025 is superseded only for collapse state).

**File format and general**

- **FR-060**: The file format MUST gain only optional view fields (pinned components, collapsed groups, excluded groups, excluded kinds, excluded tags, dimmed kinds); files without them MUST stay valid and open unchanged, and every new field MUST round-trip losslessly through save, export and import.
- **FR-061**: References from views to components, groups and features MUST use stable ids; renaming never breaks a view, and deleting an object MUST clean its references from every view in the same undo step.
- **FR-062**: Every action in this feature MUST be reachable by keyboard, with accessible names and visible focus, in light and dark themes.
- **FR-063**: The screens MUST match design frames 02, 20, 21 and 22 (light and dark twins built from the tokens) except where DESIGN.md or founder decisions differ; the undesigned parts (settings surface, Tidy layout button, pin glyph) follow DESIGN.md components and tokens.
- **FR-064**: No part of this feature may send diagram content over the network.

### Key Entities

- **View**: a saved lens over the one model: id, type (system / feature / infra / custom, only the preset it started from), title, subtitle field, optional feature, component filters (included list, excluded groups, excluded kinds, excluded tags), dimmed kinds, view-specific positions, pinned components, collapsed groups. Stored in the deck, ordered.
- **Base position**: a component's own position, edited in the base (System) view; the fallback for every other view.
- **View-specific position**: a component's position in one view, overriding the base position there.
- **Pin**: a mark on a component in a view meaning "Tidy layout must not move it".
- **Current view**: which view this tab shows; UI state, not stored.
- **Layout run**: one Tidy layout request for a view (or drilled scope): its input positions, pinned set, result and status (running, done, cancelled); never stored.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Tidy layout of a 200-component view with 5 pinned components completes in under 2 seconds on a typical laptop, and the pinned components' positions are exactly unchanged.
- **SC-002**: While Tidy layout runs on the 500-component benchmark deck, panning stays at 60 frames per second or better.
- **SC-003**: Switching views on the benchmark deck updates the canvas within 200 ms.
- **SC-004**: An edit to a component in any view is visible in every other view the next time it is shown, in 100% of cases (verified on fixtures across all view types).
- **SC-005**: Exporting and re-importing a deck with several configured views (positions, pins, filters, collapse state) reproduces every view identically.
- **SC-006**: One undo reverses a whole Tidy layout in 100% of runs.
- **SC-007**: Every story can be completed with the keyboard only, and an automated accessibility check reports no violations on the view switcher, settings and Tidy layout states, in light and dark themes.
- **SC-008**: In moderated tests, at least 4 of 5 users create a custom view that hides one group and arrange it with Tidy layout within 2 minutes, without help.

## Assumptions

- The first view in the list is the base view (with the presets, System); no rule depends on view type.
- The subtitle choices (tech, host, "flows · owner", owner, none) stay a fixed list in this feature; open-ended subtitles need user-defined card attributes (§g-40, later).
- Views keep creation order; reordering by drag is later work.
- Preset defaults: System shows all components with tech; Feature shows all components with "flows · owner" and no feature selected; Infra shows all components with host and dims clients; Custom shows all components with tech and no dimming.
- The existing `includes` list (explicit component list) is honoured when present; the settings UI edits exclusions by group, kind and tag, which also cover components added later.
- Tidy layout uses one fixed left-to-right layered arrangement by group; users cannot tune it in this feature.
- Tidy layout runs off the main thread with the layout engine already named in the constitution (confirmed in the plan); it is loaded only when first used, so it does not slow editor start-up.
- The Tidy layout button and pin glyph use the defaults accepted in design-analysis row 634 (canvas toolbar button, lucide pin icon); DESIGN.md tokens apply.
- Toasts, confirmations and the Undo toast reuse the existing components (003, 005).
- Performance-sensitive changes are measured with `pnpm bench` before and after (AGENTS.md).
- 018 (canvas-first layout) will later move the switcher and toolbar; this feature targets the current layout.
