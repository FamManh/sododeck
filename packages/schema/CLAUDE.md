# @sododeck/schema

**Responsibility:** defines the `.sododeck.json` file format. Nothing else.

- `schema/v1.json` — JSON Schema (draft 2020-12). **The source of truth.** Edit this file, never the generated code.
- `src/generated/` — TS types (`json-schema-to-typescript`) and Zod validators (`json-schema-to-zod`), produced by `pnpm schema:generate`. Committed. `pnpm test` fails if they are stale.
- `src/index.ts` — public API: types, `sododeckFileSchema`, `parseSododeckFile()`, `checkSemanticRules()`, `Issue`, `emptySododeckFile()`, `jsonSchema`, `SCHEMA_URL`.
- `src/semantic-rules.ts` — rules the generated Zod cannot check: S1 decision-table rows have one cell per column, S2 a sticky has an anchor or a position, S3 map keys are ids. `parseSododeckFile()` runs them after Zod; Ajv users call `checkSemanticRules()` themselves.
- `examples/` — `minimal`, `flow-and-rule`, `full` (uses every field and enum value; a coverage test enforces it).
- `test/` — Ajv/Zod parity over examples and 60 invalid fixtures (`fixtures.ts`), lossless parse, key order, generator guards.

## Boundaries

- No Yjs, no React, no browser APIs. Pure data definitions + validation.
- Does not know about referential integrity (edge → node ids); that is `@sododeck/model`.
- Local `$ref`s only (`#/$defs/...`), and no recursive refs: the Zod generator needs them inlined.
- Field decisions (enums, positions, decision tables, ids): ADR 0004.

## Editing `v1.json`

- Declaration order of `properties` = the key order files are written in. Tests check examples against it.
- Every property gets a `description` (Monaco hover help).
- No `default` (Zod would inject values and break the lossless round-trip) and no `format` keyword. State defaults in the description.
- The generator strips `anyOf` presence rules (both generators mishandle them) and keys next to `$ref` (they make json-schema-to-typescript emit `Id1`, `Text2`… aliases). `propertyNames` is ignored by the Zod generator. Anything the generators drop must be re-checked in `semantic-rules.ts` and covered by an invalid fixture.
- New field or type → extend `examples/full.sododeck.json` (coverage test), add invalid fixtures, run `pnpm schema:generate`, and add a round-trip case in `packages/model/test`.

## Status

v1 complete (feature 001). 006 added flow branches as optional, additive fields with no version bump: `Flow.branches[]` (`Branch { id, label, condition, errorPath?, description? }`) and `Step.branch` (ADR 0008). Empty branch labels and conditions are valid in the file; the editor's Done enforces them.

009 adds two optional sticky booleans with no version bump:

- `Sticky.collapsed?: boolean` — `true` means the note is shown as one line; the editor writes `true` or removes the key.
- `Sticky.showInFlows?: boolean` — `true` keeps the note at full strength during flow playback; the editor writes `true` or removes the key.

Keep the sticky property order `id, text, color, anchor, position, collapsed, showInFlows`, extend `examples/full.sododeck.json`, and cover invalid non-boolean values in fixtures when these fields change.
