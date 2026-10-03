# Feature Specification: Deck Tag Colours

**Feature Branch**: `033-deck-tag-colours`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "033 from docs/backlog.md" — Tags are defined once per deck with a colour: a tag picker, a tag editor, a drawer tag row, coloured tag pills on cards, and tags that keep the case the user typed.

**Sources**: `docs/backlog.md` §033 (scope, acceptance criteria); `DESIGN.md` "Card system (Deck)" (tag pill `--sd-deck-tag`, card colours with `chip` / `ink` / `dot` variants) and Components `tag-chip`; `docs/design/design-analysis.md` frame 125 "Tags" (tag chips in all 13 colours, tag picker, edit-tag popover, drawer tag row with keyboard focus), §g-59 (tags on the card, ten per card), §g-64 (tags keep the case the user typed), §g-75 (tag size); `docs/decisions/0022-schema-roadmap.md` (root `tagColors`); `specs/029-card-look-deck/spec.md` (the Deck card, tag pills, zoom rules); constitution v1.0.0.

**Dependency note**: 029 (card look "Deck") is merged on `main`. Cards already show up to ten neutral tag pills, and tags are lower-cased and de-duplicated when typed. 033 gives each tag a deck-wide colour and a way to manage tags. It runs independently of 035 (flow playback).

## Scope

**In scope**

- **A colour per tag, defined once per deck.** A tag's colour is one of the 13 named card colours or a custom colour from the deck's own colours. Every card carrying that tag shows the same colour.
- **Tag picker**: a search field, the deck's tags with their colour and usage count, and a "Create tag “…” ⏎" row when nothing matches; a pencil on each row opens the tag editor.
- **Tag editor**: name, a swatch grid of the 13 colours plus the deck's custom colours, and "Delete tag · used on N cards".
- **Drawer tag row**: tag pills with ×, keyboard support (⌫ removes the focused tag, ⏎ opens the picker), 21px pills as in frame 125.
- **Coloured tag pills on cards**: solid-tint pill in the tag's colour (18px, as in 029); a tag with no colour renders slate. Still at most 10 tags per card.
- **Case kept as typed**: "PIC" and "Lan" stay as typed. Matching and uniqueness ignore case, so typing "pic" selects the existing "PIC"; the first spelling wins. Existing lower-cased tags stay as they are.
- **Rename and delete a tag deck-wide** in one undo step.
- Light and dark themes; readable without relying on colour alone; keyboard-operable picker and editor.

**Out of scope**

- Tags on edges, flows and steps keep working as today: they follow the same case and matching rules but show no colour in 033 (cards only).
- Colours with meaning (status, priority) and typed fields (032).
- Tag hierarchies, nested tags, tag-based automation, tag filters in saved views beyond what exists today.
- Card frame and tag pill size (029), zoom-level rules for tag dots (029).
- Any change to the file format other than the new optional tag colour map.
- New end-to-end tests (constitution Principle VI, `TODO(e2e)`).

## Clarifications

### Session 2026-10-03

- Defaults from backlog §033, ADR 0022 and design-analysis §g-59, §g-64 and §g-75 are taken as decided: a root `tagColors` map (tag text → colour), tags keep typed case, matching ignores case, a tag with no colour is valid and renders slate, ten tags per card at most.
- Q: What does a user see for the tag **list** of the deck: only tags with a colour, or every tag in use? → A (default): **every tag in use on any card** (and any tag that has a colour), each with its usage count; a coloured tag that is no longer used stays listed with count 0 until deleted.
- Q: When two existing tags differ only by case (for example "pci" and "PCI" in an older deck), what happens? → A (default): nothing is rewritten on open; the picker lists them as one tag (first spelling wins) and the first edit of either merges the cards onto the first spelling.
- Q: Does renaming a tag to a name that already exists merge the two? → A (default): yes, after a confirmation that shows how many cards are affected; one undo step restores both.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Colour a tag once and see it everywhere (Priority: P1)

A user has "pci" on six cards and wants compliance-related cards to stand out. They open the tag editor for "pci", pick violet, and every card carrying it now shows a violet pill.

