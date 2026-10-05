# @sododeck/skill

**Responsibility:** builds the AI deck skill (`sododeck-deck`, spec 027): the folder a user's own AI
agent reads to write or update a valid `.sododeck` deck, with offline scripts that check it. Nothing
here runs in the app; the app never sends deck content anywhere (constitution IV).

**Boundaries**

- Depends on `@sododeck/model` and `@sododeck/schema` only (`skill → model → schema`). The scripts
  load and check decks **only** through the model (`inspectDeckText`, `checkDeck`,
  `problemEntries`, `problemReport`), so the skill and the app's Copy problems never disagree. Never
  re-implement a check the model has.
- Authoring-check codes live in the model's catalogue (`packages/model/src/problem-codes.ts`,
  family `authoring`); the checks themselves are in `src/authoring.ts`.
- Generated output (`dist/`) is never committed. The site copies `dist/sododeck-deck.zip` into its
  build (`apps/site/scripts/copy-skill.mjs`).

**Layout**

- `content/` Markdown sources: `SKILL.md` (router, < 500 lines) and `references/*.md`
  (`layout.md` teaches the hand layout the layout checks enforce). Facts come
  from `{{placeholders}}` filled by `src/generate.ts` (`cardTypes`, `deckCodes`, `authoringCodes`,
  `formatVersion`, `fingerprint`, `skillVersion`); an unknown placeholder fails the build.
- `examples/*.sododeck`: hand-written decks; tests require zero lint entries, a position on every
  card and note (ADR 0042: skill decks are hand-laid) and playable flows.
- `src/`: `authoring.ts` (incl. the layout checks: positions, connector over card, frames;
  assumed card box `CARD_BOX` 184 × 96), `lint.ts` (validate / lint reports), `diff.ts`, `summary.ts`, `text.ts`
  (plain-text output), `cli/main.ts` (commands, exit codes, `deliver`), `version.ts` (schema
  fingerprint), `generate.ts`.
- `scripts/build.ts` (esbuild bundle → `scripts/sododeck.mjs`, entry files, deterministic zip via
  `scripts/zip.ts`).
- `evals/evals.json`: acceptance prompts for agent runs; not shipped.

**Commands:** `pnpm --filter @sododeck/skill build` (→ `dist/sododeck-deck/`, `dist/sododeck-deck.zip`),
`test` (includes a full build in a temp folder: drift, no network modules, byte-identical zip).

**Writing the skill:** explain why, not only what; keep `SKILL.md` a router and put detail in one
reference per task; deterministic work belongs in a script. Don't name other diagram or database
tools (formats such as Mermaid, C4 and OpenAPI are fine).
