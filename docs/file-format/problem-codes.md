# Problem codes

<!-- Generated from packages/model/src/problem-codes.ts by its test. Do not edit; run
     `pnpm --filter @sododeck/model test -u` after changing the catalogue. -->

Every problem Sododeck reports when it reads a `.sododeck` file, lists for an open deck, or
meets while importing another format has a stable code. A released code never changes
meaning and is never reused; codes that are no longer reported stay listed as retired.
The copied report shape is in `specs/062-fixable-import-errors/contracts/problem-report.md`.

Severity: `error` refuses a file (or marks a deck problem as an error), `warning` opens with a
notice, `info` never notifies.

## File

The file cannot be read as a format v1 deck. Schema violations use one generic code per violation type; `path` names the exact value. The file is refused.

| Code | Severity | Title | Fix |
| --- | --- | --- | --- |
| `invalid-json` | error | Not JSON | Fix the JSON syntax at the given line and column (often a missing comma, quote or bracket). |
| `unsupported-version` | error | Newer file format | Open it in a newer Sododeck, or write it for format version 1. |
| `schema-required` | error | Missing key | Add the missing key with a value of the expected type. |
| `schema-type` | error | Wrong type | Change the value to the expected type. |
| `schema-enum` | error | Value not allowed | Use one of the allowed values. |
| `schema-pattern` | error | Wrong format | Change the value so it has the expected format. |
| `schema-range` | error | Out of range | Change the value so it fits the allowed range or length. |
| `schema-unknown-field` | error | Unknown key | Remove the key; the file format has no such key here. |
| `schema-union` | error | No allowed shape | Use one of the allowed shapes for the value. |
| `schema-unique` | error | Repeated list entry | Remove the repeated entry from the list. |
| `schema-invalid` | error | Invalid value | Fix the value so it matches the file format. |

## Format rules

Rules of the format that the JSON Schema cannot express. The file is refused.

| Code | Severity | Title | Fix |
| --- | --- | --- | --- |
| `rule-row-cells` | error | Rule row cell count | Give every row one "when" cell per input column and one "then" cell per output column. |
| `sticky-placement` | error | Sticky without a place | Give the sticky a "position" (x and y on the canvas). |
| `map-key-id` | error | Key is not an id | Rename the key to 1–64 letters, digits, -, _, . or :. |
| `group-frame-pair` | error | Half a group frame | Give the group both "position" and "size", or remove both. |
| `view-frame-group` | error | Frame for a missing group | Use the id of a group in this file as the key, or remove the entry. |
| `style-empty` | error | Empty style | Give the style a "fill", a "stroke", or both, or remove it. |
| `edge-style-empty` | error | Empty connector style | Add a key to the connector style, or remove "style". |
| `tag-color-key` | error | Tag colour key | Use one non-empty key per tag; keys that differ only in case or spacing are the same tag. |
| `route-anchor-side` | error | Anchor without a side | Add the matching "fromSide" or "toSide", or remove "fromAt" or "toAt". |
| `route-offset-and-waypoints` | error | Offset and bends together | Keep either "offset" or "waypoints" in the route, not both. |
| `route-waypoint` | error | Invalid bend | Give each bend exactly one of "x" or "dx" and one of "y" or "dy", and remove an empty "waypoints" list. |
| `field-definition` | error | Invalid field definition | Keep field and option ids unique, keep the kinds of tech, host and owner, and use "unit" only on number fields, "options" only on select and status fields and icons only on status options. |
| `card-value-key` | error | Invalid card value key | Use a field id as the key, and store tech, host and owner in their own keys, not in "values". |
| `column-default` | error | Two column defaults | Keep either "default" or "defaultExpr" on the column, not both. |
| `step-touch-repeat` | error | Repeated step touch | Keep one touch per table and column in the step. |
| `image-asset-missing` | error | Image without its picture | Add the picture to "assets", or point "asset" to a picture that is there. |
| `asset-id` | error | Picture key is not a picture id | Use the picture's SHA-256 as the key: 64 lowercase hex characters. |
| `asset-data` | error | Picture data and size differ | Make "bytes" the decoded length of "data", and pad the base64 to a multiple of 4. |
| `image-group-missing` | error | Image in a missing group | Point "group" to a group in this file, or remove it. |
| `image-id-clash` | error | Image id already used | Give the image an id that no card, group or sticky uses. |
| `image-too-small` | error | Image too small | Make the image at least 32 × 32. |

## Load checks

Identity checks on a structurally valid file (refused), and damaged pictures (the deck opens with the picture shown as missing).

