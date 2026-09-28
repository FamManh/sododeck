# Contract: problems UI (apps/app, added by 015)

All files in `apps/app/src/editor/problems/` unless noted.

## Computation

- `createProblemsClient(makeWorker?)` → `{ check(file): Promise<DeckProblems>; terminate() }`,
  module worker `problems.worker.ts` calling `checkDeck`. Same message shape as the layout client.
- `createProblemsStore(doc, client)`: subscribes to the deck snapshot, posts the latest snapshot
  trailing-throttled at 150 ms, drops results for superseded snapshots.
- `<ProblemsProvider doc>` in `EditorChrome` (`routes/editor-page.tsx`); tests use an inline client.
- `useProblems(): DeckProblems | null`.

## Surfaces

| Surface             | File                                             | Behaviour (spec FR)                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ProblemsPanel`     | `problems-panel.tsx`                             | Self-contained `<section aria-label="Problems">`: heading PROBLEMS + count, `role="listbox"`-style list of buttons (icon, title, detail, chevron), help line, "No problems" row, 200-row cap with "Show all n" (FR-012–016, FR-020). |
| Deck inspector      | `inspector/deck-inspector.tsx`                   | Renders `ProblemsPanel` after Summary (design 60).                                                                                                                                                                                   |
| Canvas button       | `problems-button.tsx` in `canvas-toolbar.tsx`    | Amber "n problems" / "1 problem"; absent at 0; click → `exitFlow` if needed, clear selection, focus first row (FR-024).                                                                                                              |
| Node glyph          | `deck-node.tsx`                                  | `TriangleAlert` top-right, tooltip with titles; accessible name + ", n problem(s)"; hidden while the connect "+" shows (FR-022, FR-025).                                                                                             |
| Edge glyph          | `deck-edge.tsx`                                  | Glyph in the label pill; pill shown for edges with problems even with labels off (FR-022).                                                                                                                                           |
| Flow row / rule row | `flows/flow-row.tsx`, `rules/rule-list.tsx`      | `ProblemGlyph` with "n problems"; replaces the flow row's clay marker (FR-023).                                                                                                                                                      |
| Delete toast        | `confirm-delete-dialog.tsx`                      | Appends " · n new problems" when the count grew (FR-026).                                                                                                                                                                            |
| Shortcut            | `use-canvas-shortcuts.ts` (`useEditorShortcuts`) | ⌘. / Ctrl+. next, ⇧⌘. previous, wrap; outside text fields and dialogs; "No problems" announced when empty (FR-021).                                                                                                                  |

## Navigation

`goToProblem(problem, ctx)` in `go-to-problem.ts`, context = `OpenResultContext` + `drillUp`,
`expandGroup`, `selectEdges`. Behaviour per target in [research.md](../research.md) R6. Sets
`problemCursor` to the problem key.

## Tokens and icons

`bg-amber-soft`, `text-amber-ink`, `border-amber-ink/…` per DESIGN.md; lucide `TriangleAlert`,
`Unlink` (orphan), `Copy` (duplicate), `Workflow` (flows), `Table2` (rules), `Link2Off`
(references), `CircleCheck` ("No problems"), `ChevronRight`.

## Tests

- `problems-store.test.ts`: throttling, superseded results dropped, inline client.
- `problems-client.test.ts`: FakeWorker as in `layout-client.test.ts`.
- `go-to-problem.test.ts`: each target type, collapsed group, drill scope, hidden in view, deleted
  target.
- `problems-panel.test.tsx`: rows by role/name, keyboard, empty state, cap.
- `canvas-toolbar.test.tsx`, `deck-node.test.tsx`, `deck-edge.test.tsx`, `flow-row` / `rule-list`
  tests, `confirm-delete-dialog.test.tsx`, `use-canvas-shortcuts.test.tsx` extended.
- `deck-to-flow.test.ts`: marks change → new node object; unchanged marks → cached object.
