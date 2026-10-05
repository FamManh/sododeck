# Research: Fixable import errors (062)

All decisions below resolve the plan's open points. Inputs: spec (with clarifications of
2026-10-05), the current code (`packages/schema/src/index.ts`, `semantic-rules.ts`,
`packages/model/src/{deck,errors,load-checks,assets,problems}.ts`,
`apps/app/src/storage/library-ops.ts`, `apps/app/src/library/*`, `apps/app/src/import-mermaid/*`,
`apps/app/src/db/import/*`), ADR 0013 and ADR 0020.

## R1. One problem shape: extend `Issue`, keep `Problem`

- **Decision:** `Issue` (schema package) gains a required `code` and optional `subject`,
  `evidence` and `fix`; `path` changes from a dot path to an RFC 6901 JSON Pointer. `Problem`
  (problems list) gains `path` and `subject`; its `kind` is its code. A pure function in
  `@sododeck/model` turns either into the public **problem entry** (data-model.md) for copy and
  display.
- **Rationale:** `Issue` is already produced at every refusal site (Zod mapping, S1–S15, I1–I6,
  duplicate and ambiguous ids); adding fields there keeps one producer per check. `Problem` has
  UI-only fields (`fixes`, `short`, `order`, `byObject`) that must not leak into the public shape,
  so a converter is cleaner than a merge.
- **Alternatives:** a brand-new `ProblemEntry` type produced directly by every check (rewrites ~60
  sites for no gain); keeping dot paths (not what 027 and JSON tooling expect, and ambiguous for
  `tagColors` keys holding dots or spaces).

## R2. Path format

- **Decision:** JSON Pointer built from segments (`/flows/0/steps/2/edge`), with `~` → `~0` and
  `/` → `~1`. Root is `""`. Not-JSON files use `{ line, column }` instead (R5).
- **Rationale:** standard, unambiguous for any key (`tagColors`, `rules`, `assets` map keys), what
  the 027 skill contract specifies, and resolvable by any JSON tool.
- **Impact:** existing tests asserting dot paths (`packages/schema/test/*`, `packages/model/test/
load.test.ts`, `db-grouping.test.ts`) are updated; `DeckEditError` messages read the same issues,
  so their text changes from `a.0.b:` to `/a/0/b:`. No app code parses issue paths (checked:
  only `field-writes.ts` and `step-list.tsx` read `.issues`, for the message).

## R3. Schema violations → generic codes (clarification Q3)

- **Decision:** map Zod 4 issue codes to a fixed set; the fix hint is composed from the issue
  (expected type, allowed values, bounds, key names) and the last path segment:

  | Zod issue                                 | Code                   | Fix hint pattern                                                                                    |
  | ----------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
  | `invalid_type`, input `undefined`         | `schema-required`      | Add `<field>` (`<expected>`).                                                                       |
  | `invalid_type`                            | `schema-type`          | Make `<field>` a `<expected>`.                                                                      |
  | `invalid_value`                           | `schema-enum`          | Use one of: `a`, `b`, … (first 12, then "…").                                                       |
  | `invalid_format` (regex)                  | `schema-pattern`       | Make `<field>` match `<pattern>` (id rules spelled out for id patterns).                            |
  | `too_small`, `too_big`, `not_multiple_of` | `schema-range`         | Keep `<field>` between `<min>` and `<max>`.                                                         |
  | `unrecognized_keys`                       | `schema-unknown-field` | Remove `<key>` (one entry per key, path to the key).                                                |
  | `invalid_union`                           | `schema-union`         | From the branch with the fewest issues; fall back to "Use one of the allowed shapes for `<field>`." |
  | `custom` from `uniqueItems` refine        | `schema-unique`        | Remove the repeated entry from `<field>`.                                                           |
  | anything else                             | `schema-invalid`       | Generic: "Fix `<field>` so it matches the file format."                                             |

- **Rationale:** small, stable catalogue that never drifts from the schema; `path` carries the
  precision. `json-schema-to-zod` output keeps `.strict()` objects (unknown keys reported) and
  `uniqueItems` as `.refine` (seen in `generated/zod.ts`).