**Why this priority**: This is the core value of the feature: one definition, consistent colour everywhere. Without it nothing else in 033 matters.

**Independent Test**: In a deck with a tag on several cards, colour the tag, then check that every card, the drawer and the picker agree, then undo once.

**Acceptance Scenarios**:

1. **Given** "pci" is on six cards with no colour, **When** the user colours it violet in the tag editor, **Then** all six cards show a violet solid-tint pill, and one undo step returns all six to slate.
2. **Given** a tag with a colour, **When** the deck is saved, closed and reopened, or exported and imported, **Then** the tag keeps its colour.
3. **Given** a tag with no colour, **When** it is shown on a card, **Then** the pill is slate and its text stays readable in light and dark themes.
4. **Given** a custom colour in the deck's own colours, **When** the user picks it for a tag, **Then** the pill uses that colour and remains readable (text colour chosen for contrast).
5. **Given** the user switches between light and dark, **When** looking at coloured pills, **Then** each stays distinguishable and meets the same contrast as the 13 card colours.

---

### User Story 2 - Add and pick tags with a picker (Priority: P1)

In the drawer, the user presses ⏎ on the tag row, types "pc", sees the deck's matching tags with their colour and count, and picks "pci". If nothing matches, the picker offers "Create tag “pc…” ⏎".

**Why this priority**: Without a deck-level list, users retype tags and create near-duplicates, so colours cannot stay consistent.

**Independent Test**: With a deck with 12 tags, open the picker from the drawer, search, pick, create a new tag and remove one, using only the keyboard.

**Acceptance Scenarios**:

1. **Given** a card selected, **When** the user opens the tag picker, **Then** the deck's tags are listed with colour and usage count, most used first, with the card's own tags marked as already added.
2. **Given** the search field contains text, **When** it matches no tag, **Then** a row "Create tag “text” ⏎" appears; pressing ⏎ creates the tag with no colour and adds it to the card.
3. **Given** a card already has 10 tags, **When** the user tries to add another, **Then** the add is refused with a visible message and nothing changes.
4. **Given** the drawer tag row has keyboard focus on a pill, **When** the user presses ⌫, **Then** that tag is removed from the card only; **When** the user presses ⏎ on the row, **Then** the picker opens.
5. **Given** the user selects several cards, **When** they add a tag, **Then** it is added to all of them in one undo step (existing bulk behaviour keeps working).

---

### User Story 3 - Tags keep the case the user typed (Priority: P1)

The user types "PIC" and "Lan". They stay "PIC" and "Lan" on the card and in the picker. Later they type "pic" and the picker offers the existing "PIC" instead of creating a second tag.

**Why this priority**: The founder decided (§g-64) that acronyms and names must not be forced to lower case. It changes how every tag is stored and matched, so it belongs with the colour work.

**Independent Test**: Add "PIC" to one card and "pic" to another, and check that both show "PIC" and count as one tag.

**Acceptance Scenarios**:

1. **Given** the user types "PIC", **When** the tag is added, **Then** the card shows "PIC" exactly as typed.
2. **Given** "PIC" exists in the deck, **When** the user types "pic" or "Pic" and confirms, **Then** the existing "PIC" is used and no second tag is created.
3. **Given** a deck made before 033 holds only lower-case tags, **When** it is opened, **Then** its tags are unchanged and still match as before.
4. **Given** two tags in an older deck that differ only by case, **When** the picker lists tags, **Then** they appear as one tag with the combined count, and no stored data changes until the user edits one.
5. **Given** a tag with a colour, **When** the user adds the same tag with different case, **Then** the existing spelling and colour are used.

---

### User Story 4 - Rename, recolour and delete a tag deck-wide (Priority: P2)

From the picker's pencil, the user renames "pci" to "PCI-DSS", changes its colour, or deletes it. The editor shows "Delete tag · used on 6 cards" so the user knows the effect before confirming.

**Why this priority**: It keeps the tag list tidy. Users can live without it at first (they can colour and add tags), but a list that can never be cleaned becomes noise.

