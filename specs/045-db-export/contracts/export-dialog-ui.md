# Contract: Export dialog, Schema section (UI behaviour)

Extends the 012 dialog (`apps/app/src/editor/export/export-dialog.tsx`, ADR 0016). Reference
frame: [145](../../../docs/design/screens/145-db-export-light.png) (light / dark). All names below
are the accessible names tests use.

## Format list

- One radio group "Format" with two labelled groups: **Schema** (SQL, DBML, Mermaid ER, Data
  dictionary) and **Image and data** (JSON, PNG, SVG). Schema is rendered only when the deck has
  ≥ 1 `db-table` node.
- Subtitles: SQL "In the deck dialect · Postgres" (Generic: "Choose Postgres, MySQL or SQLite"),
  DBML "Database markup", Mermaid ER "erDiagram for docs", Data dictionary "Markdown, one section
  per table". Icons (lucide): `Database`, `Braces`, `Network`, `FileText`.
- Arrow keys move between all seven formats (one radio group).

## Scope (schema formats)

- Segmented control labelled "Scope" with: **Selection** (disabled with reason "Select one or
  more tables" when no table is selected), **<database card title>** (only rendered when a card
  is in context), **Whole deck**. Default per data-model §5. Image formats keep their own scope
  control unchanged.

## Dialect

- SQL on a real-dialect deck: a static chip "Postgres · deck dialect" (`Database` icon).
- SQL on a Generic deck: a select labelled "Dialect" (Postgres, MySQL, SQLite), empty at first;
  the preview reads "Choose a dialect to write SQL" and Copy / Download are disabled until chosen.
  The choice persists while the dialog stays open; it never changes the deck.

## Banner and notes

- **Problems banner** (role `alert`, Clay soft, `CircleX` icon): "2 errors in Orders DB", then up
  to two problem details joined by " · ", and a button "Show problems" that closes the dialog
  and opens the Problems flyout. Shown only for schema formats with db problems in scope.
- **Export notes** (role `status`, neutral): heading "3 export notes", first three notes, a
  "Show all" toggle when more. Hidden when there are no notes.

## Preview

- Region "Preview": line-numbered monospace text (numbers `aria-hidden`), first 400 lines, then
  "… n more lines" when longer. Empty scope: "No tables in this scope".
- Busy: "Preparing…" (existing live status).

## Options (SQL only)

Switches: "Include enums and indexes" (on), "Write junction tables for n–n" (on), "IF NOT EXISTS"
(off). Helper text below: "SQL is written in the deck dialect. A Generic deck asks for Postgres,
MySQL or SQLite here first."

## Footer

- File name (Mono), size, **Copy** ("Copied" toast), **Download** with the format's extension
  (`text/plain` for all four; `.sql`, `.dbml`, `.mmd`, `.md`). A schema download does not count
  as a backup (`markExported` is JSON only, unchanged).

## Not changed

JSON, PNG and SVG behaviour, the dialog title, its 820 px width, open time and focus handling.
