# Research: Schema Code Panel (DBML)

**Feature**: `046-db-code-panel` · **Date**: 2026-10-04 · **Spec**: [spec.md](spec.md)

Facts below come from a survey of `main` at `75851b3` (after 043 and 044). Paths are under
`apps/app/src/` unless they start with `packages/`, `docs/` or `specs/`.

## What exists

| Area             | Today                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code overlay     | `editor/shell/json-overlay.tsx` wraps `editor/json-panel.tsx` (header `json-panel-header.tsx`, lazy `json-viewer.tsx`). Tab state `JsonTab = 'selection' \| 'deck'` in `state/json-panel-prefs.ts`, store slice in `state/ui-store.ts` (`setJsonTab`).                                                                       |
| Text sync        | Deck tab: `use-throttled-deck-text.ts` (250 ms, leading + trailing). Viewer applies one minimal `applyEdits` per change via `line-diff.ts`, never `setValue`; one Monaco model per tab path keeps folds, cursor, scroll.                                                                                                     |
| Read-only + undo | `json-viewer.tsx`: `readOnly`, `onDidAttemptReadOnlyEdit`, ⌘Z / ⇧⌘Z / ⌘Y `addCommand` → `editor.undo()` / `redo()` (`useEditor()`).                                                                                                                                                                                          |
| Monaco           | `editor/monaco-setup.ts`: bundled (`loader.config({ monaco })`), JSON language only, editor + JSON workers, no `setModelMarkers` anywhere. Themes from tokens (`monaco-theme.ts`).                                                                                                                                           |
| DBML reader      | `db/import/read-dbml.ts` `readDbml(text, dbmlModule)`: pure, returns `RawSchema` with start lines per table, column, index, check, ref, enum; keeps **only the first** parse error (`line`, `column`, `message`), no end position. Loaded by `db/import/load-parsers.ts` (`@dbml/parse` 10.2.0, ~108 KB gzip) in the worker. |
| Import worker    | `db/import/import.worker.ts` + `import-client.ts`: `{ kind: 'preview' \| 'plan' }` only; always runs the full import. Inline fallback client for tests.                                                                                                                                                                      |
| Import plan      | `db/import/build-plan.ts` → Fragment → `apply-import.ts` (`editor.batch` + `pasteFragment`). **Always adds**, new ids on paste; name clash → `copyName`.                                                                                                                                                                     |
| Writers          | `db/export/schema-export.ts` `schemaExport(deck, { format, scope, dialect, sql })` → `{ text, notes, tableCount }`; pure, main thread, 50 ms budget for 150 tables (2–5 ms measured, ADR 0031). DBML writer emits Project (real dialect only), enums, tables, refs; no TableGroup, headercolor or sticky notes.              |
| Model writes     | `DeckEditor` has per-part ops with optional caller ids: `addColumn/updateColumn/moveColumn/removeColumn`, same for indexes, checks, enum values; `addEnum/updateEnum/removeEnum`; `add/update/remove` for nodes and edges; `setLocked`, `isLocked`. `update` on a node refuses `columns/indexes/checks`.                     |
| Undo             | One `Y.UndoManager` (`packages/model/src/editor.ts`), `captureTimeout` 500. `ctx.transact(fn, key)` stops capturing unless the key repeats; `batch(fn)` passes no key, so every batch is a new step. Gestures (`beginGesture` …) set `captureTimeout = Infinity`.                                                            |
| Origins          | Local editor origin, `storageOrigin`, `channelOrigin` (`storage/origins.ts`); `observeDeck` labels `local` / `remote` / `undo` / `redo`.                                                                                                                                                                                     |
| Toast            | `editor/undo-toast.ts` `showUndoToast` (one Undo toast at a time).                                                                                                                                                                                                                                                           |
| Selection        | `useUiStore((s) => s.selection.nodes)`.                                                                                                                                                                                                                                                                                      |

## Decisions

### R1. Apply on pause, in the panel (settles the 026 "cursor fight" risk)

- **Decision**: the DBML tab is a normal editable Monaco model. 500 ms after the last keystroke
  (`DBML_APPLY_PAUSE_MS`), the text is read in the worker; if it is clean, the plan is built and
  applied. No Apply button except the "remove every table" case (FR-016). Recorded in a new
  **ADR 0034 — Editable DBML tab** (0031 is used twice; 0034 is next).
- **Rationale**: frame 166 says "Edits apply as you type"; the pause keeps partial words from being
  applied on every keystroke while keeping the canvas live.
- **Alternatives**: explicit Apply (rejected by the design); apply on every valid keystroke (too
  many plans, flicker, renames applied letter by letter at keyboard speed).

### R2. Undo bursts: a merge key on `batch`