| Code | Severity | Title | Fix |
| --- | --- | --- | --- |
| `duplicate-id` | error | Duplicate id | Give one of these objects a new, unique id and update references to it. |
| `ambiguous-end` | error | Ambiguous connector end | Give the node, group or sticky its own id and update the connectors that name it. |
| `picture-damaged` | warning | Damaged picture | Export the picture again, or put the base64 of the original file in "data" with its SHA-256 as the key. |
| `crop-trimmed` | warning | Image crop past the picture | Keep "x" + "width" and "y" + "height" of the crop at most 1; the deck shows it cut back to the picture edge. |

## Deck problems

The problems list of an open deck. The deck opens; error and warning problems are counted in the notice after an import.

| Code | Severity | Title | Fix |
| --- | --- | --- | --- |
| `duplicate-connection` | warning | Duplicate connection | Delete the extra connectors so each pair is joined once, or give them different labels. |
| `step-without-connection` | error | Step without connection | Point the step's "edge" to an existing connector id, or remove the step. |
| `broken-chain` | error | Broken flow | Pick connectors so each step starts where the previous step ended, or reorder the steps. |
| `incomplete-flow` | warning | Incomplete flow | Add steps to the flow, and give every branch a label, a condition and existing steps. |
| `overlapping-conditions` | warning | Overlapping conditions | Give each branch of the flow a different condition. |
| `missing-rule` | warning | Missing rule | Point the reference to an existing key of "rules", or remove it. |
| `rule-without-catch-all` | warning | Rule without catch-all | Add a last row whose "when" cells are all empty or "any", so every input matches a row. |
| `invalid-rule-cells` | error | Invalid rule cells | Write each cell as a value, a list ("a, b"), a comparison with a number (">= 3") or "any". |
| `broken-reference` | error | Broken reference | Point the reference to an existing id, or remove it. |
| `card-size-out-of-range` | warning | Card size out of range | Set "size" between 120 × 44 and 800 × 600 (shapes may be smaller), or remove it. |
| `unknown-card-type` | warning | Unknown card type | Use a card type this version knows, such as "service" or "database". |
| `unknown-pack` | warning | Unknown pack | Remove the id from "packs", or use a built-in pack: architecture, process, logistics, data, database, shapes. |
| `field-value-dangling` | warning | Value without a field | Remove the value from "values", or add the field (and option) it points to in "fields". |
| `db-dangling-reference` | error | Missing column | Point the reference to an existing column or enum id, or remove it. |
| `db-composite-mismatch` | error | Key columns don't match | Give "fromColumns" and "toColumns" the same number of columns. |
| `db-no-primary-key` | warning | No primary key | Mark one or more columns of the table as the primary key ("pk": true). |
| `db-duplicate-table` | error | Duplicate table | Rename one of the tables so each table name is unique in its schema. |
| `db-duplicate-column` | error | Duplicate column | Rename one of the columns so each column name is unique in its table. |
| `db-duplicate-index` | error | Duplicate index | Rename one of the indexes so each index name is unique. |
| `db-duplicate-enum` | error | Duplicate enum | Rename one of the enums so each enum name is unique in its schema. |
| `db-empty-column` | error | Column without a name | Give the column a name. |
| `db-type-mismatch` | error | Type mismatch | Give the referencing columns the same type as the columns they reference. |
| `db-null-default` | error | Null default on a not-null column | Remove the null default, or allow null in the column. |
| `db-fk-not-key` | warning | Reference to a non-key column | Point the relationship at the primary key or a unique column of the referenced table. |
| `db-many-to-many` | warning | Many-to-many | Add a junction table with a foreign key to each side. |
| `db-empty-enum` | warning | Enum without values | Add at least one value to the enum. |
| `db-default-type` | warning | Default does not fit the type | Change the default so it fits the column type. |
| `db-required-loop` | warning | Required references form a loop | Make one foreign key in the loop optional so rows can be inserted. |
| `db-duplicate-relationship` | warning | Duplicate relationship | Delete the extra relationship. |
| `db-unknown-type` | warning | Type not in the list | Use a type from the dialect's list, or keep it if your database defines it. |
| `orphan` (retired) | warning | Component without connections | Nothing to fix: no longer reported. |

## Import from other formats

What a Mermaid, SQL or DBML import could not bring across one-to-one, by group: merged, collapsed, left out, not supported. Never an error.

