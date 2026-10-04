# Data Model: Design Sync, Database Pack (039)

This feature changes no code or file format. Its "data" are the documentation records below. Their
formats are fixed in [contracts/](contracts/).

## Frame

One Part A screen or Part B row, captured in both themes.

| Field     | Rule                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `id`      | Integer 134–168, unique, in board order (Part A then Part B).                                               |
| `key`     | The board key (`SDDB.SCREENS[].id` or `SDDB.ROWS[].id`). Used for capture (`#only=<key>\|<theme>`).         |
| `slug`    | `db-` + kebab-case of the board title, ≤ 5 words. Recorded in the README when it does not follow the title. |
| `title`   | The board title, as written in the design.                                                                  |
| `size`    | 1440×900 (Part A), 900×900 (A10), 1180 × natural height (Part B).                                           |
| `primary` | Exactly one feature of 040–049 that builds it.                                                              |
| `also`    | Zero or more other features that use it.                                                                    |

**Validation:**

- Every frame has two Screenshots.
- Every feature from 041 to 049 is `primary` or `also` on at least one frame (SC-006).

### Frame catalogue

Proposed slugs. Final slugs follow the board titles at capture time.

| id  | key     | Board title                                          | slug                           | primary | also          |
| --- | ------- | ---------------------------------------------------- | ------------------------------ | ------- | ------------- |
| 134 | A1      | New schema deck, empty                               | `db-empty-schema-deck`         | 043     | 044, 049      |
| 135 | A2      | Schema deck, working                                 | `db-schema-deck-working`       | 041     | 043           |
| 136 | A3      | Relationship selected                                | `db-relationship-selected`     | 042     | 043           |
| 137 | A4      | Code view (DBML tab, inline error)                   | `db-code-view`                 | 046     |               |
| 138 | A5a     | Import · dialog                                      | `db-import-dialog`             | 044     |               |
| 139 | A5b     | Import · after                                       | `db-import-after`              | 044     |               |
| 140 | A6      | Large schema (150 tables, System zoom)               | `db-large-schema`              | 048     | 041           |
| 141 | A7a     | Architecture + schema · before                       | `db-architecture-before`       | 049     |               |
| 142 | A7b     | Inside Orders DB · flow step 4                       | `db-inside-database-step`      | 049     |               |
| 143 | A7c     | Inside Orders DB · step 5 elsewhere                  | `db-inside-database-elsewhere` | 049     |               |
| 144 | A8      | Problems                                             | `db-problems`                  | 047     |               |
| 145 | A9      | Export                                               | `db-export`                    | 045     | 047           |
| 146 | A10     | Narrow window · 900 px                               | `db-narrow-window`             | 041     | 043           |
| 147 | A11a    | Flow step · reads / writes                           | `db-flow-step-reads-writes`    | 049     |               |
| 148 | A11b    | Flow playback                                        | `db-flow-playback`             | 049     |               |
| 149 | M       | Context menus                                        | `db-context-menus`             | 043     | 041, 042      |
| 150 | S1      | ≡ menu                                               | `db-deck-menu`                 | 043     |               |
| 151 | S2      | Deck settings · drawer in deck mode                  | `db-deck-settings`             | 043     |               |
| 152 | S2b     | Deck settings · Database section                     | `db-deck-settings-database`    | 043     | 041           |
| 153 | S3      | Changing the dialect                                 | `db-dialect-change`            | 043     |               |
| 154 | S4      | After conversion                                     | `db-dialect-converted`         | 043     |               |
| 155 | sig     | Signature moment · from architecture into the schema | `db-signature-moment`          | 049     | 041, 042      |
| 156 | anat    | Table card anatomy                                   | `db-table-anatomy`             | 041     |               |
| 157 | set     | Sample set                                           | `db-sample-set`                | 041     |               |
| 158 | large   | Large tables                                         | `db-large-tables`              | 048     | 041, 042      |
| 159 | rel     | Relationships                                        | `db-relationships`             | 042     |               |
| 160 | auth    | Authoring on the canvas                              | `db-authoring`                 | 043     | 042           |
| 161 | states  | States                                               | `db-states`                    | 041     | 042, 043, 047 |
| 162 | zoom    | Zoom levels                                          | `db-zoom-levels`               | 041     | 042           |
| 163 | groups  | Groups                                               | `db-groups`                    | 048     | 041           |
| 164 | drawer  | Details drawer                                       | `db-details-drawer`            | 043     |               |
| 165 | enums   | Enums and notes                                      | `db-enums-notes`               | 041     | 043           |
| 166 | code    | Code panel, import and export                        | `db-code-import-export`        | 044     | 045, 046      |
| 167 | prob    | Problems                                             | `db-problems-lint`             | 047     |               |
| 168 | palette | Type palette                                         | `db-type-palette`              | 043     |               |

040 is model-only and has no frame. Every one of 041–049 is covered.

## Screenshot

- **File:** `docs/design/screens/<id>-<slug>-<theme>.png`, where `theme` is `light` or `dark`.
- **Capture:** 2× device scale, at the Frame's `size`. No empty icon placeholders.
- **Count:** 70 new files. 0 existing files changed.

## Component spec

An entry in design-analysis.md §b "Components added by the Database pack (134–168)".

- **Fields:** name, frames it appears in, sizes, spacing, tokens, states, owning feature.
- **Required entries** (spec scope):
  - table card and its column row and key glyphs
  - nullable marker, type text, row hairline, indexes footer
  - Show all / Show fewer button, in-table column search
  - enum card and value chips
  - crow's foot ends on curved, elbow and straight lines; ports; relationship label; type-mismatch chip
  - Names · Keys · All control, dialect chip, Deck settings Database section
  - R / W row markers and the "writes" chip, outside proxies
  - zoom-level variants, breadcrumb island

## Reused chrome entry

One list in design-analysis.md §b of the parts the board draws with `sododeck-canvas.js` /
`sododeck-states.js` unchanged:

- shell islands, rail, flyout, drawer + header
- section label, toolbar, menu, popover, tooltip, pill
- primary and secondary buttons, input, chips, toggle, segmented control, dialog
- step player, Undo toast

## Database token

A row in DESIGN.md "Database pack". Values are in [research.md](research.md) R5.

| Field     | Rule                                                    |
| --------- | ------------------------------------------------------- |
| `name`    | e.g. `tblW`, `colH`                                     |
| `value`   | The value, with light and dark forms where they differ. |
| `maps to` | The existing DESIGN.md token, or "new".                 |
| `source`  | The frame that shows it.                                |

**Validation:** every token in backlog §039 is present (SC-003).

## Design decision (§g entry)

A numbered item in design-analysis.md §g under "Mismatches found in the Database board
(2026-10-04)", numbered from 83.

- **Fields:** number, frame link(s), the conflict, the decision or default, and who decided
  ("founder, 2026-10-03" or "default").
- **Known entries:** R6 in [research.md](research.md).

## Relationships

- Frame 1 — 2 Screenshot
- Frame n — 1 Feature (primary)
- Component spec n — n Frame
- Database token n — 1 Frame (source)
- §g entry n — n Frame
