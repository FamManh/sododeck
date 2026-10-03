# Feature Specification: Connection Focus and Drill-in

**Feature Branch**: `034-connection-focus-and-drill`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "034 from docs/backlog.md" — B's "Connections and focus" row: hover or select a card to light up its connections and dim the rest, parallel connectors between the same two cards bundle into one curve with a count, drill-in shows "Inside <card>" with dashed outside proxy cards.

**Sources**: `docs/backlog.md` §034 (scope, out of scope, acceptance criteria) and the card-system intro (order §g-64, §g-65); `DESIGN.md` "Card system (Deck)" > Connectors (highlighted Ink 2.75px, dimmed 20 %, bundle count 22px Ink pill "×n", drill-in outside proxy 150 wide dashed); `docs/design/design-analysis.md` frame 118 "Connections and focus" (a hover, b bundle, d drill-in; c is owned by 022); `docs/decisions/0022-schema-roadmap.md` (`edge.relation` reserved and not scheduled); `specs/029-card-look-deck/spec.md` (Deck card, connectors, collapsed group with merged connectors); constitution v1.0.0.

**Dependency note**: 029 (card look "Deck") is merged on `main`. Today the app already has a focus mode (toggle, F) that dims cards not connected to the selected one, merged connectors with a count popover for collapsed groups, and port pills for drill-in. 034 changes how these look and behave; it does not add a new way to open them. It runs independently of 033 and 035. It adds no schema field and depends only on 029.

## Scope

**In scope**

- **Hover focus**: resting the pointer on a card (or keyboard-focusing it) highlights that card's connections and neighbours and dims everything else, with no toggle and no click. Leaving restores the canvas.
- **Highlighted look**: connected connectors draw in Ink at 2.75px, neighbours keep their full look, everything else drops to 20 % opacity (`DESIGN.md` Connectors). Today's focus mode (F) keeps working and uses the same look.
- **Bundles**: two or more connectors between the same pair of visible cards draw as one curve with a "×n" count pill. Clicking the count fans the bundle out into its individual connectors; clicking again (or Esc, or clicking the canvas) folds it back.
- **Drill-in header and proxies**: inside a group or card the canvas shows an "Inside <name>" title with the count of what is inside, and each external connection ends on a dashed **outside** proxy card (type icon, title, "Outside") instead of today's port pill. Clicking a proxy focuses it; double-clicking it (or ⏎ on it) leaves the drill-in and selects the real card.
- Light and dark themes; reduced motion; focus states readable without colour; keyboard-operable.

**Out of scope**

- Relationship types with their own colour and dash (calls, reads, writes, depends on) and the header legend with counts (frame 118 a and d legends). They need `edge.relation` in the schema and belong with 022 (ADR 0022: reserved, not scheduled).
- Any change to the file format.
- Moving a connector end along a side with snapping and a readout (frame 118 c), and any other free-anchor behaviour: owned by 022 (founder decision, 2026-10-03).
- Creating, rerouting or restyling connectors (022, 017).
- The flow playback look (035) and tag colours (033).
- New end-to-end tests (constitution Principle VI, `TODO(e2e)`).

## Clarifications

### Session 2026-10-03

