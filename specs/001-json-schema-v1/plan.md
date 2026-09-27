# Implementation Plan: Deck File Format v1 (`.sododeck.json`)

**Branch**: `001-json-schema-v1` (git: `manh-pham-tpv-clv/feat-json-schema-v1`) | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-json-schema-v1/spec.md`

## Summary

Replace the skeleton `packages/schema/schema/v1.json` (every object `{ id, ...anything }`) with the
complete, strict v1 format from [data-model.md](data-model.md): deck metadata, nodes, groups, edges,
views, features, flows, steps, decision-table rules and stickies, closed enums (6 node kinds,
6 protocol families), stable ids everywhere, canonical key order, and a description on every field.
Rules that JSON Schema cannot express, or that the Zod generator drops, are enforced by a small
pure `checkSemanticRules()` that `parseSododeckFile()` runs after Zod, so the published schema and
the app's validator give identical verdicts ([research.md](research.md) R1–R3). Add three examples,
invalid fixtures, parity/lossless/key-order/generator-guard tests, ADR 0004, and the minimal
behavior-preserving updates in `packages/model` tests and `apps/app` that the stricter types force.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), Node ≥ 24; JSON Schema draft 2020-12

**Primary Dependencies**: existing only — `zod` 4 (runtime); `ajv` 8, `json-schema-to-typescript` 16, `json-schema-to-zod` 2.8, `tsx`, `prettier` (dev). No new dependency.

**Storage**: N/A (file format definition; files are produced by 002/005)

**Testing**: Vitest in `packages/schema/test` (Ajv/Zod parity, invalid fixtures, lossless parse, key order, generator guard, staleness via `generate:check`); round-trip in `packages/model/test`

**Target Platform**: Isomorphic TS (browser, Web Worker, Node) — no browser or Node APIs in `src/`

**Project Type**: Internal library in a pnpm/Turborepo monorepo (`packages/schema`)

**Performance Goals**: Validate a 500-node / 1,000-edge deck in < 100 ms on the main thread in tests (sanity bound; large imports move to a worker in 002/005)

**Constraints**: Local, non-recursive `$ref` only; no `default` keyword; no `format` keyword; generated code committed; published schema must stay standard (no custom keywords)

**Scale/Scope**: 10 object types + 5 shared types, ~90 fields; 3 examples; ~30 invalid fixtures

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle                                    | Check                                                                                                                                                                                                                                                           | Result |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Single source of truth                    | No document state added anywhere; schema only defines the format. App changes only remove now-redundant type guards.                                                                                                                                            | ✅     |
| II. Schema-owned format, lossless round-trip | `v1.json` stays the source; types + Zod regenerated; Ajv/Zod parity extended; parse returns input unchanged (no `default`, R4); `packages/model` round-trip gains `full.sododeck.json`. Additive-only vs skeleton; `version` stays 1 (no released files exist). | ✅     |
| III. Stable identity                         | Every object incl. steps, rule rows and rule columns has a required `Id`; all references by id; id pattern documented as opaque. Rename test in model already exists; example-based rename check added (SC-005).                                                | ✅     |
| IV. Local-first, private                     | No network; schema bundled as today (`enableSchemaRequest: false`); publishing the URL is out of scope.                                                                                                                                                         | ✅     |
| V. Performance off main thread               | Validation is pure and worker-safe; no canvas change, so no `pnpm bench` needed.                                                                                                                                                                                | ✅     |
| VI. Strict types, tested                     | Generated types become strict (guard test forbids index signatures/`z.any()`); every rule has valid + invalid fixtures; no new e2e; smoke suite must pass.                                                                                                      | ✅     |
| VII. Accessible by default                   | No UI. Sticky colors are semantic tint names, not hex (tokens only).                                                                                                                                                                                            | ✅ N/A |
| VIII. Simplicity, dependencies               | No new dependency (R10). One small hand-written module (`semantic-rules.ts`) instead of Ajv custom keywords. ADR 0004 records decisions.                                                                                                                        | ✅     |

**Post-design re-check (after Phase 1)**: unchanged — all ✅. The only structural addition beyond
the backlog hint ("packages/schema only") is the minimal consumer update in `packages/model/test`
and `apps/app`, required to keep `lint/typecheck/test/build/e2e` green (Definition of done), with no
behavior change. Not a constitution deviation.

## Project Structure

### Documentation (this feature)

```text
specs/001-json-schema-v1/
├── spec.md
├── plan.md                         # this file
├── research.md                     # R1–R10: generator gaps, semantic rules, key order, …
├── data-model.md                   # field-level design = canonical key order
├── quickstart.md                   # validation guide
├── contracts/
│   └── schema-package-api.md       # @sododeck/schema exports + guarantees
├── checklists/requirements.md
└── tasks.md                        # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                  # REWRITE: full v1 (data-model.md), descriptions on every field
├── scripts/generate.ts             # EDIT: strip object-level anyOf presence rules before TS/Zod generation
├── src/
│   ├── index.ts                    # EDIT: parseSododeckFile runs checkSemanticRules; export it + Issue
│   ├── semantic-rules.ts           # NEW: S1 row cell counts, S2 sticky anchor|position, S3 id-shaped map keys
│   └── generated/{types,zod}.ts    # REGENERATED (committed)
├── examples/
│   ├── minimal.sododeck.json       # KEEP (already valid v1)
│   ├── flow-and-rule.sododeck.json # NEW
│   └── full.sododeck.json          # NEW: every object type and optional field
├── test/
│   ├── schema.test.ts              # EDIT: parity over examples + fixtures, lossless parse, messages
│   ├── fixtures.ts                 # NEW: invalid fixtures as mutations of full example (FR-026)
│   ├── semantic-rules.test.ts      # NEW: unit tests for S1–S3
│   ├── key-order.test.ts           # NEW: examples follow schema properties order
│   └── generated.test.ts           # NEW: no z.any() / no index signatures in generated code
└── CLAUDE.md                       # EDIT: Status, public API (checkSemanticRules), generator notes

