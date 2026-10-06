# Contract: skill scripts (027)

Public: agents call these. Run with `node <skill>/scripts/<name>.mjs …`. All work offline and read
or write only the files named on the command line.

Common options: `--format json|text` (default `json`, except `summary`: `text`), `--help`.
Exit codes: `0` no `error` entries; `1` at least one `error`; `2` usage or file-system error
(one-line message on stderr, nothing on stdout).

## validate

```
validate <deck.sododeck> [--format json|text]
```

Prints a `sododeck-problems` report (062 contract) with the file-format and load problems. A clean
file prints a report with `problems: []` (JSON) or `OK: <name> is a valid deck.` (text).

## lint

```
lint <deck.sododeck> [--detail faithful|balanced|simplified] [--mode new|update|codebase|text] [--format json|text]
```

When the file cannot be loaded: validate's report (status `refused`), exit 1. Otherwise: report
with status `opened`, entries = deck problems (app codes) + authoring checks (warnings), sorted in
file order. Text form:

```
ERROR step-without-connection /flows/0/steps/2 [s3] Step without connection: …
  fix: Point the step's "edge" to an existing connector, or remove the step.
WARN  label-too-long /nodes/4/title [payments] Title has 52 characters (budget 40).
  fix: Shorten the title; put details in "note" or fields.
2 problems: 1 error, 1 warning.
```

## summary

```
summary <deck.sododeck> [--format text|json]
```

Text outline (data-model "Deck summary"); exits 0 even when the deck has problems (prints
`Problems: 1 error, 2 warnings — run lint.`); exits 1 only when the file cannot be loaded.

## diff

```
diff <old.sododeck> <new.sododeck> [--format json|text]
```

Prints a `sododeck-diff` report. Exit 0 whenever both files load (a diff is information, not a
failure), 1 when either cannot be loaded, 2 on usage errors. Text form:

```
+ nodes/refund-svc "Refund Service"
~ edges/e4 fields: label
- flows/old-flow "Old flow"
+ flows/refund "Refund" (4 steps)
3 added, 1 changed, 1 removed.
```

## outline

```
outline <board.excalidraw> [--board "title"] [--min-text 13] [--format text|json]
```

Added after the auto-wo review (2026-10-05). Prints a `sododeck-sketch-outline` (JSON) or a text
outline of a whiteboard file: boards (large one-line titles over at least 8 shapes), labelled shapes
(bound labels, or free text whose centre lies inside the shape), arrows with their ends (bound, or
the nearest labelled shape within 40 px, marked `guessed`) and free text at or above `--min-text`.
Exit 0; 2 when the file cannot be read or is not JSON.

## deliver

```
deliver <draft.sododeck> <target.sododeck> [lint options]
```

Runs validate and lint on the draft. When there is no `error`, moves the draft over the target
(write to a temporary file in the target's folder, then rename, so the target is never half
written), prints the lint report only when it has warnings, and `Delivered <target>.` on stderr;
exit 0. Otherwise leaves both files untouched, prints the report, exit 1.
