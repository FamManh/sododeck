# Research: Deck File Format v1

**Feature**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Date**: 2026-09-27

Findings below come from probes run against the pinned toolchain in this repo
(`ajv` 8.20, `json-schema-to-zod` 2.8, `json-schema-to-typescript` 16, `zod` 4.6) on 2026-09-27.

## R1. Rules that JSON Schema cannot express (row cell counts)

- **Decision**: Add a small hand-written module `packages/schema/src/semantic-rules.ts` with
  `checkSemanticRules(file)`, run by `parseSododeckFile()` after the generated Zod validator
  succeeds. The published JSON Schema documents each such rule in the relevant `description`.
- **Rationale**: JSON Schema 2020-12 has no way to compare the lengths of two sibling arrays
  (`rows[].when` vs `inputs`). Ajv custom keywords would make the published schema non-standard
  (Monaco, other languages and AI agents would ignore or reject them). A pure function in the
  schema package keeps the check intra-object (no referential integrity, which stays in 002), is
  typed, and is exported so a future CLI can run Ajv + the same function.
- **Alternatives considered**: Ajv custom keyword (non-standard contract, Zod generator ignores it);
  cells keyed by column id instead of positional arrays (still a cross-field check, and noisier
  diffs); moving the check to `packages/model` (the backlog acceptance criterion puts it in schema
  validation, and the CLI must not need Yjs).

## R2. Generator gaps: `propertyNames` and `anyOf`

- **Finding**: `json-schema-to-zod` silently drops `propertyNames` (records accept any key) and
  turns `anyOf: [{required:[…]}, …]` into `.and(z.union([z.any(), z.any()]))`, i.e. no check.
  `json-schema-to-typescript` turns the same `anyOf` into `{[k: string]: unknown} & {…}`, which
  destroys type safety.
- **Decision**:
  1. Keep both constraints in the published JSON Schema (Ajv and Monaco enforce them).
  2. `scripts/generate.ts` strips object-level `anyOf` presence rules before generating TS and Zod
     (documented in the script).
  3. `checkSemanticRules()` re-checks what the generators drop: record keys are valid ids
     (`rules`, `view.positions`, `step.ruleInputs` and its inner maps) and a sticky has an anchor or
     a position.
  4. A guard test asserts the generated `zod.ts` contains no `z.any()` and `types.ts` contains no
     `[k: string]: unknown`, so any future silently-dropped construct fails CI.
- **Rationale**: the published contract stays complete and standard; the app's validator reaches
  the same verdict (parity test compares `Ajv + semantic rules` with `parseSododeckFile`).
- **Alternatives considered**: drop the constraints from JSON Schema (Monaco would no longer flag
  them); post-process generated Zod text (fragile string surgery).

## R3. Ajv strict mode and `anyOf` presence rules

- **Finding**: with `strict: true`, `anyOf: [{ required: ['anchor'] }]` throws `strictRequired`.
  Declaring the property inside the branch passes:
  `anyOf: [{ properties: { anchor: true }, required: ['anchor'] }, { properties: { position: true }, required: ['position'] }]`.
- **Decision**: use that form for the sticky rule; keep Ajv in strict mode in tests.

## R4. No `default` keyword

- **Finding**: `json-schema-to-zod` maps `default` to `.default(…)`, so parsing would inject values
  (e.g. `color: "amber"`, `direction: "forward"`) that were not in the file, breaking the lossless
  round-trip required by constitution II.
- **Decision**: never use `default` in `v1.json`; state defaults in `description` only
  ("Absent means forward"). A test asserts parsing a valid file returns data deep-equal to the input.

## R5. Canonical key order

- **Decision**: the declaration order of `properties` in `v1.json` **is** the canonical key order
  for every object type (id first, then identity, content, references, layout). Examples must follow
  it; a test walks each example against the schema and checks key order. `json-schema-to-zod`
  preserves declaration order, so Zod's parsed output also comes out in canonical order.
- **Rationale**: one source of truth; 002 can reuse it for `serializeDeck` by reading `jsonSchema`.
- **Alternatives considered**: a separate exported `KEY_ORDER` table (duplicates the schema and
  can drift).

## R6. Error messages

- **Finding**: Zod 4 messages are readable: `Invalid option: expected one of "a"|"b"` (lists
  allowed values), `Unrecognized key: "foo"` (names the key); `parseSododeckFile` already returns
  dotted paths (`flows.0.steps.2.id`).
- **Decision**: keep Zod's messages; semantic-rule issues use the same `{ path, message }` shape
  and name the rule id and row id, e.g.
  `rules.delivery-tier.rows.1.when` → `Rule "delivery-tier" row "r2" has 2 "when" cells but 3 input columns`.

## R7. Id format

- **Decision**: `^[A-Za-z0-9_.:-]{1,64}$` (spec FR-005). Covers every id in the design data and the
  spec examples (`order-svc`, `e7`, `R-12`, `r1`). Stated as opaque in the description.

## R8. Staleness check

- **Finding**: already in place: `pnpm --filter @sododeck/schema test` runs
  `generate:check && vitest run`, and `generate.ts --check` fails with
  "Run `pnpm schema:generate` and commit the result." Satisfies FR-029 / US4 as is.
- **Decision**: keep; add a quickstart step that demonstrates it.

## R9. Impact on existing consumers

- **Finding**: today every object is `{ id, ...anything }`. Tightening breaks:
  `packages/model/test/deck.test.ts` (the `rich` fixture uses free-form fields, steps without ids,
  free-text rule tables); `apps/app` guards like `typeof node.title === 'string'`
  (`deck-to-flow.ts`, `left-sidebar.tsx`, `inspector.tsx`) become unnecessary conditions that
  `strictTypeChecked` lint rejects; app test fixtures may hold now-invalid shapes.
- **Decision**: minimal, behavior-preserving updates in those files so lint, typecheck, test, build
  and the smoke e2e stay green. No new app behavior. The `rich` model fixture is replaced by the
  full example (which also gives 002 its round-trip baseline).

## R10. Dependencies

- **Decision**: none added. Everything uses the existing devDependencies of `@sododeck/schema`.
