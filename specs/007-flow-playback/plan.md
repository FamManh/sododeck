# Implementation Plan: Flow Playback

**Branch**: `007-flow-playback` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-flow-playback/spec.md` (clarified 2026-09-27, 5 answers)

**Dependency**: 006 is merged on `main` (`96bd929`); names re-checked at `3a3c2d3` (research
header). 008 (inspector-rules) is specified but not merged; 007 and 008 both extend
`inspector-step.tsx` at separate seams (research R10), and whichever lands second rebases.

## Summary

Turn "open a flow" into **flow mode**: the played path is highlighted and everything else dimmed,
the current step's connection is thick with a looping token, a step player (previous, play/pause,
next, 1×/2×, progress segments, branch picker) drives it, ← / → / ↑ / ↓ navigate, the inspector
shows the step (from → to, protocol, condition, description, rule titles, SLA target) and the JSON
panel shows the step as in the file.

- **UI state** (research R1): flow mode is derived (`activeFlow !== null && flowSession === null`).
  `activeFlow` gains `alternativeId`, `playing`, `speed`; new `lastPlayedFlowId`. Actions
  `openFlow`, `exitFlow`, `setCurrentStep`, `setPlaying`, `setSpeed`, `setAlternative`, `advance`.
- **Pure derivation** (R2): `played-path.ts` (played path, player view, click lookups, re-homing,
  announcement text), all over 006's `analyzeFlow`.
- **Canvas** (R3, R5, R8, R9): `flowOverlay` gets a `playback` input → `inPath` / `current` marks;
  members get `.in-flow`, the wrapper `data-flow-mode`, CSS dims the rest; `FlowToken`
  (`<animateMotion>`, static under reduced motion) only on the current edge; view-only canvas;
  click-to-jump; fit on open, pan-if-needed on step change.
- **Player + keys** (R4, R6, R7): `StepPlayer`, `BranchPicker` (existing `SegmentedControl`),
  `usePlayback` (one timeout per step, pause on hidden tab), `usePlaybackShortcuts`.
- **Inspector / JSON** (R10, R11): `InspectorStep` gains a playback header and a RULES list;
  `@sododeck/model` gets `serializeEntry('steps', …)` so the JSON panel can show the step.
- **Sync** (R12): `useFlowSync` handles current step / alternative / flow removal.
- **No new runtime dependency, no schema or Yjs layout change, no new `packages/ui` component.**

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed:

- `@xyflow/react` 12.12 (`fitBounds`, `setCenter`, `getViewport`, `getSmoothStepPath`)
- `zustand` 5
- `lucide-react` (`Play`, `Pause`, `SkipBack`, `SkipForward`, `X`, `ArrowLeft`, `CircleAlert`,
  `GitBranch`, `History` for "Last played", `Table2` for rules)
- `@sododeck/ui`: `SegmentedControl`, `Button`, `Tooltip`, `KindTile`, `PanelSection`, toast,
  `focusRing`, `resolveMotion` / `MOTION`, `useReducedMotion`
- `@sododeck/model`: `analyzeFlow`, `serializeEntry`, `observeDeck`, `getObject`

**Storage**: none new. Flow mode state is UI-only (per tab, not persisted). Step text edits go
through `editor.updateStep` (006) and are autosaved and synced by 005 as before.

**Testing**:

- **Vitest (`packages/model`)**: `serialize-entry.test.ts` — `'steps'` entries equal slices of
  `serializeDeck` for every step of the full example.
- **Vitest (`apps/app`, pure / store)**: `played-path.test.ts` (paths, player view, lookups,
  re-home, announcement), `flow-overlay.test.ts` (+ playback marks), `deck-to-flow.test.ts`
  (`in-flow` class, cache hits/misses on current change), `canvas-geometry.test.ts` (`boundsOf`,
  `rectInView`), `ui-store.test.ts` (flow mode actions), `json-panel-view.test.ts` (step entry).
- **Testing Library (by role and label)**: `step-player.test.tsx` (buttons, disabled states,
  segments, speed, autoplay with fake timers incl. last-step stop and restart, hidden tab),
  `branch-picker.test.tsx` (radiogroup, ↑/↓, re-home), `use-playback-shortcuts.test.tsx` (←/→ not
  in text fields, Esc exit), `inspector-step.test.tsx` (playback header, broken, rules list, SLA
  target only), `flow-panel.test.tsx` (current row, Back to canvas, Last played), `deck-edge.test.tsx`
  (token present / static under reduced motion / absent when broken), `use-flow-sync.test.tsx`
  (removals), `canvas.test.tsx` (view-only in flow mode, click to jump, `data-flow-mode`),
  `a11y.test.tsx` (announcements).
- **E2E**: existing smoke suite only (constitution VI). It does not open a flow.
- **Bench**: `pnpm bench` before and after with two new flow scenarios and a "playing at 2×" fps
  sample (R13).

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox and Safari; desktop 1440×900
reference; offline.

**Project Type**: Web SPA (`apps/app`) plus internal packages in the pnpm/Turborepo monorepo.

**Performance Goals**:

- Open flow → dimmed + highlighted + token painted < 100 ms on 500 / 1,000 (constitution V, SC-001).
- Step change → new current painted < 100 ms; only the previous and new current edges and their
  nodes get new React Flow objects.
- Playing at 2× on the bench deck: ≥ 60 fps average, pan/zoom fps within 5 % of `main` (SC-002).
- Autoplay within ±100 ms of 1.7 s / 0.85 s (SC-003).

**Constraints**:

- No duplicated document state; nothing written to the deck by playback (FR-025, SC-008).
- No network. Keyboard-operable, no state by color alone, tokens only.
- Canvas stays derived (ADR 0006); flow marks only through the `overlay` argument.
- Timers never leak (SC-007): one timeout, cleaned up on every change and unmount.

**Scale/Scope**:

- Flows up to ~30 steps in normal use, 50+ supported (scrolling segments and list).
- About 8 new app files, ~12 touched; 1 model file touched; no UI kit change.

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes, no violations._

| Principle                        | Status | How                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Single source of truth        | ✅     | Flow mode holds ids, a boolean and a number in `useUiStore` (UI-only). Paths, numbers, from/to come from `analyzeFlow` every render; step edits go through `DeckEditor`. Nothing is copied from the deck.                                                                                                                |
| II. Schema-owned format          | ✅     | No format change. The JSON panel's step text comes from `@sododeck/model` (`serializeEntry('steps')`, derived from the schema's key order), so the app still never serializes deck data. Serialization test added; round-trip unaffected.                                                                                |
| III. Stable identity             | ✅     | Current step, alternative and last-played flow are referenced by id and pruned on removal (`useFlowSync`). No new reference type in the file.                                                                                                                                                                            |
| IV. Local-first, private         | ✅     | No network, no assets. Page Visibility is used only to pause (universal in supported browsers, guarded for non-DOM runtimes). Smoke no-third-party check unchanged.                                                                                                                                                      |
| V. Performance                   | ✅     | Dimming by one wrapper attribute + `.in-flow` on members only (project skill recipe); cache checks keep untouched RF objects; token animation is SMIL on one edge. No heavy work, so no worker. Bench before/after with new scenarios.                                                                                   |
| VI. Strict types, tested         | ✅     | Pure `played-path.ts` and store actions unit-tested; component tests by role/label; fake-timer tests for autoplay; model serialization test. No new e2e.                                                                                                                                                                 |
| VII. Accessible                  | ✅     | ←/→/↑/↓/Esc, all player controls are buttons / radios with names and states, focus rings. Non-color cues: step numbers on labels, width + filled label + node ring for current, dash + icon for error, opacity plus numbers for membership. One polite announcement per step; reduced motion: static token, instant dim. |
| VIII. Simplicity, justified deps | ✅     | No new dependency or UI kit component (reuses `SegmentedControl`). No 008 decision table, no measured SLA, no ⌘K, sticky or group work. No ADR needed: no format or architecture change; the flow-mode state shape is recorded in data-model.md and `apps/app/CLAUDE.md`.                                                |

## Project Structure

### Documentation (this feature)

```text
specs/007-flow-playback/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R13
├── data-model.md        # Phase 1: UI state, derived played path, overlay marks
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── flow-playback-ui.md    # user-visible contract (roles, labels, text, keys)
│   └── model-additions.md     # serializeEntry('steps')
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/model/
├── src/serialize-entry.ts, src/key-order.ts   # EntryCollection + 'steps' (flows[].steps item shape)
└── test/serialize-entry.test.ts               # + step entries vs serializeDeck slices

