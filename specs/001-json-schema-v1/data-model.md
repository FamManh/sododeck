# Data Model: Deck File Format v1

**Feature**: [spec.md](spec.md) · **Research**: [research.md](research.md)

This is the field-level design for `packages/schema/schema/v1.json`. **Field order in each table is
the canonical key order** (research R5): it is the declaration order in the schema, examples follow
it, and 002 will write files in it.

Conventions:

- **Req** = required. Everything else is optional; absent means "not set" (no `default` keyword,
  research R4).
- `Id` = string matching `^[A-Za-z0-9_.:-]{1,64}$`; opaque, stable, never derived from a title.
- `Text` = non-empty string (`minLength: 1`) for titles and ids-like values; free text fields
  (`description`, `condition`, cells, …) are plain strings and may be empty.
- `Markdown` = string rendered as markdown.
- Every object has `additionalProperties: false` (FR-019).
- References (→) are ids. Whether they resolve, and id uniqueness per collection, is **not** checked
  here (FR-007): 002 enforces on load, 015 reports to users.

## Deck file (envelope)

| Field         | Type            | Req | Notes                                                  |
| ------------- | --------------- | --- | ------------------------------------------------------ |
| `$schema`     | const URL       | ✓   | `https://sododeck.com/schema/v1.json`                  |
| `version`     | const `1`       | ✓   |                                                        |
| `name`        | Text            |     | Deck name; the library supplies one when absent        |
| `description` | Markdown        |     |                                                        |
| `tags`        | Text[]          |     |                                                        |
| `nodes`       | Node[]          | ✓   |                                                        |
| `groups`      | Group[]         | ✓   |                                                        |
| `edges`       | Edge[]          | ✓   |                                                        |
| `views`       | View[]          | ✓   |                                                        |
| `features`    | Feature[]       | ✓   |                                                        |
| `flows`       | Flow[]          | ✓   |                                                        |
| `rules`       | map `Id` → Rule | ✓   | Keyed by rule id (ADR 0002); key checked (semantic S3) |
| `stickies`    | Sticky[]        | ✓   |                                                        |

## Node

| Field         | Type        | Req | Notes                                                             |
| ------------- | ----------- | --- | ----------------------------------------------------------------- |
| `id`          | Id          | ✓   |                                                                   |
| `type`        | NodeKind    | ✓   | `client` `gateway` `service` `queue` `database` `external`        |
| `title`       | Text        | ✓   |                                                                   |
| `level`       | Level       |     | `landscape` `system` `container` `component` (semantic zoom, V-1) |
| `description` | Markdown    |     |                                                                   |
| `owner`       | string      |     | Free text (design-analysis §g-10)                                 |
| `tags`        | Text[]      |     |                                                                   |
| `tech`        | string      |     | e.g. "Go · Postgres"; System view subtitle                        |
| `host`        | string      |     | e.g. "EKS eu-west-1"; Infra view subtitle                         |
| `icon`        | Text        |     | Icon key from the app icon set (000); not enumerated              |
| `links`       | Link[]      |     |                                                                   |
| `group`       | Id → Group  |     |                                                                   |
| `parent`      | Id → Node   |     | Drill-down parent across levels                                   |
| `rules`       | Id[] → Rule |     | Rules attached to the node                                        |
| `position`    | Position    |     | Canvas position; views may override                               |

## Group

| Field         | Type       | Req | Notes                                      |
| ------------- | ---------- | --- | ------------------------------------------ |
| `id`          | Id         | ✓   |                                            |
| `title`       | Text       | ✓   |                                            |
| `description` | Markdown   |     |                                            |
| `parent`      | Id → Group |     | Nesting by reference (no recursive `$ref`) |

No geometry: bounds derive from member nodes (design-analysis §g-8). Membership is `node.group`.

## Edge

| Field         | Type      | Req | Notes                                                     |
| ------------- | --------- | --- | --------------------------------------------------------- |
| `id`          | Id        | ✓   |                                                           |
| `from`        | Id → Node | ✓   |                                                           |
| `to`          | Id → Node | ✓   | Self-loops allowed                                        |
| `protocol`    | Protocol  |     | `http` `grpc` `event` `sql` `websocket` `other`           |
| `label`       | string    |     | Carries specifics ("POST /orders", "OrderPlaced · Kafka") |
| `direction`   | Direction |     | `forward` `both` `none`; absent means `forward`           |
| `description` | Markdown  |     |                                                           |
| `owner`       | string    |     |                                                           |
| `tags`        | Text[]    |     |                                                           |
| `links`       | Link[]    |     |                                                           |

## View

| Field           | Type                      | Req | Notes                                          |
| --------------- | ------------------------- | --- | ---------------------------------------------- |
| `id`            | Id                        | ✓   |                                                |
| `type`          | ViewType                  | ✓   | `system` `feature` `infra` `custom`            |
| `title`         | Text                      | ✓   |                                                |
| `subtitleField` | SubtitleField             |     | `tech` `host` `owner` `none`                   |
| `feature`       | Id → Feature              |     | For feature views                              |
| `includes`      | Id[] → Node               |     | Absent = all nodes                             |
| `positions`     | map `Id`(Node) → Position |     | Per-node overrides; keys checked (semantic S3) |

## Feature

| Field         | Type     | Req |
| ------------- | -------- | --- |
| `id`          | Id       | ✓   |
| `title`       | Text     | ✓   |
| `description` | Markdown |     |
| `owner`       | string   |     |

## Flow

