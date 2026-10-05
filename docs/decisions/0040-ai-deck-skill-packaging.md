# 0040. The AI deck skill is built from the repo and runs the app's own checks

- **Status:** Accepted
- **Date:** 2026-10-05
- **Feature:** `specs/027-ai-deck-skill`
- **Builds on:** 0002 (file format), 0013 (derived problems), 0039 (problem codes), constitution
  II, IV, VIII

## Context

Users want their own AI agent to write decks they can import. The agent needs instructions it can
follow and a way to check its file before handing it over. Those checks must say exactly what
Sododeck would say (062's codes, paths and fix hints), or the user ends up between two judges that
disagree. The schema and the problems list change often; a hand-kept copy of either in a skill
would fall behind within weeks.

## Decision

- **A workspace package, `packages/skill` (`@sododeck/skill`)**, holds the skill's Markdown
  sources, example decks and script sources. Its build writes `dist/sododeck-deck/` and a
  deterministic `dist/sododeck-deck.zip`; nothing generated is committed. The marketing site
  copies the zip into its build (`/downloads/sododeck-deck.zip`) next to `/docs/ai-skill`.
- **The scripts run the app's code.** `validate` and `lint` call `@sododeck/model`'s
  `inspectDeckText`, `checkDeck` and `problemReport`; the CLI is bundled with esbuild (a
  devDependency of this package only) into one self-contained ES module for Node 20+, so the user
  copies a folder and runs it, with no install step.
- **Facts are generated.** Card types, problem-code tables, the file-format version and a schema
  fingerprint are filled into the Markdown at build time. A test builds the skill in a temporary
  folder and fails when the bundled schema, codes or fix hints differ from the packages, when the
  bundle imports a network module, or when two builds give different archives.
- **Skill-only advice has catalogue codes.** Authoring checks (id style, mixed positions, orphan
  cards, duplicate titles, label length, cards per level, source links) are a new `authoring`
  family in the model's catalogue, always warnings, never reported by the app, so codes never
  clash.
- **Until the format revision (025) exists, the skill names the schema by fingerprint** (first 12
  hex characters of the SHA-256 of `v1.json`) next to `formatVersion`.
- **The app lays out unplaced cards on import.** (Amended by 0042: the skill now places every
  card; the import layout remains for files without positions.) Decks from the skill leave positions out; the
  library worker returns such a file as `ImportedDeck.unplaced`, and `importDeckFile` places it
  level by level with the layout worker (placed cards pinned) before storing it.

## Consequences

- Any change to the schema, the problems list or the catalogue reaches the next download
  automatically; the drift test keeps the build honest.
- The bundle is about 0.9 MB (0.22 MB zipped) because it carries the model, Yjs and Zod; that is
  the price of one source of truth.
- The render self-check (phase 3 of 027) needs the app's layout and export in a headless entry; it
  gets its own decision before it is built.

## Alternatives considered

- **Committing the generated skill** (`skills/sododeck-deck/`): browsable, but a regenerate step
  for every schema change and large bundles in git.
- **Re-implementing the checks in plain JavaScript inside the skill**: two copies of every rule,
  the drift this decision exists to prevent.
- **Shipping TypeScript and requiring `tsx`**: an install step on the user's machine and a network
  fetch, against "copy the folder and run".