**Independent Test**: Rename, recolour and delete a tag used on several cards; undo each in one step.

**Acceptance Scenarios**:

1. **Given** "pci" is used on six cards, **When** the user renames it to "PCI-DSS", **Then** all six cards show "PCI-DSS" with the same colour, and one undo step restores "pci" on all six.
2. **Given** a tag used on N cards, **When** the user opens its editor, **Then** the delete action reads "Delete tag · used on N cards"; confirming removes the tag from every card and clears its colour, in one undo step.
3. **Given** the user renames a tag to a name that already exists (ignoring case), **When** they confirm, **Then** the two merge onto the existing spelling after a confirmation showing the number of cards affected, and one undo step reverses it.
4. **Given** an empty name or a name longer than the tag limit, **When** the user confirms, **Then** the edit is refused with a clear message.
5. **Given** a tag is used on no card but has a colour, **When** the picker lists tags, **Then** it appears with count 0 and can be deleted.

---

### User Story 5 - Older decks and other places that show tags keep working (Priority: P2)

A deck saved before 033 opens unchanged; tags on edges, flows and steps, bulk editing of several cards and the JSON panel keep working with the new case rules.

**Why this priority**: Protects existing work and keeps the single document model coherent.

**Independent Test**: Open a deck saved before 033, check nothing changed, then add colours and see the JSON panel show them.

**Acceptance Scenarios**:

1. **Given** a deck saved before 033, **When** it is opened, **Then** every tag shows as before, in slate, and the file is not rewritten until the user edits.
2. **Given** the user colours a tag, **When** they look at the JSON panel, **Then** it shows the new tag colour entry in sync with the canvas.
3. **Given** a deck with no tag colours, **When** it is saved by this version, **Then** the file has no tag colour entry and is byte-identical to what an earlier version would write for the same deck.
4. **Given** several cards are selected, **When** the toolbar or bulk drawer shows tags, **Then** shared and partial tags (n/N) display with their colours.

---

### Edge Cases

- A tag text that is very long (up to the field limit): the pill truncates with the full text on hover and in the picker; the card height still comes from the computed tag layout (029).
- A tag that is only whitespace, or has leading and trailing spaces: trimmed on add; empty is refused.
- A tag whose text matches only a colour key by accident (for example "violet"): tag names are free text, and nothing treats them as colour names.
- Deleting a tag while a card is mid-edit in the drawer: the drawer reflects the removal without losing other edits.
- Two people (or two tabs) editing the same deck: the last write per tag wins and the document stays valid; real collaboration is out of scope.
- A deck holding a tag colour for a tag no card carries (for example after a card was deleted): it stays listed with count 0; it is never silently dropped.
- A custom colour removed from the deck's own colours while a tag uses it: the tag keeps the stored colour (still valid) and the editor shows it as a one-off swatch.
- Undo and redo across rename, recolour and delete behave as one step each, including the card tags they touch.
- Zoom levels: tag pills follow 029's rules (chips as dots at System level, no tags at Landscape); the dot uses the tag's colour.
- Reduced motion and high contrast: no animation is required; a tag's meaning never depends on its colour alone (the text is always shown, or available on hover when a dot is shown).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A deck MUST be able to hold one colour per tag, chosen from the 13 named card colours or the deck's custom colours; a tag without a colour is valid and renders slate.
- **FR-002**: Every card that carries a tag MUST show it in that tag's colour, and changing the colour MUST update all those cards at once as one undo step.
- **FR-003**: Tag colours MUST be saved with the deck, survive reload, export and import, and appear in the JSON panel in sync with the canvas.
- **FR-004**: Users MUST be able to open a tag picker from a card's drawer that lists the deck's tags with colour and usage count, supports search by typing, and offers "Create tag “…”" when nothing matches.
- **FR-005**: Users MUST be able to open a tag editor from the picker to rename a tag, choose its colour from the 13 swatches and the deck's custom colours, and delete it.
- **FR-006**: The delete action MUST show how many cards use the tag ("Delete tag · used on N cards") before it is confirmed, and MUST remove the tag from every card in one undo step.
- **FR-007**: The drawer tag row MUST show tag pills with a × control; ⌫ on a focused pill MUST remove it from that card, and ⏎ on the row MUST open the picker.
- **FR-008**: Tags MUST keep the case the user typed; matching and uniqueness MUST ignore case; the first spelling in the deck wins; existing lower-cased tags MUST stay unchanged.
- **FR-009**: A card MUST hold at most 10 tags; attempts to add more MUST be refused with a visible message.
- **FR-010**: Renaming a tag MUST update every card that carries it; renaming to an existing name (ignoring case) MUST merge the two after a confirmation, as one undo step.
- **FR-011**: Tag pills MUST keep the size and text rules of the Deck card (18px on the card, 21px with × in the drawer) so that card height still comes from the computed tag layout.
- **FR-012**: Tag pills MUST meet the contrast of the 13 card colours (text on tint) in light and dark themes, and custom colours MUST get a readable text colour.
- **FR-013**: The picker and editor MUST be fully operable by keyboard (open, move, pick, create, edit, delete, close with Esc returning focus), expose roles and labels to assistive technology, and announce adds, removals and merges.
- **FR-014**: A deck saved before this feature MUST open with its tags unchanged and without being rewritten until the user edits it; a deck with no tag colours MUST be written exactly as before. Opening a deck with tag colours in an earlier app version is not supported (the format rejects unknown keys; compatibility is deferred to 025, ADR 0020).
- **FR-015**: Exports that already draw tag pills (if any) MUST draw them with the tag's colour at the resting look.
- **FR-016**: Tags on cards in bulk selections (toolbar and bulk drawer) MUST show colours and keep the partial "n/N" display.
- **FR-017**: Tag operations MUST not make any network call and MUST not depend on browser-only features without a fallback.

