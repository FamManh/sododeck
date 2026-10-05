# Data model: Fixable import errors (062)

Nothing here is stored in the deck, the Yjs document or IndexedDB. All shapes are derived, plain
data (structured-clone safe), and never sent over the network (FR-020).

## Issue (`@sododeck/schema`, extended)

What a file check returns when it refuses a file. Produced by `parseSododeckFile`,
`checkSemanticRules`, and the model's load checks.

| Field      | Type        | Rule                                                                            |
| ---------- | ----------- | ------------------------------------------------------------------------------- |
| `code`     | `IssueCode` | **New, required.** From the catalogue.                                          |
| `path`     | `string`    | **Changed:** JSON Pointer (RFC 6901), `""` = root.                              |
| `message`  | `string`    | Unchanged: one human sentence.                                                  |
| `subject`  | `string?`   | **New.** Id of the object the issue belongs to, when one exists. Never a title. |
| `evidence` | `string?`   | **New.** What was found, ≤ 200 chars, `…` when trimmed.                         |
| `fix`      | `string?`   | **New.** One-sentence instruction; when absent the catalogue's default is used. |

## Problem (`@sododeck/model` problems list, extended)

Existing fields unchanged (`key`, `kind`, `target`, `title`, `detail`, `severity`, `fixes`, …).
New:

| Field     | Type      | Rule                                                                                                                                                                           |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `path`    | `string`  | JSON Pointer to the main object of `target` (`/nodes/3`, `/edges/7`, `/flows/1/steps/2`, `/rules/<id>`, `/views/0`, `/stickies/4`, `/nodes/3/columns/2` for a column problem). |
| `subject` | `string?` | Main id of `target` (first id for multi-id targets).                                                                                                                           |

## ProblemEntry (public, copied)

One problem as shown in the import problems dialog and copied as JSON. Built by
`toProblemEntry(issue | problem)` in `@sododeck/model`.

| Field            | Type                             | Rule                                                                        |
| ---------------- | -------------------------------- | --------------------------------------------------------------------------- |
| `code`           | `string`                         | Stable kebab-case code (catalogue).                                         |
| `severity`       | `'error' \| 'warning' \| 'info'` | `error` refuses a file; `warning` opens with notice; `info` never notifies. |
| `path`           | `string`                         | JSON Pointer; omitted for `invalid-json`.                                   |
| `line`, `column` | `number?`                        | Only for `invalid-json` (1-based).                                          |
| `subject`        | `string?`                        | Object id.                                                                  |
| `message`        | `string`                         | Human sentence.                                                             |
| `evidence`       | `string?`                        | ≤ 200 chars.                                                                |
| `fix`            | `string`                         | Always present (FR-005): the entry's own hint or the catalogue default.     |

Order: path segment-wise (numeric segments numerically), then `code`, then `message` (FR-006).
Issue entries are always `error` (they refuse); problems-list entries keep their `SEVERITY`;
`picture-damaged` is `warning`.

## ProblemReport (public, copied)

What **Copy problems** writes. Contract: `contracts/problem-report.md`.

| Field           | Type                                       | Rule                                                              |
| --------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `report`        | `'sododeck-problems'`                      | Discriminator.                                                    |
| `reportVersion` | `1`                                        | Bumped only on a breaking change of this shape.                   |
| `source`        | `{ kind: 'file' \| 'deck'; name: string }` | File name on import; deck name in the problems panel.             |
| `status`        | `'refused' \| 'opened'`                    | `opened` for the problems panel and opened-with-problems imports. |
| `schema`        | `string`                                   | `SCHEMA_URL`.                                                     |
| `formatVersion` | `number`                                   | `FORMAT_VERSION`.                                                 |
| `app`           | `string`                                   | App version.                                                      |
| `counts`        | `{ error; warning; info }`                 | Over **all** entries, including omitted ones.                     |
| `problems`      | `ProblemEntry[]`                           | ≤ 5,000.                                                          |
| `omitted`       | `number`                                   | Entries beyond 5,000; `0` normally.                               |

## FidelityItem (public, copied)

| Field     | Type                                                       | Rule                                                           |
| --------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| `code`    | `string`                                                   | `import-mermaid-<reason>` or `import-db-<reason>` (catalogue). |
| `group`   | `'merged' \| 'collapsed' \| 'left-out' \| 'not-supported'` | Exactly one (FR-013).                                          |
| `line`    | `number?`                                                  | 1-based input line; absent for whole-input notes.              |
| `lines`   | `number[]?`                                                | For `merged` items that combine several declarations.          |
| `excerpt` | `string?`                                                  | Existing excerpt rules (Mermaid 120, DB 60 chars).             |
| `target`  | `string?`                                                  | DB: `orders.status`, `orders`.                                 |
| `message` | `string`                                                   | Existing reason/detail text.                                   |
| `fix`     | `string?`                                                  | Only when changing the input helps (R9).                       |

