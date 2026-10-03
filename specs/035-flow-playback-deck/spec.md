# Feature Specification: Flow Playback "Deck"

**Feature Branch**: `035-flow-playback-deck`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "035 from docs/backlog.md" — Playing a flow deals the deck: played cards get a ✓ sticker, the current card lifts on an orange lip with a number sticker, upcoming cards show a dashed number, the token is a numbered disc, and branch points and error paths follow board B's style.

**Sources**: `docs/backlog.md` §035 (scope, acceptance criteria) and the card-system intro (order §g-64, §g-65); `DESIGN.md` "Card system (Deck)" (card states "Current flow step", edge states, "Flow playback (117, owned by 035)", `flow-token`); `docs/design/design-analysis.md` §a frames 117 (signature moment), 118, 119 and 122, and founder decisions §g-62 (playing a flow deals the deck), §g-63 (direction B), §g-73 (token and stickers replace the 5px dot token); `specs/007-flow-playback/spec.md` (flow mode, step player, branches, announcements, reduced motion); `specs/006-flow-authoring/spec.md` (steps, derived step numbers, branches, error paths); `specs/029-card-look-deck/spec.md` (card frame, lip, states, zoom rules); constitution v1.0.0 (principles I, II, III, IV, V, VI, VII).

**Dependency note**: 029 (card look "Deck") is merged on `main` (`2e85e4a`): cards already have the Deck frame, the lip, the lift, the 22 % dimmed state, the connector styles and the zoom rules. 007 (flow playback) is merged: flow mode, the step player, the token, branches and the "current step" marking exist and keep their behaviour. 035 changes how playback **looks**; it adds no stored fields and no new playback behaviour.

## Scope

**In scope**

- **Step stickers on cards**: a small round sticker on the card's top-left corner for every card on the played path — **played** (✓), **current** (larger, orange, step number) and **upcoming** (dashed outline, step number).
- **Current card**: lifts 2px on a 5px orange lip with an orange border and a soft orange halo (DESIGN.md "Current flow step"), plus the larger orange number sticker.
- **Flow token**: a numbered orange disc travelling along the current step's connector, replacing today's small dot token.
- **Connector states in playback**: played, current, upcoming and error-path connectors in board B's style (weight, colour, dash and label as in DESIGN.md "Connector states"); the step label pill in B's style.
- **Branch points and error paths**: the branch picker and the error-path connector, label and destination card in B's style, with an error cue that does not rely on colour.
- **Dimmed rest**: everything not on the played path at 22 % opacity (cards) and the connector dim value in DESIGN.md.
- **Step player and branch popover restyle**: the step player panel (play button, "Step n of m", from → to line, speed pill, one segment per step) and the branch popover in the Deck look of frame 117, behaviour unchanged.
- **Reduced motion**: nothing animates; stickers and the lip stay; the token is static.
- **Readable without colour**: every state is distinguishable in greyscale.
- **Light and dark themes**, and playback marks in the **exports** that already draw flow marks (if any), at the resting look.
- Update `DESIGN.md` `flow-token` to the numbered disc (§g-73).

**Out of scope**

- New playback behaviour: step order, autoplay timing, branch choice rules, keyboard shortcuts, announcements (007 keeps them; only their look changes).
- Card frame, lip, hover / selected / problem states, connector line types (029).
- Connection bundles, relationship styles, drill-in proxies (034, 022).
- Measured SLA values, rule tables in the step view (008), sticky-note dimming during flows (009).
- Recording or editing flows (006).
- Any file-format or stored-data change.
- New end-to-end tests (constitution Principle VI, `TODO(e2e)`).

## Clarifications

### Session 2026-10-03

- Defaults from design-analysis §g-62, §g-63 and §g-73 are taken as decided: B's numbered disc token and corner stickers replace DESIGN.md's earlier 5px dot token; playback uses the lip-and-sticker language only on the current step (§g-78).
- Q: Which card is "the current card" in a step that joins two cards? → A (confirmed by the founder, 2026-10-03): the step's **target** card is current (it carries the orange lip and the number sticker); its **source** card is shown as played (✓). On step 1 the flow's starting card is shown as played because the flow leaves it.
- Q: Which number does a card's sticker show when it appears in several steps? → A (default): the number of the step in which the card is first reached as a target (the starting card has no number, only ✓). The current card always shows the **current** step's number.
- Q: What if a card is both played and later needed again (a loop back)? → A (default): it keeps the state of its most advanced appearance up to the current step; if it is the current step's target it is current.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Step through a flow and see the deck dealt (Priority: P1)

A presenter opens the flow "Checkout" and presses → through its steps. Cards already passed carry a ✓ sticker, the card the flow has just reached lifts on an orange lip with a big numbered sticker, and cards still ahead wait with dashed numbers. Everything off the path fades back.

