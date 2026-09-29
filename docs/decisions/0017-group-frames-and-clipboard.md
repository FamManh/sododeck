# 0017. Groups are stored frames; the clipboard carries a file fragment

- **Status:** Accepted
- **Date:** 2026-09-29
- **Feature:** `specs/016-canvas-editing` (spec, research R1–R15, contracts)
- **Supersedes:** the "group bounds are derived, never stored" part of 0004 (§ positions) and 0006

## Context

016 makes editing on the canvas fast: copy / paste / duplicate, group the selection, move and
resize groups, drop into and out of groups, align, snap and nudge. The founder decided on
2026-09-29 (§g-55) that groups are frames that users place and resize, and that never scale on
their own. Until now a group's box was derived from its members (0004, 0006), so a group could
not be moved, resized or left larger than its members, and views could not differ.

Copy and paste must work within one deck and across tabs and decks, never send content over the
network (principle IV), and keep ids stable and unique (principle III).

## Decision

1. **Groups as frames (R1).** Schema v1 gains optional `$defs/Size` `{ width, height }` (both
   > 0) and `$defs/Frame` `{ position, size }`, `Group.position` / `Group.size` (after `parent`),
   > and `View.groupFrames` (group id → `Frame`, after `positions`). Semantic rules: a group has both
   > fields or neither (S4), and `groupFrames` keys are group ids of the file (S5). The change is
   > additive and optional, so the version stays 1 (0002). 017 reuses `Size` for `node.size`.
2. **Membership is explicit (R6).** Frames never capture cards by covering them. Only a drop, a
   paste, "Group", ungroup / delete and the group field change `node.group` / `group.parent`.
   The pointer decides a drop; ⌥ keeps membership.
3. **Fitting older decks, untracked (R2).** `fitGroupFrames` (pure, model) fits frames inner-first
   around the member cards and child frames plus padding, with the card size passed in by the app
   (`COMPONENT_CARD_SIZE`, 24 px padding), so frames match today's boxes at full detail. The app
   calls `editor.fillGroupFrames` once after opening a deck; it writes only missing frames with
   the untracked origin, so ⌘Z never "unfits". Two tabs fitting at once write identical values.
4. **One choke point (R3).** `groupBounds` returns the stored frame and falls back to the derived
   box only for a deck an older tab has not fitted yet. The canvas, minimap, collapsed cards,
   arrow navigation and export all read it, so they follow frames with no other change.
5. **Per-view frames (R4).** `editor.setGroupFrames(viewId, frames)` mirrors `moveInView`: the
   base view writes the group fields; another view writes `view.groupFrames`, after copying every
   base frame into it (untracked) the first time. `viewDeck` projects a view's frames onto its
   groups. Removing a group deletes its `groupFrames` entry in every view in the same step.
6. **Clipboard envelope (R9, R10).** The clipboard text is `{ "sododeckFragment": 1, "deck": … }`,
   where `deck` is a valid file holding only the copied nodes, edges and groups. `packages/model` builds it (`toFragment`) and parses it with the file parser plus the
   duplicate-id check (`parseFragment`), so a fragment is valid by construction and plain text is
   ignored. ⌘C / ⌘X / ⌘V use the platform `copy` / `cut` / `paste` events (`text/plain`, no
   permission prompt); the menu's Paste uses the feature-detected `navigator.clipboard.readText`.
   `editor.pasteFragment` allocates new ids and remaps every reference inside the fragment in one
   undo step; duplicate and ⌥-drag reuse it. A timestamp in `localStorage` hints that a fragment
   was copied (never content).
7. **Cancel a gesture (R14).** `editor.cancelGesture()` ends the open gesture and undoes it. The
   editor holds back the redo stack during a gesture instead of letting Yjs clear it, so after a
   cancel both stacks are as before the gesture (Esc during a drag or a resize).

## Alternatives considered

- **A flat `group.frame { x, y, width, height }`:** a second shape for the same idea, not
  matching `node.position` and 017's `node.size`.
- **Group ids in `view.positions` plus a `view.sizes`:** mixes node and group keys and breaks
  what rule S3 means.
- **A required frame with a version bump:** breaks every existing file.
- **Fit inside `fromJSON`:** covers imports only (not decks already in IndexedDB), and the model
  does not know card sizes.
- **Render a derived box until the first edit:** groups would still scale on their own.
- **A new `groupFrame()` beside `groupBounds`:** seven callers to change, easy to miss one.
- **Frames always derived in views:** views would scale their groups while the base does not.
- **A custom clipboard MIME type:** Chromium only.
- **An in-app clipboard over BroadcastChannel:** does not survive closing the source tab, and adds
  a second channel.
- **The async Clipboard API for the keys:** permission prompts in some browsers.

## Consequences

- Group geometry is now document data: it is saved, synced, undone and exported like positions.
  At smaller semantic zoom levels fitted frames are a little looser than the old derived boxes.
- A frame may be smaller than its members in a hand-edited file; loading accepts it, and the
  resize UI enforces "members plus padding, at least 160 × 96".
- Views with their own positions get their own frames; editing a frame in one view never moves it
  in another.
- 017 (card resize) reuses `Size` and the resize wrapper; 020 (colours) adds `group.style` next to
  the frame.
