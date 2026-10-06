# Research: AI deck skill (027)

Each decision: what was chosen, why, what else was considered.

## R1. Where the skill lives and how it ships

- **Decision**: A new workspace package `packages/skill` (`@sododeck/skill`) holds the sources
  (Markdown, script sources in TypeScript, example decks, eval prompts). Its `build` writes the
  finished skill to `packages/skill/dist/sododeck-deck/` and a deterministic archive
  `packages/skill/dist/sododeck-deck.zip`. Nothing generated is committed. The marketing site copies
  the archive into its build output as `/downloads/sododeck-deck.zip`.
- **Rationale**: generated files in git drift and make noisy diffs (a bundled script is hundreds of
  kilobytes). Building on every `pnpm build` means the shipped skill can only drift if the build is
  skipped; the drift test (R9) covers the rest. A package keeps the boundary clean: `skill → model →
schema`, the same direction as the app.
- **Alternatives**: committing `skills/sododeck-deck/` at the repo root (the spec's first guess):
  easy to browse, but needs a regenerate-and-check step for every schema change and stores bundles
  in git. A separate public repository: waits on the open-source decision; can be added later by
  publishing the same `dist/` folder.
- **Spec impact**: the Assumption "Location and distribution" is updated to this layout.

## R2. Script runtime and bundling

- **Decision**: Scripts are written in TypeScript in `packages/skill/src/cli/` and bundled with
  **esbuild** into one self-contained ES module, `scripts/sododeck.mjs` (platform node, target
  `node20`), plus four three-line entry files `validate.mjs`, `lint.mjs`, `summary.mjs`,
  `diff.mjs` (and `deliver.mjs`) that call it. The bundle includes `@sododeck/model`,
  `@sododeck/schema`, Zod and Yjs; no `node_modules` is needed on the user's machine.
- **Rationale**: lint must run the app's own problem logic (`inspectDeckText`, `checkDeck`,
  `problemEntries`), which lives in TypeScript packages; bundling is the only way to ship it as
  "copy the folder and run". One bundle avoids loading the model five times. `node20` is the oldest
  maintained runtime most agent sandboxes ship; the code uses nothing newer.
- **Dependency**: `esbuild` as a **devDependency** of `@sododeck/skill` only (already in the lockfile
  at 0.28.x through Vite; no new code reaches the app or site bundles; no runtime dependency, so no
  founder approval is needed under constitution VIII, but it is stated here).
- **Alternatives**: Vite library mode (heavier configuration for a Node target), shipping
  TypeScript and requiring `tsx` (an install step for the user), rewriting the checks in plain
  JavaScript (two copies of the rules: the drift the feature exists to avoid).

## R3. What validate and lint each check

- **Decision**:
  - `validate` = `inspectDeckText(text)` from `@sododeck/model`: not JSON, newer version, schema
    violations, format rules, duplicate / ambiguous ids (entries of the refused result), plus the
    load warnings of an accepted file (damaged pictures, trimmed crops). Problems-list kinds are not
    part of validate.
  - `lint` = validate's result; when the file is refused, lint prints exactly that and stops. When it
    loads, lint adds every problems-list entry (`checkDeck` → `problemEntries`, the app's codes and
    fix hints) and the skill's **authoring checks** (R5), sorted by `sortEntries`.
- **Rationale**: same code path as the app's import (062), so the skill and the app's
  **Copy problems** cannot disagree (FR-012, SC-004). Splitting keeps validate cheap and its meaning
  simple ("would the app open it?").
- **Alternatives**: one `check` command (spec and backlog name two; agents find the split clearer
  when the repair loop says "validate first").

## R4. Output shape, exit codes, plain text

- **Decision**: JSON by default for validate, lint and diff; text by default for summary; `--format
json|text` switches. Problem output is 062's `sododeck-problems` report (`reportVersion` 1) with
  `source: { kind: "file", name }`, `status` `refused` (cannot load) or `opened`, and `app` set to
  `sododeck-deck-skill <skill version>`. Exit codes: `0` no `error` entries (warnings allowed), `1`
  at least one `error`, `2` usage or file-system error (message on stderr). Text form, one line per
  entry: `ERROR step-without-connection /flows/0/steps/2 [checkout] Step 3 …` then `  fix: …`.
