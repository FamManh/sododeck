# Quickstart: validate Flow Playback (007)

How to prove the feature works. Behavior details are in [contracts/flow-playback-ui.md](contracts/flow-playback-ui.md)
and [data-model.md](data-model.md); this file only lists what to run and what to see.

## Prerequisites

- `main` with 006 merged; Node ≥ 24; `pnpm install`.
- Branch `007-flow-playback`.
- Baseline bench before any change: `pnpm bench` → copy the flow table to `specs/007-flow-playback/bench-before.md`.

## Automated checks

```bash
pnpm --filter @sododeck/model test -- serialize-entry   # 'steps' entries equal serializeDeck slices
pnpm --filter @sododeck/app test -- played-path flow-overlay deck-to-flow ui-store
pnpm --filter @sododeck/app test -- step-player branch-picker inspector-step use-playback flow-panel use-flow-sync json-panel-view
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench                                              # → bench-after.md
```

Expected: all green; the smoke e2e (incl. no third-party requests) unchanged; bench flow scenarios
"open flow → flow mode painted" and "next step → current painted" < 100 ms; "playing at 2×" ≥ 60 fps
average on 500 / 1,000.

## Manual scenarios (`pnpm dev`)

The demo deck has no flows: import `packages/schema/examples/full.sododeck.json` (it has a flow
with two branches) or record an 8-step flow with 006 first.

1. **Open and step (US1)**: click an 8-step flow (called "Place order" below) in Features → chip "Flow mode · Place order", rest
   dimmed, step 1 thick with a moving token, the whole path fitted in view. Press → seven times:
   player, step row, segment, inspector and JSON "Step n" follow; VoiceOver/NVDA reads "Step 5 of
   8: …". Type in Condition and press ←: the caret moves, the step does not. Try dragging a node
   or pressing ⌫: nothing. Esc → normal canvas, deck inspector, "Last played" mark on the row.
2. **Play (US2)**: Play → a step every ~1.7 s, stops on the last; Play again restarts at 1;
   Speed 2× pauses, then ~0.85 s per step; switch tabs while playing → paused on return.
3. **Jump (US3)**: click a node on the path → first step touching it; click a dimmed node →
   nothing; click segment 6 and row 6.
4. **Branches (US4)**: open the example's flow with two branches:
   an "AT STEP n" picker appears from the fork step; ↓ switches to the second alternative, the
   current step becomes its first step ("…b"), error paths show dashed with an icon, and the
   player reads "Step <n>b of <m>".
5. **Reduced motion and grayscale (US5)**: enable OS reduced motion → token static at the edge
   midpoint, no fade; DevTools rendering "emulate achromatopsia" → current, flow and error steps
   still distinguishable.
6. **Robustness**: in a second tab delete the current step's connection → first tab shows
   "connection deleted", no token; delete the flow → first tab leaves flow mode with a toast.
7. **Screens**: capture 1440×900 light and dark of steps 1 and 3 above and compare with
   `docs/design/screens/03-flow-mode-*`, `26-flow-playing-2x-light`, `46-branch-tree-*`,
   `24-flow-step-no-rule-light` (allowed differences: target-only SLA, rules as names until 008,
   DESIGN.md tokens, lucide icons). Store under `specs/007-flow-playback/screens/`.
