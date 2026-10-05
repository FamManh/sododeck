# 0038. Deck files use the `.sododeck` extension; Mermaid import reads flowcharts and sequence diagrams

- **Status:** Proposed
- **Date:** 2026-10-05
- **Feature:** `specs/056-file-format-and-mermaid-import`
- **Builds on:** 0002 (file format), 0020 (format revision), constitution II, IV, VIII

## Context

Founder feedback: `.sododeck.json` is long and reads as "just JSON". Decks should be recognisable
files. People also arrive with diagrams written in Mermaid.

## Decision

- **Extension.** New saves are named `<name>.sododeck`. The content is the same JSON; no `version`,
  `revision` or schema change. Opening decides by content, so `.sododeck`, `.sododeck.json`, `.json`
  and renamed files all open. No stored deck is migrated (they live in the browser, not as files).
- **Not renamed.** Bundled sample file names and the internal Monaco model path stay: they are not
  user-visible.
- **Mermaid import.** A hand-written parser for the `flowchart`/`graph` and `sequenceDiagram`
  subsets (no dependency) runs in the library worker and emits a plain deck file; the existing
  import validates and stores it. Flowchart shapes map to Basic shapes; a sequence diagram becomes
  one flow with one step per message. Anything unsupported is reported, never silent. ER diagrams
  are a later feature (database pack).

## Consequences

- One constant and one name function cover every save path; docs and labels change.
- The hand-written parser must be kept to the documented subset; extending it is a feature, not a fix.
- Operating systems have no registered handler for `.sododeck`; double-click does not open the app.
  Acceptable for a web app; revisit if a desktop wrapper appears.
- Alternatives rejected: keeping `.sododeck.json` (the founder's request); the official Mermaid
  package (size, DOM, rendering concerns); mapping `alt/else` to flow branches now (ambiguous).