packages/model/test/deck.test.ts    # EDIT: replace free-form `rich` fixture with examples/full.sododeck.json;
                                    #       keep round-trip, Yjs-update and rename tests
packages/model/src/deck.ts          # EDIT only if typecheck requires (e.g. top-level name/description/tags
                                    #       round-trip through `meta`) — keep toJSON lossless for new envelope fields

apps/app/src/editor/{deck-to-flow,left-sidebar,inspector}.ts(x)   # EDIT: drop redundant typeof guards
apps/app/src/**/*.test.ts(x), bench/generate-deck.ts               # EDIT: fixtures valid under v1

docs/decisions/0004-schema-v1-shape.md   # NEW ADR: enums, positions, decision tables, rules[], ids,
                                         #          branches deferred to 006, semantic rules, enum-widening trade-off
docs/spec.md §6                          # EDIT: sododeck.com URL; example updated to valid v1
```

**Structure Decision**: all format work stays in `packages/schema` (backlog 001 plan hint).
`packages/model` and `apps/app` receive only the edits the stricter generated types force; they are
listed explicitly so nothing else in those packages changes. Note on `packages/model/src/deck.ts`:
the envelope gains optional `name`/`description`/`tags`; today `fromJSON`/`toJSON` copy only
`$schema`/`version` into `meta`, so without an edit those fields would be dropped. Storing them in
`meta` and emitting them only when present is the smallest lossless fix, covered by the new
round-trip case (constitution II). The full Yjs layout remains 002's job.

## Implementation notes (for /speckit-tasks)

1. Write `v1.json` per data-model: `$defs` for every type with a `title` (type names), description
   on every property, `additionalProperties: false`, no `default`/`format`; sticky `anyOf` in the
   R3 form. Keep `$defs` non-recursive (group/node nesting is by id).
2. Update `generate.ts` (strip `anyOf` presence rules), run `pnpm schema:generate`.
3. `semantic-rules.ts` + unit tests; wire into `parseSododeckFile`.
4. Examples, then fixtures and the parity/lossless/message/key-order/generator tests.
5. Fix consumers (`model` tests + envelope meta, app guards/fixtures) until repo gates pass.
6. Docs: ADR 0004, spec §6, `packages/schema/CLAUDE.md`, and `packages/model/CLAUDE.md` only if its
   API text changes.

Commit plan (Conventional Commits, no AI trailers): `feat(schema): …` (schema + generator +
semantic rules), `test(schema): …`, `fix(model): …`/`refactor(app): …` for consumer updates,
`docs: …` (ADR, spec, CLAUDE.md).

## Complexity Tracking

No constitution violations. Nothing to justify.
