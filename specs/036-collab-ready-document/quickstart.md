# Quickstart: Collaboration-Ready Deck Document (036)

A validation guide. Most of this feature is proven by automated tests (two in-memory documents
exchanging updates); the manual part uses two browser tabs, which sync the same way a server
later will. No new e2e test (constitution VI).

## Before upgrading (founder, once)

Decks stored in the browser before this feature cannot be opened afterwards (§g-81, §g-82).
For each deck worth keeping: open it on the current build, deck menu → Export… → JSON, and keep
the `.sododeck.json` file. After upgrading, import the files from the library.

## Automated

```bash
pnpm install
pnpm --filter @sododeck/model test      # round-trip, order keys, concurrency, repair, legacy probe, perf
pnpm --filter @sododeck/app test        # live-field rebase, loader and library "unsupported" outcome
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench                              # run on main first, then on this branch; compare
```

Expected:

- Every test that existed before passes unchanged, apart from the seven test files that reach into
  the stored layout (SC-002).
- `round-trip.test.ts`: every example file and the generated 500 / 2,000 decks serialize to the
  same text after `fromJSON` → `toJSON` (SC-001).
- `concurrency.test.ts`: every scenario passes with both delivery orders (SC-003, SC-004).
- `perf.test.ts`: the 10,000-component edit and move budgets hold (SC-005).
- `pnpm bench`: no scenario worse than `main` beyond run-to-run noise; storage load within 10 %
  (SC-006). Put both tables in the PR.

## Manual scenarios

Setup: `pnpm dev`, import `packages/schema/examples/full.sododeck.json`, and open the deck in
**two tabs** side by side. Tabs sync within milliseconds, so two manual edits are rarely truly
simultaneous: exact races are covered by the scripted tests, and the scenarios below check that
the behaviour is wired end to end.

1. **Nothing changed** (US1)
   - Edit a title, move a card, reorder a flow step, move a rule row, add and delete a note, undo
     and redo each. Expect: exactly as before.
   - Export the deck. Import the export into a build of `main` (or diff it against an export made
     on `main` from the same file): no difference.
2. **Reorder while the other tab edits** (US2)
   - Tab A: open a flow's step list. Tab B: open the same step in the inspector.
   - A drags the step to another position; B types a new title.
   - Expect: both tabs show the step in its new place with the new title. ⌘Z in A puts the step
     back and keeps B's title.
3. **Both tabs move the same step** (US2): move it to the top in A and to the bottom in B.
   Expect: one step, in the same place in both tabs.
4. **Typing in the same description** (US3)
   - Select the same component in both tabs and open its details.
   - Focus the description in both. Type a sentence at the start in A, then one at the end in B,
     then keep typing in A.
   - Expect: both sentences are present in both tabs; A's cursor stays where A is typing while
     B's text appears.
   - Leave the field in A and press ⌘Z: only A's typing goes.
5. **First text from both tabs** (US3): pick a component with no description; type in both tabs.
   Expect: both texts kept.
6. **Delete against connect** (US4)
   - The exact race (A deletes a component while B connects to it) is in the scripted tests. By
     hand: in A delete a component that a flow step uses, and check in B that the Problems badge
     counts the broken step at once, with no action in B.
   - ⌘Z in A: the component and its connections return in both tabs and the problem goes.
7. **Delete against pin** (US4): B pins a component in a view, A deletes the component. Expect:
   the JSON panel's view shows no `pinned` entry for it in either tab, and neither tab gained an
   undo step for that.
8. **Old stored deck** (FR-027): with a deck stored by `main` in the library, open it on this
   branch. Expect: the "can't be opened" page with the sentence about importing the exported
   file; the library still lists the deck; "Export" from the library card shows an error instead
   of saving an empty file.
9. **Rule table** (R5): in two tabs on the rule editor, add a column in A and a row in B. Expect:
   the row has an (empty) cell under the new column in both tabs, and the exported file imports
   again.

## Decision records to read

- ADR 0021 (layout 2): the stored layout, long text fields, repair rule, known limits.
- ADR 0022 (schema roadmap): check each schema change of backlog 029, 033, 022, 030 and 032
  against it (SC-008).
