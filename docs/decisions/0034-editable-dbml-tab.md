# 0034. Editable DBML tab

- **Status:** Accepted
- **Date:** 2026-10-04
- **Feature:** `specs/046-db-code-panel` (research R1, R2, R4, R5)
- **Builds on:** 0029 (database pack model), 0031 (schema export), 0033 (schema import parsers)

## Context

The code overlay showed the deck as read-only JSON. 046 adds DBML and SQL tabs, and the DBML tab
is editable: typing changes the canvas, and the canvas changes the text. The backlog tied this to
026 (editable JSON); the founder removed that dependency on 2026-10-04, so the JSON tab stays
read-only and 046 builds the editing it needs itself.

## Decision

- **Apply on a pause.** The DBML tab is an ordinary editable Monaco model. 500 ms after the last
  keystroke the text is read in the import worker (`@dbml/parse`, ADR 0033), validated, planned
  against the deck and written. There is no Apply button, except when the plan would remove every
  table (the panel then asks first). Text with an error is never written: errors become editor
  markers and the canvas keeps the last valid schema.
- **One undo step per burst.** `editor.batch(fn, { merge })` is the only model change: batches with
  the same merge key join one undo item whatever the time gap. The panel keys applies
  `dbml:<session>:<burst>`; a burst ends after 2 s without typing, on blur, on undo / redo and on
  any other local write. Remote and storage updates never end it. Operations nested inside a batch
  no longer touch the grouping state, so only the outermost call decides the undo step.
- **Matching keeps ids** (`db/sync/match.ts`): tables by `schema.name`, then ignoring case, then the
  session memory (a table removed earlier in the panel session and typed back is restored with its
  old ids, position and relationships), then one likely rename (one unmatched table on each side
  sharing at least half the columns). Columns, enum values, indexes, checks and relationships have
  their own rules; guesses are one-to-one only, so a wrong one is rare and undoable.
- **Only what DBML expresses is ever patched.** Position, size, colour, tags, owner, links, lock,
  group, `expanded`, `detail` and enum colour are never in a patch. Both sides are normalised the
  way the writer writes and the reader reads (`db/sync/normalise.ts`), so the writer's own text is
  an empty plan (SC-004). What the writer cannot express (an index method DBML cannot hold, an enum
  with no values, a relationship without columns) is left alone, not cleared.
- **The text is mapped by 044's `buildPlan`**: one place knows how DBML columns, defaults, indexes
  and enums become deck objects. The planner compares those shapes with the deck.
- **Pure pipeline, one writer.** `db/sync/*` (except `apply-schema-plan.ts`) imports no React, DOM,
  Yjs or `editor/`; it takes a snapshot and the parsed text and returns a plan. Applying goes only
  through `DeckEditor` ops, in one batch: enums added, tables added or restored, patches, parts,
  relationships, then removals last so a cascade never hits something the plan still patches.

## Alternatives considered

- **An explicit Apply button** (the 026 design): rejected, the design frame says "Edits apply as you
  type" and an extra step would make the text feel like a form.
- **Apply on every valid keystroke:** too many plans and a rename applied letter by letter.
- **A long-lived gesture per burst** (`beginGesture`): holds back redo and makes every other write
  join the step; the merge key is the smaller change.
- **Raising `captureTimeout` globally:** changes undo for the whole app.
- **A second parser worker:** the parser would load twice. The existing import worker gets a
  `read-dbml` request.
- **The diff in `@sododeck/model`:** matching depends on the parser's raw shape, which the model
  does not know. The model keeps the batch option only.
- **Re-using import (`buildPlan` + paste):** paste always makes new ids.

## Consequences

- Renaming in the text is safe for relationships, indexes and enum links (ids stay).
- Text typed with a rename the matcher cannot tell from remove + add (two or more unmatched tables
  on each side) replaces the tables and says so with an Undo.
- The planner and the writer must change together: the round-trip test over the DBML corpus and
  the Shop deck fails when they drift.
- 026 can later make the JSON tab editable with its own ADR; nothing here blocks it.