- **Rationale**: reuses a published contract (062 `contracts/problem-report.md`); adding authoring
  codes is additive (new codes only), so `reportVersion` stays 1. Exit codes follow common CLI
  practice so an agent can branch on them without parsing.

## R5. Authoring checks: rules, codes, thresholds

New catalogue family `authoring` in `packages/model/src/problem-codes.ts` (heading "Authoring
checks (AI deck skill)"), all severity `warning`, so `docs/file-format/problem-codes.md` lists them
and codes never clash with the app's.

| Code                       | Rule                                                                                                                                                                   | Notes                                                                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id-style`                 | an id longer than 32 characters, or containing upper-case letters or spaces-turned-separators like `__`, or equal to the slug of its title when the title has 4+ words | "Looks derived from a title" cannot be proven; long, title-shaped ids are the signal. A short slug that matches a short title (`api` / "API") is fine and recommended.                                                          |
| `positions-mixed`          | some cards have `position`, others not                                                                                                                                 | Skipped with `--mode update` (new cards next to placed ones are expected, FR-024 places them).                                                                                                                                  |
| `orphan-card`              | a card with no connector, not in a group, no children (`parent`), not touched by a flow step                                                                           | The retired app code `orphan` stays retired; this is a new code for authoring only. The spec's "marked as intended in its note" escape was dropped: notes are free text and the agent can state intent in its handover instead. |
| `duplicate-title`          | two cards with the same title (case and spaces ignored) in the same group and level                                                                                    |                                                                                                                                                                                                                                 |
| `label-too-long`           | card or group title over 40 characters; connector label over 32                                                                                                        | Budgets from DESIGN.md card widths (240 px default, ~40 characters before truncation).                                                                                                                                          |
| `level-over-budget`        | more cards on one level (same `parent`) than the detail dial allows: `faithful` 24, `balanced` 12 (default), `simplified` 7                                            | "Per view" in the spec is measured per level: a level is what one drill-in screen shows. Groups organise a level but do not reduce its count.                                                                                   |
| `connector-without-source` | `--mode codebase`: a connector or card without a `links` entry                                                                                                         | Phase 2.                                                                                                                                                                                                                        |

- **Rationale**: warnings, not errors, because taste rules have exceptions; the instructions ask the
  agent to clear them or name them in the handover (FR-015).

## R6. Format revision until 025 exists

- **Decision**: 025 (format revision) is deferred, so there is no `FORMAT_REVISION` yet. The skill
  stamps a **schema fingerprint** instead: the first 12 hex characters of the SHA-256 of
  `packages/schema/schema/v1.json`, together with `formatVersion` (1) and the skill version
  (`1.0.0+<fingerprint>`). They go into
  `SKILL.md` and `VERSION.json`. When 025 lands, `revision` is added to the same file.
- **Rationale**: a fingerprint changes exactly when the format changes, which is what "the skill is
  behind the app" means; the drift test compares it.

## R7. Facts in the references are generated

- **Decision**: reference sources in `packages/skill/content/` are Markdown with a few placeholders
  the build fills from the packages: `{{cardTypes}}` (table from `CARD_TYPES` / `PACKS`),
  `{{authoringCodes}}` and `{{deckCodes}}` (tables from `CATALOGUE`), `{{formatVersion}}`,
  `{{fingerprint}}`, `{{skillVersion}}`. Everything else is prose written by hand.
- **Rationale**: type ids and codes are where a hand-kept copy would rot first.

## R8. Archive

- **Decision**: a small zip writer in `packages/skill/scripts/zip.ts` (deflate via `node:zlib`,
  CRC-32 via `zlib.crc32`, fixed 1980-01-01 timestamps, files sorted), so the archive is
  byte-identical for the same input.
- **Alternatives**: a zip dependency (a new dependency for ~80 lines), tar.gz (agent skill uploads
  expect zip).

## R9. Drift test (FR-004, SC-006)

- **Decision**: `packages/skill/test/build.test.ts` builds into a temporary directory and asserts:
  bundled `schema/v1.json` equals `@sododeck/schema`'s; the fingerprint matches; every code in the
  generated tables exists in `CATALOGUE` with the same fix; every example passes validate and lint
  with zero entries; the bundle imports no network module (`node:http`, `node:https`, `node:net`,
  `node:tls`, `node:dgram`, `undici`) and never calls `fetch` (esbuild metafile + text scan);
  `SKILL.md` stays under 500 lines and every reference it names exists.

## R10. App side: placing unplaced cards on import (FR-024)

- **Decision**: `importFile` in the library worker already loads the file; when at least one card
  has no `position`, it also returns the plain file (`unplaced: SododeckFile`). `importDeckFile`
  then runs the existing layout worker with every positioned card **pinned** (`LayoutRequest.pinned`,
  `applyPins` keeps them exact and pushes free cards off them), writes positions for the unplaced
  cards only, fits frames for groups that have none, and imports the placed text through
  `importFile` again (the same route Mermaid import uses). The first pass's open report is kept.
  The request builder moves from `import-mermaid/layout-input.ts` to
  `apps/app/src/layout/place-unplaced.ts` and gains pins; Mermaid import calls it with no pins.
  Connector ends that are stickies or images are left out of the layout request (the layout knows
  cards and groups only).
- **Rationale**: reuses the off-main-thread layout (constitution V) and the single import route
  (constitution II); a fully placed deck takes the old path unchanged.
- **Alternatives**: laying out inside the library worker (the ELK worker is separate by design,
  ADR 0012); placing unplaced cards on a grid (stacks them meaninglessly; SC-005 asks for no
  overlaps, which `applyPins` already guarantees).

## R11. Skill writing practice

From the skill-authoring guidance used for this feature:

- Frontmatter `name: sododeck-deck` and a `description` that says what it does **and** when to use
  it, slightly pushy ("use whenever the user wants an architecture / flow diagram or a `.sododeck`
  file, even if they don't name Sododeck"), since agents tend to under-use skills.
- `SKILL.md` is a short router (target < 150 lines, hard limit 500): workflow, mode table pointing
  to one reference each, the repair loop, handover format. References say at the top when to read
  them; any reference over 300 lines gets a table of contents.
- Deterministic work goes to scripts (validate, lint, summary, diff, deliver); prose explains _why_
  (stable ids keep a user's views and notes attached) rather than stacking MUSTs.
- `evals/evals.json` in the package holds 3 realistic prompts with expected outcomes (checkout from
  a description, add a refund flow to an example deck, fix a broken deck), used for acceptance runs
  and kept out of the shipped archive.

## R12. Phase 3 (render) is planned, not built in this pass

- **Decision**: phase 3 needs a headless render entry built from `apps/app` plus an ADR (FR-029) on
  how it is packaged; it is tracked in tasks as a later phase and not implemented now. Phase 2's
  instructions (codebase, text formats, fidelity report) and its one lint rule are small and are
  built with phase 1.

## R13. Revision after the first real deck (2026-10-05)

The first deck the skill produced for a real system (Auto Work Order, 9 features, 13 entry points)
was compared with the team's hand-drawn boards. Findings and decisions:

- **No default card budget.** The default `balanced` (12 per level) pushed the agent to merge use
  cases ("Manual Job Use Cases"), losing what the boards show. A large system makes a large deck;
  `level-over-budget` now runs only when the user asks for `balanced` or `simplified`.
- **Features and views carry readability.** The skill now asks for one feature per capability, an
  Overview view first, then one feature view per feature listing its cards; the app lays each such
  view out on import (`view.positions`, `groupFrames`).
- **Explanations in descriptions and step notes, not stickies.** Long notes covered cards.
- **From-diagrams mode** with an `outline` command for whiteboard files: boards are often megabytes
  of JSON with labels drawn over shapes rather than bound to them.
- **App placement measured cards wrongly** (160 × 72 fallback instead of the drawn size) and ignored
  anchored notes: 35 overlaps on the real deck, 0 after measuring with `cardSize` and slotting
  notes under their cards.
