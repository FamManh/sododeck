# 0004. Shape of the `.sododeck.json` v1 format

- **Status:** Accepted
- **Date:** 2026-09-27
- **Feature:** `specs/001-json-schema-v1` (spec, research R1–R10, data model)

## Context

ADR 0002 chose JSON with a JSON Schema as the source of truth, but left the v1 schema as a skeleton
(`{ id, ...anything }`). The Claude Design prototype, `docs/spec.md` §6 and the P0 requirements
disagree on several details (design-analysis §g-4). The file is a public contract for the app, a
future CLI/MCP server and AI agents, so these choices are hard to change after launch.

## Decision

1. **Node kinds:** a closed list of six: `client`, `gateway`, `service`, `queue`, `database`,
   `external`. These are the design's six kind tiles with the spec's names (`gateway`, `database`
   rather than the prototype's `edge`, `data`). Same list as `COMPONENT_KINDS` in `packages/ui`
   (ADR 0003).
2. **Protocols:** protocol families `http`, `grpc`, `event`, `sql`, `websocket`, `other`. Products
   and transports ("Kafka", "HTTPS") go in the edge `label`.
3. **Positions:** stored on the node (`position`). A view may override positions per node
   (`view.positions`). Group bounds are derived from member nodes, never stored.
4. **Decision tables:** structured, following the design: `hitPolicy` (`first`, `unique`,
   `collect`), `inputs` and `outputs` columns with ids, and `rows` with ids plus one text cell per
   column (`when`, `then`). The meaning of cells (`≤ 5`, `Any`, `—`) belongs to the rule evaluator.
   Rules stay a map keyed by id (ADR 0002).
5. **Rules on steps and nodes:** lists of rule ids (`rules`), even though the design shows one.
   Sample inputs for the rule tester live on the step: `ruleInputs` (rule id → input column id →
   value).
6. **Ids:** every object, including steps, rule columns and rule rows, has an `id` matching
   `^[A-Za-z0-9_.:-]{1,64}$`. Ids are opaque and never derived from titles.
7. **Branches are not in v1.** Flow branching (spec F-4) is not designed yet. It will be added in
   `006-flow-authoring` as an optional step field, which needs no version bump.
8. **Strict objects:** every object rejects unknown keys. No `default` keyword (the Zod generator
   would inject values and break the lossless round-trip) and no `format` keyword; defaults are
   stated in descriptions.
9. **Semantic rules:** three rules are enforced by `checkSemanticRules()` in `packages/schema`,
   which `parseSododeckFile()` runs after Zod:
   - S1: each row has exactly one cell per column. JSON Schema cannot compare array lengths.
   - S2: a sticky has an anchor, a position or both. This is in `v1.json` as `anyOf`, but the
     generators drop it.
   - S3: keys of `rules`, `view.positions` and `step.ruleInputs` are valid ids. This is in
     `v1.json` as `propertyNames`, but json-schema-to-zod drops it.

   We did not use Ajv custom keywords, because the published schema must stay standard for Monaco,
   other languages and AI agents. Tools that validate with Ajv call `checkSemanticRules()`
   afterwards. A parity test holds `Ajv + checkSemanticRules` and `parseSododeckFile` to the same
   verdict on every example and fixture.

10. **Key order:** the declaration order of `properties` in `v1.json` is the canonical key order
    for every object type. It is tested on the examples.

## Consequences

- Every field in the design data has a place in the file. The prototype's step sample inputs are
  keyed by column label; importers key them by column id instead.
- Adding an enum value later is additive for new files, but older app builds will reject files
  that use it. We accept this: the app is a web app, so all users run the latest build.
- Cross-object integrity (unique ids, references that resolve) is still not checked by the schema;
  `@sododeck/model` (002) enforces it on load and 015 reports it to users.
- The generator strips `anyOf` presence rules and `$ref` siblings before generating types and Zod,
  and guard tests fail if generated code ever contains catch-all validators, defaults or index
  signatures.
