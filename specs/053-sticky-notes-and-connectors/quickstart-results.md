# Quickstart results: 053 manual walkthrough (T055)

Date 2026-10-05. Driven through Chrome (claude-in-chrome extension) against this worktree's dev server
(`vite --port 5174`; port 5173 was already held by another checkout's server, which was left alone).
Dark theme is the app default; light was checked by removing the `dark` class on `<html>`.
Synthetic pointer input was used, which explains some flakiness noted below. Nothing was fixed in code.

## Summary

| Scenario                                                  | Result                                                                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1. US1 sticky + connector                                 | PASS, with a spec/behaviour mismatch (no delete confirmation, see B1)                                    |
| 2. US2 paper look, resize, auto font                      | PASS with caveats (old-deck default size not checked; resize drag inconsistent under automation, see B4) |
| 3. US3 toolbar, colour, tag, lock, multi-select, pad drop | PASS (pad drag verified with synthetic DnD events, see B5)                                               |
| 4. US4 multi-connector toolbar                            | PASS                                                                                                     |
| 5. Edge cases                                             | PARTIAL: JSON fields and SVG preview checked; hide-notes and PNG not verified                            |

## Scenario 1 (US1): PASS

- Added a sticky, typed "Why two queues?", committed by clicking away.
- Dragged from the sticky's top handle onto a card: connector created and its popover opened.
- Moved the card: the connector followed.
- Undo order was move first, then connector creation; the second undo removed only the connector (sticky and cards stayed).
- Delete: connector is removed together with the sticky, and one undo restores both (checked). The delete is immediate with an Undo toast, there is no confirmation (B1, B2).
- Reload: sticky, connector, position and text all persisted.

## Scenario 2 (US2): PASS with caveats

- Paper look: sticky (blue/amber paper, folded corner, shadow) is clearly different from the plain cards in both light and dark.
- Auto font size, measured on the textarea: 1 word 32px, 6 words 16px, 48 words 11px at default size (200x200), text fully inside (scrollHeight == clientHeight). In a 160x96 note the same 48 words are clipped and show a "..." overflow button (expected for that size, see B3).
- Fixed size: picked 16 in the toolbar, rendered at 16px and exported as `fontSize: 16`. I did not re-edit afterwards to prove it stays fixed.
- Resize persists across reload (160x96 note reloaded at 160x96, `size` in the JSON).
- NOT verified: opening an old deck and seeing the default size (no old deck available).

## Scenario 3 (US3): PASS

- Selecting a sticky shows the toolbar (font, bold, align, link, colour, tags, collapse, pin, lock, delete).
- Colour: three stickies multi-selected (shift-click), one colour change applied to all three.
- Tag: created "queue" through the tag picker; chip shown on the notes; the pad tile and exported JSON show it.
- Lock: not individually clicked on a sticky (only exercised on connectors).
- Pad drop over a card: the new note is free (no connector, not pinned), in edit mode (textarea focused), and takes the last-used colour. Verified with dispatched `dragstart`/`dragover`/`drop` events because the automation's mouse drag does not start a native drag for this tile (B5).

## Scenario 4 (US4): PASS

- Shift-click of three connectors shows a toolbar: arrow end, route type, colour, weight, lock, and a "Line style" popover that says the change applies to all 3.
- Set colour green, weight 3 px, arrow end None: all three changed.
- One undo reverted exactly the last change (arrow ends) on all three connectors; colour and weight stayed. One undo per property change, which matches "one undo reverts all" for a single change.
- Lock: lock badges appear on all three; dragging on the connector did not change its route. I could not confirm the drag actually targeted a bend handle (none are shown when locked).

## Scenario 5 (edges): PARTIAL

- JSON: exported JSON (Export dialog, whole deck) contains the new fields: sticky `size`, `fontSize`, `tags`, `color`; edge `locked`, `style`, `route` with sticky ids as `from`. The in-editor JSON panel selection view shows `tags` too. The panel could not be scrolled by the automation.
- SVG export preview: shows the resized (160x96) note, default-size notes, tag chips, and connectors with ends on notes. Text inside the preview is too small to judge. Not downloaded.
- NOT verified: hiding notes hides their connectors. "Notes hidden" only applies in flow mode (`notesHidden: flowMode && notesDisplay === 'hidden'` in `canvas.tsx`), which needs a flow with steps; I did not set one up.
- NOT verified: PNG export.

## Bugs and findings

Nothing was changed in the code.

- **B1 (spec mismatch, not a bug in code):** Deleting a sticky (Delete key or toolbar trash) removes it at once and shows a toast "Note deleted - Cmd+Z to undo". `quickstart.md` step 1, spec US1 AS5, US4 AS7 and FR-010 say a confirmation lists the connectors. The code is intentional: `confirm-delete-dialog.tsx` says canvas objects delete at once (founder, 2026-10-02). The spec and quickstart wording is stale.
- **B2 (minor):** The toast for a sticky-only delete never mentions removed connectors. `removalToast` returns early for sticky-only targets, so "Note deleted" is shown even when a connector was removed too (cards say "X and N connection(s)"). Restoring with one undo does bring the connector back.
- **B3 (observation):** A note shrunk to 96-160 px with long text cuts it off and shows a "..." overflow button. At the default size 48 words fit.
- **B4 (unconfirmed, possibly automation only):** Pointer resize from a corner handle gave inconsistent sizes with large single-jump drags: dragging outward ended at the 96x96 minimum or at a smaller-than-expected size, while a moderate drag was exact (170 to 341 px as expected). The ending (160x96) persisted. I did not root-cause it; the drag tool emits one move event. Worth a manual retry with a real mouse.
- **B5 (automation only):** The Add flyout "Sticky" tile did not drop a note with the automation's mouse drag, but the same tile works with dispatched drag events, and shape tiles drag fine. Likely a limitation of synthetic drags; recheck by hand.
- **B6 (behaviour to confirm):** Pressing Esc while editing a brand-new note discards the typed text, and the empty note is deleted. Clicking away keeps it. Consistent with Esc = cancel, but easy to lose text.
- **B7 (cosmetic):** The multi-connector toolbar and the line-style popover are placed over the notes the connectors end on, hiding part of them (see screenshots).
- **B8 (automation flakiness):** After selecting an object, the first drag from its handle (to make a connector) was ignored and the second worked. Not seen as a user-facing bug.
- Side effect of automation: typing "Queues" while a connector was selected and no text field was active triggered single-key shortcuts (tool and zoom changes, deck-name highlight). No data was lost.

## Screenshots (our own app, `screenshots/`)

Paper look: `sticky-paper-look-dark.jpg`, `sticky-paper-look-light.jpg`.
Sticky toolbar: `sticky-toolbar-dark.jpg`, `sticky-toolbar-light.jpg`.
Pad tile in Add flyout: `pad-tile-add-flyout-dark.png` (amber pad, taken before any colour change), `pad-tile-add-flyout-light.png` (blue pad, last-used colour).
Multi-connector toolbar: `multi-connector-toolbar-dark.jpg`, `multi-connector-toolbar-light.jpg`.

None of the reference images were read or used.