| Field         | Type         | Req | Notes                                                            |
| ------------- | ------------ | --- | ---------------------------------------------------------------- |
| `id`          | Id           | ✓   |                                                                  |
| `title`       | Text         | ✓   |                                                                  |
| `feature`     | Id → Feature |     |                                                                  |
| `description` | Markdown     |     |                                                                  |
| `trigger`     | string       |     |                                                                  |
| `outcome`     | string       |     |                                                                  |
| `owner`       | string       |     |                                                                  |
| `tags`        | Text[]       |     |                                                                  |
| `links`       | Link[]       |     |                                                                  |
| `steps`       | Step[]       | ✓   | Ordered; may be empty; last so long lists do not bury the header |

## Step

| Field         | Type                                      | Req | Notes                                              |
| ------------- | ----------------------------------------- | --- | -------------------------------------------------- |
| `id`          | Id                                        | ✓   | Own stable id (constitution III)                   |
| `edge`        | Id → Edge                                 | ✓   | The same edge may appear in several steps          |
| `title`       | string                                    |     | K-1; the edge label is shown when absent           |
| `condition`   | string                                    |     |                                                    |
| `sla`         | string                                    |     | Target, e.g. "< 300 ms", "24h"                     |
| `description` | Markdown                                  |     |                                                    |
| `payload`     | string                                    |     | What data is carried                               |
| `notes`       | Markdown                                  |     |                                                    |
| `owner`       | string                                    |     |                                                    |
| `tags`        | Text[]                                    |     |                                                    |
| `links`       | Link[]                                    |     |                                                    |
| `rules`       | Id[] → Rule                               |     |                                                    |
| `ruleInputs`  | map `Id`(Rule) → map `Id`(Input) → string |     | Sample inputs per attached rule; keys checked (S3) |

No `branch` in v1 (spec FR-022, added in 006). Order = position in `flow.steps`.

## Rule (value in `rules`, key = rule id)

| Field         | Type      | Req | Notes                          |
| ------------- | --------- | --- | ------------------------------ |
| `title`       | Text      | ✓   |                                |
| `description` | Markdown  |     |                                |
| `hitPolicy`   | HitPolicy | ✓   | `first` `unique` `collect`     |
| `inputs`      | Column[]  | ✓   | May be empty                   |
| `outputs`     | Column[]  | ✓   | May be empty                   |
| `rows`        | RuleRow[] | ✓   | May be empty; cell counts (S1) |

**Column**: `id` (Id, ✓), `label` (Text, ✓).
**RuleRow**: `id` (Id, ✓), `when` (string[], ✓, one per input), `then` (string[], ✓, one per
output). Cells are plain text; `Any`, `—`, `≤ 5` etc. are interpreted by the evaluator, not here.

## Sticky

| Field      | Type            | Req | Notes                                                      |
| ---------- | --------------- | --- | ---------------------------------------------------------- |
| `id`       | Id              | ✓   |                                                            |
| `text`     | Markdown        | ✓   |                                                            |
| `color`    | StickyColor     |     | `amber` `blue` `green` `clay` `grey`; absent means `amber` |
| `anchor`   | Id → any object |     | Node, edge, group, flow, step…                             |
| `position` | Position        |     | Absolute when free; offset from the anchor when anchored   |

At least one of `anchor` / `position` (JSON Schema `anyOf`, research R3; semantic S2).

## Shared types

- **Link**: `label` (string), `url` (Text, ✓). Plain string, no `format: uri` (Ajv strict would need
  `ajv-formats`; relative links are allowed).
- **Position**: `x` (number, ✓), `y` (number, ✓). Negative and fractional values allowed.

## Semantic rules (not expressible, or dropped by generators)

Checked by `checkSemanticRules()` after structural validation; documented in schema descriptions.

| Id  | Rule                                                                               | Why not structural                       |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------- |
| S1  | Every rule row has `when.length == inputs.length`, `then.length == outputs.length` | JSON Schema cannot compare arrays        |
| S2  | A sticky has `anchor` or `position`                                                | Zod generator drops `anyOf` (R2)         |
| S3  | Keys of `rules`, `view.positions`, `step.ruleInputs` (both levels) match `Id`      | Zod generator drops `propertyNames` (R2) |

## Design-data coverage (SC-001, SC-007)

| Design (`sododeck-data.js`)                                            | v1 field                                                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| node `kind` edge / data                                                | `type` `gateway` / `database`                                                    |
| node `x, y`                                                            | `position`                                                                       |
| node `desc`, `icon`, `tech`, `host`, `owner`, `tags`, `rules`, `links` | same names (`desc` → `description`)                                              |
| group `label`, `x,y,w,h`                                               | `title`; geometry derived (not stored)                                           |
| edge `proto` HTTPS/gRPC/Kafka/SQL/WebSocket                            | `protocol` `http`/`grpc`/`event`/`sql`/`websocket` (specifics in `label`)        |
| flow `name`, `desc`                                                    | `title`, `description`                                                           |
| step `e`, `cond`, `sla`, `rule`, `ctx`                                 | `edge`, `condition`, `sla`, `rules[]`, `ruleInputs`                              |
| rule `name`, `desc`, `policy`, `conds`, `acts`, `rows[{c,a}]`          | `title`, `description`, `hitPolicy`, `inputs`, `outputs`, `rows[{id,when,then}]` |
| views `System/Feature/Infra/Custom`                                    | `views[]` with `type`                                                            |
| theme, TEAMS, DECKS                                                    | not stored (UI / library metadata)                                               |
