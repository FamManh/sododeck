# 0039. Problems have public, stable codes and one copyable report shape

- **Status:** Accepted
- **Date:** 2026-10-05
- **Feature:** `specs/062-fixable-import-errors`
- **Builds on:** 0013 (derived problems), 0002 (file format), 0038 (Mermaid import), constitution
  II, IV, VI

## Context

People ask their AI for a deck, import the file, and it is refused with one generic toast. The
details the app already found (which field, what is wrong) are thrown away, so the user has
nothing to hand back to the AI. Decks that open with damaged pictures or problems, and imports
from Mermaid / SQL / DBML, say little about what did not come across. The AI deck skill (027) will
validate and lint files outside the app and must speak the same language.

## Decision

- **One public problem entry.** Every refusal reason (not JSON, newer version, schema violation,
  format rule, duplicate or ambiguous id), every damaged picture and every problems-list entry is
  described by `{ code, severity, path, line?, column?, subject?, message, evidence?, fix }`.
  `Issue` (schema) grows `code`, `subject`, `evidence`, `fix`; `Problem` (model) grows `path`,
  `subject`; a pure converter in `@sododeck/model` builds the public entry, so UI-only fields of
  `Problem` never leak.
- **Paths are RFC 6901 JSON Pointers** (`/flows/0/steps/2/edge`, root `""`), replacing dot paths;
  a file that is not JSON gets `line` / `column` instead.
- **Schema violations use generic codes** per violation type (`schema-required`, `schema-type`,
  `schema-enum`, `schema-pattern`, `schema-range`, `schema-unknown-field`, `schema-union`,
  `schema-unique`, `schema-invalid`). The exact field is in `path`; the fix hint is composed from
  the violation (expected type, allowed values, bounds). Format rules, load checks and every
  problems-list kind keep one specific code each; problems-list kinds keep their names.
- **One catalogue** in `@sododeck/model` (`problem-codes.ts`) lists every code with family,
  default severity, title and a one-sentence fix hint, typed `satisfies Record<Code, …>`.
  `docs/file-format/problem-codes.md` is generated from it by a Vitest file snapshot; CI fails when
  it is stale.
- **Stable codes.** A released code never changes meaning and is never reused. A code that stops
  being emitted stays in the catalogue marked retired (`orphan` is the first).
- **Reports are plain JSON** (`sododeck-problems` and `sododeck-import`, `reportVersion: 1`),
  pretty-printed, keys in a fixed order, no timestamp, so the same file copies to the same bytes.
  They go only to the clipboard, on a user action.

## Consequences

- Problem locations of the problems list are computed on demand (`problemLocator(file)`), not
  inside `checkDeck`: adding them there cost about +17 % on the 2,000-node bench deck, which the
  problems worker runs on every edit (`specs/062-fixable-import-errors/bench-after.md`).
- The library worker returns the ready report with a refused or opened import, and the report
  shapes and `stringifyReport` live in the type-only subpath `@sododeck/model/report-json`, so the
  library route copies reports without loading the model.
- Test expectations that asserted dot paths change once, mechanically.
- `DeckValidationError` / `DeckEditError` messages read `/a/0/b: …` instead of `a.0.b: …`.
- The 027 skill reuses the catalogue document and the report contract instead of inventing its own.
- Adding a check means adding a catalogue entry with a fix hint; the type and a unit test enforce it.
- Alternatives rejected: per-field schema codes (catalogue drifts with every schema change); dot
  paths (ambiguous for map keys with dots or spaces); a brand-new entry type produced directly by
  every check (rewrites ~60 sites for no gain); a separate generator script for the doc (a file
  snapshot needs no new tooling).
