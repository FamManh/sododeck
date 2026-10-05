# Contract: copied problem report and fidelity report (062)

Public: these JSON documents are what users paste into their AI, and what the AI deck skill
(027) emits from `validate` / `lint` (same entry shape, same codes). Field meanings:
`data-model.md`. Breaking changes bump `reportVersion`; adding optional fields does not.

## Problem report (`Copy problems`)

```json
{
  "report": "sododeck-problems",
  "reportVersion": 1,
  "source": { "kind": "file", "name": "checkout.sododeck" },
  "status": "refused",
  "schema": "https://sododeck.com/schema/v1.json",
  "formatVersion": 1,
  "app": "0.0.0",
  "counts": { "error": 2, "warning": 0, "info": 0 },
  "problems": [
    {
      "code": "schema-required",
      "severity": "error",
      "path": "/nodes/3/title",
      "subject": "payments",
      "message": "\"title\" is missing.",
      "fix": "Add \"title\" (a string) to node \"payments\"."
    },
    {
      "code": "duplicate-id",
      "severity": "error",
      "path": "/nodes/7/id",
      "subject": "api",
      "message": "Id \"api\" is used more than once (/nodes/2/id, /nodes/7/id).",
      "evidence": "\"api\"",
      "fix": "Give one of these objects a new, unique id and update references to it."
    }
  ],
  "omitted": 0
}
```

Not-JSON file:

```json
{
  "code": "invalid-json",
  "severity": "error",
  "line": 14,
  "column": 5,
  "message": "The file is not valid JSON: expected ',' or '}' after a property value.",
  "fix": "Fix the JSON syntax at line 14, column 5 (often a missing comma or quote)."
}
```

Rules:

- Valid JSON only, pretty-printed with 2 spaces, no surrounding text (FR-018, clarification Q4).
- Keys in the order shown; optional keys omitted when empty (never `null`).
- `problems` sorted as in data-model.md; at most 5,000 entries, rest counted in `omitted`.
- `status: "opened"` for the problems panel and for imports that opened with problems; there,
  entries are problems-list kinds and `picture-damaged`.
- No timestamp, no machine data: copying the same file twice gives identical bytes (SC-003).

## Fidelity report (`Copy report`)

```json
{
  "report": "sododeck-import",
  "reportVersion": 1,
  "source": { "format": "mermaid-flowchart", "name": "checkout.mmd" },
  "created": { "components": 12, "connections": 14, "groups": 2, "steps": 0 },
  "complete": false,
  "items": [
    {
      "code": "import-mermaid-appearance",
      "group": "left-out",
      "line": 18,
      "excerpt": "style api fill:#f9f",
      "message": "Styling is not imported."
    },
    {
      "code": "import-mermaid-flattened",
      "group": "collapsed",
      "line": 4,
      "excerpt": "subgraph inner",
      "message": "Nested group flattened into its parent."
    },
    {
      "code": "import-mermaid-merged-declaration",
      "group": "merged",
      "lines": [3, 9],
      "excerpt": "api[Gateway]",
      "message": "\"api\" is declared twice; the first label is kept.",
      "fix": "Declare \"api\" once, or give the second node its own id."
    }
  ]
}
```

- `complete: true` and `items: []` when nothing was lost.
- Items in input order; no cap.

## Catalogue document

`docs/file-format/problem-codes.md`, generated from `@sododeck/model` `problem-codes.ts` by a
file snapshot test. One table per family: code, severity, title, fix hint; retired codes marked.
