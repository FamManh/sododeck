# Implementation Plan: File format and Mermaid import

**Branch**: `056-file-format-and-mermaid-import` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/056-file-format-and-mermaid-import/spec.md`

## Summary

Two independent slices.

1. **`.sododeck` extension.** Every save names the file `<name>.sododeck`; the bytes are unchanged
   (same JSON, same revision). Every open path accepts `.sododeck`, `.sododeck.json` and `.json`
   and decides by content (it already does: `importFile` parses JSON and validates). The change is
   file names, the file chooser `accept` lists, labels and docs. No schema change.
2. **Mermaid import.** A small in-repo parser reads `flowchart`/`graph` and `sequenceDiagram` text
   in the library worker and returns a plain deck object (the same shape as a `.sododeck` file,
   without positions) plus an import report. The main thread places the nodes (ELK layout worker
   for flowcharts, a fixed row for sequence diagrams), computes group frames, and hands the result
   to the existing `importFile` path, so validation, ids and storage are the ones every import
   already uses. A dialog takes pasted text or a file, then shows the report.

## Technical Context

**Language/Version**: TypeScript strict (`noUncheckedIndexedAccess`), Node ≥ 24, pnpm monorepo

**Primary Dependencies**: existing only (React 19, Yjs via `@sododeck/model`, Dexie, ELK in the
existing layout worker, Radix dialog via `@sododeck/ui`). **No new dependency**: the Mermaid
grammar subset is a hand-written line parser (research R1).

**Storage**: unchanged. Imported decks are stored like any imported file (library worker →
`insertDeck`). No new table, no schema or `FORMAT_REVISION` change.

**Testing**: Vitest (parsers table-driven; deck builder; layout request builder; file-name and
`accept` helpers; import hook), Testing Library for the dialog (roles and labels). Existing model
round-trip tests cover the produced deck: an importer test round-trips every fixture through
`fromJSON` → `toJSON`. No new e2e (AGENTS.md); smoke suite must stay green.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox, Safari.

**Project Type**: monorepo web app; this feature lives in `apps/app` only.

**Performance Goals**: 30-node/2-subgraph flowchart → open deck < 3 s; 500-node flowchart: parse and
build in the worker, layout in the layout worker, no main-thread task over 100 ms (SC-004);
`pnpm bench` is not required (no canvas change).

**Constraints**: no network with content (R: the dialog and parser make no request); text never
interpreted as markup (rendered by React as text only); tokens only; keyboard-operable dialog.

**Scale/Scope**: input ≤ 512 KB, ≤ 2,000 nodes, ≤ 4,000 links/messages; above that import is refused
with a message (FR-018).

## Constitution Check

_GATE: passed before Phase 0, re-checked after Phase 1._

| Principle                                    | Result                                                                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | Pass. The importer produces a file object and the existing import turns it into the Yjs document; nothing is kept in Zustand beyond dialog UI state (text, report).                               |
| II. Schema-owned format, lossless round-trip | Pass. The importer emits `SododeckFile`; all Yjs ↔ JSON stays in `@sododeck/model` (`fromJSON` inside `importFile`). Extension change leaves the content identical. Fixtures round-trip in tests. |
| III. Stable identity                         | Pass. Ids are generated (counters/random per kind), never the Mermaid ids or titles; Mermaid ids are used only inside the parser to join links (FR-009).                                          |
| IV. Local-first, private                     | Pass. No network. Text read from a pasted string or `File.text()`; no schema or parser fetch.                                                                                                     |
| V. Performance off the main thread           | Pass. Parse + build in the library worker, layout in the layout worker. Only a small positions merge and the dialog run on the main thread.                                                       |
| VI. Strict types, tested behaviour           | Pass. Parser/builder are pure; table-driven tests; dialog tested by roles. No e2e added.                                                                                                          |
| VII. Accessible                              | Pass. Dialog is keyboard operable with labelled textarea and file button; report is a labelled list; state not conveyed by colour alone.                                                          |
| VIII. Simplicity, justified dependencies     | Pass. No dependency (R1). One ADR (0038) for the extension decision.                                                                                                                              |

No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/056-file-format-and-mermaid-import/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── file-naming.md        # extension, accept lists, detection order
│   └── mermaid-mapping.md    # accepted grammar and the mapping to deck objects
└── tasks.md                  # /speckit-tasks
```

### Source Code (repository root)

```text
apps/app/src/
├── storage/
│   ├── download.ts                  # + DECK_EXTENSION, deckFileName(name)
│   ├── library-ops.ts               # + importMermaid(text) → { file, report }  (worker op)
│   ├── library-worker-protocol.ts   # + 'importMermaid'
│   ├── library.worker.ts            # + handler
│   └── library-client.ts            # + importMermaid()
├── import-mermaid/                  # new, pure, UI-free
│   ├── detect.ts                    # diagram type, fences, front matter, comments
│   ├── parse-flowchart.ts           # lines → { direction, nodes, links, subgraphs, skipped }
│   ├── parse-sequence.ts            # lines → { participants, messages, title, skipped }
│   ├── flowchart-to-deck.ts         # parsed → SododeckFile (no positions) + report
│   ├── sequence-to-deck.ts          # parsed → SododeckFile (row positions, one flow) + report
│   ├── shape-map.ts                 # Mermaid shape → type id (contracts/mermaid-mapping.md)
│   ├── layout-input.ts              # file → LayoutRequest, positions + group frames back
│   ├── import-report.ts             # report type + summary text
│   └── *.test.ts
├── layout/elk-layout.ts             # + optional request.direction ('RIGHT' default)
├── library/
│   ├── use-import-files.ts          # content-based: deck file vs Mermaid; message text
│   ├── import-button.tsx            # accept list; label
│   ├── import-mermaid-dialog.tsx    # paste / choose file → report → Open
│   └── library-actions.ts           # exportDeckFile name; importMermaidDeck()
├── editor/use-export-deck.ts        # name
├── editor/shell/deck-menu.tsx       # accept list; label
├── editor/export/formats.ts         # subtitle '.sododeck'
└── samples/                         # file names stay (not user-visible); see R6
docs/decisions/0038-sododeck-extension.md
```

**Structure Decision**: all code in `apps/app`. The parsers sit in their own folder with no React
or Dexie imports so they run in the library worker and in tests unchanged. Nothing is added to
`packages/*`: the importer targets the public file type and the model's existing import.

## Design decisions (see research.md)

- **R1** hand-written parser, no dependency.
- **R2** detection by content first, extension second.
- **R3** flowchart nodes become shape types (they map one to one); sequence participants become
  cards (`component`, `database`, `queue`) or the `actor` shape.
- **R4** sequence diagram → one flow, one step per message, edges per ordered pair.
- **R5** layout: ELK with a direction option for flowcharts; row layout for sequence diagrams;
  group frames from member boxes.
- **R6** old extension handling and sample file names.
- **R7** import UI: a dialog opened from a new "Import Mermaid" button; the Import button also
  recognises Mermaid files by content.

## Post-design re-check

Constitution Check unchanged after Phase 1: the data model adds no stored entity, the contracts
describe file names and a mapping only.

## Complexity Tracking

_None._
