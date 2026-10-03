# Tasks: Flow Playback "Deck"

**Input**: design documents in `specs/035-flow-playback-deck/`:

- [plan.md](plan.md) and [spec.md](spec.md), clarified 2026-10-03 (current card = step target, founder-confirmed).
- [research.md](research.md) (R1–R13) and [data-model.md](data-model.md) (derived `NodeStepMark`, `EdgeStepState`; no stored data).
- [contracts/playback-marks-ui.md](contracts/playback-marks-ui.md) (roles, names and data attributes the tests assert).
- [quickstart.md](quickstart.md). Visual reference: `DESIGN.md` "Card system (Deck)" / "Flow playback" and `docs/design/screens/117-deck-sample-board-*.png`.

**Tests are required** (constitution VI): unit tests for every pure function, component tests by role and name. Write each new test first and watch it fail. Do not add Playwright tests; the smoke suite must keep passing.

**Scope guards**:

- **No stored data, schema or `packages/model` change.** Marks are derived at render time.
- **Lift, lip and stickers are paint-only**; card size and position never change (029 FR-016).
- **Every state keeps a non-colour cue** (constitution VII); stickers and token are `aria-hidden`; one polite announcement per step (007 unchanged).
- **Playback behaviour is unchanged** (order, autoplay, shortcuts, branch rules). Only the look changes.
- **Export stays unchanged** (R10).
- **Out of scope**: card frame and states (029), bundles / relationship styles (034, 022), the branch popover placement (R8 flag), new e2e tests.

**Approvals**: no new runtime dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1 stickers and current card · US2 token · US3 branches and error paths · US4 step player · US5 reduced motion and no-colour.
- Paths are relative to the repo root; `app/` = `apps/app/src/editor/`.

---

## Phase 1: Setup

- [ ] T001 Run `pnpm bench` on a quiet machine and save the "next step → current painted" and "playing at 2×" medians (5 runs, machine state noted) to `specs/035-flow-playback-deck/bench-before.md`.
- [ ] T002 [P] Save reference screenshots of today's playback (light and dark, step 3 of "Checkout") to `specs/035-flow-playback-deck/screens/before-*.png` for comparison.

---

## Phase 2: Foundational (blocks every story)

- [ ] T003 [P] Add tokens in `packages/ui/src/styles/tokens.css`: move `--sd-deck-lip-current: 5px` here from `apps/app/src/index.css`, add `--sd-deck-dim-edge: 0.2`, `--sd-step-sticker: 22px`, `--sd-step-sticker-current: 26px`, `--sd-flow-token: 24px`; map `--color-deck-dim` and `--color-deck-dim-edge` in `packages/ui/src/styles/theme.css`. Keep `packages/ui/test/tokens-only.test.ts` green.
- [ ] T004 [P] Write failing contrast cases in `packages/ui/test/contrast.test.ts` (both themes, ≥ 4.5:1): On-primary on Deck Orange, Surface on Ink, Text secondary on Surface, Clay ink on Clay soft; adjust a token only if a pair fails and record it in `DESIGN.md`.
- [ ] T005 Write failing unit tests `apps/app/src/editor/flows/step-marks.test.ts` for the rules table in [data-model.md](data-model.md): linear flow, step 1, last step, branch switch, loop-back card, self-loop step, broken step, other alternative gets no mark, `edgeStateOf` before / at / after the current index.
- [ ] T006 Implement `apps/app/src/editor/flows/step-marks.ts` (`stepMarks`, `edgeStateOf`, `StepState`, `NodeStepMark`) until T005 passes.
- [ ] T007 Extend `apps/app/src/editor/flows/flow-overlay.ts` (`markPlayback`): attach `step: NodeStepMark | null` to `NodeFlowMark`, `state` to `EdgeFlowMark`, `number` to `EdgeFlowMark.current`; update `apps/app/src/editor/flows/flow-overlay.test.ts` first. Keep `currentStep` and `inPath` for `aria-current` and the bench selector.
- [ ] T008 Pass the marks through `apps/app/src/editor/deck-to-flow.ts` into node data (`data.step`) and add `data-step-state` on the node root; update `apps/app/src/editor/deck-to-flow.test.ts`.
- [ ] T009 [P] Extend `apps/app/src/editor/collapse-flow-marks.ts` to fold card states (current > played > upcoming) and change `flowInside` to `'current' | 'played' | 'upcoming' | null`; update `apps/app/src/editor/collapse-flow-marks.test.ts` first.

