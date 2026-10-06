# 0041. Remove note pinning; free legacy anchored notes on load

- **Status:** Accepted
- **Date:** 2026-10-05
- **Supersedes:** ADR 0010 decisions 2 (`position` as the pin offset) and 3 (freeing pinned notes
  on node delete)
- **Feature:** founder decision (2026-10-05), follow-up to `specs/053-sticky-notes-and-connectors`

## Context

Since 009 a sticky note could be pinned to a card: the note's `anchor` named the card, its
`position` became an offset from it, and the note moved with the card. The app pinned a note
automatically when it was created over a card, offered Pin / Unpin in the note toolbar, the
context menu and the inspector ("Free" / "Pinned to node" with a card picker), drew a dotted
leader from the note to its card, wrote "Pinned to <card>" in the note footer, kept pinned notes
at full strength during flow playback when their card was in the current step, and freed pinned
notes when their card was deleted.

In manual testing the founder found this unnecessary and confusing ("Move the note over a card to
pin it"). Two simpler tools already cover the need: since 053 a connector can end on a note, so a
note is linked to a card by drawing a connector, and selecting a note together with cards moves
them together.

`anchor` is part of the published format v1 (`.sododeck` files people already have, including
files written by the AI deck skill, which recommended it), and decks stored in the browser hold
it in their Yjs state. Neither may stop opening or show notes in a different place.

## Decision

1. **No pinning, anywhere.** Every note is free and placed by its own absolute `position`. The
   app has no Pin / Unpin action, no inspector placement switch, picker or Unpin buttons, no
   auto-pin on create (notes are always created free), no "Pinned to" footer, no leader edges and
   no pin-based flow dimming: during playback a note dims unless it has `showInFlows`. The step
   inspector no longer lists notes pinned to the step's cards; views no longer hide notes with
   their card, and a flow-scoped image export draws no notes (a note belongs to no flow).

2. **`anchor` stays in schema v1, deprecated.** Its description says so; `position` is described
   as the canvas position (an offset only in an older file with an anchor on a node); rule S2
   (anchor or position) is unchanged, so every older file still validates. The full example places
   every note by `position`, and the coverage test exempts the deprecated key. No version bump.

3. **The model frees legacy notes on load** (`packages/model/src/legacy-stickies.ts`, the only
   Yjs ↔ JSON place, constitution II). `fromJSON` / `loadDeck` run `freeAnchoredStickies` after
   validation: each anchored note gets `position` = the point it was shown at, and `anchor` is
   dropped:
   - anchored to a card: the card's canvas point (stored position, else its grid slot) plus the
     stored offset, or the old default offset `{ x: 24, y: -96 }`;
   - anchored to anything else (a connector, a flow, a step…) or to an id that does not exist: the
     note's own `position` (the origin when it has none), which is where it was drawn.

   Nothing moves on screen. A file without anchors loads unchanged.

4. **Stored decks are freed once on open.** A deck in the library is Yjs bytes and never passes
   through `fromJSON` again, so the editor page calls `editor.freeLegacyStickies()` after storage
   is attached, next to `fitMissingFrames`. It writes the same result with the untracked origin:
   saved and synced, never an undo step, and nothing at all when no note has an anchor. Exporting
   a stored deck that was not opened since does the same on its throwaway document, so an exported
   file never carries `anchor`.

5. **The editor never writes `anchor`.** `add` / `update` of a sticky with an anchor is refused
   (`invalid`).

6. **Dead code goes.** `pinSticky` / `unpinSticky`, `StickyPlacement` / `stickyCanvasPosition`
   (replaced by `stickyPosition(sticky)`), the `STICKY_DEFAULT_OFFSET` export,
   `RemovalResult.freed` and the "notes unpinned" delete copy, the sticky anchor integrity check
   (the `ambiguous-anchor` kind and the `object` target type), the "any object" reference target
   (`anchorableIds`), and the search context "Note · pinned to …". The app's leader edge, card-under
   lookup and pin actions are removed.

## Alternatives considered

- **Schema v2 without `anchor`**: breaks the published format and every file that uses it, for a
  field that costs nothing to keep as deprecated.
- **Keep `anchor` but ignore it**: a pinned note's `position` is an offset, so read as absolute
  the note would jump next to the origin; a note with no position would be invalid to draw.
- **Normalize in the app**: duplicates format knowledge outside `@sododeck/model`, the only
  Yjs ↔ JSON layer, and the AI skill's offline checks would disagree with the app.
- **Keep pinning, improve the hint**: the founder's call is that the feature itself is not worth
  its weight next to connectors and multi-select.

## Consequences

- A legacy file round-trips to its normalized form (no `anchor`, absolute positions), not
  byte-identically; that is the intent. Current files still round-trip losslessly.
- An AI-written legacy deck with unplaced cards still works: import lays the cards out from the
  raw text first, then `fromJSON` frees each note next to its laid-out card.
- The AI deck skill no longer suggests `anchor`: in a new deck caveats go in descriptions; a note
  (with a `position`) is added in update mode next to a placed card, and linked by a connector.
- Deleting a card leaves notes where they are; one undo restores the card and its connectors.