**Why this priority**: This is the signature moment of the Deck look (§g-62) and the whole feature in its simplest form.

**Independent Test**: Open a flow of 8 steps, step forward and back, and compare each state with frame 117 in light and dark.

**Acceptance Scenarios**:

1. **Given** a flow opened in flow mode, **When** step 3 of 8 is current, **Then** the cards reached by steps 1–2 show a ✓ sticker on their top-left corner, the step-3 target card is lifted 2px on a 5px orange lip with an orange border and a number sticker "3", and the cards reached by steps 4–8 show a dashed sticker with their number.
2. **Given** step 3 is current, **When** the user presses →, **Then** the lip, lift and large sticker move to the step-4 target card, the previous current card becomes played (✓), and the step-4 sticker changes from dashed to current.
3. **Given** step 4 is current, **When** the user presses ←, **Then** step 4's card goes back to upcoming (dashed number), step 3's card is current again.
4. **Given** the flow's first step, **When** it is current, **Then** the starting card is shown as played (✓), the step-1 target is current, and all other path cards are upcoming.
5. **Given** cards and connectors not on the played path, **When** a flow is in flow mode, **Then** cards are drawn at 22 % opacity and connectors at the dimmed value; stickers appear only on path cards.
6. **Given** a flow mode session ends, **When** the user leaves flow mode, **Then** all stickers, lips and halos are gone and cards return to their normal look.

---

### User Story 2 - Follow the token along the current connector (Priority: P1)

While a step is current, a numbered orange disc travels along its connector from the source card to the target card, so the audience's eye follows the data.

**Why this priority**: The token is the second half of the signature moment; it is what makes the flow feel "played".

**Independent Test**: Play a flow and watch the token on curved, elbow and straight connectors; repeat with reduced motion on.

**Acceptance Scenarios**:

1. **Given** step 3 is current, **When** the flow plays, **Then** a 24px orange disc showing "3" travels along the step's connector in every line type (curved, elbow, straight) and loops at today's token speed.
2. **Given** playback is paused or a step is current, **When** the user looks at the connector, **Then** the connector is the current style (orange, thicker, soft halo) and the label pill is solid orange.
3. **Given** the user prefers reduced motion, **When** a step is current, **Then** the token does not move: a static numbered disc sits at the connector's midpoint, and no lift animation plays.
4. **Given** the user changes step, **When** the next step becomes current, **Then** the token appears on the new connector and none remains on the old one.

---

### User Story 3 - Branches and error paths in the Deck style (Priority: P2)

A flow forks at the payment step into "payment ok" and "payment failed". The branch point is clearly marked, the chosen alternative plays as the main path, and the error path looks different even without colour.

**Why this priority**: Most flows are linear, but branches and errors are where a presentation is most often confusing.

**Independent Test**: Open a flow with a fork and an error path; switch alternatives; compare with frame 117's popover and error path in light, dark and greyscale.

**Acceptance Scenarios**:

1. **Given** the current step is the fork step, **When** the branch picker shows, **Then** it lists each alternative with its number key, and an error path is shown with a dashed Clay border and an ⊗ icon.
2. **Given** an error-path step is current, **When** it is drawn, **Then** its connector is Clay, dashed, ends in a × (no arrow), and its label is a Clay Soft pill with an ⊗ icon; its target card keeps the current lip and number sticker.
3. **Given** the user switches the branch, **When** the played path changes, **Then** the stickers of the other alternative's cards disappear and those cards and connectors are dimmed.
4. **Given** an error path in a greyscale screenshot, **When** viewed, **Then** it is distinguishable from a normal connector by the dashes, the × end and the ⊗ icon.
5. **Given** a fork where an alternative's target card is also used elsewhere on the path, **When** drawn, **Then** it shows one sticker following the rules in Clarifications.

---

### User Story 4 - Step player and progress in the Deck look (Priority: P2)

The step player at the bottom of the canvas looks like frame 117: a round orange play button, "Step 3 of 8", the from → to line, a speed pill and one segment per step showing played, current and upcoming at a glance.

**Why this priority**: The player is what the presenter touches; it must belong to the same look as the cards and token.

**Independent Test**: Open a flow, use every player control, and compare with frame 117 in both themes and with keyboard-only navigation.

**Acceptance Scenarios**:

1. **Given** a flow of 8 steps, **When** step 3 is current, **Then** the player shows 8 segments: 2 played, 1 current (orange), 5 upcoming; the next branch point's segment is outlined dashed.
2. **Given** the player, **When** the user operates play / pause, previous, next, speed or a segment, **Then** it behaves exactly as in 007.
3. **Given** the player, **When** tabbing through its controls, **Then** each control has a visible focus ring and an accessible name, as in 007.