- **Decision**: add an optional merge key to the model: `editor.batch(fn, { merge: key })`. When the
  key equals the previous transaction's key and nothing else wrote in between, the transaction is
  merged into the previous undo item **regardless of `captureTimeout`** (the model raises
  `captureTimeout` for that transaction only). The panel uses `dbml:<sessionId>:<burst>` and
  increments `burst` after 2 s without typing (`DBML_BURST_IDLE_MS`), on editor blur, on undo /
  redo, and after any other local write (canvas, drawer). Remote and storage updates are untracked
  and do not end a burst, so a second browser tab cannot split a step it did not make.
- **Rationale**: clarify Q1 (B). Applies are ≥ 500 ms apart, so the 500 ms capture window never
  merges them; a gesture (`captureTimeout = Infinity`) would hold back redo and every other write.
  The key lives in the model (constitution I: writes go through `DeckEditor`); no format change.
- **Alternatives**: a long-lived gesture per burst (blocks other writes from becoming their own
  steps); raising the global `captureTimeout` (changes undo for the whole app).

### R3. Parsing: a `read-dbml` request on the existing worker

- **Decision**: add `{ kind: 'read-dbml', text }` to the import worker protocol, returning
  `{ schema: RawSchema, problems: TextProblem[] }`. `readDbml` keeps every compiler diagnostic
  (not just the first) with start and end positions. The panel uses the shared import client, so
  the parser is loaded once per session and only when the DBML tab first opens (FR-006,
  SC-006). Requests carry a sequence number; a stale reply is dropped (latest wins).
- **Rationale**: one place loads the parser (ADR 0033); `readDbml` is already pure and DBML-only.
- **Alternatives**: a second worker (parser loaded twice); parsing on the main thread (300-table
  DBML is ~150 ms, too slow while typing).

### R4. Diff is pure and lives in `db/sync/`

- **Decision**: new folder `db/sync/` with the pure pipeline `planSchemaSync(deck, raw, context) →
{ plan, problems }`: (1) **validate** (FR-008: duplicate names, missing ref ends, enum default
  values, enum still in use, locked tables, no tables in empty-whole-schema case); (2) **match**
  (R5); (3) **plan** add / update / remove operations keyed by existing ids. Same boundary as
  `db/export` and `db/import` (`apps/app/CLAUDE.md`: snapshot + request in, data out; no React,
  DOM, Yjs or `editor/` imports).
- A thin `db/sync/apply-schema-plan.ts` writes the plan through `DeckEditor` ops in one
  `batch(…, { merge })` (as `apply-import.ts` does through `editor.batch`).
- **Rationale**: keeps matching testable without Yjs; constitution II (model is the only Yjs ↔
  JSON path) holds because apply uses editor ops only.
- **Alternatives**: put the diff in `@sododeck/model` (as the backlog sketched): rejected because
  matching depends on `RawSchema` (app-side, parser-specific) and the model does not know DBML;
  the model only gains the merge key. Re-using `buildPlan` + paste: rejected, paste always makes
  new ids.

### R5. Matching rules

Applied per kind, in this order; each existing object matches at most once.

1. **Tables** (in scope): same `schema.name` → same name ignoring case → **session memory**
   (removed earlier in this panel session, same name, R7) → **likely rename**: exactly one
   unmatched existing table and one unmatched parsed table **in this apply**, and at least half
   of the parsed table's column names exist in the old table (or both have ≤ 1 column). Anything
   else unmatched: parsed → add; existing → remove. When ≥ 2 old and ≥ 2 new are unmatched, add a
   warning "X, Y were replaced; Undo to restore" (spec edge case).
2. **Columns** (within a matched table): same name → name ignoring case → likely rename: the
   unmatched old and new columns are paired one-to-one when they sit at the same position among
   the unmatched ones **and** have the same type, or when exactly one old and one new are
   unmatched. Column order follows the text (`moveColumn`).
3. **Enums**: like tables (name, case, session, one-to-one rename by value overlap); **enum
   values** like columns (name, case, one-to-one by position).
4. **Indexes**: by name when named; unnamed by their column list; **checks**: by name, then by
   expression.
5. **Relationships**: by the ordered pair (from table + columns, to table + columns) after
   table/column matching; then by name. A relationship whose ends are both outside the scope is
   never touched.

- **Rationale**: spec FR-010/FR-011; one-to-one only, so a wrong guess is rare and always undoable.
- **Alternatives**: similarity scoring across all pairs (hard to predict, hard to test).

### R6. Updates are field patches, never replacements

- **Decision**: a matched object gets a patch of only the fields DBML expresses (spec scope list);
  absent optional fields become `null` / `false` in the patch so they are cleared. Fields DBML
  does not express (`position`, `size`, `color`, `tags`, `owner`, `links`, `locked`, `group`,
  `fields`, `expanded`, `detail`, enum `color`) are never in a patch. No-op patches are dropped,
  so applying the writer's own text is an empty plan (SC-004).
- **Normalisation before compare**: the same rules the round-trip test uses (column `check`s
  beyond the first become table checks, quoted defaults vs expressions, `increment` on `pk`
  only, type spelling as written). One function `normaliseRawTable` shared with tests.

### R7. Session memory for cut and paste

