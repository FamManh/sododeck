# Quickstart: validate 008 (Inspectors and Rules)

Run this after `/speckit-implement`, on a branch where 006 is merged.

## Prerequisites

```bash
nvm use            # Node ≥ 24
pnpm install
pnpm bench         # before: save the numbers (apps/app/bench/results/)
```

## Automated checks

```bash
pnpm --filter @sododeck/model test   # rules-evaluate, rule-links, rule-usage, round-trip, preview, undo
pnpm --filter @sododeck/ui test      # markdown, markdown-view, combobox, tag-input suggestions, contrast
pnpm --filter @sododeck/app test     # inspectors, bulk, fields, rule editor, attach, derive, links
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench         # after: compare, no regression below 60 fps at 500 nodes / 1,000 edges
```

## Manual walkthrough (`pnpm dev` → http://localhost:5173, demo deck)

1. **Component (story 1)**: select Pricing Service.
   - Type a description with `- a` bullets and `` `code` ``, then switch to Preview. Expected: a bullet list and code render. `<b>x</b>` shows as literal text.
   - Owner: type "Or". Expected: deck owners containing "or" are suggested.
   - Add the tag " PCI ". Expected: it becomes `pci`.
   - Paste `https://www.example.com/runbook` + Enter. Expected: the link is labelled "example.com".
   - Type `javascript:alert(1)`. Expected: it is refused.
   - Press ⌘Z once (outside the field). Expected: only the last field edit is undone.
2. **Connection (story 1)**: select Order → Pricing.
   - Set Protocol to gRPC. Expected: the canvas label and the popover (double-click) agree.
   - Set To = Order Service. Expected: refused with "Can't connect to itself".
   - Check USED IN FLOWS. Expected: it lists "Place order · Step 4", and choosing it shows the flow with step 4 selected.
3. **Flow, step, deck (story 2)**: open Place order.
   - Check the summary line. Expected: "8 steps · …".
   - Select step 4. Expected: Owner, Edge, Tags, Links and Attached rules show, and the SLA shows the target only.
   - Deselect everything. Expected: the deck inspector shows Name, Description, Tags and the stats, and "Rules n" opens the rule editor.
4. **Bulk (story 3)**: shift-select three services with different owners.
   - Expected: Owner shows "Mixed", and a tag on two of them shows "2/3" dashed.
   - Set the owner "Dispatch", then press ⌘Z once. Expected: every component gets its own previous owner back.
5. **Rule editor (story 4)**: Rules → New rule → name it "Delivery tier".
   - Add three conditions and three actions, then five rows from design 04.
   - Type `> abc` in a cell. Expected: "Not a valid condition".
   - ⌥↓ a row, delete a row, then ⌘Z. Remove a condition column. Expected: an Undo toast, and ⌘Z restores the column.
   - Reload the page. Expected: the same rule is open, unchanged.
6. **Attach (story 5)**: on step 4, Attach → Delivery tier.
   - Set Evaluated with 5 / 10 / Express. Expected: "Row 1 matches → Bike · 45 min · €4.00".
   - Attach the same rule to another step and to Pricing Service.
   - Edit a cell. Expected: both steps update, and a second tab updates too.
   - Detach, then ⌘Z. Expected: the rule and its sample inputs come back.
7. **Test and usage (story 6)**: choose "Edit rule" on step 4. Expected: TEST INPUT is pre-filled.
   - Clear Weight. Expected: "No row matches these inputs".
   - Switch to Unique and match two rows. Expected: "2 rows match; Unique expects one".
   - Change the inputs and choose "Save as step inputs". Expected: step 4 updates.
   - Check CHECKS. Expected: the catch-all warning shows, and a row of Any replaces it with "Has a catch-all row".
   - Choose a USED IN entry. Expected: it goes to the step.
   - Delete the rule. Expected: the dialog says "Used in 2 steps and 1 component". Confirm, then ⌘Z. Expected: every attachment is restored.
8. **Accessibility**: repeat steps 1, 5 and 6 with the keyboard only (Tab, arrows, Enter, Esc, ⌥↑/↓, ⌫). Then take a grayscale screenshot of 04/28/58. Expected: the matched row, no-match, Mixed and partial tags are identifiable without color.
9. **Privacy**: DevTools → Network while doing steps 1–7. Expected: no request carries deck content (`pnpm e2e` checks third-party requests).

## Visual check (definition of done)

Take screenshots at 1440×900, light and dark, of each frame and put them next to the design in the PR:

- 02, 18, 23 (component)
- 49 (connection)
- 50 (flow)
- 51 (step, without the meter)
- 10 (deck)
- 58 (bulk)
- 04, 28, 29 (rule editor)

List every difference (allowed: DESIGN.md tokens, lucide icons, SLA target only, owner combobox).
