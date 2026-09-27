# Quickstart: validating Deck File Format v1

Run from the repo root. Prerequisites: Node ≥ 24, `pnpm install`.

## 1. Format and derived code are in step (US4, FR-029)

```bash
pnpm schema:generate                       # regenerates src/generated/{types,zod}.ts
git diff --exit-code packages/schema/src/generated   # expect: no diff after committing
```

Staleness demo: add a harmless `"description"` change to a field in
`packages/schema/schema/v1.json`, then run `pnpm --filter @sododeck/schema test`.
Expected: fails with `Out of date: …/src/generated/…` and
"Run `pnpm schema:generate` and commit the result." Revert the change.

## 2. Examples valid, fixtures invalid, validators agree (US1, US2, SC-002, SC-003)

```bash
pnpm --filter @sododeck/schema test
```

Expected, all green:

- each file in `packages/schema/examples/` is accepted by Ajv (strict, 2020-12) + semantic rules and by
  `parseSododeckFile`, and parsed data deep-equals the input;
- each invalid fixture (list in spec FR-026) is rejected by both, with a non-empty issue path;
- rule-row cell mismatch message names the rule id and row id;
- enum issues list allowed values; unknown-key issues name the key;
- key order of every example follows the schema's `properties` order;
- generated code contains no `z.any()` and no `[k: string]: unknown`.

## 3. Hand check with Ajv only (what a CLI / agent would do)

```bash
pnpm --filter @sododeck/schema exec tsx -e "
import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { jsonSchema, checkSemanticRules } from './src/index.ts';
const file = JSON.parse(readFileSync('examples/full.sododeck.json', 'utf8'));
const ok = new Ajv2020({ strict: true }).validate(jsonSchema, file);
console.log(ok, ok ? checkSemanticRules(file) : 'structural errors');
"
```

Expected: `true []`.

## 4. Editor hover help (FR-024)

`pnpm dev`, open the editor, JSON panel: hovering a key (e.g. `hitPolicy`) shows its description
from `v1.json`; typing `"protocol": "` offers the six protocol values.

## 5. Repo gates (Definition of done)

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

Expected: all pass, including `packages/model` (round-trip of `full.sododeck.json`) and the app
(no behavior change; smoke e2e incl. "no third-party requests").
