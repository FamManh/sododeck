# Implementation Plan: Database Architecture Link

**Branch**: `049-db-architecture-link` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/049-db-architecture-link/spec.md`

## Summary

Make the schema and the architecture one model. Most of the plumbing already exists: a table's
owner is `node.parent`, drill-in already scopes by `parent` and already draws one dashed outside
proxy per outside table, `removeNode` already un-parents children, and SQL export already has a
`database` scope and writes foreign keys to outside tables as comments. The new work is:

1. **File format**: one optional `touches` list on a flow step (decision in
   [research.md](research.md) R1, ADR 0035).
2. **Model**: ops to edit a step's touches, cleanup of touches when a table or column is deleted,
   integrity checks, and an "owner" op for move / remove-from-card.
3. **Database card face**: "n tables inside" and the deck dialect chip.
4. **Authoring**: set `parent` on tables created while drilled into a card; "Move to database…" and
   "Remove from card" actions; delete-card confirmation text; a "Touches" section in the step
   inspector.
5. **Playback**: a card chip ("writes orders +1") at architecture level; lit tables and highlighted
   column rows when drilled in; the step player names tables it cannot light.
6. **Export SQL** action on a database card (reuses the existing `database` scope).
7. **Samples**: Shop, SaaS auth, Blog as `.sododeck.json` files picked up by the existing samples
   test.

Technical approach: reads go through the deck snapshot, writes through `DeckEditor` ops in
`packages/model`, UI-only state stays in the Zustand store, and nothing new is stored outside the
Yjs document (constitution I).

## Technical Context

**Language/Version**: TypeScript 5 (strict, `noUncheckedIndexedAccess`), Node ≥ 24

**Primary Dependencies**: existing only: React, React Flow (`@xyflow/react`), Yjs, Zustand, Zod/Ajv (schema), `lucide-react`, Radix / shadcn. **No new dependency.**

**Storage**: the Yjs document (IndexedDB provider) and `.sododeck.json` export; no new storage

**Testing**: Vitest (schema parity, model round-trip and cascade, pure view-model tests in the app), Testing Library for the Touches section, the card chip and the new actions. No new Playwright tests (constitution VI); the smoke suite must keep passing.

**Target Platform**: browser SPA (latest 2 versions of Chrome, Edge, Firefox, Safari)

**Project Type**: monorepo web app (`apps/app` → `packages/model` → `packages/schema`)

**Performance Goals**: playback highlight < 100 ms (constitution V); touches are computed per step from a small list, not per frame. 60 fps pan/zoom at 500 nodes / 1,000 edges unchanged.

**Constraints**: offline, no network with content, tokens only (no hard-coded colours), reads vs writes distinguishable without colour, keyboard reachable.

**Scale/Scope**: a step touches ≤ ~30 tables; a card owns up to 150 tables (048 fixture); samples ≤ ~10 tables per database.

**Known unknowns resolved in research.md**: R1 touches shape, R2 owner rules, R3 forced-visible rows without 048, R4 lighting at both levels, R5 samples.

## Constitution Check

_GATE: passed before Phase 0; re-checked after Phase 1 (still passes)._

| #    | Principle                                | Status | How                                                                                                                                                                                                                                            |
| ---- | ---------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Single source of truth (Yjs)             | Pass   | Owner is `node.parent`, touches live on the step in Yjs. Lit tables, chips and the "touched" highlight are derived at render time from the deck + active step; nothing is copied into Zustand.                                                 |
| II   | Schema-owned format, lossless round-trip | Pass   | One additive optional field (`step.touches`), so no version bump. Edited in `v1.json`, generated with `pnpm schema:generate`, parity tests, `examples/full` extended, round-trip case in `packages/model/test`. Decision recorded in ADR 0035. |
| III  | Stable identity                          | Pass   | Touches reference table and column ids; owner is an id; renames break nothing. A test covers rename, delete table, delete column.                                                                                                              |
| IV   | Local-first and private                  | Pass   | No network. Samples are bundled files.                                                                                                                                                                                                         |
| V    | Off the main thread / perf               | Pass   | No heavy work. Canvas change is small (chip on a card, marks on tables): run `pnpm bench` before and after and report both.                                                                                                                    |
| VI   | Strict types and tested behaviour        | Pass   | Unit + component tests listed in tasks; no e2e added.                                                                                                                                                                                          |
| VII  | Accessible by default                    | Pass   | Read / Write use different marker shapes and text ("R" / "W" labels with icon), not colour alone; Touches section and new actions keyboard reachable with accessible names.                                                                    |
| VIII | Simplicity, justified deps               | Pass   | No dependency. One ADR (0035). Reuses drill-in, proxies, export scope, cascade and samples test.                                                                                                                                               |

No violations, so Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/049-db-architecture-link/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R8
├── data-model.md        # Phase 1: Step.touches, owner rules, derived views
├── quickstart.md        # Phase 1: how to see it working
├── contracts/
│   ├── file-format.md   # Phase 1: schema addition + semantic rule + model ops
│   └── ui.md            # Phase 1: card face, actions, Touches section, playback marks
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                  # + Step.touches, + $defs/Touch
├── src/semantic-rules.ts           # + S15 (touch uniqueness / column needs table)
├── examples/full.sododeck.json     # extended with touches
└── test/                           # fixtures: valid + invalid touches

packages/model/
├── src/ops/touches.ts              # NEW: addTouch / setTouchAccess / removeTouch
├── src/ops/db-owner.ts             # NEW: setTableOwner (move / remove from card)
├── src/ops/cascade.ts              # + drop touches on removeNode / removeColumn
├── src/integrity.ts                # + touches reference table / column of that table
└── test/                           # touches, owner, cascade, round-trip, rename

apps/app/src/
├── db/touches.ts                   # NEW pure: touched tables / columns / chip text for a step
├── db/owner.ts                     # NEW pure: tables of a card, count, candidate cards
├── editor/deck-node.tsx            # + database card face (count, dialect chip, touch chip)
├── editor/flows/step-marks.ts      # + 'current' marks for touched tables
├── editor/flows/flow-overlay.ts    # + card chip data
├── editor/flows/inspector-step.tsx # + <Touches> section
├── editor/flows/step-touches.tsx   # NEW: picker + Read/Write rows
├── editor/flows/step-player.tsx    # + "also touches …" line
├── editor/table-layout.ts          # + forced-visible column ids (touched rows)
├── editor/table/table-body.tsx     # + R / W marker on touched rows
├── editor/actions/db-actions.ts    # NEW: move / remove from card, database.exportSql
├── editor/inspector/node-inspector.tsx  # + "Move to database…" field for tables
├── editor/…(add-table path)        # set parent when created while drilled in
├── editor/…(delete dialog)         # table count copy via previewRemoval
└── samples/                        # shop, saas-auth, blog `.sododeck.json`

docs/decisions/0035-step-touches.md # NEW ADR
```

**Structure Decision**: follow the existing monorepo and dependency direction
(`app → model → schema`). Pure logic (touched sets, chip text, owner lookups) goes in
`apps/app/src/db/` next to the 041–046 helpers so it is unit-tested without React. Persistent
data changes only in `packages/schema` and `packages/model`.

## Risks and notes

- **048 is not merged on `main`** (only its docs). 049 must not depend on the 048 row-limit
  button. FR-011 "touched columns never hidden" is built on `table-layout.ts` as it is today (the
  041 "+n columns" pill) through a `forcedColumnIds` input, which 048's keep-set can reuse.
  Whichever of 048 / 049 lands second adapts the other's call site (see R3).
- **Unowned tables after deleting a card**: a table's `position` is relative to its old drill
  level. Un-parented tables may overlap items on the level above. Mitigation in tasks: place them
  in a free spot on un-parenting (use the existing find-free-position helper if present; otherwise
  an offset grid), covered by a test.
- **Parent type**: `node.parent` accepts any node. The UI only offers database cards as owners;
  integrity does not forbid other parents (kept permissive for older decks).
- **Samples dir is untracked** on `main` (013 work). New sample files are added there; they are
  committed with 049 only if the user asks to include that directory (see the report).