| Code | Group | Title | Fix |
| --- | --- | --- | --- |
| `import-mermaid-appearance` | left-out | Styling | Nothing to fix: style the cards in Sododeck after the import. |
| `import-mermaid-interaction` | left-out | Clicks and links | Nothing to fix: add links to the cards in Sododeck after the import. |
| `import-mermaid-extra-diagram` | left-out | Second diagram | Import each diagram on its own. |
| `import-mermaid-unsupported` | not-supported | Syntax not supported | Rewrite the line with the supported flowchart or sequence syntax. |
| `import-mermaid-unreadable` | not-supported | Line not readable | Check the syntax on this line. |
| `import-mermaid-flattened` | collapsed | Block flattened | Nothing to fix: the block is kept in reading order. |
| `import-mermaid-note` | collapsed | Import note | Nothing to fix: this says how the input was read. |
| `import-mermaid-merged-declaration` | merged | Declared more than once | Declare each node or group once, or give the second one its own id. |
| `import-db-view` | left-out | View | Nothing to fix: views are not modelled. |
| `import-db-function` | left-out | Function | Nothing to fix: functions are not modelled. |
| `import-db-procedure` | left-out | Procedure | Nothing to fix: procedures are not modelled. |
| `import-db-trigger` | left-out | Trigger | Nothing to fix: triggers are not modelled. |
| `import-db-grant` | left-out | Permission or owner | Nothing to fix: permissions and owners are not modelled. |
| `import-db-policy` | left-out | Policy | Nothing to fix: policies are not modelled. |
| `import-db-partition` | left-out | Partition | Nothing to fix: partitions are not modelled. |
| `import-db-sequence` | left-out | Sequence | Nothing to fix: sequences are not modelled. |
| `import-db-extension` | left-out | Extension | Nothing to fix: extensions are not modelled. |
| `import-db-schema` | collapsed | Schema statement | Nothing to fix: the schema name is kept on each of its tables. |
| `import-db-data` | left-out | Data rows | Nothing to fix: data rows are not imported. |
| `import-db-session` | left-out | Session setting | Nothing to fix: session settings do not change the schema. |
| `import-db-drop-or-rename` | left-out | Drop or rename | Write the schema as it should end up, without DROP or RENAME statements. |
| `import-db-alter` | left-out | Other ALTER change | Write the change into the CREATE TABLE statement. |
| `import-db-dangling-fk` | left-out | Reference to a missing table | Include the referenced table in the import. |
| `import-db-unknown-table` | left-out | Change to a missing table | Include the table's CREATE TABLE statement in the import. |
| `import-db-parse-error` | not-supported | Statement not readable | Check the syntax of this statement. |
| `import-db-unknown` | not-supported | Statement not recognised | Remove the statement, or write the schema as CREATE TABLE, CREATE TYPE and CREATE INDEX statements. |
| `import-db-type-converted` | collapsed | Type converted | Nothing to fix: the type was mapped to the deck's dialect. |
| `import-db-type-kept` | collapsed | Type kept as written | Nothing to fix: the type is kept as written. |
| `import-db-option-dropped` | left-out | Option dropped | Nothing to fix: set the option in Sododeck if you need it. |
| `import-db-renamed-duplicate` | merged | Renamed duplicate | Give each table, column or index a unique name in the input. |
| `import-db-name-exists` | merged | Name already in the deck | Rename the table in the input, or import into a new deck. |
| `import-db-enum-name-exists` | merged | Enum name already in the deck | Rename the enum in the input, or import into a new deck. |
| `import-db-schema-dropped` | left-out | Schema dropped | Nothing to fix: the deck's dialect has no schemas. |

## Authoring checks (AI deck skill)

Reported only by the AI deck skill's `lint`, never by the app: advice for decks written by an AI agent. Always warnings.

| Code | Severity | Title | Fix |
| --- | --- | --- | --- |
| `id-style` | warning | Id is not a short slug | Use a short lower-case slug (at most 32 characters) chosen once; never rebuild it from the title. |
| `positions-mixed` (retired) | warning | Some cards placed, some not | Nothing to fix: no longer reported; every card now needs a position (card-without-position). |
| `orphan-card` | warning | Card without connections | Connect the card, put it in a group, or delete it if it does not earn its place. |
| `duplicate-title` | warning | Same title twice | Give each card in the same group and level its own title. |
| `label-too-long` | warning | Label over budget | Shorten the label; put details in the note or in fields. |
| `level-over-budget` | warning | Too many cards on one level | Split the level: move related cards under a parent card one level down, or merge minor ones. |
| `connector-without-source` | warning | No source link | Add a link to the file and lines the connector or card was built from, or remove it. |
| `card-without-position` | warning | Card without a position | Place the card on the layout grid (see references/layout.md); a hand-laid deck reads far better than the app's import layout. |
| `connector-crosses-card` | warning | Connector runs over a card | Move the card off the line, move an end so the line between the two card centres misses it, or add a bend (`route.waypoints`). |
| `frame-covers-card` | warning | Group frame covers a card of another group | Move the card out of the frame, or move the group's cards so their frame no longer reaches it. |
| `frames-overlap` | warning | Two group frames overlap | Move one group so the frames have a gap; sibling groups never share space. |
| `group-by-kind` (retired) | warning | Group of one kind | Nothing to fix: no longer reported; hand-laid decks group cards by role (ADR 0042). |
| `hub-card` | warning | Too many connectors | Keep only the connectors a flow walks or that tell the story; name the other readers and writers in the description. |
