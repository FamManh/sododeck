# Quickstart: validating Flow Authoring (006)

**Prerequisites:** Node ≥ 24, `pnpm install`, on branch `006-flow-authoring`.

## 1. Automated checks

```bash
pnpm schema:generate                        # generated types/Zod up to date (no diff after)
pnpm --filter @sododeck/schema test         # Ajv/Zod parity incl. Branch fixtures
pnpm --filter @sododeck/model test          # round-trip, flow-paths, addBranch, restore, cascade
pnpm --filter @sododeck/app test            # stores, overlay, filter, sortable, components
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e   # definition of done
pnpm bench                                  # before (main) and after; see §3
```

Expected results:

- Everything is green.
- The smoke suite, including the no-third-party-requests check, passes unchanged.
- `git status` shows no stale files under `packages/schema/src/generated/`.

## 2. Manual walkthrough (`pnpm dev` → http://localhost:5173/deck/demo)

The demo deck has connections but no flows. Each check below names its spec scenario. The
contracts are [flow-authoring-ui.md](contracts/flow-authoring-ui.md) and
[model-additions.md](contracts/model-additions.md).

1. **Create a feature.** "New feature" → "Delivery". Rename it with F2, and check that an empty name
   is refused (story 3, #1).
2. **Record a flow.** "+ New flow" → "Place order". Check that the chip shows 0 steps and Done is
   disabled. Hover an edge to see the preview. Click three contiguous edges. Check the badges, the
   ring and "Step 4 starts here", then press Done. Check the toast, and "3 steps" in the list
   (story 1, #1–4).
3. **Blocked click.** Start recording again, click one edge, then click an edge that doesn't start
   at its end. Check:
   - nothing is added
   - the edge flashes dashed with the ban icon
   - the popover and the step-list message appear
   - a screen reader (or the live region in DevTools) reads the message
   - an edge leaving an earlier step's end offers "Add as branch from step k"

   (story 2, #1–2)

4. **Keyboard only.** Focus the canvas, press Tab / Shift+Tab to move between candidates (the focus
   ring shows and the name is announced), press Enter to record, then reach Done with the keyboard
   (story 2, #3).
5. **Undo and cancel.** ⌘Z removes the last recorded step. Esc with steps asks for confirmation.
   Esc with none exits at once (story 1, #5–6).
6. **Edit steps.**
   - Select a step and set the title "Authorize payment" and the SLA "< 300 ms". The row's main
     line changes to the title.
   - Edit steps: ⌥↓ a step to break the chain. Check the dashed clay dot, the icon and the text,
     and that Done is disabled.
   - ⌥↑ it back. Cancel restores the order and keeps the title (story 3, #3–5; clarification Q1).
7. **Branches.**
   - On a 5-step flow, focus step 3 and press B. Check that steps 4–5 become "a" with empty
     label and condition errors on Done.
   - Fill in "a", label "b" "payment failed", set a condition, turn Error path on, and record 2
     edges.
   - Check the "◇" headers, the 4a/5a/4b/5b numbering, and the dashed clay edges with the alert
     icon.
   - Take a grayscale screenshot and check that the error path is still identifiable.
   - Press B on 4b: it is refused with a message (story 4; SC-006).
8. **Organize.** Reorder flows by drag and by ⌥↑. Move a flow to another feature (it goes to the
   end). Delete a feature: the dialog states the flow count, the flows move to "No feature", and
   Undo restores them (story 3, #6–8).
9. **Filter.**
   - Add ten flows and press /, then type "fail". Check "n of m", the bold and underlined matches,
     and that feature headers stay.
   - Type "zzz". Check the empty state, then "New flow 'zzz'" (story 5, #1–3).
10. **Broken step.** Delete an edge used by a step and confirm. The dialog says steps will be
    flagged. Check the row shows "Connection deleted", the flow row shows "Has problems", and Done
    in edit mode is not blocked. ⌘Z clears it (story 5, #4; clarification Q2).
11. **Round trip.** Copy the JSON panel's Deck tab and check that `branches` and `branch` appear as
    in [data-model.md](data-model.md). Once 005 lands, export → import the deck and check it is
    identical (SC-007).

## 3. Performance (constitution V, SC-002)

- Run `pnpm bench` on `main` and on the branch with `BENCH_FLOWS=1`.
- In the report, record pan/zoom/drag fps (within 5 % of `main`), "select flow → marks painted"
  (< 100 ms) and "record click → badge" (< 100 ms).

## 4. Visual check

Take screenshots at 1440×900, light and dark, of states 41–48 and the left panel of 02 and 03. Put
them next to `docs/design/screens/*` in the PR. The allowed differences are:

- DESIGN.md clay and tokens
- lucide icons
- the confirmation before deletes
- no player or dimming (007)
