# @sododeck/schema

**Responsibility:** defines the `.sododeck.json` file format. Nothing else.

- `schema/v1.json` — JSON Schema (draft 2020-12). **The source of truth.** Edit this file, never the generated code.
- `src/generated/` — TS types (`json-schema-to-typescript`) and Zod validators (`json-schema-to-zod`), produced by `pnpm schema:generate`. Committed. `pnpm test` fails if they are stale.
- `src/index.ts` — public API: types, `sododeckFileSchema`, `parseSododeckFile()`, `emptySododeckFile()`, `jsonSchema`, `SCHEMA_URL`.
- `examples/` — valid example files. Every example is validated by both Ajv (against the JSON Schema) and Zod in tests.

## Boundaries

- No Yjs, no React, no browser APIs. Pure data definitions + validation.
- Does not know about referential integrity (edge → node ids); that is `@sododeck/model`.
- Local `$ref`s only (`#/$defs/...`), and no recursive refs: the Zod generator needs them inlined.

## Status

TODO(schema-v1): the schema is a skeleton (every object is `{ id, ...anything }`). The full schema is a separate task; when it lands, add fixtures for each object type and keep the Ajv/Zod parity test.