**Checkpoint**: marks exist in node / edge data; nothing is painted differently yet.

---

## Phase 3: User Story 1 — Stickers and the current card (P1) 🎯 MVP

**Goal**: stepping through a flow shows ✓ on passed cards, the lifted orange-lip card with a number sticker, dashed numbers ahead, the rest at 22 %.

**Independent test**: open an 8-step flow, press → and ← through it, check each card's sticker and `aria-current`, leave flow mode and check nothing remains.

- [ ] T010 [P] [US1] Write failing tests `apps/app/src/editor/step-sticker.test.tsx`: played shows a ✓ and no number, current and upcoming show the step number, `aria-hidden="true"`, `data-step-state`, not focusable; long numbers ("10a") fit without growing the disc.
- [ ] T011 [US1] Implement `apps/app/src/editor/step-sticker.tsx` (22 / 26 / 22 px discs at (−9, −9), 2px Surface ring on played and current, 1.5px dashed Secondary on upcoming, `pointer-events: none`) until T010 passes.
- [ ] T012 [P] [US1] Write failing tests in `apps/app/src/editor/deck-node.test.tsx`: sticker mounted only in flow mode and only for marked cards; `aria-current="step"` only on the current card; card `aria-label` unchanged; no sticker outside flow mode; card box size identical with and without sticker.
- [ ] T013 [US1] Mount `StepSticker` in `apps/app/src/editor/deck-node.tsx` from `data.step` until T012 passes.
- [ ] T014 [P] [US1] Write failing tests in `apps/app/src/editor/collapsed-group-node.test.tsx`: folded sticker on the front card; `FlowInsideDot` gone; label still ends ", flow step inside".
- [ ] T015 [US1] Replace `FlowInsideDot` with `StepSticker` in `apps/app/src/editor/collapsed-group-node.tsx` and remove the `sd-flow-inside-dot` rule from `apps/app/src/index.css`.
- [ ] T016 [US1] Update `apps/app/src/index.css`: stop zeroing `--sd-deck-lip-current` under `[data-lipless]` (current lip stays below 60 %); dim off-path cards with `var(--color-deck-dim)` and off-path connectors / labels with `var(--color-deck-dim-edge)` instead of the literal `0.2`; give the current card the 9px Orange Soft halo. Extend `apps/app/src/flow-mode-css.test.ts` to assert no literal opacity remains and the lipless exception exists.
- [ ] T017 [US1] Add a canvas test in `apps/app/src/editor/canvas.test.tsx` (next to the lipless test): below 60 % zoom the current card keeps its lip, other cards have none, played and upcoming stickers are present.
- [ ] T018 [US1] Add a regression test in `apps/app/src/editor/flows/flow-mode.test.ts`: open, step, go back and exit leave the serialised deck byte-identical and remove every mark (SC-006, SC-007).

**Checkpoint**: US1 works alone; the flow reads as a dealt deck without the new token or connector styles.

---

## Phase 4: User Story 2 — Numbered token (P1)

**Goal**: a 24px numbered orange disc travels the current connector in every line type.

**Independent test**: play a flow with curved, elbow and straight connectors and a self-loop; the token shows the step number and follows each.

- [ ] T019 [P] [US2] Write failing tests `apps/app/src/editor/flow-token.test.tsx`: shows the number, `aria-hidden`, one token only, `animateMotion` present with motion allowed, no `animateMotion` and positioned at the label midpoint under reduced motion.
- [ ] T020 [US2] Rework `apps/app/src/editor/flow-token.tsx`: 24px disc, 2.5px Surface ring, 3px Orange Ink lip, number text 11.5 / 700 On Primary; read `number` from the mark; pass it from `apps/app/src/editor/deck-edge.tsx` and `apps/app/src/editor/merged-edge.tsx`.
- [ ] T021 [US2] Extend `apps/app/src/editor/deck-edge.test.tsx` and `apps/app/src/editor/merged-edge.test.tsx`: token on the current connector for each line type and for a self-loop, none on other connectors, none on a broken step.

