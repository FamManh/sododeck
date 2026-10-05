# Research: File format and Mermaid import

## R1. Parser: hand-written subset, no dependency

- **Decision**: a line-oriented parser for the subset in `contracts/mermaid-mapping.md`, in plain
  TypeScript, running in the library worker.
- **Rationale**: the official Mermaid parser needs a DOM and pulls a large bundle (rendering,
  layout, many diagram types); we need only structure, not drawing. Constitution VIII and AGENTS.md
  ask us to avoid runtime dependencies without approval. The accepted grammar is small and
  well-defined; unknown lines are reported, not fatal, so a partial grammar degrades gracefully.
- **Alternatives**: the Mermaid package (rejected: size, DOM, security surface, and it renders
  rather than exposes a stable AST); a PEG/parser-generator dependency (rejected: a new dependency
  for ~300 lines).

## R2. Opening files: content decides

- **Decision**: `importFile` stays the single parser of deck files and already rejects non-JSON and
  invalid decks, so name checks are not added there. The `accept` list of file inputs gets
  `.sododeck,.json,application/json` (`.sododeck.json` ends in `.json`). The Import hook tells
  Mermaid from a deck by trying deck JSON first when the text starts with `{`, otherwise by Mermaid
  keywords; extensions `.mmd`, `.mermaid` mark Mermaid but never override content.
- **Rationale**: renamed or extension-less files still open (spec edge case); one detection order
  is testable. A `.sododeck` MIME type is unknown to browsers, so `accept` lists the extension.
- **Alternatives**: extension-only detection (rejected: brittle, fails on renamed files).

## R3. Flowchart shapes map to shape types

- **Decision**: the Basic shapes pack already has `rectangle`, `rounded-rectangle`, `ellipse`,
  `diamond`, `pill`, `cylinder`, `document-shape`, `parallelogram`, `hexagon`, `actor`: Mermaid's
  `[ ]`, `( )`, `(( ))`, `{ }`, `([ ])`, `[( )]`, `[[ ]]` (as rectangle), `[/ /]`, `{{ }}`, etc. map
  one to one (table in the contract). Imported flowchart decks turn on the `shapes` pack.
- **Rationale**: a flowchart is about shape; cards would lose that. No new type is needed.
- **Alternatives**: all nodes as the `component` card (rejected: loses decision diamonds and
  terminators, the main information a flowchart carries beyond text).

## R4. Sequence diagram → one flow

- **Decision**: participants → components (`actor` shape for `actor`, `component` card for every other participant; typed participants such as databases are not read). Messages → steps of a single flow in source order. Edges: one per ordered
  `(from, to)` pair, created on first use, reused after. Edge `label` is the message label when all
  messages on that edge share it, otherwise empty; each step's `title` is its own message label.
  Dashed arrows (`-->>`, `--)`) set the edge `style.dash = 'dashed'` when every message on the edge
  is dashed. `alt/opt/loop/par/critical/break` blocks are flattened: messages keep reading order;
  the block label goes into the first covered step's `notes` as `alt: <label>`; the report says
  branching was flattened. Notes and activations are skipped, listed in the report.
- **Rationale**: the model already represents "ordered steps over connections" (flows). Branch
  objects exist but mapping `alt/else` to them is a follow-up (risk of wrong semantics).
- **Alternatives**: map `alt/else` to branches now (rejected: ambiguous semantics, bigger test
  surface; deferred and recorded).

## R5. Layout

- **Decision**: flowchart: reuse `computeLayout` and the layout client; add an optional
  `direction` to `LayoutRequest` (`'RIGHT'` default so Tidy is unchanged) → `TB/TD` = `DOWN`,
  `BT` = `UP`, `LR` = `RIGHT`, `RL` = `LEFT`. Node sizes come from the shape registry
  (`defaultSize`). Group frames = bounding box of members plus the same padding the layout uses
  (`laidOutFrames` logic), computed in a pure function so it works without an editor instance.
  Sequence: participants in a left-to-right row in order of appearance, fixed gap; no ELK.
- **Rationale**: no new layout code; ELK already handles compounds. Direction is a one-line option.
- **Alternatives**: positionless nodes left to the canvas default (rejected: overlapping cards).

## R6. Old extension and sample files

- **Decision**: no migration of stored decks (they live in IndexedDB, not as files). Bundled sample
  files keep their `.sododeck.json` names: they are source assets imported by the build, never
  shown to users; renaming ~9 files is noise. The Monaco model path and its `*.sododeck.json`
  fileMatch are internal (the JSON panel is read-only) and stay; the contract notes it.
- **Alternatives**: rename samples and Monaco match (rejected for now; cheap to do later).

## R7. Import UI

- **Decision**: a new **Import Mermaid** button next to Import opens a dialog: a labelled textarea
  (paste), a "Choose file" button, an Import button; after success the dialog shows the report
  (counts, skipped list) and an **Open deck** button; failure shows an inline message and keeps the
  text. The Import button accepts Mermaid files too (content detection) and shows the report in the
  same dialog. No DESIGN.md frame exists for this; it follows existing dialog and button patterns
  and is flagged in the final report.
- **Alternatives**: a single menu (rejected: changes an existing control the smoke suite touches).

## R8. Limits and safety

- **Decision**: refuse input over 512 KB, 2,000 nodes or 4,000 links/messages with a clear message.
  Titles are stored as plain strings: `<br/>` becomes a newline, other tags are removed, HTML
  entities decoded, markdown-ish markers kept as text. Max title length is the schema's `Text`.
- **Rationale**: bounds worker time and deck size; text is never interpreted (FR-019).
