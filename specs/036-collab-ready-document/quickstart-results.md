# Quickstart results (036)

Date: 2026-10-03. Branch `FamManh/feat-file-format-capability`.

**The two-tab manual walk has not been done yet.** It needs a person at a browser with two tabs
open side by side. The table records which automated test covers each scenario today, so the
manual walk only has to confirm that the behaviour is wired end to end in the real app.

## Automated

`pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`: all pass (schema 154, ui 430,
model 558, app 1,795 tests; e2e smoke 4). No skipped or `.only` tests. `grep -rn "getArray("
packages/model/src apps/app/src` finds only the legacy-deck test fixture
(`apps/app/src/test/legacy-deck.ts`), which builds the old layout on purpose.

## Manual scenarios

| #   | Scenario                       | Automated coverage                                                                                                                                                                             | Manual walk |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Nothing changed (US1)          | Every model and app test that uses the public API passes unedited; `round-trip.test.ts` (byte-identical export of the examples and of 500 / 2,000-node decks); e2e smoke                       | not done    |
| 2   | Reorder while the other edits  | `concurrency.test.ts` "keeps a field edit of a step another tab moved", "undoes a local move without losing the other side's edit"                                                             | not done    |
| 3   | Both tabs move the same step   | `concurrency.test.ts` "never duplicates an item moved on both sides"                                                                                                                           | not done    |
| 4   | Typing in the same description | `concurrency.test.ts` long text block (start + end, same place, undo of local characters); `use-live-field.test.tsx` "keeps the typing and the caret when another tab edits the focused field" | not done    |
| 5   | First text from both tabs      | `concurrency.test.ts` "keeps both first texts of an empty description, step notes and note text"                                                                                               | not done    |
| 6   | Delete against connect         | `concurrency.test.ts` "keeps a connection to a node deleted elsewhere, reports it, and undo makes it whole"; `problems-store.test.ts` "follows a change from another tab with no user action"  | not done    |
| 7   | Delete against pin             | `repair.test.ts` "cleans up after 'A deletes a node, B pins it', outside undo"; `concurrency.test.ts` "drops a pin, position or include of a node deleted elsewhere"                           | not done    |
| 8   | Old stored deck                | `deck-loader.test.ts`, `editor-page.test.tsx` "explains that a deck stored by an earlier build cannot be opened", `library-ops.test.ts` "refuses to read a deck stored by a build before 036"  | not done    |
| 9   | Rule table                     | `concurrency.test.ts` "keeps rule tables rectangular whatever columns and rows change" (add column vs add row; `fromJSON(toJSON(doc))` re-imports)                                             | not done    |
