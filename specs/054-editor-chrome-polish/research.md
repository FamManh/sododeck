# Research: Editor chrome polish

## R1. Where does Deck settings go?

**Decision**: an icon button (`Settings2`) in the tools island, before Jump to. It calls the same
`openDrawer('deck')` the menu uses and toggles (second press closes). The menu keeps its item.
**Rationale**: founder asked for the top-right toolbar; the island already hosts global tools and
loses Focus, so it stays the same width (Jump, Labels, Settings). **Alternative**: deck island,
rejected by the founder (top-left is crowded).

## R2. Views: rename in place, do not migrate

**Decision**: change only `title` of the two presets (`system` → "Overview", `feature` → "Flows") and
remove the `infra` preset. Keep ids and types. Nothing is written to existing decks.
**Rationale**: presets are shown only while `file.views` is empty and are written on first view change
(011). Decks with stored views keep whatever titles they were saved with. Changing ids or types would
need a schema enum change and a migration for no user benefit. `viewTabName` currently appends the
type ("Overview, system view"); it will drop the type for built-in presets and keep it for custom.
**Alternative**: new ids `overview` / `flows` with a type enum bump; rejected (format change).
**Risk**: a deck whose stored views are an old preset set shows "System / Feature / Infra" forever;
accepted by the spec (FR-005).

## R3. Focus in the rail

**Decision**: a rail toggle button right after the pointer button (`Focus` icon, `aria-pressed`,
shortcut `F`, same disabled rule as now: flow session or flow mode, with the reason in the tooltip).
It reads and writes `focusMode` in the UI store; no behaviour change. `ISLAND_SIZES.rail` counts 11
buttons. **Rationale**: Focus is a canvas mode, like Select / Hand. **Alternative**: merge into the
Select button like Hand; rejected (Select / Hand already toggle there).

## R4. Table detail control

**Decision**: always the dropdown form (today's compact one), trigger `Detail: <label>` with the
`Rows3`-style icon, and each radio item shows a second line: Auto: "Follows the zoom level"; Names:
"Table and column names only"; Keys: "Names plus key columns"; All: "Every column with type and notes"
(final copy checked against `table-display.ts` behaviour in tasks). The segmented control goes away.
**Rationale**: one button width, explanations visible when opened, one code path (the compact
shell already uses it). **Alternative**: keep the segmented control with tooltips; rejected (still
four buttons wide).

## R5. Spread ends evenly

**Decision**: add `description: 'Space the connector ends evenly along each side of the selected
cards'` to `SPREAD_ENDS_ACTION`; the menu and toolbar already show `description` for enabled items
and `disabledReason` for disabled ones. Reword the disabled reason to say what is needed: "Needs a
side with two or more connector ends". **Rationale**: the infrastructure exists (`Action.description`).

## R6. Lock: groups and select-all, no new data

**Decision**: `node.lock` is also offered for the `group` and `mixed` targets. Locking collects the
ids of every card in the selected groups (descendants through `group.parent`) plus selected cards and
calls `editor.setLocked(ids, true)` once (one undo step). A group is _locked_ when it has at least
one descendant card and all are locked (derived, `isGroupLocked`). Locked groups refuse drag, resize
and delete with the existing `LOCKED_HINT`. The label reads Unlock only when every collected card is
locked. Connectors and stickies in a select-all are skipped: they have no lock yet (stickies and
connector lock arrive in 053). The announcement counts cards.
**Rationale**: group frames store `position` and `size`, but members stay `node.locked`; deriving
avoids a schema field and keeps old files valid. A card added later to a locked group is unlocked, so
the group stops reading as locked until it is locked again (spec US5-6) and its frame follows.
**Alternative**: `Group.locked` in the schema (additive); rejected (format change, two sources of
truth for one state).

## R7. DBML drawer

**Decision**: a second right drawer, `CodeDrawer`, with tabs DBML and SQL, always the whole schema.
State: `codeDrawer { open, width, format }` in the UI store, persisted with the JSON panel prefs
(`sododeck.jsonPanel`, per browser): `format: 'dbml' | 'sql'`, `width`, `open`. The JSON panel drops
`format` (stored `dbml` / `sql` values read as JSON) and the scope switch. `DbmlTab` / `SqlTab` are
reused unchanged apart from receiving the fixed scope `'schema'` and dropping the "Select tables, or
switch to Whole schema" copy; the `schemaScope` pref and Selection code path stay, hidden.
**Layout**: right edge `EDGE`; when the details drawer is open the code drawer sits to its left
(`right = EDGE + detailsWidth + EDGE`). Width 320 to `min(70% viewport, viewport − FLYOUT_LEFT −
detailsWidth − 2·EDGE − 240)` (a 240 px canvas strip), never below 320; if 320 does not fit, opening
one closes the other. Compact shell: 35% share like the details drawer, only one open at a time.
The zoom island and the JSON overlay move left by the total width of open drawers.
**Resize**: generalise `DrawerGrip` to take `min`, `max`, `onChange`, `onCommit` (same keys: ←/→ 8 px,
⇧ 40 px, Home / End), or copy it as `CodeDrawerGrip` if the generalisation touches too many tests;
decided in tasks, favouring generalisation.
**Rationale**: separate state means neither surface hides the other (spec US7); lazy chunks and the
editor's apply / undo behaviour are untouched. **Alternative**: reuse the details drawer's slot with a
mode; rejected (cannot show details and DBML together, width cap 560).

## R8. Hiding the scope switch

**Decision**: remove the control from the header and pass `'schema'`; do not delete `SchemaScope`,
`setSchemaScope`, or the selection branch of the writers (parked, 046). A stored `selection` scope is
ignored when rendering and left in storage. **Test**: the tabs render the whole schema with a table
selected and with nothing selected.

## R9. Keyboard and regions

**Decision**: add `'code'` to `REGION_ORDER` (after `drawer`), F6 reaches it when open; Esc closes
the drawer and returns focus to its opener (the same as the details drawer). A command-palette entry
"Open DBML / SQL" and a menu item open it; no new shortcut (spec Assumptions).

## R10. ADR

**Decision**: no ADR. No format, storage or dependency decision. The group-lock derivation is
recorded here and in `contracts/ui.md`.
