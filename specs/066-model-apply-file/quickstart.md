# Quickstart: validate 066 (apply a changed deck file)

066 has no UI. It is validated through `@sododeck/model` tests. The contract is in [contracts/model-api.md](contracts/model-api.md) and the rules are in [data-model.md](data-model.md).

## Prerequisites

```bash
cd ../sododeck-066        # worktree on branch 066-model-apply-file
pnpm install
```

## Run

```bash
pnpm --filter @sododeck/model test -- apply-file     # feature tests
pnpm --filter @sododeck/model test -- perf           # SC-003 timings
pnpm --filter @sododeck/model test                   # whole package (load / import regressions)
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e   # definition of done
```

## Scenarios and expected outcomes

| #   | Scenario (spec ref)                                                               | Expected                                                                                                                                             |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Rename one component in a copy of `full.sododeck.json`, apply (US1 AS1)           | One `DeckChange` naming that node and `title`. All stored maps of other objects are the same instances. Snapshot identity kept for untouched objects |
| 2   | Add a connector, remove a note (US1 AS2)                                          | `summary.edges.added = 1`, `summary.stickies.removed = 1`, nothing else                                                                              |
| 3   | Change a step's text, a rule cell, a table column type (US1 AS3)                  | One change each, child named, key named                                                                                                              |
| 4   | Move one flow step / rule row / column / view (US1 AS4)                           | The open deck has the file order. Exactly one `$order` key written per moved item                                                                    |
| 5   | Apply the same file again (US1 AS5)                                               | `changed: false`, no `observeDeck` call, no Yjs update emitted                                                                                       |
| 6   | Every corpus pair A→B (US1 AS6, SC-001)                                           | `serializeDeck(doc)` byte-equal to `serializeDeck(loadDeck(B).doc)`                                                                                  |
| 7   | User edit → apply unrelated change → undo, redo (US2 AS1)                         | The user edit is undone and redone. The applied change stays throughout                                                                              |
| 8   | Apply on a fresh editor (US2 AS2)                                                 | `canUndo()` is false                                                                                                                                 |
| 9   | User sets a title → file sets another title → undo (US2 AS3)                      | The file's title stays. The undo returns true and throws nothing                                                                                     |
| 10  | User types a description, the file rewrites it, the user undoes (US2 AS3, FR-018) | The description equals the file's value                                                                                                              |
| 11  | Typing burst with an apply in the middle (US2 AS4)                                | One undo step for the burst                                                                                                                          |
| 12  | Dangling reference / duplicate id / not JSON / version 2 (US3)                    | `refused` with the same entries `inspectDeckText` gives. `toJSON` unchanged, no event, undo unchanged                                                |
| 13  | New picture with bytes; damaged picture; `data: ''` for a known picture (US4)     | Bytes returned by id; problem listed and the rest applied; no picture change                                                                         |
| 14  | Locked node moved and unlocked by the file (FR-017)                               | Applied                                                                                                                                              |
| 15  | Apply during an open gesture (edge case)                                          | Applied at once. `endGesture` closes one undo step holding only the gesture's edits                                                                  |
| 16  | Editor origin passed as `origin`                                                  | Throws `TypeError`, nothing written                                                                                                                  |
| 17  | 500 / 1,000 deck: one field; every object (SC-003)                                | < 50 ms; < 1 s                                                                                                                                       |

## Report

Record the SC-003 timings from the perf test output in the final report. No canvas code changes, so `pnpm bench` is not required.
