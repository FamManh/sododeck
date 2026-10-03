# @sododeck/schema

**Responsibility:** defines the `.sododeck.json` file format. Nothing else.

- `schema/v1.json` — JSON Schema (draft 2020-12). **The source of truth.** Edit this file, never the generated code.
- `src/generated/` — TS types (`json-schema-to-typescript`) and Zod validators (`json-schema-to-zod`), produced by `pnpm schema:generate`. Committed. `pnpm test` fails if they are stale.
- `src/index.ts` — public API: types, `sododeckFileSchema`, `parseSododeckFile()`, `checkSemanticRules()`, `Issue`, `emptySododeckFile()`, `jsonSchema`, `SCHEMA_URL`.
- `src/semantic-rules.ts` — rules the generated Zod cannot check: S1 decision-table rows have one cell per column, S2 a sticky has an anchor or a position, S3 map keys are ids, S4 a group has both `position` and `size` or neither (016), S5 `view.groupFrames` keys are group ids of the file (016). `parseSododeckFile()` runs them after Zod; Ajv users call `checkSemanticRules()` themselves.
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

016 adds group frames with no version bump (ADR 0017): `$defs/Size` `{ width, height }` (both > 0; 017 reuses it for `node.size`), `$defs/Frame` `{ position, size }`, optional `Group.position` / `Group.size` (after `parent`, set together: `dependentRequired` in v1.json, S4 in `semantic-rules.ts`) and optional `View.groupFrames` (group id → `Frame`, after `positions`; S5). Per-object validation in `@sododeck/model` runs S4 on groups and supplies the named groups for S5 on a single view.

011 adds optional view fields with no version bump (ADR 0012): `View.excludeGroups`, `excludeKinds`, `excludeTags`, `dimKinds`, `pinned`, `collapsed` (unique lists; absent when empty), and `SubtitleField` gains `flows` ("<n> flows · <owner>"). The example `full.sododeck.json` uses all of them; invalid fixtures cover unknown kinds, duplicates and bad ids.

017 adds optional card size and connector routing with no version bump: `$defs/Side` (`'top' | 'right' | 'bottom' | 'left'`), `Node.size?: Size` (reuses 016's `Size`, after `group`; a stored override of the level's default card size, in canvas px), and `Edge.route?: EdgeRoute` (`{ fromSide?, toSide?, offset? }`, after `links`; pins an end's side and/or shifts the middle segment, all optional, empty object valid). Absent `size` / `route` means "automatic" (today's behaviour unchanged, so old files are byte-identical on round-trip). `examples/full.sododeck.json` sets both; invalid fixtures cover a non-positive `size`, an unknown `Side`, and an `EdgeRoute` with an unknown key.

020 adds card colours with no version bump (ADR 0018): `$defs/CardColor` (13-name enum), `$defs/HexColor` (`^#[0-9a-f]{6}$`), `$defs/ColorRef` (`anyOf [CardColor, HexColor]`; generates a `z.union`), `$defs/Style` (`{ fill?, stroke? }`, `additionalProperties: false`, `minProperties: 1`), optional `Node.style` (after `position`), optional `Group.style` (after `size`), and root `swatches` (`HexColor[]`, `uniqueItems`, no `maxItems` — the 12 cap is a model-only rule, after `tags`). `minProperties` is dropped by json-schema-to-zod, so **S6** ("style has a fill, a stroke, or both") lives in `semantic-rules.ts`; `uniqueItems` survives as a Zod `.refine`. `test/schema-walk.ts`'s `walk()` now follows `anyOf` branches (picking the one whose `enum` or `pattern` matches the value) for leaf unions like `ColorRef`, but skips that path when the schema also has `properties` (e.g. `Sticky`'s presence rule), so object coverage still works.

029 adds the connector line type with no version bump (ADR 0022): `$defs/EdgeShape` (`curved` | `elbow` | `straight`), `$defs/EdgeStyle` (`{ shape? }`, `additionalProperties: false`, `minProperties: 1`) and optional `Edge.style` (after `route`). Absent `shape` reads as `elbow` when `route.offset` is set, else `curved` (computed by `@sododeck/model` `edgeShape`). `minProperties` is dropped by json-schema-to-zod, so **S7** ("edge style has a key") lives in `semantic-rules.ts`. `full.sododeck.json` uses every shape; invalid fixtures cover an unknown shape, an empty style and an unknown key.