---

### User Story 5 - Reduced motion and no-colour reading (Priority: P1)

A user who prefers reduced motion, or who cannot tell orange from grey, can still follow the flow: the lip and stickers stay, nothing animates, and each state has a shape cue.

**Why this priority**: Playback is the most animated feature of the product; accessibility must not be an afterthought (constitution, DESIGN.md accessibility rules).

**Independent Test**: Turn on the operating-system reduced-motion setting and view a greyscale screenshot of each step.

**Acceptance Scenarios**:

1. **Given** reduced motion is on, **When** the user steps through a flow, **Then** the lift, token movement, dimming transitions and sticker changes happen instantly with no animation; the lip, stickers, halo and static token stay.
2. **Given** a greyscale screenshot of any step, **When** viewed, **Then** played (✓ disc), current (larger disc with number and lip) and upcoming (dashed outline) stickers are distinguishable, and so are played, current and upcoming connectors (weight, solid / dashed).
3. **Given** a screen reader, **When** the current step changes, **Then** the announcement is the one 007 already makes; stickers and token are decorative and add no extra announcements.

### Edge Cases

- A flow whose cards are far apart: the token and stickers stay readable at any zoom the canvas allows; stickers keep their on-screen size and are not hidden below 60 % zoom (the "no lip below 60 %" rule applies to the lip of other cards, not to the current step's lip and sticker).
- At the System and Landscape zoom levels, playback marks are still drawn: the current card keeps its lip and sticker, played cards their ✓, upcoming their dashed number; no card changes size.
- A step whose connector was deleted (007's "broken step"): the step keeps its slot; its target card still gets its sticker; no token travels.
- A card that is a collapsed group member on the path: the collapsed group shows the highest-priority state of its path members (current over played over upcoming) on its front card.
- A step whose source and target are the same card (self-loop): the card is current; the token loops visibly on the self-loop connector.
- Two steps targeting the same card: one sticker, per the rules in Clarifications; the number is never duplicated on a card.
- A dimmed card that is also selected or has a problem: those cues stay visible (029's outlines are not removed by playback).
- A card with a long title and a sticker at its corner: the sticker overlaps the card's outer corner only and never hides the header tile or type name.
- Flow edited by another tab while playing: marks follow the live flow as in 007.
- The flow has 40+ steps: the segments in the player shrink to fit; no horizontal scroll and each remains operable.
- Stepping fast with the keyboard: only the latest step's marks are shown; no intermediate marks stay on screen.

## Requirements _(mandatory)_

### Functional Requirements

**Step stickers and current card**

- **FR-001**: In flow mode, every card on the played path MUST show a round sticker on its top-left corner, offset (−9, −9) from the card corner: **played** = 22px Ink disc with a ✓ and a 2px Surface ring; **current** = 26px Deck Orange disc with the step number (12.5 / 700) and a 2px Surface ring; **upcoming** = 22px Surface disc with a 1.5px dashed Secondary border and the step number.
- **FR-002**: The current card MUST be lifted 2px, drawn on a 5px lip in Deck Orange (Orange Ink for the lip, as in DESIGN.md), with a Deck Orange border and a 9px Orange Soft halo.
- **FR-003**: Which cards are played, current and upcoming, and which number each sticker shows, MUST follow the rules in Clarifications; a card shows at most one sticker.
- **FR-004**: Cards not on the played path MUST be drawn at 22 % opacity and MUST NOT carry a sticker; the current card and path cards MUST be at full opacity.
- **FR-005**: Lift, lip and sticker MUST be paint-only: snapping, hit tests, connector anchors, selection and export use the unlifted card box, as in 029 (FR-016).
- **FR-006**: The current-step lip and sticker MUST remain visible at every zoom level, including below 60 % (an exception to 029's no-lip rule for the current card only); played and upcoming stickers MUST remain visible at every zoom level.
- **FR-007**: Playback marks MUST NOT change any card's size or position.

**Token and connectors**

- **FR-008**: The flow token MUST be a 24px Deck Orange disc carrying the current step number (11.5 / 700, On Primary), with a 2.5px Surface ring and a 3px Orange Ink lip, travelling along the current connector in every line type.
- **FR-009**: Connectors in playback MUST use these states: played = Secondary, 2.5px; current = Deck Orange, 3.25px, 8px orange halo at 18 %; upcoming = dashed `2 6` with round caps; dimmed = 20 % opacity; error path = Clay, 2.5px, dashed `7 4`, ending in × instead of an arrow.
- **FR-010**: The step label pill MUST be 20px tall (11 / 600) with Surface fill, 1.5px Border-strong and Secondary text; the current step's label MUST be solid Deck Orange with On Primary text; an error-path label MUST be Clay Soft with Clay border and text and an ⊗ icon.
- **FR-011**: Labels MUST carry the step number (as 007), so connector states stay readable without colour.

**Branches and error paths**

- **FR-012**: At a fork, the branch picker MUST list each alternative with its number key; an error-path alternative MUST show a dashed Clay border and ⊗; choosing an alternative MUST behave exactly as in 007 and change the played path, marks and dimming together.
- **FR-013**: An error-path step's target card MUST receive the same current / played / upcoming stickers as any other step, in addition to the error connector.
- **FR-014**: The next branch point MUST be marked in the player's progress strip (dashed outline on its segment).

**Step player**

- **FR-015**: The step player MUST be a 560px wide panel (radius 16, 1.5px Border-strong, 3px Border-strong lip, Float shadow) with a 40px round play button on an Orange Ink lip, "Step n of m" (14 / 700), the from → to line, a Mono speed pill, and one 8px segment per step: played Secondary, current Deck Orange, upcoming Surface 3.
- **FR-016**: The player's behaviour (play, pause, previous, next, speed, segment jump, restart at the end) MUST be unchanged from 007.

**Motion and accessibility**

- **FR-017**: When the user prefers reduced motion, the lift, token movement, sticker transitions and dimming fades MUST NOT animate; the lip, halo, stickers and a static numbered token at the connector's midpoint MUST stay.
- **FR-018**: Played, current, upcoming and error states MUST each be distinguishable without colour (✓ vs number vs dashed outline on stickers; weight, solid / dashed and × end on connectors; icon on error labels).
- **FR-019**: Stickers and the token MUST be decorative to assistive technology; the existing polite step announcement from 007 MUST be the only announcement per step change.
- **FR-020**: Text on stickers, labels and the token MUST reach at least 4.5:1 contrast against its background in both themes.

**Exports and docs**

- **FR-021**: Exports MUST NOT include playback marks (stickers, current lip, token, dimming) unless the export already draws flow marks; if it does, it MUST draw the resting look of those marks without lift or animation.
- **FR-022**: `DESIGN.md` `flow-token` MUST be updated to the numbered disc, and design-analysis §g-73 MUST be marked as built.

**Performance**

- **FR-023**: Moving to the next step MUST paint the new current card, sticker, lip and token within the existing "next step → current painted" benchmark target, and playing the flow on the benchmark deck MUST NOT drop below the frame rate target of 007.

### Key Entities

- **Flow, step, branch** (existing): read only; unchanged. A step has a number, a source card, a target card, a connector and optionally a branch label and an error flag.
- **Playback state** (existing, UI-only): the open flow, the current step, the chosen alternative, playing / paused, speed. Not stored in the deck.
- **Step mark** (derived, not stored): for each card on the played path, one of played, current or upcoming, with the number to show. Computed from the flow and the current step.
- **Token** (existing, UI-only): the numbered disc on the current connector.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Stepping through the demo "Checkout" flow from step 1 to the last step, 100 % of steps show exactly one current card with a lip and number sticker, ✓ on every earlier path card, and a dashed number on every later path card.
- **SC-002**: With reduced motion on, no element animates during a full playthrough (zero running animations), while the lip, stickers and static token remain.
- **SC-003**: In a greyscale screenshot of any step, a reviewer can identify played, current and upcoming cards and the error path correctly in 100 % of the reference screenshots.
- **SC-004**: The benchmark "next step → current painted" stays within its existing target, and playing a flow on the 500-node / 1,000-edge deck shows no more long frames than before this change.
- **SC-005**: Canvas screenshots of the demo flow at step 3 of 8 match frame 117 in layout, sticker sizes, lip and connector states (allowing founder-decision deviations), in light and dark.
- **SC-006**: Leaving flow mode removes 100 % of playback marks: a deck screenshot before and after a playthrough is identical.
- **SC-007**: No deck file changes as a result of playing a flow (the stored file is byte-for-byte unchanged).

## Assumptions

- 029 provides the card lip, lift, dimmed state, halo-capable outlines and connector line types; 035 only adds playback marks on top.
- The 22 % card dim comes from the backlog and 029; connectors keep DESIGN.md's 20 % dim value (a known 2-point difference).
- The step player's size and layout come from DESIGN.md "Flow playback"; its behaviour and keyboard model stay 007's.
- Stickers use existing design tokens (Ink, Surface, Secondary, Deck Orange, Orange Ink, Orange Soft, Clay, Clay Soft); any missing token is added by this feature to the shared tokens.
- "Current card" semantics (target of the current step, source shown as played) are confirmed by the founder; the numbering and repeated-card rules are defaults chosen here.
- Existing exports do not draw flow-mode marks today; if that is confirmed during planning, FR-021 reduces to "exports are unchanged".
- No new runtime dependencies and no file-format change.