apps/app/src/
├── state/ui-store.ts                  # ActiveFlow + alternativeId/playing/speed, lastPlayedFlowId,
│                                      #   openFlow/exitFlow/setCurrentStep/setPlaying/setSpeed/
│                                      #   setAlternative/advance; setActiveFlow → alias
├── editor/flows/
│   ├── played-path.ts                 # NEW pure: playedPath, playerView, stepForNode/Edge,
│   │                                  #   rehome, stepAnnouncement
│   ├── step-player.tsx                # NEW region "Step player": buttons, position, speed, segments
│   ├── branch-picker.tsx              # NEW radiogroup "At step n" (SegmentedControl)
│   ├── use-playback.ts                # NEW autoplay timeout + visibility pause
│   ├── flow-mode.ts                   # NEW actions: open/exit/go/next/prev/switchAlternative
│   │                                  #   (store + announce), used by keys, clicks, player
│   ├── flow-overlay.ts                # + playback input → inPath / current / currentStep marks
│   ├── use-flow-shortcuts.ts          # + usePlaybackShortcuts (←/→/↑/↓)
│   ├── use-flow-sync.ts               # + current step / alternative / flow removal in flow mode
│   ├── flow-panel.tsx, step-list.tsx, step-row.tsx  # current row, Back to canvas → exitFlow
│   ├── flow-row.tsx                   # openFlow; "Last played" mark
│   ├── flow-inspector.tsx, inspector-step.tsx       # playback header, from→to tiles, protocol,
│   │                                  #   RULES titles, SLA target placeholder
│   ├── session-chip.tsx               # + "Flow mode · <title>" chip with Exit
│   └── flow-session.ts                # Done/Cancel → openFlow; Edit steps from flow mode
├── editor/flow-token.tsx              # NEW token child of DeckEdge (animateMotion / static)
├── editor/deck-to-flow.ts             # `in-flow` className, NodeFlowMark fields in cache check
├── editor/deck-edge.tsx, deck-node.tsx# current width/filled label/token; node ring + aria-current
├── editor/canvas.tsx                  # data-flow-mode, playback overlay input, view-only flags,
│                                      #   <StepPlayer/> panel, useFlowViewport
├── editor/canvas-geometry.ts          # + boundsOf, rectInView
├── editor/use-canvas-handlers.ts      # flow mode: click → jump; block drop/connect/double-click
├── editor/use-canvas-shortcuts.ts     # flow mode: no arrows/C/E/Enter on canvas; Esc exits; no Delete
├── editor/json-panel-view.ts          # flow mode: Step entry
├── editor/top-bar.tsx                 # chip slot shows flow-mode chip
├── index.css                          # [data-flow-mode] dimming rules
├── routes/bench-page.tsx              # __sododeckFlowBench.openFlow / nextStep
└── ../bench/perf.bench.ts             # 2 scenarios + playing-at-2× fps

