# Implementation Plan: Flow Playback "Deck"

**Branch**: `035-flow-playback-deck` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/035-flow-playback-deck/spec.md`, clarified on 2026-10-03: the current card is the step's **target**, the source shows ✓ (founder-confirmed); sticker numbering and repeated-card rules are the spec's defaults.

**Dependency**: 029 (`2e85e4a`) and 007 are merged on `main`. I checked these names in the code:

- **State and path**: `ActiveFlow` in `state/ui-store.ts`; `analyzeFlow` (`packages/model/src/flow-paths.ts`, `PathStep.number|from|to|branchId|broken`); `flows/played-path.ts` (`playedPath`, `currentOf`, `playerView`, `Segment`, `stepAnnouncement`); `flows/flow-mode.ts`; `flows/flow-overlay.ts` (`markPlayback`, `NodeFlowMark`, `EdgeFlowMark`, `EdgeBadge`); `collapse-flow-marks.ts`; `deck-to-flow.ts` (`in-flow`, `currentStep`, `flowInside`).
- **Cards**: `deck-node.tsx` (`aria-current="step"`, `deckStateClasses`, `hasFlowStep`), `collapsed-group-node.tsx` (`FlowInsideDot`, `sd-flow-inside-dot`), `index.css` (`.sd-card`, `[data-lipless]`, `.sd-card.current-step`, `[data-flow-mode]` dimming), `canvas.tsx` (`liplessSelector`, `data-flow-mode`).
- **Connectors**: `flow-token.tsx` (5px dot, `animateMotion`), `flow-strokes.ts` (`FLOW_STROKES`), `deck-edge.tsx`, `merged-edge.tsx`, `flow-badges.tsx` (`StepBadge`), the edge-end drawing used by `EdgeEnds`.
- **Player**: `flows/step-player.tsx`, `flows/branch-picker.tsx`, `use-playback.ts`, `use-flow-shortcuts.ts`, `packages/ui/src/lib/motion.ts` (`MOTION`).
- **Tokens**: `packages/ui/src/styles/tokens.css` (`--sd-deck-orange|orange-soft|orange-ink|dim|lip*`), `theme.css` (`--color-deck-*`, `--color-primary`, `--color-clay-*`), `test/contrast.test.ts`, `test/tokens-only.test.ts`.
- **Bench**: `bench/perf.bench.ts` "next step → current painted" (`FLOW_TARGET_MS` 100, measured through `[data-testid="edge-label"][aria-current="step"]`), `routes/bench-page.tsx`.
- **Export**: `export/scene.ts`, `render-svg.ts`: they call `flowOverlay(..., null, null)`, so they carry no playback marks (R10).

## Summary

Playing a flow deals the deck. Cards on the played path get a corner sticker (✓ / number / dashed number), the current (target) card keeps 029's lifted orange lip, the token becomes a numbered disc, connectors get played / current / upcoming / error styles, and the player and branch picker take the Deck look.

- **Derived marks** (R1, R2): one pure `stepMarks(path, currentIndex)` returns each card's state and number; `flowOverlay` attaches it to `NodeFlowMark`; a parallel `stateOf` on `EdgeFlowMark` gives played / current / upcoming. Nothing is stored; no schema or model change.
- **Cards** (R3, R4): a decorative `StepSticker` (aria-hidden, absolutely placed, no size change) on `DeckNode` and on the collapsed group's front card (replaces `FlowInsideDot`). The current lip stays visible below 60 % zoom.
- **Token** (R5): `FlowToken` draws a 24px numbered disc with a 3px Orange Ink lip; static at the label midpoint under reduced motion.
- **Connectors** (R6, R7): `FLOW_STROKES` gains `played`, `current`, `upcoming`; error paths end in × without an arrow; label pill restyled; dimming reads tokens (cards 0.22, connectors 0.20).
- **Player** (R8): restyle only: panel, 40px play button, 8px segments, dashed next-fork segment, picker items with number hints and dashed-Clay error item.
- **Tokens and docs** (R9, R11): small additions to `tokens.css` / `theme.css`, contrast cases, `DESIGN.md` `flow-token`, design-analysis §g-73.
- **Export** (R10): unchanged (no code), confirmed by test.
- **Bench** (R12): before / after on "next step → current painted" and "playing at 2×".

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed; **no new dependency**. `@xyflow/react` ^12, `zustand` 5, Radix through `packages/ui`, `lucide-react` (`Check`, `CircleAlert`, `X`/`CircleX` for ⊗).

**Storage**: none. All marks are derived from the Yjs deck and the UI store's `ActiveFlow`; nothing is added to the deck, the schema or `packages/model`.

**Testing**: Vitest + Testing Library (pure `stepMarks`, overlay, node / edge / token / player components by role and name, CSS-source tests like `flow-mode-css.test.ts`, contrast tests). No new e2e (constitution VI `TODO(e2e)`); the smoke suite must stay green.

**Target Platform**: Evergreen desktop browsers (Chromium for bench and e2e).

**Project Type**: pnpm / turbo monorepo; changes are in `apps/app` and `packages/ui`.

**Performance Goals**: "next step → current painted" ≤ 100 ms (existing target), "playing at 2×" not below its 029 result (59.2 fps); `stepMarks` for a 40-step flow < 1 ms.

**Constraints**: lift, lip and stickers are paint-only (no size or position change, 029 FR-016); no colour-only state (VII); reduced motion = no animation (VII); stickers decorative (single announcement per step, 007); export unchanged.

**Scale/Scope**: ~1 new pure module, ~10 app files edited, ~2 ui files, docs. Estimate 3 d (backlog).

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes; no violations._

| Principle                                    | Status | How                                                                                                                                                                                                  |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | ✅     | Marks are derived from the deck and `ActiveFlow` at render time; no mark is copied into Zustand, React Flow state or the doc.                                                                        |
| II. Schema-owned format, lossless round-trip | ✅     | No schema, model or file change; SC-007 asserts a playthrough leaves the stored file byte-identical.                                                                                                 |
| III. Stable identity                         | ✅     | Marks are keyed by node / step / edge ids from `analyzeFlow`; no titles used.                                                                                                                        |
| IV. Local-first, private                     | ✅     | No network; no new assets or fonts (icons from `lucide-react`, bundled).                                                                                                                             |
| V. Performance off the main thread           | ✅     | O(steps) pure derivation inside the existing overlay pass; no new layout or measuring; bench before / after is a gate (R12).                                                                         |
| VI. Strict types, tested behaviour           | ✅     | Pure `stepMarks` and `edgeStateOf` unit-tested; components tested by role / name per [contracts/playback-marks-ui.md](contracts/playback-marks-ui.md); no new e2e.                                   |
| VII. Accessible by default                   | ✅     | Every state has a shape cue (✓ vs number vs dashed outline; weight and dash; × end; ⊗ icon); stickers / token `aria-hidden`; single polite announcement kept; reduced motion static; contrast tests. |
| VIII. Simplicity, justified deps             | ✅     | No dependency; reuses the overlay, token and stroke tables; no ADR needed (no format or architecture decision); `DESIGN.md` is updated in place.                                                     |

## Project Structure

### Documentation (this feature)

```text
specs/035-flow-playback-deck/
├── spec.md
├── plan.md                 # this file
├── research.md             # R1–R12
├── data-model.md
├── quickstart.md
├── contracts/playback-marks-ui.md
├── checklists/requirements.md
├── tasks.md                # /speckit-tasks
├── bench-before.md, bench-after.md, visual-check.md, screens/   # during implementation
```

### Source Code (repository root)

```text
apps/app/src/editor/
├── flows/
│   ├── step-marks.ts (+ .test.ts)      # new: pure card marks + edge state
│   ├── flow-overlay.ts                 # attach marks to NodeFlowMark / EdgeFlowMark
│   ├── played-path.ts                  # Segment.nextFork flag
│   ├── step-player.tsx                 # Deck panel, play button, segments
│   └── branch-picker.tsx               # number hints, dashed-Clay error item
├── step-sticker.tsx (+ .test.tsx)      # new: decorative corner sticker
├── deck-node.tsx                       # mount sticker, data-step-state
├── collapsed-group-node.tsx            # sticker replaces FlowInsideDot
├── collapse-flow-marks.ts              # fold card states: current > played > upcoming
├── deck-to-flow.ts                     # pass marks to node data
├── flow-token.tsx                      # numbered disc
├── flow-strokes.ts                     # played / current / upcoming, error cross end
├── deck-edge.tsx, merged-edge.tsx      # state strokes, halo, label pill, × end
├── flow-badges.tsx                     # label restyle
└── edge-ends (existing module)         # 'cross' end for error paths
apps/app/src/index.css                  # current lip below 60 %, dim tokens, halo, reduced motion
apps/app/src/flow-mode-css.test.ts      # extend: tokens, no literal 0.2 / 0.22
apps/app/bench/perf.bench.ts            # unchanged selector (R12)
packages/ui/src/styles/{tokens,theme}.css   # --sd-deck-lip-current, --sd-deck-dim-edge, mappings
packages/ui/test/contrast.test.ts       # sticker / token / label pairs, both themes
DESIGN.md, docs/design/design-analysis.md   # flow-token, §g-73 built
apps/app/CLAUDE.md, packages/ui/CLAUDE.md  # only if boundaries change
```

**Structure Decision**: Single pure module (`step-marks.ts`) owns every state decision; components only paint what the overlay gives them. No change in `packages/model`, so the dependency direction `app → model → schema` is untouched.

## Complexity Tracking

No constitution violations to justify.
