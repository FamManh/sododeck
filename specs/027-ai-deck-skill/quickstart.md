# Quickstart: validating the AI deck skill (027)

Prerequisites: `pnpm install`, Node ≥ 24 for the repo (the shipped scripts need Node ≥ 20).

## 1. Build the skill

```bash
pnpm --filter @sododeck/skill build
ls packages/skill/dist/sododeck-deck          # SKILL.md VERSION.json references schema examples scripts
ls -l packages/skill/dist/sododeck-deck.zip
```

Expected: the tree in `contracts/skill-package.md`; building twice gives a byte-identical zip.

## 2. Run the scripts on the examples (offline)

```bash
S=packages/skill/dist/sododeck-deck
node $S/scripts/validate.mjs $S/examples/checkout.sododeck --format text   # OK …, exit 0
node $S/scripts/lint.mjs     $S/examples/checkout.sododeck --format text   # 0 problems, exit 0
node $S/scripts/summary.mjs  $S/examples/platform.sododeck                 # outline, exit 0
```

## 3. Broken deck → fixable entries (US2)

Copy `checkout.sododeck`, point one flow step's `edge` at `nope`, then:

```bash
node $S/scripts/lint.mjs broken.sododeck; echo "exit $?"
```

Expected: JSON report with an entry `code: "step-without-connection"` (or `broken-reference`),
`path: "/flows/0/steps/<i>"`, `subject`, `evidence`, `fix`; `exit 1`. `deliver broken.sododeck
target.sododeck` leaves `target.sododeck` untouched.

## 4. Update mode diff (US3)

Add a flow and a card to a copy of `checkout.sododeck`, then `diff.mjs checkout.sododeck copy.sododeck
--format text`: only `+` lines for the new objects.

## 5. Import without positions (FR-024)

`pnpm dev`, open the app, Library → Import `examples/checkout.sododeck` (no positions). Expected:
cards laid out with no overlaps, the checkout flow plays from step 1 to the last step.

## 6. Agent run (SC-001, by hand)

Install the folder as a skill in an agent (or point an `AGENTS.md` at `SKILL.md`), give it the
prompts in `packages/skill/evals/evals.json`, import each result.

## 7. Repository gates

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```