### Key Entities

- **Tag**: a piece of free text carried by cards (and, without colour, by edges, flows and steps). Identified by its text, ignoring case; the first spelling in the deck is the display spelling.
- **Tag colour**: a deck-level association from a tag to a card colour (named or custom). Optional per tag; absent means slate.
- **Deck colours**: the deck's own custom colours (existing feature 020) that tags may also use.
- **Usage count**: the number of cards that carry a tag; derived, never stored.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can colour a tag used on 6 cards in under 15 seconds from opening the picker, and all 6 cards change together.
- **SC-002**: One undo step reverses a recolour, rename, merge or delete, in 100 % of cases tried, including the cards affected.
- **SC-003**: 100 % of tag pills in the 13 named colours and in a sample of custom colours reach a text-to-background contrast of at least 4.5:1 in both light and dark themes.
- **SC-004**: Adding "pic" when "PIC" exists never creates a second tag, and the existing spelling and colour are reused (checked over a set of at least 20 spelling variants).
- **SC-005**: A deck saved before this feature opens with every tag unchanged and no automatic rewrite, and a deck with tag colours survives export and import with no loss.
- **SC-006**: The whole flow (open picker, search, create, colour, rename, delete, remove from a card) can be done with the keyboard alone.
- **SC-007**: On the 500-card benchmark deck, panning and dragging stay within the existing canvas targets (no measurable drop beyond run-to-run variation) with tag colours in use.

## Assumptions

- Tag colours apply to cards only in this feature; tags on edges, flows and steps stay neutral and follow the new case rules.
- The deck's tag limit per card (10) and the maximum tag length are the ones that exist today and do not change.
- The 13 named card colours and the deck's custom colours (existing) are the only colours offered; no new palette is introduced.
- Frame 125 (light and dark) is the visual reference for the picker, the editor and the drawer row; `DESIGN.md` wins where they differ.
- The file change is a single optional addition, so no version bump and no migration is needed (ADR 0002, 0020, 0022); it is recorded in the schema roadmap ADR.
- The picker lists tags from cards; tags kept only on other object kinds are not listed in 033.
- Real-time collaboration is out of scope; the document model stays collaboration-ready (036).
- This feature is independent of 035 and may be built in parallel with it.