- **Decision**: `db/sync/session-memory.ts` keeps, per open panel, the snapshot JSON of every table
  (and its relationships, enum refs) removed by an apply, keyed by lower-cased `schema.name`.
  When a later apply adds a table of that name, the plan re-adds it **with its old ids** (node and
  part ids are free again after removal; `New*` types accept ids) and position, then patches it to
  the text. Relationships come back when both ends exist. Cleared when the panel closes.
- **Rationale**: spec edge case "cut and paste a table block"; clarify Q3 (toast + restore).

### R8. Text ↔ deck state machine

States of the DBML editor (UI only, `use-dbml-session.ts`):

| State     | Meaning                                        | Deck changes from elsewhere                   |
| --------- | ---------------------------------------------- | --------------------------------------------- |
| `synced`  | text = writer output for the scope             | text updated by minimal line edits (FR-017)   |
| `dirty`   | user typed, pause timer running                | text kept (FR-018)                            |
| `invalid` | last read had errors                           | text kept                                     |
| `applied` | applied while focused; text may differ in form | text kept until blur, then rewritten (FR-019) |
| `confirm` | plan removes every table (FR-016)              | text kept; Apply button shown                 |

- On blur / tab switch / panel close: `dirty` / `invalid` / `confirm` → discard and rewrite
  (FR-020); `applied` → rewrite.
- The writer text is regenerated from `useDeckSnapshot` with the same 250 ms throttle as the
  JSON deck tab; Selection scope reads `selection.nodes` filtered to `db-table`. In Selection, the
  **baseline set** (table ids in the text when it was written) bounds removals (FR-015); new
  tables are added to the UI selection after apply.

### R9. Problems in the editor

- **Decision**: one `TextProblem` type (`line`, `column`, `endLine`, `endColumn`, `severity`,
  `message`, `suggestion?`). Parser diagnostics from R3; semantic problems from R4 carry the line
  of the object from `RawSchema`. Shown with `monaco.editor.setModelMarkers(model, 'dbml', …)` and
  `renderValidationDecorations: 'on'`; Monaco's F8 / ⇧F8 moves between them (FR-024). The status
  line and an `aria-live` region announce "Applied", "Can't apply: fix n errors".
- **Suggestions**: unknown setting words are compared to the known DBML setting list
  (`pk`, `primary key`, `null`, `not null`, `unique`, `increment`, `default`, `note`, `ref`) with
  edit distance ≤ 2 → "did you mean not null?".

### R10. Languages and themes

- **Decision**: SQL uses Monaco's bundled basic SQL tokenizer (deep import of the
  `basic-languages/sql` contribution, same pattern as the JSON import; no new dependency). DBML
  gets a small Monarch tokenizer of our own (`editor/code/dbml-language.ts`: keywords `Table`,
  `Ref`, `Enum`, `indexes`, `checks`, `Note`, `Project`, settings in `[...]`, strings, comments).
  `monaco-theme.ts` gains rules for the new token classes from existing tokens. The extra
  bundle cost is measured in the implementation report.

### R11. Prefs

- **Decision**: `JsonPanelPrefs` gains `format: 'json' | 'dbml' | 'sql'` (default `json`),
  `schemaScope: 'selection' | 'schema'` (default `selection`, as frame 137) and
  `sqlPreviewDialect: 'postgres' | 'mysql' | 'sqlite'` (default `postgres`). The JSON
  `tab: 'selection' | 'deck'` is unchanged. Unknown stored values fall back field by field, so
  old prefs keep working.

### R12. Placement of new tables

- **Decision**: synchronous and simple, so an apply is one write: new tables go in a column to the
  right of the bounding box of the scope's tables (or the viewport centre in an empty deck),
  160 px gap (as `placeImport`), heights from 041's `tableLayout`, stacked without overlap and
  checked against every card's rect. ELK is not used here (it is async and re-flows nothing that
  exists).

### R13. SQL tab

- **Decision**: `schemaExport(deck, { format: 'sql', scope, dialect })`, read-only through the
  existing viewer path (`readOnly`, read-only message "SQL is read-only here; edit DBML or the
  canvas"). Dialect = deck dialect; Generic uses `sqlPreviewDialect`. Writer notes listed under
  the editor as in the export dialog.

### R14. Performance

- Writer: ≤ 5 ms for 150 tables (ADR 0031). Read: ~75 ms for 150 tables in the worker (044 R15:
  ~150 ms for 300). Plan: pure, target ≤ 30 ms for 150 tables, perf test like
  `schema-export.perf.test.ts`. Apply: one transaction. Total after the 500 ms pause ≲ 200 ms →
  within SC-005's 1 s. Typing never waits on any of it (worker + debounce).

### R15. Not inputs: warnings, not errors

- `TableGroup`, sticky `Note`, `headercolor`, `Project` (incl. `database_type`), ref `color`, and
  `records` produce a warning on their line ("Table groups are edited on the canvas", "The deck
  dialect is set in Deck settings"); the rest of the text applies (FR-009).