- Defaults from backlog §034 and `DESIGN.md` Connectors are taken as decided: Ink 2.75px highlight, 20 % dim, "×n" Ink pill, 150px dashed outside proxy, no `edge.relation`.
- Q: Does hover focus replace the Focus toggle (F)? → A (default): **no**. F keeps pinning the focus on the selected card (it survives pointer movement); hover focus is the transient version and gives way to a pinned focus or to flow playback.
- Q: Does a bundle count connectors in both directions? → A (default): yes, any connector between the same two cards in either direction; the curve shows arrowheads for each direction that exists, and the count popover (today's merged-connector list) still lists each connector with its direction.
- Q: What happens to hover focus while a flow plays, a card is dragged, or a connector is being drawn? → A (default): it is suspended, so it never fights the flow look (035), the drag or the connection target highlight.
- Q: The end-along-a-side move needs 022's free anchors; does 034 own it? → A (founder, 2026-10-03): **no**. It moves to 022, so 034 depends only on 029 and can run in parallel with 033 and 035.
- Q: Do connectors with a route the user adjusted (017: chosen sides or moved middle segment) join a bundle? → A: **no**. Only connectors on the automatic route bundle; an adjusted connector always draws on its own, even between the same two cards. 022 applies the same rule to connectors with their own waypoints or style.
- Q: When 022 adds per-connector colour and dash, does a highlighted connector keep its own style? → A: 034 highlights every connector in Ink at 2.75px (no connector has its own colour yet); **022 decides** whether a styled connector keeps its colour when highlighted. The highlight sets colour and weight separately so 022 can change the colour rule alone.
- Q: While a flow is shown or playing (007 / 035), how does a bundle that contains one of the flow's connectors draw? → A: the flow's connectors leave their bundle and draw on their own (with 035's step look and token); the rest of the bundle stays bundled with its count lowered. Leaving the flow re-forms the bundle.
- Q: Does hover focus start as soon as the pointer touches a card? → A: no, after the pointer rests on the card for about 150 ms; moving from a focused card straight to another switches at once; leaving clears it after a grace of about 100 ms. Keyboard focus applies at once.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Hover a card to see what it connects to (Priority: P1)

A user looks at a busy deck and rests the pointer on "Order Service". Its neighbours and the connectors between them stay at full strength and the connectors turn Ink; everything else fades. Moving away restores the deck.

**Why this priority**: This is the core value: reading connections without clicking or toggling anything. The other stories build on the same highlighted look.

**Independent Test**: On the benchmark deck, hover a card and check that non-neighbours are dimmed within one frame and restored when the pointer leaves.

**Acceptance Scenarios**:

1. **Given** a card with 3 neighbours, **When** the pointer rests on it for about 150 ms, **Then** the card, its 3 neighbours and their connectors keep full opacity, the connectors draw in Ink at 2.75px, and every other card and connector drops to 20 % opacity within one frame.
2. **Given** hover focus is showing, **When** the pointer leaves the card, **Then** the whole canvas returns to its resting look within one frame.
3. **Given** the pointer moves from one card straight to another, **When** it enters the second, **Then** the focus moves to the second card with no flash of the undimmed deck in between.
4. **Given** a card is focused with the keyboard (Tab or arrow keys), **When** it receives focus, **Then** it shows the same highlight as hover, and it clears when focus moves away.
5. **Given** the Focus toggle (F) is on or a card is selected with focus pinned, **When** the pointer hovers another card, **Then** the pinned focus stays and hover does not change it.
6. **Given** a flow is playing, a card is being dragged, or a connector is being drawn, **When** the pointer passes over cards, **Then** no hover focus is applied.
7. **Given** the deck has a saved view that already dims some cards, **When** hover focus shows, **Then** the dimmed cards stay dimmed and the combined look remains readable.

---

### User Story 2 - Parallel connectors bundle into one curve (Priority: P1)

Between "Order Service" and "Payment gateway" there are four connectors (two calls, a read, a write). On the canvas they draw as one smooth curve with a "×4" pill instead of four overlapping lines. Clicking the pill fans them out.

**Why this priority**: Overlapping parallel connectors hide information and make the canvas look broken; bundling fixes the most common clutter.

**Independent Test**: In a deck with three connectors between two cards, check the canvas shows one curve with "×3", fan it out, and fold it back.

**Acceptance Scenarios**:

1. **Given** three connectors between the same two visible cards, **When** the canvas draws them, **Then** one curve with a "×3" Ink pill (22px, 2px canvas ring) is shown instead of three lines.
2. **Given** a bundle, **When** the user clicks the "×3" pill, **Then** the three connectors draw separately (each with its own route and label), and clicking the pill again, pressing Esc, or clicking empty canvas folds them back.
3. **Given** a bundle, **When** the user hovers either card, **Then** the whole bundle highlights as one connection with its count.
4. **Given** two connectors between a pair of cards, **When** one is deleted, **Then** the remaining one draws as an ordinary connector with no count pill.
5. **Given** connectors in opposite directions between two cards, **When** they bundle, **Then** the curve shows an arrowhead for each direction present.
6. **Given** a bundle, **When** the user selects it, **Then** the inspector or popover lists each connector with its label and direction, and each can be selected, edited or deleted on its own.
7. **Given** a single connector between two cards, **When** the canvas draws it, **Then** it looks exactly as before (no pill, no change).

---

### User Story 3 - Drill-in shows where things connect outside (Priority: P2)

A user drills into "Order Service". The canvas shows "Inside Order Service · 4" and its four components. Connections to cards outside end on dashed "Outside" proxy cards (API Gateway, Auth service, Orders DB, Event bus). Selecting a proxy and pressing ⏎ takes the user back out to that card.

**Why this priority**: Drill-in already works; the proxies make external connections readable and navigable. It is valuable but not blocking.

**Independent Test**: Drill into a group with external connections, check the header and the dashed proxies, then use ⏎ on a proxy to leave and land on the real card.

**Acceptance Scenarios**:

1. **Given** a drill-in with 4 cards inside, **When** it opens, **Then** the canvas shows "Inside <name>" with a count of 4 and the breadcrumb path.
2. **Given** a connection from an inside card to an outside card, **When** drilled in, **Then** it ends on a dashed outside proxy (150px wide, type icon, title, "Outside") placed just outside the drilled-in content: in a left column when every connection comes in from that card, otherwise in a right column.
3. **Given** several inside connections to the same outside card, **When** drilled in, **Then** they share one proxy, and the connectors to it bundle as in Story 2 when they join the same two cards.
4. **Given** an outside proxy, **When** the user double-clicks it or presses ⏎ on it, **Then** the drill-in closes to the level that contains the outside card, the real card is selected and brought into view.
5. **Given** an outside proxy, **When** the user tries to move, resize or edit it, **Then** nothing changes in the deck (proxies are views, not cards).
6. **Given** a drill-in, **When** the user hovers an inside card, **Then** hover focus (Story 1) treats proxies as neighbours.
7. **Given** a drill-in where nothing connects outside, **When** it opens, **Then** no proxies are shown and the header still shows the count.

---

### Edge Cases

- A card with no connections: hover shows the card alone at full strength and dims the rest; the deck is not left blank.
- A card connected to nearly every other card: hover focus keeps them all at full strength; nothing misleading is dimmed.
- Pointer jitter at a card edge or sweeping across a dense deck: focus must not flicker; the rest delay (about 150 ms) on entering and the grace delay (about 100 ms) on leaving avoid strobing.
- Hover on touch devices (no hover): hover focus does not apply; tap-to-select with pinned focus remains.
- A bundle whose connectors have different labels: the pill shows only the count; labels appear when fanned out or in the popover.
- Fanned-out bundle and a card moved: the fan follows; folding it back works after the move.
- A bundle at very low zoom: at System level the pill shrinks to a small Ink dot (no number, per 029's "chips as dots at System level" rule) and at Landscape level only the curve is drawn; the count never overlaps the cards, and fan-out still works from the bundle popover.
- A flow step runs between two cards joined by a "×3" bundle: in flow mode the step's connector draws on its own with the step look and the other two show as "×2"; closing the flow shows "×3" again.
- A connector between a card and itself (self-loop): not bundled with others and drawn as today.
- A pair with two automatic connectors and one adjusted connector: the two draw as one "×2" bundle and the adjusted one keeps its own route beside it. Resetting the adjusted one's route (`R`) makes it join the bundle ("×3"); adjusting a bundled connector (e.g. after fan-out) takes it out of the bundle.
- A collapsed group's merged connector (029): keeps today's behaviour (click or ⏎ opens its list) and takes the same Ink "×n" pill as a bundle (`DESIGN.md` Connectors).
- Drill-in into a group with more than about 12 external neighbours: proxies stay legible (stacked, no overlap) and scroll with the canvas.
- An outside card that is itself hidden (collapsed in an outer group): the proxy stands for the visible representative and selecting it leaves the drill-in to that representative.
- Reduced motion: dimming, highlighting and fan-out change state without animation; no information is conveyed by motion alone.
- High contrast and without colour: highlighted connectors differ by weight and neighbours by full opacity, not by hue.
- Very large decks: hover focus must not cause a measurable drop in pan, zoom or drag smoothness (SC-005).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Resting the pointer on a card for about 150 ms, or focusing it with the keyboard (at once), MUST highlight its connections and neighbours and dim all other cards and connectors, without a click or a toggle, and MUST restore the canvas when the pointer or focus leaves (after a grace of about 100 ms for the pointer). Moving the pointer from a focused card straight onto another MUST switch the focus at once, with no rest delay. Passing the pointer across cards without resting MUST NOT dim the canvas.
- **FR-002**: The highlighted look MUST be: connected connectors in Ink at 2.75px; neighbour cards at full opacity with their border and lip in Secondary; other cards at 22 % and other connectors and labels at 20 % opacity (`DESIGN.md` Card states and Connectors); the same look MUST be used by pinned focus (F). Colour and weight MUST be applied as separate rules so 022 can keep a connector's own colour without changing the weight rule.
- **FR-003**: A pinned focus (F on a selected card) MUST take priority over hover focus; hover focus MUST be suspended during flow playback, dragging, resizing and connector drawing.
- **FR-004**: Hover focus MUST combine with a saved view's dimming without hiding cards the view dimmed more strongly, and MUST NOT change selection, the document or the undo history.
- **FR-005**: Two or more connectors on the automatic route between the same pair of visible cards, in either direction, MUST draw as one curve with a "×n" Ink pill (22px, 11.5 / 700 text, 2px canvas ring) showing the number of bundled connectors; self-loops and connectors with an adjusted route (017 `edge.route`) MUST NOT bundle and MUST draw as today.
- **FR-005a**: While a flow is shown or playing, connectors that belong to that flow MUST NOT be bundled and MUST draw on their own with the flow look (035); the remaining connectors of the pair MUST stay bundled if two or more remain, with the count updated, and the bundle MUST re-form when the flow is closed. While a flow is being recorded (006), no connector MUST be bundled, so every connector can be clicked as a step.
- **FR-006**: Clicking a bundle's count MUST fan the bundle out into its individual connectors, and clicking again, Esc, or clicking empty canvas MUST fold it back; the fanned state is UI-only and is never saved in the deck.
- **FR-007**: A bundle MUST highlight as one connection under hover focus and MUST draw an arrowhead for each direction present; selecting it MUST expose each underlying connector for selection, editing and deletion.
- **FR-007a**: A bundle MUST be fully operable by keyboard: ⏎ on a focused bundle opens its list (as for a collapsed group's merged connector today), and the list offers Fan out / Fold plus Select and Delete for each connector.
- **FR-008**: A pair that drops below two connectors MUST draw as an ordinary connector with no count; a pair with one connector MUST look exactly as before this feature.
- **FR-009**: Drilling into a group or card MUST show an "Inside <name>" header with the count of what is inside and the existing breadcrumb path.
- **FR-010**: Each connection from inside the drill-in to an outside card MUST end on a dashed outside proxy (150px wide, 1.5px dashed Secondary, radius 14, canvas fill, type icon, title 12.5 / 600, "Outside" 10 Muted); connections to the same outside card MUST share one proxy.
- **FR-011**: Activating an outside proxy (double-click or ⏎) MUST leave the drill-in to the level containing the real card (or its visible representative) and select and reveal it; proxies MUST NOT be movable, resizable or editable and MUST NOT be stored in the deck.
- **FR-012**: Today's port pills MUST be replaced by the outside proxies without losing what they offer today (navigating out to the real card, keyboard access). Navigating out moves from a single click to double-click or ⏎ (FR-011), so a click can focus a proxy without leaving the drill-in.
- **FR-013**: All highlight, bundle and proxy states MUST be readable in light and dark themes and without relying on colour alone (weight, opacity, dash, count text).
- **FR-014**: Hover focus, bundling and proxies MUST be keyboard-operable and expose roles and labels to assistive technology (a bundle announces its count and endpoints; a proxy announces "<title>, outside, press Enter to go to it"); reduced motion MUST remove any animation without removing information.
- **FR-015**: This feature MUST NOT change the file format, MUST NOT add a connector relationship type or legend, and MUST NOT make any network call.
- **FR-016**: Decks saved before this feature MUST open and render correctly with no rewrite; a deck exported and imported MUST be unchanged by 034.

### Key Entities

- **Focus set**: the card under the pointer or focus, its neighbours and the connectors between them; derived from the document each time, never stored.
- **Bundle**: the group of automatic-route connectors between one pair of visible cards, drawn as one curve with a count; derived, never stored; its fanned-out state is UI-only.
- **Outside proxy**: a read-only stand-in for a card outside the current drill-in, placed in a column just outside the drilled-in content; derived, never stored.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On the 500-card benchmark deck, once the rest delay (about 150 ms) has passed, hovering a card dims every non-neighbour within one frame (under 16 ms at the benchmark's measured baseline) and restores on leave.
- **SC-002**: In a deck with three connectors between two cards, the canvas shows exactly one curve with "×3"; fanning out shows exactly three connectors; folding back shows one curve again, in 100 % of cases tried.
- **SC-003**: A user can find all connections of a given card in a dense deck in under 3 seconds by hovering it, without clicking or toggling anything.
- **SC-004**: Every outside connection in a drilled-in group ends on exactly one proxy, and 100 % of proxies take the user to the right card with one action (⏎ or double-click).
- **SC-005**: On the 500-node, 1,000-edge benchmark deck, pan, zoom and drag stay within the existing canvas targets with no measurable drop beyond run-to-run variation, with hover focus and bundles active (`pnpm bench` before and after).
- **SC-006**: The whole feature (hover or focus a card, fan out and fold a bundle, drill in, go to an outside card) can be done with the keyboard alone.
- **SC-007**: A deck saved before this feature opens and renders with no change to its data, and its export is identical before and after.

## Assumptions

- The highlighted look, dim level, count pill and proxy size come from `DESIGN.md` "Card system (Deck)" and frame 118; `DESIGN.md` wins where they differ.
- Relationship types and the legends in frame 118 (a and d) are not drawn in 034; the highlighted connectors use Ink for all connectors. Whether a connector styled by 022 keeps its own colour when highlighted is 022's decision.
- No schema change: bundles, focus sets, fan-out and proxies are all derived from the document or kept as UI-only state.
- 034 depends only on 029. Moving a connector end along a side (frame 118 c) belongs to 022, not to 034.
- Today's focus mode (F), merged connectors for collapsed groups and the drill-in breadcrumb stay; 034 only changes their look and adds hover, bundles and proxies.
- Real-time collaboration is out of scope; the document model stays collaboration-ready (036).
- This feature is independent of 033 and 035 and may be built in parallel with them; 035 owns the look during flow playback, and hover focus yields to it.
