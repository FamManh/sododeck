# Feature Specification: Card Look "Deck"

**Feature Branch**: `029-card-look-deck`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "029 from docs/backlog.md" — Today's cards, groups, handles and connectors take board B's "Deck" look; connectors get a user-chosen line type (curved, elbow, straight), the only file-format change.

**Sources**: `docs/backlog.md` §029 (scope, acceptance criteria, risks) and the card-system intro (order §g-64, §g-65); `DESIGN.md` "Card system (Deck)" (tokens, card anatomy, states, groups, extended palette); `docs/design/design-analysis.md` §a frames 117–127 and founder decisions §g-58 (one card size at every zoom), §g-59 (tags on the card), §g-62 (collapsed group as a stack), §g-63 (direction B and the lip / dot rule), §g-64 (three line types), §g-66–§g-80 (defaults for mismatches between the design and earlier decisions); `specs/017-resize-edge-routing/spec.md` (stored card size, connector route and its movable middle segment); `specs/020-card-style/spec.md` (13 named colours, custom colours, fill and stroke); constitution v1.0.0 (principles I, II, III, IV, V, VI, VII).

**Dependency note**: 028 (design sync) is merged on `main` (`f2b0140`): frames 117–127 and the DESIGN.md tokens are in the repo. 036 (collab-ready document) is merged on `main` (`c1c8acd`): the stored layout is ADR 0021, and ADR 0022 (schema roadmap, accepted) already defines the field 029 adds, `edge.style.shape`. 029 builds on that layout (Clarifications). 025 (format compatibility) is deferred to before the first public release (§g-81), so 029 adds no handling for files from older or newer builds.

## Scope

**In scope**

- **Card frame** in the Deck look: thick-paper card with rounded corners, a border, a solid lip under the card in the border colour, a header (type icon in a small tile + type name), a title of up to 3 lines, a description of up to 3 lines, and tags as filled pills. Default width 184 for cards without a stored size; height computed from content; the same on-canvas size at every zoom level.
- **Card states**: hover, selected, has a problem, dimmed, being dragged, connection target, has children, highlighted neighbour, editing title — each with a cue that does not rely on colour.
- **Connection handles**: round knobs at the four side midpoints, with a larger orange active knob.
- **Groups**: the collapsed group drawn as a fanned hand of cards with its name and member count, met by the existing merged connectors; the expanded group frame with rounded corners and a label pill on its top edge.
- **Connectors**: 2px line in the Deck edge colour, rounded filled arrow at the end, small knob at the start.
- **Line type per connector**, chosen by the user: **curved** (default), **elbow** (today's orthogonal routing with 017's movable middle segment) and **straight**; set from the connection toolbar, the context menu and the detail drawer, for one connector or a multi-selection in one undo step; saved in the deck file.
- **Zoom rules**: no lip below 60 % zoom; tags shown as dots at System level; at Landscape the card shows its type icon on its colour fill.
- **Palette**: the 13 named colours gain chip, ink and dot values for light and dark themes, used by the type tile, tags and dots.
- **Export**: PNG and SVG export draw the Deck frame, lip, header, tags and line types as on the canvas.

**Out of scope**

- Flow playback styling: step stickers, dealt deck, numbered token, current-step orange lip in playback (035). The "current flow step" state is styled only as far as today's playback already marks a current card.
- Shapes (031), typed fields and field chips on cards (032), deck-level tag colours (033), card types and packs (030).
- Connector relationship styles, ×n bundle redesign, ends sliding along a side, drill-in proxies (§g-76; 022 and 034).
- Colouring connectors; a deck-wide default line type; changing the 13 named colours' fill / stroke (020's values stay, §g-66).
- Canvas dot-grid redesign beyond what the tokens already define.
- New end-to-end tests (constitution Principle VI, `TODO(e2e)`).

## Clarifications

### Session 2026-10-03

