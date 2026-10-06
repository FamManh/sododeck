# Scripts

Every script: `node <skill>/scripts/<name>.mjs …`. Node 20 or newer, offline, reads and writes only
the files you name. `--help` prints usage.

Exit codes: `0` no `error` problems (warnings allowed) · `1` at least one `error`, or a file that
cannot be loaded · `2` wrong arguments or a file that cannot be read (message on stderr).

## Contents

1. validate · 2. lint · 3. summary · 4. diff · 5. deliver · 6. outline · 7. Reading a problem · 8. Problem codes

## 1. validate

`validate.mjs <deck> [--format json|text]`: would the app open this file? Checks JSON syntax, the
file format (schema) and identity rules (unique ids). Default output is JSON.

## 2. lint

`lint.mjs <deck> [--detail faithful|balanced|simplified] [--mode new|update|codebase|text]
[--format json|text]`: everything validate checks, plus the app's deck problems (broken flows,
missing rules, broken references, …) and the authoring checks (taste and modelling warnings).
`--mode update` skips the mixed-positions warning; `--mode codebase` asks for a source link on
every card and connector. `--detail balanced|simplified` adds the cards-per-level budget; without
it (or with `faithful`) there is none.

## 3. summary

`summary.mjs <deck> [--format text|json]`: a short outline (groups with cards, levels,
connectors, flows with numbered steps, rules and where they are used). Read it before editing a
deck instead of reading the whole file.

## 4. diff

`diff.mjs <old> <new> [--format json|text]`: what changed, matched by id. `+` added, `~` changed
(with the changed fields), `-` removed. Exit 0 whenever both files load.

## 5. deliver

`deliver.mjs <draft> <target> [--detail …] [--mode …]`: runs lint on the draft; when there is no
error, replaces the target with the draft in one step and deletes the draft (the report prints
only when there are warnings). Otherwise both files stay as they are and the report prints.

## 6. outline

`outline.mjs <board.excalidraw> [--board "title"] [--min-text 13] [--format text|json]`: what a
whiteboard file holds, without reading its JSON: the boards (large one-line titles over a
diagram), every labelled shape (labels bound to a shape or written on top of it), every arrow as
`from → to "label"` (`end guessed` when the arrow was not attached and the nearest shape within
40 px was taken), and the free text by size. `--board` keeps one board (title match, any case).
See `from-diagrams.md`.

## 7. Reading a problem

```json
{
  "code": "step-without-connection",
  "severity": "error",
  "path": "/flows/0/steps/2",
  "subject": "charge",
  "message": "Step without connection: Checkout · step 3 used a deleted connection.",
  "evidence": "Checkout · step 3 used a deleted connection",
  "fix": "Point the step's \"edge\" to an existing connector id, or remove the step."
}
```

`path` is a JSON Pointer into the file (`/flows/0/steps/2` = first flow, third step; a schema
problem points at the exact key, such as `/nodes/3/title`); `subject` is the id of the object; `fix` is what to change. A file that is not JSON gives
`line` and `column` instead of `path`. The same report comes out of Sododeck's **Copy problems**,
so a user can paste the app's problems to you and you fix them the same way.

## 8. Problem codes

Errors make the app refuse a file or mark a deck problem; warnings are advice. Format and identity
codes (`schema-*`, `invalid-json`, `duplicate-id`, …) come from validate.

### Deck problems (lint)

{{deckCodes}}

### Authoring checks (lint, skill only)

{{authoringCodes}}
