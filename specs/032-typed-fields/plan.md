# Implementation Plan: Typed Fields

**Branch**: `032-typed-fields` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/032-typed-fields/spec.md` (clarify 2026-10-03: on-card per type; built-ins Tech / Host / Owner in the list; default fields per type from frame 120; any kind change keeps what converts; person suggestions without bulk rename).

**Dependency**: 030 is built (`884586b`). I checked these names on `main`: `packages/model/src/card-types.ts` (`CardType` id / name / pack / category / family / order, `CARD_TYPES`, `typeName`, `deckPacks`), `layout.ts` (layout-2 lists, `ORDER_KEY`, `childList`, `orderedEntries`, `packsMap`, `tagColorsMap`), `problems.ts` (`ProblemKind`, `PROBLEM_KINDS`), `search/search.ts` (`SearchField`), `apps/app/src/editor/card-layout.ts` (`cardLayout`, tag block, minimum height rule, `SIZE_STEP`), `deck-node.tsx`, `inspector/node-inspector.tsx` (Owner / Tech / Host rows), `inspector/bulk-inspector.tsx`, `inspector/derive.ts` (`ownerSuggestions`), `fields/owner-field.tsx` / `combo-field.tsx` / `pick-field.tsx` / `one-step.ts`, `tags/tag-colours.ts` (`chipColours`, `tagColours`), `export/scene.ts`, `export/render-svg.ts`, `bench/perf.bench.ts` (`BENCH_TYPES`). ADR numbers: 0025 is 030's, 0026 reserved for 031; this feature takes **0027**.

## Summary

Cards get typed fields: definitions per type (built-ins, code defaults, deck fields), values per card, a chosen subset shown on the card, and a field editor in the drawer.

- **Sources of fields** (R1): built-ins (`tech`, `host`, `owner`; values stay where they are), code defaults per type (founder table, ids like `task.status`), deck fields. A type's defaults are materialised into the deck on its first definition change; `fieldDefaults` records that.
- **File format** (R2): root `fields`, root `fieldDefaults`, `node.values`; rules S12 / S13; dangling values valid and reported. ADR 0022 rows refined; new ADR 0027. No version bump.
- **Document** (R3): layout-2 `fields` list with `options` child lists; `values` nested map key by key.
- **Ops** (R4): add / update / move / delete fields and options, `changeFieldKind` (R6 conversions), `setValues`.
- **Card** (R5): header status slot, chip shelf, rows, "+N fields"; layout includes the fields block (minimum height rule); zoom per spec.
- **Drawer** (R8): one "Fields" list replacing the Owner / Tech / Host rows; add / rename / kind / options / types / delete; bulk with "Mixed".
- **Person** (R7) suggestions and canonical spelling; **search, export, problems, clipboard** (R9); **bench** (R10).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all installed; **no new dependency**. Dates via `Intl.DateTimeFormat` and `<input type="date">`; status icons from lucide (`Circle`, `CircleDashed`, `CircleDot`, `CircleCheck`, `Eye`, `DoorOpen`), kind icons (`Type`, `Hash`, `CircleChevronDown`, `CircleDot`, `User`, `Calendar`, `CalendarRange`, `Link`, `Gauge`); names checked during T001.

**Storage**: schema v1 additions (R2) + `pnpm schema:generate`; Yjs layout-2 `fields`, `fieldDefaults` map, `values` nested map (R3); no layout version change, no migration.

**Testing**: Vitest (schema parity and S12 / S13; `fieldsOfType`, materialisation, every op, conversions table, validation, person canonical spelling, problems, round-trip, concurrency; `card-fields` and `card-layout` heights; search; export scene), Testing Library (card fields block, drawer editor, add form, kind change confirmation, bulk by role and name per [contracts/fields-ui.md](contracts/fields-ui.md)). No new e2e; smoke suite green.

**Target Platform**: Evergreen desktop browsers (Chromium for bench and e2e).

**Project Type**: pnpm / turbo monorepo: Vite SPA plus internal packages.

**Performance Goals**: `BENCH_FIELDS=1` (500 cards, four on-card values each) within run-to-run variation of `bench-before.md`; toggling "On card" for a type re-renders only that type's cards and lands within one frame (SC-002); `fieldsOfType` memoised per snapshot and type.

**Constraints**: older decks byte-identical (nothing written before a value or a field change); single source of truth (definitions and values only in the document; add-field form and drawer drafts are UI state); colour never the only cue (chips always show text or carry names); tokens only (user hex aside); links never fetched; no network.

**Scale/Scope**: ~3 schema files, ~6 model files, ~20 app files, docs (ADR 0027, ADR 0022, DESIGN.md fields details, package `CLAUDE.md`s, backlog §032). Estimate **6 d** (backlog 5 d + default fields and kind conversions from clarify).

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes; no violations._

| Principle                                    | Status | How                                                                                                                                                                                                                                              |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Single source of truth                    | ✅     | Definitions in `fields` (plus code defaults until materialised), values in `node.values` / built-in keys; card view, drawer, search and export derive through `fieldsOfType` and `card-fields`. Drafts and the add form are UI state.            |
| II. Schema-owned format, lossless round-trip | ✅     | `fields`, `fieldDefaults`, `values` in `v1.json`; S12 / S13 with invalid fixtures; round-trip: defaults not written until changed, materialised types, every kind's value, dangling values preserved. Only `packages/model` converts Yjs ↔ JSON. |
| III. Stable identity                         | ✅     | Field and option ids are stable (renames never touch values); code default ids are fixed strings; values key by id.                                                                                                                              |
| IV. Local-first, private                     | ✅     | No network; link values are never fetched or previewed.                                                                                                                                                                                          |
| V. Performance off the main thread           | ✅     | Memoised pure derivations; layout cost similar to tags; bench gate.                                                                                                                                                                              |
| VI. Strict types, tested behaviour           | ✅     | Pure modules with the rules in [contracts/fields-api.md](contracts/fields-api.md); component tests by role and name; no new e2e.                                                                                                                 |
| VII. Accessible by default                   | ✅     | Every control named; keyboard reorder; confirmations as `alertdialog`; announcements; chips named "<field>: <value>"; System dots named; chip contrast tested (033 helpers).                                                                     |
| VIII. Simplicity, justified deps             | ✅     | One merge function for three field sources; reuses `ComboField`, `SwatchGrid`, 033 chip colours, 029 layout rules; no date or form library.                                                                                                      |

## Project Structure

### Documentation (this feature)

```text
specs/032-typed-fields/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R10
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── fields-api.md
│   └── fields-ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                     # fields, FieldDef, FieldOption, StatusIcon, fieldDefaults, Node.values
├── src/semantic-rules.ts              # S12, S13
├── src/generated/{types,zod}.ts
├── examples/full.sododeck.json
└── test/{fixtures,schema,semantic-rules,coverage,key-order}.test.ts

