# 0035. Step touches and database card ownership

- **Status:** Accepted
- **Date:** 2026-10-04
- **Feature:** `specs/049-db-architecture-link` (research R1–R8)
- **Builds on:** 0022 (schema roadmap), 0029 (database pack model)

## Context

049 links the database schema to the architecture board. A database card owns the tables drawn
inside it, and a flow step must be able to say which tables and columns it reads or writes so
playback can show what a flow does to data. The founder ruled out flows drawn between tables
(2026-10-03): flows stay between architecture cards, a step only lists what it touches.

## Decision

- **One new optional field: `Step.touches`.** A flat, ordered list of `{ table, column?, access }`
  where `table` is a table node id, `column` an optional column id of that table and `access` is
  `read` or `write`. One entry per row of the inspector's Touches section. Absent or empty means
  the step touches nothing and playback is unchanged. Additive and optional, so no `version` bump.
- **No two touches of one step share the same `(table, column)` pair.** JSON Schema cannot say
  this, so it is semantic rule S15. Whether the table exists, has columns and owns the column is
  referential integrity and lives in `@sododeck/model`'s `checkIntegrity`.
- **Ownership stays `node.parent`.** A table's owner is the database card it is parented to; at
  most one, because the field holds one id. There is no new owner field. Drill-in, outside proxies
  and the SQL export `database` scope already scope by `parent`. `setTableOwner` sets or clears it
  in one undo step; deleting a card un-parents its tables (they are kept and become unowned).
- **Cleanup by id.** Deleting a table removes every touch naming it; deleting a column removes the
  touches naming that column. Steps are never removed and are not reported as broken.
- **Lighting is derived, never stored.** The card chip ("writes orders +1"), lit tables, R / W row
  markers and the step player's "also touches" lines are computed from the deck and the current
  step at render time.
- **Touched rows are forced visible through `table-layout.ts`.** The layout takes a
  `forcedColumnIds` set and keeps those rows even when Auto detail would fold them, so the one
  owner of which rows draw stays the same and connectors, export and hit areas follow it.

## Alternatives considered

- **Nested `{ table, access, columns: [...] }`:** two levels of toggles, harder to edit and to
  clean up on delete.
- **A top-level `touches` collection keyed by step:** a new id space, and the step no longer
  carries its own knowledge.
- **Flows between tables:** rejected by the founder.
- **A separate `owner` field on tables:** duplicates `parent`, which already means "one level up".
- **Highlighting touched rows only if visible:** a touched column could then be hidden.

## Consequences

- Older readers that do not know `touches` reject the file (the step has
  `additionalProperties: false`), the same as every additive field since 006.
- The row limit planned in 048 reuses the same forced set for rows that must stay visible.
- `node.parent` accepts any node; the UI only offers database cards as owners and integrity stays
  permissive for older decks.