Group meanings:

- **merged:** met another declaration, or existing deck content, of the same name; combined or
  renamed.
- **collapsed:** came across in a simpler form (nesting flattened, type generalised, schema stored
  on the table).
- **left out:** understood but deliberately not imported (styling, clicks, data rows, grants…).
- **not supported:** could not be read or is outside the accepted subset.

## FidelityReport (public, copied)

| Field           | Type                                                                                                        | Rule                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `report`        | `'sododeck-import'`                                                                                         | Discriminator.                                                                                                              |
| `reportVersion` | `1`                                                                                                         |                                                                                                                             |
| `source`        | `{ format: 'mermaid-flowchart' \| 'mermaid-sequence' \| 'sql' \| 'dbml'; name?: string; dialect?: string }` |                                                                                                                             |
| `created`       | `Record<string, number>`                                                                                    | Existing counts (components, connections, groups, steps / tables, relationships, enums, indexes, checks, groups, stickies). |
| `complete`      | `boolean`                                                                                                   | `true` when `items` is empty ("Everything was imported", FR-015).                                                           |
| `items`         | `FidelityItem[]`                                                                                            | All, in input order. No cap (inputs are already capped at 512 KB).                                                          |

The Mermaid `ImportReport` and DB `ImportReport` keep their current shapes for the UI; each gets a
pure `toFidelityReport()` adapter in the app (where the importers live) using catalogue codes.

## CatalogueEntry (`@sododeck/model` `problem-codes.ts`)

| Field      | Type                                                      | Rule                                         |
| ---------- | --------------------------------------------------------- | -------------------------------------------- |
| `code`     | `string`                                                  | Key.                                         |
| `family`   | `'file' \| 'format-rule' \| 'load' \| 'deck' \| 'import'` | Grouping in the doc.                         |
| `severity` | `Severity \| 'info'`                                      | Default.                                     |
| `title`    | `string`                                                  | Short name.                                  |
| `fix`      | `string`                                                  | Default fix hint. Required (FR-005, FR-019). |
| `retired`  | `true?`                                                   | Never emitted again; never reused (FR-002).  |

## Codes (initial catalogue)

- **file:** `invalid-json`, `unsupported-version`.
- **schema (generic, R3):** `schema-required`, `schema-type`, `schema-enum`, `schema-pattern`,
  `schema-range`, `schema-unknown-field`, `schema-union`, `schema-unique`, `schema-invalid`.
- **format-rule (R4):** S1 `rule-row-cells`, S2 `sticky-placement`, S3 `map-key-id`,
  S4 `group-frame-pair`, S5 `view-frame-group`, S6 `style-empty`, S7 `edge-style-empty`,
  S8 `tag-color-key`, S9 `route-anchor-side`, S10 `route-offset-and-waypoints`,
  S11 `route-waypoint`, S12 `field-definition`, S13 `card-value-key`, S14 `column-default`,
  S15 `step-touch-repeat`, I1 `image-asset-missing`, I2 `asset-id`, I3 `asset-data`,
  I4 `image-group-missing`, I5 `image-id-clash`, I6 `image-too-small`.
- **load:** `duplicate-id`, `ambiguous-end`, `picture-damaged` (warning; evidence = `bad-data` /
  `size-mismatch` / `too-large` / `bad-type` / `hash-mismatch`).
- **deck:** every `ProblemKind` unchanged (30 today), plus retired `orphan`.
- **import:** `import-mermaid-{appearance, interaction, extra-diagram, unsupported, unreadable,
flattened, note, merged-declaration}`, `import-db-{<18 skip reasons>, <7 change kinds>}`.

Names are final once released; the doc `docs/file-format/problem-codes.md` is generated from this
table.

## State: import problems dialog

```
idle ──import refused──▶ open(mode: refused, report)
idle ──import ok, N>0──▶ toast "Imported X with N problems" ──Show──▶ open(mode: opened, report)
open ──Copy ok──▶ open (announce "Copied")
open ──Copy failed──▶ open + JSON textarea visible, focused, selected
open ──Close / Esc──▶ idle
```

UI-only state (which report is open) lives in the library page's component state; the report is
derived and dropped on close.