- Defaults from design-analysis §g-66–§g-80 are taken as decided for this feature (palette fill / stroke unchanged, width 184, weight 600 inside cards only, B's problem state, §g-58 / §g-59 detail per level, no lip below 60 %, B's connector stroke, tilt / lift / fan paint-only, B's tag size, custom colours as designed, states measured at 184 wide).
- Q: Must 029 wait for 036 (collab-ready document) before planning and building? → A: Yes. 029 is planned against 036's layout and schema roadmap (ADR 0022) and built after 036 merges; no migration of the line-type field is needed. 036 merged on 2026-10-03 (`c1c8acd`). (Revised after 036's plan landed; an earlier answer had 029 build first on today's layout.)
- Q: When an elbow connector with a moved middle segment is switched to curved or straight, is its stored `route.offset` kept? → A: Yes. The offset stays stored (unused); switching back to elbow restores the earlier route. Because an absent shape with an offset means elbow, the shape is then stored explicitly.
- Q: Which line type does a newly drawn connector get? → A: The last line type the user explicitly picked in this tab (curved until they pick one). It is UI-only session state, lost on reload, never stored in the deck; new connectors store `style.shape` only when it is not curved.
- Q: Where do curved and straight connectors attach to cards? → A: At the same side midpoints the existing routing picks for elbow (or the pinned sides); the three line types differ only in the path between those two points.
- Q: Does "no lip below 60 % zoom" apply to every board or only dense ones? → A: Every board, every card and every state (hover, selected, dragging included); no density threshold.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Existing decks open in the Deck look (Priority: P1)

A user opens any deck they made before this change. Every card, group frame, collapsed group, handle and connector is drawn in the Deck look. Nothing in the deck file changes just by opening it, and every card still shows its title, description, tags, colour and problem state.

**Why this priority**: The look is the feature. Every other story builds on cards and connectors already being drawn in the new style, and existing decks must keep working unchanged.

**Independent Test**: Open the demo deck and a deck saved before this change; compare the canvas with frames 117, 120, 121 and 125 (light and dark); compare the deck file before and after opening.

**Acceptance Scenarios**:

1. **Given** a deck saved before this change, **When** it is opened, **Then** every card renders with the Deck frame (rounded corners, border, lip, header tile, title, description, tags) and the deck file is byte-for-byte unchanged until the user edits something.
2. **Given** a card with no stored size, **When** it is drawn, **Then** it is 184 wide and as tall as its content; **Given** a card the user resized (017), **Then** it keeps its stored width.
3. **Given** a card with a title longer than 3 lines, **When** drawn, **Then** the title is cut after 3 lines with "…" and the full title shows in a tooltip; the same 3-line limit applies to the description.
4. **Given** a card coloured with one of the 13 named colours, **When** drawn, **Then** fill and border use the colour's existing fill and stroke, the lip uses the stroke, and the type tile and tags use the colour's chip and ink values.
5. **Given** a card with a custom deck colour, **When** drawn, **Then** fill, border and lip use the custom colour and tags use the custom colour with the automatically chosen text colour.
6. **Given** a card with an empty description and no tags, **When** drawn, **Then** those regions are not drawn and the card is shorter.
7. **Given** the dark theme, **When** any deck is shown, **Then** every Deck token uses its dark value.

---

### User Story 2 - Card states read at a glance and without colour (Priority: P1)

While editing, the user hovers, selects, drags and connects cards, and sees problems. Each state has a distinct Deck-style cue, and each cue is readable without relying on colour.

**Why this priority**: States are how users understand what they are acting on; the new frame must not lose or confuse any of them.

**Independent Test**: On a test deck, put cards into each state and compare with frame 122; check each state in greyscale.

**Acceptance Scenarios**:

1. **Given** a card, **When** the pointer hovers it, **Then** the card lifts 2px, its lip grows to 5px and its handles show.
2. **Given** a card, **When** selected, **Then** a 2px orange outline is drawn 2px outside the card.
3. **Given** a card with one or more problems, **When** drawn, **Then** a 1.5px dashed Clay outline is drawn 4px outside the card and a Clay Soft badge with a warning icon and the problem count sits in the header.
4. **Given** a card that is both selected and has a problem, **When** viewed in greyscale, **Then** both states are still distinguishable (solid vs dashed outline, warning icon with count).
5. **Given** a card being dragged, **When** the drag is in progress, **Then** the card is drawn tilted −2.5° with a 6px lip and a floating shadow; **When** dropped, **Then** its position, snapping and connector anchors are exactly what they would be without the tilt.
6. **Given** a dimmed card (focus mode, saved-view dimming), **When** drawn, **Then** it is shown at 22 % opacity; a highlighted neighbour stays at full opacity with its border and lip in Secondary.
7. **Given** a user dragging a new connection, **When** the pointer is over a valid target card, **Then** that card's border turns orange and the hovered side's handle shows as active.
8. **Given** a card with child components, **When** drawn, **Then** an "n inside" pill with a drill-in key hint is its last row.
9. **Given** a card whose title is being edited, **When** editing, **Then** the title keeps the same type and wrapping and the text selection uses the Deck selection colour.

---

### User Story 3 - Choose a connector's line type (Priority: P1)

A user wants some connectors as smooth curves, some as right-angled elbows and some as straight lines. They pick the line type for one connector or several at once, from the connection toolbar, the context menu or the detail drawer. The choice is saved with the deck.

**Why this priority**: This is the only data change in the feature and a direct founder request (§g-64); it also decides when 017's movable segment is available.

**Independent Test**: Select connectors, switch line types through each entry point, undo, reload, export and re-import the deck file.

**Acceptance Scenarios**:

1. **Given** a connector with no stored line type and no stored route offset, **When** drawn, **Then** it is a curved line.
2. **Given** a connector from a deck saved before this change that has a stored middle-segment offset (017), **When** drawn, **Then** it is an elbow line with that offset kept.
3. **Given** one selected connector, **When** the user picks "Elbow" in the connection toolbar, **Then** it is drawn as an orthogonal line, its middle-segment handle becomes available, and the choice is stored on the connector.
4. **Given** three selected connectors with mixed line types, **When** the user picks "Straight" from the context menu, **Then** all three become straight in a single undo step, and one undo restores each to its previous type.
5. **Given** a connector open in the detail drawer, **When** the user changes its line type there, **Then** the canvas and the read-only JSON panel update together.
6. **Given** a curved or straight connector, **When** selected, **Then** no middle-segment handle is shown.
7. **Given** an elbow connector with a stored offset, **When** the user switches it to curved and back to elbow, **Then** the earlier offset is restored.
8. **Given** a deck file with line types set, **When** exported and imported again, **Then** every connector has the same line type (lossless round-trip).
9. **Given** a mixed multi-selection, **When** the line type control is shown, **Then** it indicates that the selection is mixed rather than showing one type as current.
10. **Given** the user picked "Elbow" for a connector, **When** they then draw a new connector in the same tab, **Then** the new connector is elbow and undo removes it in one step; **When** the page is reloaded and they draw another, **Then** it is curved.

---

### User Story 4 - Zooming keeps cards the same size and quiets dense boards (Priority: P2)

A user zooms out over a large board. Cards never change size; below 60 % the lips disappear, at System level tags turn into small dots, and at Landscape each card shows only its type icon on its colour fill so the board stays readable.

**Why this priority**: The design's own risk is noise on dense boards (§g-63); this rule keeps large decks usable.

**Independent Test**: On the bench deck, zoom from 30 % to 400 % and compare against frame 123; measure a card's canvas size at each level.

**Acceptance Scenarios**:

1. **Given** a card on the bench deck, **When** zooming from 30 % to 400 %, **Then** its canvas size never changes.
2. **Given** any zoom below 60 %, **When** cards are drawn, **Then** no card shows a lip; at 60 % and above lips are shown.
3. **Given** the System zoom level, **When** a card with tags is drawn, **Then** each tag shows as a 6px dot in the card colour's dot value (a neutral dot when uncoloured) instead of a pill, in the same card size.
4. **Given** the Landscape zoom level, **When** a card is drawn, **Then** it shows its type icon on its colour fill (or the neutral surface when it has no colour) and no text.

---

### User Story 5 - Groups as a fanned hand and a Deck frame (Priority: P2)

A user collapses a group: it becomes a fanned hand of cards showing the group's name, member count and one small tile per member type; connectors from outside meet the hand as they meet today's collapsed group. Expanded, the group frame has rounded corners and a label pill on its top edge.

**Why this priority**: Groups are the main structure on large boards; they must match the new card look, but they reuse existing collapse and merged-connector behaviour.

**Independent Test**: Collapse and expand groups on a test deck, compare with frame 119, and check merged connectors and the expand action.

**Acceptance Scenarios**:

1. **Given** a collapsed group, **When** drawn, **Then** it appears as a front card with two back sheets fanned behind it, the group's name, a member-count disc and one tile per member, using the group's colour when set.
2. **Given** a collapsed group with connections to outside cards, **When** drawn, **Then** each neighbour has one merged connector to the hand with its existing count badge.
3. **Given** a collapsed group, **When** the user presses Enter or double-clicks it, **Then** it expands as today.
4. **Given** the fanned sheets, **When** selecting, snapping or anchoring connectors, **Then** only the unrotated front-card box is used.
5. **Given** an expanded group, **When** drawn, **Then** its frame has rounded corners and a label pill (chevron, name, member count) sitting on its top edge.

---

### User Story 6 - Exports match the canvas (Priority: P3)

A user exports a deck to PNG or SVG and gets the same Deck look they see: frame, lip, header, tags and connector line types. Today's export leaves the tag area empty; that gap is closed.

**Why this priority**: Export is how decks leave the app; it must not show a different look, but it is used less often than editing.

**Independent Test**: Export the demo deck to PNG and SVG and compare against the light-theme canvas at 100 %.

**Acceptance Scenarios**:

1. **Given** a deck with tagged, coloured cards and connectors of all three line types, **When** exported to SVG, **Then** cards show frame, lip, header tile, title, description and tag pills, and each connector has its line type, arrow and start knob.
2. **Given** the same deck, **When** exported to PNG, **Then** the image matches the SVG.
3. **Given** a card that was being hovered or dragged at export time, **When** exported, **Then** it is drawn in its resting state (no lift, tilt or hover lip).

### Edge Cases

- A file whose connector line type is not one of curved, elbow or straight: the file is invalid like any other schema violation; no special handling for files from other builds (ADR 0020 deferred, §g-81).
- An elbow connector with pinned sides (017) switched to curved or straight: the pinned sides are still honoured as the line's attachment sides.
- A self-loop connector (same card at both ends) in any line type: drawn as a visible loop and never as a zero-length line.
- Two cards so close that a straight or curved connector would be shorter than its arrow: the arrow is still drawn at full size and does not invert.
- A card resized narrower than the header needs (below ~150 wide): the problem badge shows icon and count, the type name ellipsises, the tile never shrinks.
- A card with ten long tags: tags wrap, the card grows to fit them; size is still the same at every zoom.
- A light custom colour that fails 3:1 as a border: drawn as chosen; the existing text-contrast warning from 020 is the only check (§g-79).
- Dragging several cards at once: each is tilted around its own centre; the group's relative layout on drop is unchanged.
- Reduced motion preferred by the operating system: hover lift and lip changes apply without animated transitions.
- A dense board of 200+ visible cards above 60 %: lips are drawn and pan / zoom stay within the bench budget (SC-004).

## Requirements *(mandatory)*

### Functional Requirements

**Card frame**

- **FR-001**: Cards MUST be drawn with a 14px corner radius, a 1.5px border (Border-strong, or the card's colour stroke), and a solid lip below the card in the border colour: 3px at rest, 5px on hover and on the current flow step, 6px while dragging; the lip has no blur.
- **FR-002**: Cards without a stored size MUST default to 184 wide with height computed from content (padding 12 vertical / 13 horizontal, gap 8 between regions); cards with a stored size (017) MUST keep it.
- **FR-003**: The card size MUST be computed from content (not measured from the drawn result) and MUST be identical at every zoom level.
- **FR-004**: The card header MUST show the card type's icon in a 24px rounded tile and the type name on one line with ellipsis, plus a right-aligned badge slot for pin and problem badge.
- **FR-005**: The title MUST use the Deck title style (14 / 600) and show at most 3 lines, then "…"; when cut, the full title MUST be available as a tooltip. The description MUST show at most 3 lines.
- **FR-006**: Tags MUST be drawn as filled pills 18px tall (10.5 / 500), up to 10, wrapping with gap 4, using the colour's chip fill and ink text.
- **FR-007**: Empty regions (no description, no tags, no children) MUST NOT be drawn and MUST NOT reserve space.
- **FR-008**: Font weight 600 MUST be used only inside the Deck card look (titles, badges, count discs); app chrome keeps 400–500.

**States**

- **FR-009**: Hover MUST lift the card 2px, grow the lip to 5px and show handles.
- **FR-010**: Selection MUST draw a 2px orange outline 2px outside the card.
- **FR-011**: A card with problems MUST show a 1.5px dashed Clay outline 4px outside the card and a Clay Soft badge with a warning icon and the problem count in the header.
- **FR-012**: Dimmed cards MUST render at 22 % opacity; highlighted neighbours MUST stay at full opacity with border and lip in Secondary.
- **FR-013**: While dragging, a card MUST be drawn tilted −2.5° with a 6px lip and floating shadow.
- **FR-014**: A valid connection target MUST show an orange border and the hovered side's handle active.
- **FR-015**: A card with child components MUST show an "n inside" pill with a drill-in key hint as its last row.
- **FR-016**: Lift, tilt, lip size and the fanned hand's rotation MUST be paint-only: snapping, hit tests, connector anchors, minimap, selection marquee and export MUST use the unrotated, unlifted card box.
- **FR-017**: Every state MUST have a cue that does not rely on colour alone (outline style, icon, badge text, opacity, lift).

**Handles**

- **FR-018**: Connection handles MUST be 12px round knobs (surface fill, 2px Secondary border) at the four side midpoints, and 16px orange with a 4px Orange Soft halo when active; no default grey handle dots MUST appear.

**Groups**

- **FR-019**: A collapsed group MUST be drawn as a fanned hand: two back sheets with the group's fill, stroke and lip rotated −7° and +4°, behind a front card showing a layers tile, the word "Group", a member-count disc, the group name and one small tile per member.
- **FR-020**: Existing merged connectors to a collapsed group MUST attach to the fanned hand's front card, keeping today's count badge and popover.
- **FR-021**: An expanded group frame MUST have a 20px corner radius, a 1.5px border (colour stroke or Border-strong), a fill (colour fill or Surface 2) and a label pill on its top edge with chevron, name and member count.

**Connectors**

- **FR-022**: Connectors MUST be drawn 2px in the Deck edge colour (light `#b4b4ab`, dark `#5a5a53`), with a rounded filled arrow at the end and a 3.5px-radius knob at the start; bidirectional and undirected connectors keep their existing end meaning in this style.
- **FR-023**: Each connector MUST support three line types: curved, elbow (orthogonal, today's routing with 017's movable middle segment) and straight.
- **FR-023a**: All three line types MUST attach at the same two points: the side midpoints chosen by the existing routing, or the pinned sides (017). Changing the line type MUST NOT move a connector's end points; only the path between them changes.
- **FR-024**: A connector with no stored line type MUST be drawn curved, except a connector with a stored middle-segment offset, which MUST be drawn elbow so its tweak is kept.
- **FR-025**: The movable middle-segment handle (017) MUST be shown only on elbow connectors.
- **FR-026**: Switching a connector away from elbow MUST keep its stored `route.offset` and pinned sides unchanged, so switching back restores the earlier route; a connector that has an offset and is not elbow MUST store its shape explicitly. Pinned sides MUST be honoured by every line type.
- **FR-027**: Users MUST be able to set the line type from the connection toolbar, the context menu and the detail drawer, for one connector or a multi-selection, as one undo step.
- **FR-028**: When the selected connectors have different line types, the control MUST show a mixed state.
- **FR-028a**: A connector the user draws MUST get the line type they last picked explicitly (toolbar, context menu or drawer) in the current tab, or curved if none; this memory is UI-only, is lost on reload, is not changed by undo, opening another deck or paste, and is never written to the deck. When it is not curved, the shape is stored in the same undo step as the connector's creation; when it is curved, no style is stored. Pasted, duplicated and imported connectors keep their own line type.
- **FR-029**: The line type control MUST be fully keyboard-operable and expose an accessible name and the current value (or "mixed") to screen readers.

**Zoom rules**

- **FR-030**: Lips MUST NOT be drawn below 60 % zoom, on every board regardless of card count and for every card state (hover, selected, dragging, current step); at 60 % and above they follow FR-001.
- **FR-031**: At System level, tags MUST be drawn as 6px dots using the card colour's dot value (neutral when uncoloured), without changing the card size.
- **FR-032**: At Landscape level, a card MUST show its type icon on its colour fill (neutral surface when uncoloured) and no text.

**Palette**

- **FR-033**: Each of the 13 named colours MUST provide chip, ink and dot values for light and dark themes in addition to the existing fill and stroke, which MUST stay unchanged.
- **FR-034**: Ink on chip MUST reach at least 4.5:1 contrast in both themes for every named colour, and this MUST be covered by an automated check.
- **FR-035**: Custom deck colours MUST use the custom colour for fill, border and lip, and for tag pills with the automatically chosen text colour; no additional contrast check is added (§g-79).

**File format**

- **FR-036**: The connector's line type MUST be stored as the optional `edge.style.shape` field (values curved, elbow, straight), as defined in the schema roadmap (ADR 0022); the connector style object exists only when it has at least one key and is shared with 022's later style keys. Files without it MUST open unchanged and MUST NOT gain the field until the user sets a line type.
- **FR-037**: The line type MUST round-trip losslessly through save, export and import, and MUST be visible in the read-only JSON panel.
- **FR-038**: The change MUST be additive (files valid before stay valid, `version` stays 1) and MUST match ADR 0022; any refinement made by this feature MUST be written back into that ADR.

**Export**

- **FR-039**: PNG and SVG export MUST draw the Deck card frame, lip, header tile, title, description and tag pills, groups in the Deck look, and connectors with their line type, arrow and start knob, in the export palette (light only, ADR 0016; a dark export stays out of scope).
- **FR-040**: Export MUST draw every card in its resting state (no hover, lift, tilt or drag lip) and MUST follow the canvas zoom rules only as far as export already does today (export at full detail).

**Performance and accessibility**

- **FR-041**: The canvas benchmark MUST show no regression in pan frame rate or long frames compared with the run before this change.
- **FR-042**: Hover and lift transitions MUST be disabled when the user prefers reduced motion.

### Key Entities

- **Card (component)**: Existing node. Drawn with the Deck frame; uses its stored size (017), style (020), tags and problem count. No new stored fields.
- **Group**: Existing group. Drawn as a Deck frame when expanded and as a fanned hand when collapsed. No new stored fields.
- **Connector (edge)**: Existing edge. Gains an optional **style** with **line type** (curved, elbow, straight). Its existing route (pinned sides, middle-segment offset) is kept and used by elbow lines.
- **Named colour**: One of 13 palette entries; gains chip, ink and dot values per theme next to fill and stroke. Design tokens, not stored in decks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % of existing decks (demo, sample and bench decks, and every round-trip test fixture) open in the Deck look with their stored file unchanged.
- **SC-002**: A card's on-canvas size is identical at every zoom step from 30 % to 400 %; lips are absent at every step below 60 % and tags are dots at System level.
- **SC-003**: Selected and problem states are distinguishable in a greyscale screenshot for every combination of the two.
- **SC-004**: The canvas benchmark (500 nodes / 1,000 edges) shows no regression in median pan frame rate and no increase in long frames versus the run before this change.
- **SC-005**: A user can change the line type of any number of selected connectors in at most 2 interactions from the connection toolbar, and undo it in one step.
- **SC-006**: Every connector's line type survives save → reload and export → import in 100 % of round-trip tests.
- **SC-007**: For all 13 named colours, ink on chip reaches at least 4.5:1 contrast in both themes.
- **SC-008**: Canvas screenshots of the demo deck match frames 117–123 and 125–126 in layout, sizes and states (allowing the founder-decision deviations §g-66–§g-80), in light and dark.
- **SC-009**: PNG / SVG exports of the demo deck show every card's tags and every connector's line type, matching the canvas at 100 %.

## Assumptions

- The defaults in design-analysis §g-66–§g-80 are accepted as decisions for 029 (listed under Clarifications).
- 029 is built on 036's document layout (ADR 0021, merged); it adds the connector style through that layout, key by key like the card style (020), and needs no migration (036 does not migrate stored decks, §g-82).
- The current-flow-step lip (5px) applies to whatever card today's playback marks as current; the full playback look (orange lip, stickers, dealt deck) is 035.
- "System" and "Landscape" are the existing semantic zoom levels from 010; their thresholds do not change.
- Merged connectors and their count badge / popover for collapsed groups already exist and are restyled, not redesigned (bundles are 034).
- The minimap, outline and JSON panel need no visual change beyond what the existing size and colour already give them.
- Tags keep the case the user typed (§g-64); tag colours are the card colour's chip / ink until 033 adds deck tag colours.
- No new runtime dependencies are needed.