- **Evidence:** the offending value, JSON-stringified and trimmed to 200 characters (`input` is
  available on Zod 4 issues when `reportInput` is on; otherwise read from the input by path).
- **Alternatives:** per-field codes (rejected in clarification Q3); deriving hints from the JSON
  Schema `description` (long prose, not an instruction).

## R4. Format rules S1–S15, I1–I7 and load checks get specific codes

- **Decision:** every semantic format rule and load check gets one kebab-case code (list in
  data-model.md §Codes), e.g. S1 → `rule-row-cells`, S4 → `group-frame-pair`, I1 →
  `image-asset-missing`, duplicate ids → `duplicate-id`, ambiguous connector end →
  `ambiguous-end`. Codes never contain the rule letter (S/I numbers are internal).
- **Rationale:** these are semantic (clarification Q3: semantic problems keep specific codes) and
  each needs its own fix hint.

## R5. One pass, deterministic order, not-JSON and version

- **Decision:** a new pure entry `inspectDeckText(text)` in `@sododeck/model` replaces the
  parsing now spread across `library-ops.importFile` and `buildDoc`:
  1. strip BOM; `JSON.parse`; on failure → one `invalid-json` entry with `{ line, column }`
     derived from the engine message (`position N` and, when present, `line L column C`); when
     neither is present, line/column are omitted.
  2. `version` greater than `FORMAT_VERSION` → one `unsupported-version` entry (evidence: the
     version found; fix: "Open it in a newer Sododeck, or write it for version 1").
  3. Zod structural check → all structural issues (R3). If any, stop here: S/I rules and id
     checks need a structurally valid file.
  4. Otherwise S1–S15/I1–I6 **and** duplicate/ambiguous id checks run together (today duplicates
     only run when the semantic rules pass), so a structurally valid file reports everything at
     once.
  5. Entries sorted by path (segment-wise, numeric segments numerically), then code, then
     message. Stable for the same file (SC-003).
- **Rationale:** FR-008 (one round) within the limit that typed checks need typed data; FR-006.
- **Alternatives:** running semantic rules on partially valid data (unsafe, typed code would see
  wrong shapes).

## R6. Damaged pictures and open-time problems (clarifications Q1 revised, Q2)

- **Decision:** files with broken references keep loading unchanged (002, `load.test.ts`
  "loads a file with dangling references"). At import, the library worker also runs `checkDeck`
  on the loaded file (pure, ~8 ms cold on a 2,000-node deck per ADR 0013, already off the main
  thread) and returns the problem entries of severity `error`/`warning` plus one
  `picture-damaged` entry per `AssetProblem` (evidence: reason; subject: picture id). The library
  shows a toast "Imported "X" with N problems" + **Show**, which opens the **import problems
  dialog** in its "opened" mode (same component as the refused mode) with the list and Copy
  problems.
- **Rationale:** one dialog for both cases; damaged pictures are not in `checkDeck` (the document
  holds a placeholder), so the import result is the only place that knows them. No new route or
  flyout plumbing.
- **Alternatives:** opening the editor with the problems flyout (does not list pictures; needs
  cross-route UI state); a `picture-missing` problems-list kind (needs blob-store knowledge in a
  pure model check).

## R7. Code catalogue: where and how it is published

- **Decision:** `packages/schema/src/issue-codes.ts` lists the codes the schema package emits
  (generic `schema-*` and format rules). `packages/model/src/problem-codes.ts` is **the catalogue**:
  every code (schema codes re-exported, load checks, problems-list kinds, fidelity codes) with
  family, default severity, title and fix hint, plus a `renderCatalogueMarkdown()` function. A
  Vitest file-snapshot (`toMatchFileSnapshot`) writes `docs/file-format/problem-codes.md`; `vitest
-u` regenerates it and CI fails when it is stale. A type-level `satisfies Record<Code, Entry>`
  plus a unit test enforce "every code has a fix hint" and "every emitted code is catalogued"
  (FR-019).
- **Rationale:** the model already depends on schema; the app depends on model; 027's generator
  (later) reads from model. Pure data, no new script, no new dependency.
- **Retired codes:** stay in the catalogue with `retired: true` and are never emitted (FR-002).
  `orphan` (removed by the ADR 0013 amendment) is the first entry so marked.