**Checkpoint**: US1 + US2 give the full signature moment on cards and token.

---

## Phase 5: User Story 3 — Connector states, branches and error paths (P2)

**Goal**: played / current / upcoming / error connectors and the branch picker in the Deck style.

**Independent test**: open a flow with a fork and an error path, switch alternatives, compare with frame 117 in colour and greyscale.

- [ ] T022 [P] [US3] Write failing tests in `apps/app/src/editor/flow-strokes.test.ts` (create if missing): `played` Secondary 2.5, `current` orange 3.25, `upcoming` dashed `2 6` round caps, `error` Clay dashed `7 4`; existing `candidate` / `preview` / `invalid` unchanged.
- [ ] T023 [US3] Update `apps/app/src/editor/flow-strokes.ts` and `apps/app/src/editor/deck-edge.tsx` / `merged-edge.tsx` to pick the stroke from `flow.state` and `errorPath`, draw the 8px orange halo at 18 % under the current connector, and set `data-step-state` on the label.
- [ ] T024 [P] [US3] Write failing tests for the `cross` end in the edge-end module (find it via `EdgeEnds` in `apps/app/src/editor/`): an error-path connector ends in × and has no arrow; other connectors keep their arrow in every line type.
- [ ] T025 [US3] Implement the `cross` end and use it for error paths in `deck-edge.tsx`.
- [ ] T026 [P] [US3] Write failing tests in `apps/app/src/editor/flow-badges.test.tsx` (create if missing) and `deck-edge.test.tsx`: label pill 20px tall, solid orange with On Primary text when current, Clay Soft with ⊗ when error, always carries the step number, keeps `aria-current="step"` on the current step.
- [ ] T027 [US3] Restyle the label pill in `apps/app/src/editor/flow-badges.tsx` and the label in `deck-edge.tsx` per FR-010.
- [ ] T028 [P] [US3] Write failing tests in `apps/app/src/editor/flows/branch-picker.test.tsx`: each alternative shows an `aria-hidden` number hint, the error item has a dashed Clay border and ⊗ and still announces ", error path", choosing an alternative behaves as before, no new keyboard shortcut.
- [ ] T029 [US3] Restyle `apps/app/src/editor/flows/branch-picker.tsx` to pass T028.
- [ ] T030 [US3] Extend `apps/app/src/editor/flows/flow-overlay.test.ts` and `deck-to-flow.test.ts`: switching the branch removes the other alternative's stickers and dims its cards and connectors; an error-path target card gets the normal sticker (FR-013).

**Checkpoint**: connectors and branches read correctly in colour and greyscale.

---

## Phase 6: User Story 4 — Step player (P2)

**Goal**: the player looks like frame 117; behaviour is untouched.

**Independent test**: use every control and the keyboard on a flow with a fork; compare with frame 117 in both themes.

- [ ] T031 [P] [US4] Write failing tests in `apps/app/src/editor/flows/played-path.test.ts`: `playerView` marks `nextFork` on the segment of the next branch point strictly after the current step, and none when there is no later fork.
- [ ] T032 [US4] Add `nextFork` to `Segment` in `apps/app/src/editor/flows/played-path.ts`.
- [ ] T033 [P] [US4] Write failing tests in `apps/app/src/editor/flows/step-player.test.tsx`: segments played / current / upcoming expose `aria-current` on the current, the next-fork segment has `data-next-fork`, controls keep their names and focus ring, 40 segments fit without horizontal scroll, all 007 behaviours still pass.
- [ ] T034 [US4] Restyle `apps/app/src/editor/flows/step-player.tsx`: radius 16, 1.5px Border-strong, 3px lip, Float shadow, 40px round play button with Orange Ink lip, 8px segments with the colours of FR-015, dashed outline for `nextFork`, Mono speed pill; keep `min(560px, …)` width.

**Checkpoint**: whole playback surface is in the Deck look.

---

## Phase 7: User Story 5 — Reduced motion and no-colour reading (P1)

**Goal**: nothing animates under reduced motion; every state has a shape cue.