apps/app/CLAUDE.md                     # flow mode rules (derived mode, view-only canvas, keys)
.agents/skills/react-flow/SKILL.md     # playback marks + FlowToken file names
docs/backlog.md                        # 007 status line after merge
```

**Structure Decision**: everything stays in `apps/app/src/editor` (flow-specific code in
`editor/flows/`, canvas extension points in the shared editor files) plus one serialization
addition in `packages/model`. No new package, no boundary change.

## Implementation order (for /speckit-tasks)

1. Bench before (`bench-before.md`). Model `serializeEntry('steps')` + test.
2. UI store flow mode actions + tests; `played-path.ts` + tests; `flow-mode.ts` actions.
3. **P1 slice (US1)**: `openFlow` from flow rows and Done; flow chip + Exit/Esc/Back; overlay
   playback marks, `.in-flow` + dimming CSS, current edge + node ring, `FlowToken`; view-only
   canvas; ← / →; `StepPlayer` (prev/next/position/segments); inspector playback header and
   RULES; JSON step entry; announcements; viewport fit/pan; `useFlowSync` removals.
4. **US2**: Play/Pause, speed, `usePlayback` with fake-timer tests, hidden-tab pause.
5. **US3**: click-to-jump on nodes/edges, segment and row jumps.
6. **US4**: branch picker, ↑/↓, re-home, played-path segments.
7. **US5**: reduced motion (static token, instant dim) and non-color cue review.
8. Bench scenarios, bench after, screenshots vs design frames, docs (`apps/app/CLAUDE.md`,
   `packages/model/CLAUDE.md`, react-flow skill).

## Complexity Tracking

No violations. (006's edit-mode checkpoint exception is unchanged and not extended.)
