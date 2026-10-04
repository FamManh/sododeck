# Implementation Plan: Database Schema Model

**Branch**: `040-db-schema-model` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/040-db-schema-model/spec.md`

## Summary

Give the file format and the Yjs model a lossless place for a database schema, with no visible
canvas change. A table is a node of the new type `db-table` (pack `database`) carrying optional
`schema`, `columns`, `indexes`, `checks`, `expanded` and `detail`; enums are a deck-level `enums`
list; the deck has an optional `dialect`; relationships are edges with `fromColumns` /
`toColumns`, `cardinality`, optional sides and `onDelete` / `onUpdate`. Columns, indexes, checks,
enums and enum values share one deck-wide id scope. In Yjs, every new list is a layout-2 child
list (ADR 0021) so concurrent edits merge per item. New editor ops add, change, move and remove
each part, with cascades (removing a column removes its relationships and index parts) in one
undo step. Two new derived problems report dangling references and mismatched composite ends.
Decisions: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict, `noUncheckedIndexedAccess`), Node ≥ 24

**Primary Dependencies**: existing only: Yjs (model), generated Zod + Ajv (schema),
`json-schema-to-typescript` / `json-schema-to-zod` (generator). No new dependency (R16).

**Storage**: the deck's Yjs document (IndexedDB provider, unchanged) and `.sododeck.json` files

**Testing**: Vitest (schema parity and fixtures, model round-trip, ops, cascades, concurrency,
problems, paste, perf); existing Playwright smoke suite unchanged

**Target Platform**: browsers (main thread and Web Workers) and Node (tests); model code stays
DOM-free

**Project Type**: pnpm monorepo: `packages/schema`, `packages/model`, small touches in
`packages/ui` and `apps/app`

**Performance Goals**: 150 tables × 12 columns (~200 relationships): `fromJSON` / `toJSON`
< 1 s each; a column edit within the existing per-edit budget; `checkDeck` within its budget
(SC-005, R15)

**Constraints**: lossless round-trip; decks saved before 040 byte-identical on save; schema
strict (`additionalProperties: false`); no network; no version or revision bump (ADR 0020
deferred)

**Scale/Scope**: ~25 schema `$defs`/properties, ~20 editor methods, 2 problem kinds, 1 registry
pack and type, 1 ADR

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                           | Gate                                                                                                                                    | Status |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Single source of truth           | Schema data lives only in the Yjs document; no app state copies it (no app UI in this feature)                                          | Pass   |
| II. Schema-owned format, round-trip | `v1.json` edited first, types + Zod regenerated, parity green; model is the only Yjs ↔ JSON path; round-trip cases added; additive only | Pass   |
| III. Stable identity                | Every column, index, check, enum, enum value has an id; all references by id; rename tests (US2)                                        | Pass   |
| IV. Local-first and private         | No network, no new assets; smoke e2e unchanged                                                                                          | Pass   |
| V. Performance off the main thread  | No new heavy work; problems already run in the worker; perf case added; `pnpm bench` before/after                                       | Pass   |
| VI. Strict types, tested behavior   | Unit tests per op, cascade, problem and paste; no app behavior beyond registry entries (covered by existing tests + card-types test)    | Pass   |
| VII. Accessible by default          | No new UI. The Packs panel and Add palette list the new pack/type through existing accessible components                                | Pass   |
| VIII. Simplicity, justified deps    | No dependency; mirrors existing patterns (steps, rule columns, field options); ADR 0029 records the model decisions                     | Pass   |

**Post-design re-check (after Phase 1)**: still Pass. One recorded note: the spec originally
named a format revision bump and "duplicates reported as problems"; both contradicted the code
(ADR 0020 deferred; duplicates refuse a file) and the spec was corrected during planning rather
than deviating from the constitution or existing rules.

## Project Structure

### Documentation (this feature)

```text
specs/040-db-schema-model/
├── plan.md               # this file
├── research.md           # Phase 0: decisions R1–R16
├── data-model.md         # Phase 1: entities, rules, Yjs layout
├── quickstart.md         # Phase 1: validation guide
├── contracts/
│   ├── file-format.md    # v1.json additions, semantic rules, fixtures
│   └── model-additions.md# DeckEditor and export additions
├── checklists/requirements.md
└── tasks.md              # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                 # new $defs, root dialect/enums, node + edge keys
├── src/generated/                 # regenerated (pnpm schema:generate)
├── src/semantic-rules.ts          # S14 (default xor defaultExpr), S15 if needed
├── examples/full.sododeck.json    # "Shop" fragment, coverage of every new key/value
├── test/fixtures.ts               # invalid fixtures (contracts/file-format.md)
└── CLAUDE.md                      # status entry for 040

packages/model/
├── src/card-types.ts              # pack `database`, type `db-table`, isDbTable
├── src/layout.ts                  # enumsList(meta), table child-list helpers
├── src/text-fields.ts             # TextKind += dbColumn, dbIndex, dbCheck, enum, enumValue
├── src/read.ts / write.ts         # node child lists; meta.dialect, meta.enums
├── src/deck.ts                    # layout doc comment; fromJSON builds new lists
├── src/ids.ts                     # prefixes; collect ids of the new lists
├── src/load-checks.ts             # database-parts duplicate scope
├── src/ops/db-tables.ts (new)     # column / index / check ops + column cascade
├── src/ops/db-enums.ts (new)      # enum / enum value ops + enum cascade, setDialect
├── src/ops/collections.ts         # refuse list keys in update('nodes'); edge column-end checks
├── src/ops/paste.ts, fragment.ts  # re-id parts, remap index parts and edge ends
├── src/problems.ts                # db-dangling-reference, db-composite-mismatch
├── src/editor.ts, index.ts        # new methods and exports
├── test/…                         # see quickstart.md §2
└── CLAUDE.md                      # "Added by 040"

packages/ui/src/lib/icons.ts       # type style for db-table
apps/app/src/library/deck-thumbnail.tsx      # fill for db-table
apps/app/src/editor/problems/problem-kinds.ts # titles/icons for the two kinds

docs/decisions/0029-database-pack-model.md   # ADR
docs/backlog-database.md                     # 040 status; 041 notes (enum hover, column ends)
```

**Structure Decision**: model-first change inside the existing packages; the app only gains
registry-driven entries that exhaustive maps require. No new package.

## Phases (for /speckit-tasks)

1. **Schema**: `v1.json`, regenerate, S14/S15, examples, fixtures, parity (contracts/file-format).
2. **Model read/write**: layout, text kinds, read/write of node lists and meta, `fromJSON` /
   `toJSON`, round-trip cases, legacy byte-identity (US1, US3).
3. **Registry**: pack + type, ui type style, thumbnail fill (FR-001–003).
4. **Ops**: tables, enums, dialect, edge column ends; rename tests (US2, US6).
5. **Cascades and paste** (US5, FR-022a).
6. **Concurrency** (US4).
7. **Problems and load checks** (FR-021), app problem kinds.
8. **Perf, docs, ADR, DoD** (SC-005, FR-034).

## Complexity Tracking

No constitution violations to justify.