- **Site page:** the sododeck.com docs page is 027's ("Docs page on sododeck.com"); 062 publishes
  the repo document only. Noted in the plan, not a gap in FR-019's intent (the skill reads the
  same source).

## R8. Problems panel copy

- **Decision:** `checkDeck` adds `path` (pointer to the main object of `target`: `/nodes/3`,
  `/edges/7`, `/flows/1/steps/2`, `/rules/<id>`, …) and `subject` (main id) to each `Problem`,
  using index maps built once per check. The panel header gets a **Copy problems** button; the
  report is built on the main thread from the already-computed list (no extra worker trip).
- **Rationale:** the worker already has the file; index maps are O(n). Copy is user-triggered.
- **Bench:** `checkDeck` is not on the canvas render path, but it runs on every edit in the
  worker. Measure `checkDeck` on the 2,000-node bench deck before/after; budget +10 %.

## R9. Fidelity report: four groups

- **Decision:** map existing reasons without losing detail; add codes `import-mermaid-<reason>`
  and `import-db-<reason>`; severity `info`.

  | Source  | Reason / change kind                                                                  | Group         |
  | ------- | ------------------------------------------------------------------------------------- | ------------- |
  | Mermaid | `appearance`, `interaction`, `extra-diagram`                                          | left out      |
  | Mermaid | `unsupported`, `unreadable`                                                           | not supported |
  | Mermaid | `flattened`, report `notes`                                                           | collapsed     |
  | Mermaid | node declared again with a different label or shape (new, today silent: first wins)   | merged        |
  | DB      | `view` … `session`, `drop-or-rename`, `alter`, `data`, `dangling-fk`, `unknown-table` | left out      |
  | DB      | `schema` (stored on tables), `type-converted`, `type-kept`                            | collapsed     |
  | DB      | `option-dropped`, `schema-dropped`                                                    | left out      |
  | DB      | `renamed-duplicate`, `name-exists`, `enum-name-exists`                                | merged        |
  | DB      | `parse-error`, `unknown`                                                              | not supported |

  "Merged" is defined as "met another declaration, or existing deck content, of the same name;
  combined or renamed" (data-model.md). Fix hints exist where the input can be changed
  (`dangling-fk`: "Include the referenced table in the import"; `unreadable`: "Check the syntax on
  this line"), omitted for deliberate omissions like styling.

- **Audit task:** the Mermaid parser is checked for other silent folds (duplicate edges, repeated
  subgraph ids); each found becomes a `merged` or `collapsed` item with a test (SC-005).
- **UI:** both report views group items under the four headings (empty groups hidden), keep
  their current collapse rules (044: 20 per reason), and show "Everything was imported" when no
  item exists. **Copy report** in both.

## R10. Copy, fallback, limits, accessibility

- **Decision:** copy uses the existing `copyText` (feature-detected). On failure the dialog/panel
  reveals a read-only `<textarea>` with the JSON, focused and selected, plus the existing
  `couldNotCopyText` hint; success announces "Copied problems" via the toast live region.
  Limits: list shows 500 rows then "and N more"; copy holds up to 5,000 entries and
  `omitted: N`; evidence trimmed to 200 characters with `…`.
- **Rationale:** reuses platform helpers (constitution IV/VIII), keyboard and screen-reader
  reachable (VII).

## R11. App identification in the report

- **Decision:** the report carries `schema` (`SCHEMA_URL`), `formatVersion` (`FORMAT_VERSION`)
  and `app` (`apps/app/package.json` version via a Vite `define`, `__APP_VERSION__`; `0.0.0` today).
  No timestamp, so two copies of the same file are byte-identical (SC-003).

## R12. Worker boundary

- **Decision:** `LibraryOpError` gains an optional `problems: ProblemEntry[]` (structured-clone
  safe plain data), carried through `LibraryClientError`. `importFile` returns
  `{ …, openProblems: ProblemEntry[] }` instead of the bare `AssetProblem[]` count.
  `importMessage()` stays for the toast fallback paths (several files, unknown errors).
- **Large inputs:** 10,000 entries cross the boundary as plain objects (~2 MB), well inside
  structured-clone limits; the dialog virtualises nothing (500 rendered rows), keeping SC-004.
