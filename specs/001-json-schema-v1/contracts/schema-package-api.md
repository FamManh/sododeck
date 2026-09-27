# Contract: `@sododeck/schema` public API (v1)

Two contracts leave this package:

1. **The file format** — `schema/v1.json` (published later at `https://sododeck.com/schema/v1.json`),
   field by field in [../data-model.md](../data-model.md). Consumers: the app (Monaco), 002 model,
   a future CLI/MCP server, AI agents.
2. **The TypeScript API** below. Consumers: `@sododeck/model`, `apps/app`.

## TypeScript exports (`packages/schema/src/index.ts`)

| Export                                                                                    | Kind     | Status          | Contract                                                                                                                                                        |
| ----------------------------------------------------------------------------------------- | -------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SododeckFile` and the object types (`Node`, `Edge`, `Flow`, `Step`, `Rule`, `Sticky`, …) | types    | changed         | Generated from `v1.json`; strict (no index signatures). Named via `title` in each `$defs` entry                                                                 |
| `sododeckFileSchema`                                                                      | Zod      | changed         | Structural validator generated from `v1.json` (no `anyOf` presence rules, no key patterns — see S2/S3)                                                          |
| `jsonSchema`                                                                              | object   | unchanged       | The `v1.json` document, for Monaco and Ajv                                                                                                                      |
| `SCHEMA_URL`, `FORMAT_VERSION`                                                            | const    | unchanged       | `https://sododeck.com/schema/v1.json`, `1`                                                                                                                      |
| `parseSododeckFile(input: unknown): ParseResult`                                          | function | changed         | Zod structural parse, then `checkSemanticRules`. Returns `{ success: true, data }` with data deep-equal to the input, or `{ success: false, issues }`           |
| `checkSemanticRules(file: SododeckFile): Issue[]`                                         | function | **new**         | Rules S1–S3 ([data-model](../data-model.md#semantic-rules-not-expressible-or-dropped-by-generators)). Pure; for callers that validated structure with Ajv (CLI) |
| `Issue`                                                                                   | type     | **new** (named) | `{ path: string; message: string }`; `path` is dotted (`flows.0.steps.2.id`, `rules.R-1.rows.1.when`)                                                           |
| `ParseResult`                                                                             | type     | unchanged shape | `issues: Issue[]`                                                                                                                                               |
| `emptySododeckFile()`                                                                     | function | unchanged       | Returns a valid empty file (no `name`)                                                                                                                          |

Package `exports` stay as they are (`.`, `./v1.json`, `./examples/*`).

## Guarantees

- **Parity**: for every input, `parseSododeckFile(x).success === (ajv(jsonSchema)(x) && checkSemanticRules(x).length === 0)`.
  Tested over all examples and invalid fixtures.
- **Lossless**: on success, `data` deep-equals the input (no defaults, no coercion, no stripping).
- **Messages**: every issue has a non-empty `path` pointing at the offending value (or its parent
  object for unknown keys, with the key named in the message) and a readable `message`. Enum issues
  list the allowed values; semantic issues name the rule and row ids.
- **Not guaranteed here**: unique ids and resolving references (002 / 015).

## Example files (`packages/schema/examples/`)

| File                          | Purpose                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `minimal.sododeck.json`       | Existing 3-node, 2-edge deck (already valid v1; kept stable for the app demo)            |
| `flow-and-rule.sododeck.json` | One feature, one flow of steps, one decision table attached to a step with sample inputs |
| `full.sododeck.json`          | Every object type and every optional field (FR-025); round-trip baseline for 002         |