packages/model/
├── src/card-types.ts                  # defaultFields per type; BUILT_IN_FIELDS
├── src/fields.ts                      # new: fieldsOfType, fieldUsage, personSuggestions, canonicalPerson
├── src/field-values.ts                # new: validateValue, convertValue, clearedByKindChange
├── src/layout.ts, src/read.ts, src/deck.ts   # fields list, fieldDefaults map, values map
├── src/ops/fields.ts                  # new: field, option, kind and value ops (materialise first)
├── src/problems.ts                    # field-value-dangling
├── src/search/{index,search}.ts       # 'field' search field
├── src/editor.ts, src/index.ts
└── test/{fields,field-values,fields-ops,round-trip,concurrency,problems,search}.test.ts

apps/app/src/editor/
├── card-fields.ts (+ test)            # new: header / chips / rows / hidden for a node
├── card-layout.ts                     # fields block + minimum height
├── deck-node.tsx                      # header status slot, chip shelf, rows, +N pill, System dots
├── deck-to-flow.ts                    # node data fields view; cache keys
├── fields/typed-fields-section.tsx (+ test)   # new: drawer list, row menu, reorder
├── fields/add-field-form.tsx (+ test)         # new
├── fields/value-controls/*.tsx (+ tests)      # new: one per kind
├── fields/owner-field.tsx             # → person control using personSuggestions
├── inspector/{node-inspector,bulk-inspector,derive}.tsx  # Fields section replaces Owner / Tech / Host rows
├── export/{scene,render-svg}.ts       # fields block
└── bench: apps/app/bench/perf.bench.ts, src/bench/generate-deck.ts   # BENCH_FIELDS

docs/  decisions/0027-typed-fields.md (new) · decisions/0022-schema-roadmap.md · DESIGN.md (fields, field editor) · backlog.md (§032 status)
packages/schema/CLAUDE.md, packages/model/CLAUDE.md, apps/app/CLAUDE.md
```

**Structure Decision**: existing layout; field logic pure in `model`, card view and editor in `app`.

## Delivery slices

1. **Format and model** (R1–R4, R6, R7): schema, code fields, materialisation, ops, conversions, problems, round-trip.
2. **US1 drawer values and add field** (R8 subset): Fields section with value controls and add form.
3. **US2 on the card** (R5): fields block, header status, "+N", zoom, layout, export.
4. **US3 manage** (R8): rename, reorder, options, types, kind change, delete.
5. **US4 built-ins**, **US5** bulk / search / clipboard, polish, bench.

## Complexity Tracking

No constitution violations to justify.
