# Quickstart: validating the Deck Document Model (002)

How to prove 002 works. API in [contracts/model-api.md](contracts/model-api.md); behavior tables in
[data-model.md](data-model.md).

## Prerequisites

- Node ≥ 24, `pnpm install` at the repo root.
- 001 merged (`packages/schema` with v1, examples `minimal`, `flow-and-rule`, `full`).

## 1. Model tests (all spec scenarios)

```bash
pnpm --filter @sododeck/model test
```

Expected: all green, in Vitest's `node` environment (no DOM). Test files map to the spec:

| Test file (packages/model/test) | Proves                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `round-trip.test.ts`            | US2 AS1/2, FR-022/023: every example + one case per object type/field; replica via encoded update serializes identically |
| `load.test.ts`                  | US2 AS3/4/5, FR-019–021: invalid file refused, duplicate ids refused with both paths, dangling refs load                 |
| `ids.test.ts`                   | US5, FR-009/010: format-valid, not title-derived, stable, 10,000 without collision                                       |
| `edit.test.ts`                  | US1, FR-005–008: add/update/move/reorder per type; invalid edits refused and deck unchanged; export valid after every op |
| `cascade.test.ts`               | US3, FR-011–018: every row of the cascade table + one-undo restore                                                       |
| `rules.test.ts`                 | FR-018: column/row add/move/remove keep cell counts; ruleInputs cleanup                                                  |
| `undo.test.ts`                  | US4, FR-024–029: burst grouping, gesture, batch, redo cleared, load not undoable, remote not undone                      |
| `observe.test.ts`               | US1 AS3, FR-002: one event per transaction with object ids and keys                                                      |
| `integrity.test.ts`             | FR-030/031, SC-008: one fixture per problem kind                                                                         |
| `perf.test.ts`                  | SC-003/004: 500 nodes / 1,000 edges timings                                                                              |

## 2. Manual smoke in Node (optional)

`tsx` is a dev dependency of `@sododeck/schema`, not of the model, so run it through `pnpm dlx`
from `packages/model`:

```bash
cd packages/model && pnpm dlx tsx -e "
import { readFileSync } from 'node:fs';
import { fromJSON, toJSON, createEditor, checkIntegrity } from './src/index.ts';
const doc = fromJSON(JSON.parse(readFileSync('../schema/examples/flow-and-rule.sododeck.json', 'utf8')));
const ed = createEditor(doc);
const nodeId = toJSON(doc).nodes[0].id;
console.log(ed.remove('nodes', nodeId));
console.log(checkIntegrity(toJSON(doc)));
ed.undo();
console.log(checkIntegrity(toJSON(doc)).length === 0);
"
```

Expected: the removal lists the cascaded edges; integrity lists the now-broken steps; after one
undo there are no problems.

## 3. Definition of done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

Expected: all pass; the app still loads and saves decks (its `fromJSON`/`toJSON` calls are
unchanged), and the smoke suite incl. "no third-party requests" is green. No `pnpm bench` needed
(no canvas change).