**Independent test**: enable reduced motion and take greyscale screenshots of steps 1, 3 and an error step.

- [ ] T035 [P] [US5] Write failing tests in `apps/app/src/flow-mode-css.test.ts`: under `prefers-reduced-motion` the current-card lift transition, off-path fade (`--sd-dur-dim`) and sticker transitions resolve to none; the lip, halo and sticker rules still exist.
- [ ] T036 [US5] Update `apps/app/src/index.css` so lift, sticker and halo transitions use zero duration under reduced motion; verify the token path from T020 renders the static disc at the label midpoint.
- [ ] T037 [P] [US5] Extend `apps/app/src/editor/flows/a11y.test.tsx`: after a step change exactly one polite announcement is made, stickers and token are absent from the accessibility tree, the current card is the only `aria-current="step"` card.
- [ ] T038 [US5] Capture greyscale and reduced-motion screenshots for steps 1, 3 and an error step to `specs/035-flow-playback-deck/screens/` and record the comparison with frame 117 in `specs/035-flow-playback-deck/visual-check.md` (SC-003, SC-005, light and dark, with the founder-decision deviations including the inline branch picker).

---

## Phase 8: Polish and cross-cutting

- [ ] T039 [P] Add the export regression test in `apps/app/src/editor/export/scene.test.ts` / `render-svg.test.ts`: exporting a deck with an open flow contains no sticker, lip, halo or token elements (R10, FR-021).
- [ ] T040 [P] Update `DESIGN.md`: `flow-token` becomes the numbered disc (24px, 2.5px ring, 3px Orange Ink lip), note the current-lip exception below 60 % and the 22 % / 20 % dim values; mark design-analysis §g-73 as built in `docs/design/design-analysis.md`.
- [ ] T041 [P] Update `apps/app/CLAUDE.md` and `packages/ui/CLAUDE.md` only where boundaries or APIs changed (new `step-marks.ts`, new tokens); update the 035 entry in `docs/backlog.md` with status and links.
- [ ] T042 Run `pnpm bench` again, save to `specs/035-flow-playback-deck/bench-after.md`; "next step → current painted" must stay within its target and "playing at 2×" no lower than before (FR-023, SC-004).
- [ ] T043 Run the full definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; no skipped or `.only` tests.
- [ ] T044 Walk [quickstart.md](quickstart.md) end to end and record results in `specs/035-flow-playback-deck/quickstart-results.md`; list what was skipped or uncertain for the final report.
- [ ] T045 Commit in small Conventional Commits (`feat(app): …`, `feat(ui): …`, `docs: …`), no AI attribution lines (AGENTS.md).

---

## Dependencies and order

- Phase 1 → Phase 2 → stories. Phase 2 blocks everything.
- **US1** needs T003–T009. **US2** needs T007 (edge `number`) and is otherwise independent of US1. **US3** needs T007 and shares `deck-edge.tsx` with US2 (do US2 first). **US4** needs only T032's `playerView` change (independent of US1–US3 visually). **US5** needs US1 and US2 (it verifies them).
- Phase 8 after all stories.

## Parallel opportunities

- Phase 1: T001 ‖ T002. Phase 2: T003 ‖ T004 ‖ T005 (T006 after T005; T009 ‖ T007 after T006).
- US1: T010 ‖ T012 ‖ T014 (tests), then T011, T013, T015; T016 touches `index.css` alone.
- US3: T022 ‖ T024 ‖ T026 ‖ T028 (different test files).
- US4 can run in parallel with US3 (different files).
- Phase 8: T039 ‖ T040 ‖ T041.

## Implementation strategy

- **MVP**: Phases 1–3 (US1). Stickers and the current card already give the dealt-deck read; the old dot token and connector styles remain.
- **Increment 2**: US2 (token) completes the signature moment.
- **Increment 3**: US3 and US4 in parallel, then US5 as the accessibility gate.
- Stop after Phase 8; do not start 033 or any other feature.

## Counts

Total 45 tasks. Setup 2 · Foundational 7 (T003–T009) · US1 9 (T010–T018) · US2 3 (T019–T021) · US3 9 (T022–T030) · US4 4 (T031–T034) · US5 4 (T035–T038) · Polish 7 (T039–T045).
