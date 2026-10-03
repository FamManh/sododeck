# Tasks: Connection Focus and Drill-in

**Input**: design documents in `specs/034-connection-focus-and-drill/`:

- [plan.md](plan.md) and [spec.md](spec.md), clarified 2026-10-03 (automatic-route-only bundles; Ink 2.75px highlight with colour and weight as separate rules; a shown flow takes its connectors out of bundles; 150 ms rest / 100 ms grace).
- [research.md](research.md) (R1–R10) and [data-model.md](data-model.md) (derived `FocusSet`, `Bundle`, `OutsideProxy`, `ScopeLabel`; UI-only `hoverFocus`, `fannedBundles`).
- [contracts/connection-focus-ui.md](contracts/connection-focus-ui.md) (function signatures, DOM / CSS hooks, keys and accessible names the tests assert).
- [quickstart.md](quickstart.md). Visual reference: `DESIGN.md` "Card system (Deck)" > Card states / Connectors / Groups, and `docs/design/screens/118-deck-connections-*.png` (a, b, d; c belongs to 022).

**Tests are required** (constitution VI): unit tests for every pure function and store change, component tests by role and name. Write each new test first and watch it fail. Do not add Playwright tests; the smoke suite must keep passing.

**Scope guards**:

- **No stored data, schema or `packages/model` change.** Focus sets, bundles, proxies and the scope label are derived; `hoverFocus` and `fannedBundles` are UI-only and never saved.
- **Hover changes no React Flow object** (R1): no `dimmed` / `inert` / `aria-hidden` from hover; pinned focus (F) keeps its current mechanism.
- **017 routes are never written** by fan-out (R6); adjusted connectors never bundle.
- **Every state keeps a non-colour cue** (weight, opacity, dash, count text); reduced motion removes fades.
- **Out of scope**: relationship types and legends, end-along-a-side (022), connector restyling, new e2e tests.

**Approvals**: no new runtime dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1 hover focus · US2 bundles · US3 drill-in proxies.
- Paths are relative to the repo root; `app/` = `apps/app/src/editor/`.

---

## Phase 1: Setup

- [ ] T001 Run `pnpm bench` on a quiet machine (5 runs, machine state noted) and save pan / drag / "focus" scenario numbers to `specs/034-connection-focus-and-drill/bench-before.md`.
- [ ] T002 [P] Save reference screenshots of today's focus mode (F), two cards with three parallel connectors, and a drill-in with port pills (light and dark) to `specs/034-connection-focus-and-drill/screens/before-*.png`.

---

## Phase 2: Foundational (blocks every story)

- [ ] T003 Write failing tests in `apps/app/src/state/ui-store.test.ts` for the new UI-only fields: `hoverFocus` (`setHoverFocus({ id, source })`, `clearHoverFocus()`), `fannedBundles` (`toggleBundleFan(id)`, `foldBundles()`, `pruneFannedBundles(ids)`), and that `showView`, `drillInto`, `drillUp` and opening another deck clear both.
- [ ] T004 Implement T003 in `apps/app/src/state/ui-store.ts` (types per `data-model.md` "UI-only state"; never document data). Extend `focusedId` / `focusedEdgeId` pruning to accept `port:` and `bundle:` ids.
- [ ] T005 [P] Write failing tests in `app/deck-edge.test.tsx` and `app/merged-edge.test.tsx`: the path's inline style is `stroke: var(--sd-edge-hl-stroke, <base>)` and `stroke-width: var(--sd-edge-hl-width, <base>)` when neither selected nor flow-marked; a selected or flow-marked connector keeps its literal stroke; the label / pill carries `data-edge-label-for="<id>"`.
- [ ] T006 Implement T005 in `app/deck-edge.tsx`, `app/merged-edge.tsx` and pass the colour variable to `app/edge-ends.tsx` so arrowheads follow (R2). No visual change without focus.
- [ ] T007 Write a failing CSS-source test `apps/app/src/focus-look-css.test.ts` (like `apps/app/src/flow-mode-css.test.ts`) asserting in `apps/app/src/index.css`: `[data-focus-mode] .react-flow__edge.in-focus` sets `--sd-edge-hl-stroke: var(--color-ink)` and `--sd-edge-hl-width: 2.75px` in **separate** declarations; non-member connectors and labels use `var(--color-deck-dim-edge)`, cards `var(--sd-deck-dim)`; neighbour cards (`.in-focus` that is not the focus card, class `sd-focus-neighbour`) get Secondary border and lip; transitions use `var(--sd-dur-dim)`.
- [ ] T008 Implement T007 in `apps/app/src/index.css` and add the `sd-focus-neighbour` class for pinned-focus members other than `focusId` in `app/deck-to-flow.ts` (keep the cache check in step; add a `deck-to-flow.test.ts` case).

**Checkpoint**: pinned focus (F) already shows the Deck highlight look; nothing else changed.

---

## Phase 3: User Story 1 — Hover a card to see what it connects to (P1) 🎯 MVP

**Goal**: resting on (or keyboard-focusing) a card highlights its connections and neighbours and dims the rest, without a click or toggle.

**Independent test**: on the bench deck, hover a card → non-neighbours dim within one frame after the rest delay; leaving restores; quick sweeps do nothing (Story 1, quickstart 1–6).

### Tests (write first)

- [ ] T009 [P] [US1] Failing tests with fake timers in `app/hover-focus/use-hover-focus.test.ts`: 150 ms rest before `hoverFocus` is set; a sweep under 150 ms sets nothing; card → card while showing switches at once; leave clears after 100 ms and re-entering within it cancels; `pointerType: 'touch'` ignored; keyboard focus sets `source: 'keyboard'` at once and clears on blur; suspended (and any shown hover cleared) while `focusMode`, `activeFlow`, `flowSession`, dragging, resizing, reconnecting, connecting, hand tool, or an open popover / menu; stickies, `port:` and `scope-label:` ids never start a hover.
- [ ] T010 [P] [US1] Failing tests in `app/hover-focus/hover-focus-style.test.tsx`: renders no `<style>` and no `data-hover-focus` when `hoverFocus` is null; otherwise one `<style>` whose selectors name exactly the focus set's members and edges (ids escaped with `CSS.escape`, including `collapsed:` and `merged:` ids), dims non-members with the tokens from T007, sets the two highlight variables in separate declarations, and never emits `inert` / `aria-hidden`; a card with no connections highlights alone; a saved view's `view-dimmed` cards are not raised above their view opacity (FR-004).
- [ ] T011 [P] [US1] Failing `app/deck-to-flow.test.ts` case: changing `hoverFocus` returns the **same** RF node and edge objects (R1, contract "Hover changes no RF object").

### Implementation

- [ ] T012 [US1] Implement `useHoverFocus()` in `apps/app/src/editor/hover-focus/use-hover-focus.ts` per research R3 (returns `onNodeMouseEnter`, `onNodeMouseLeave`, `onCardFocus`, `onCardBlur`; reads suspension from `useUiStore` and the wrapper's `data-dragging` / RF `connection.inProgress`).
- [ ] T013 [US1] Implement `HoverFocusStyle` in `apps/app/src/editor/hover-focus/hover-focus-style.tsx` per R1: subscribes to `hoverFocus`, computes `focusSet(deck, graph, id)`, renders the `<style>`, and sets / removes `data-hover-focus` on the wrapper through a ref.
- [ ] T014 [US1] Wire both into `app/canvas.tsx`: pass the handlers to `<ReactFlow onNodeMouseEnter / onNodeMouseLeave>`, call `onCardFocus` from the roving-focus path when `pointerFocus.current` is false, render `<HoverFocusStyle>` inside the wrapper. `Canvas` must not subscribe to `hoverFocus` (T011 guards it).
- [ ] T015 [US1] Clear `hoverFocus` from `app/use-canvas-handlers.ts` at drag / resize / reconnect / connect start, and from `app/use-canvas-shortcuts.ts` when F pins focus or a flow opens.
- [ ] T016 [P] [US1] Add a polite announcement for keyboard focus only ("<title>: n connections") through `app/announcer.tsx`, with a test in `app/announcer.test.tsx`; pointer hover announces nothing.
- [ ] T017 [US1] Bench hook: add `hover(id)` to `window.__sododeckBench` in `apps/app/src/routes/bench-page.tsx` (sets `hoverFocus` directly, skipping the rest delay) and a "hover → focus painted" action scenario (target 16 ms, median of 5) in `apps/app/bench/perf.bench.ts`.

**Checkpoint**: US1 complete and demoable on its own (quickstart 1–6).

---

## Phase 4: User Story 2 — Parallel connectors bundle into one curve (P1)

**Goal**: two or more automatic-route connectors between the same two visible cards draw as one curve with an Ink "×n" pill; the pill fans them out; the curve opens the list.

**Independent test**: three connectors between two cards → one curve "×3"; fan out → three spread connectors; fold back (Story 2, quickstart 7–12).

### Tests (write first)

- [ ] T018 [P] [US2] Failing tests in `app/bundles.test.ts` for `bundleEdges` (contract): pairs with ≥ 2 eligible edges bundle in either direction with `direction` `a-to-b` / `b-to-a` / `both`; a single edge stays plain; self-loops and `edge.route !== undefined` stay plain; edges in `exclude` stay plain and the rest of the pair re-bundles with the lower count (or turns plain at 1); `off: true` bundles nothing; a fanned id returns its edges as plain with `fanIndex` / `fanCount` and still lists the bundle with `fanned: true`; ends resolve through `graph.representative`; port edges (inside rep ↔ `port:`) bundle too; id is `bundle:a|b` with `a < b`; same result object for equal inputs; timing at 500 / 1,000 logged (< 2 ms).
- [ ] T019 [P] [US2] Failing tests in `app/routing/route-path.test.ts`: `spread` undefined or 0 returns exactly today's path for curved, elbow and straight; a non-zero spread moves curved control points along the chord normal, the elbow middle segment, and straight ends along their sides, with the label point moved with it.
- [ ] T020 [P] [US2] Failing tests in `app/focus-set.test.ts`: a folded bundle contributes its `bundle:` id (not its edges); fanned edges contribute their own ids; port edges make the proxy a member (also needed by US3).
- [ ] T021 [P] [US2] Failing component tests in `app/merged-edge.test.tsx` for `data.kind: 'bundle'`: the pill is a `button` named "3 connections between A and B" with `aria-expanded`; clicking it calls `toggleBundleFan`; at System level it renders as a dot with the same accessible name and no visible number, at Landscape level no pill; clicking the curve opens the popover; arrowheads for each direction present; a `merged:` (collapsed group) pill keeps opening the popover on click and also takes the Ink pill look.
- [ ] T022 [P] [US2] Failing tests in `app/merged-edge-popover.test.tsx`: for a bundle its first item is a "Fan out" / "Fold" button that calls `toggleBundleFan`, then it lists each connector with label and direction plus Select (selects that edge) and Delete (through `requestDelete`, one undo step).

### Implementation

- [ ] T023 [US2] Implement `bundleEdges` and `BUNDLE_EDGE_PREFIX` in `apps/app/src/editor/bundles.ts` per research R4 (cache: `WeakMap` on `graph` + options key).
- [ ] T024 [US2] Add the optional `spread` to `routedPath` in `app/routing/route-path.ts` per R6 (render-only; `edge.route` untouched).
- [ ] T025 [US2] Extend `focusSet` in `app/focus-set.ts` with the optional `bundles` argument and port edges (T020).
- [ ] T026 [US2] In `app/canvas.tsx`, compute `bundleEdges(deck, graph, { exclude, fanned, off })`: `exclude` = edges with a mark in the shown flow's overlay while `activeFlow !== null`, `off` = `flowSession !== null`, `fanned` = `fannedBundles`; pass the result to `toFlowEdges` and `HoverFocusStyle`; prune `fannedBundles` to existing bundle ids.
- [ ] T027 [US2] In `app/deck-to-flow.ts`, emit bundles as `type: 'merged'` edges with `data.kind: 'bundle'` (own cache keyed by bundle id + edge ids + direction + fanned + focus state) and fanned connectors as plain edges with `data.fan: { index, count }`; plain edges that join a bundle are no longer emitted alone. Add cache cases to `app/deck-to-flow.test.ts` (an edit to one edge keeps the other RF objects; moving a card while a bundle is fanned keeps it fanned and moves the spread connectors with it).
- [ ] T028 [US2] Render the bundle in `app/merged-edge.tsx` (pill toggles fan, curve opens popover, `aria-expanded`, pressed look while fanned; Ink pill per `DESIGN.md` 22px, 11.5 / 700, also for `merged:` pills; System level dot, Landscape no pill via `data.level`) and apply `data.fan` as `spread = (index − (count − 1) / 2) × 14` in `app/deck-edge.tsx`.
- [ ] T029 [US2] Extend `app/merged-edge-popover.tsx` for bundles with a first "Fan out" / "Fold" item and per-connector Select and Delete (T022).
- [ ] T030 [US2] Keys and pane: in `app/use-canvas-shortcuts.ts` Esc folds all fanned bundles (after closing an open popover), ⏎ on a focused `bundle:` edge opens its popover (same branch as `MERGED_EDGE_PREFIX` in `case 'enter'`), `E` cycles a card's connections including bundles; in `app/use-canvas-handlers.ts` a pane click folds and `onEdgeClick` on a `bundle:` id opens the popover instead of selecting. Tests in `app/use-canvas-shortcuts.test.tsx` and `app/use-canvas-handlers.test.ts`.

**Checkpoint**: US1 + US2 work together: hovering a card highlights a bundle as one connection (Story 2.3).

---

## Phase 5: User Story 3 — Drill-in shows where things connect outside (P2)

**Goal**: drill-in shows "Inside <name> · n" and dashed Outside proxies that take the user to the real card.

**Independent test**: drill into a group with external connections → header and proxies (inputs left, outputs right); ⏎ on a proxy leaves the drill-in and lands on the real card (Story 3, quickstart 13–15).

### Tests (write first)

- [ ] T031 [P] [US3] Failing tests in `app/proxy-layout.test.ts` for `proxyLayout` (R7): incoming-only proxies go left, the rest right, 72 from `scopeBounds`; 150 × 52; sorted by mean inside-anchor y; 16 gap, no overlaps with 15 proxies in one column; `kind` and `title` from the outside node; one proxy per outside card; none when nothing connects outside.
- [ ] T032 [P] [US3] Failing component tests in `app/outside-proxy-node.test.tsx` (replacing `port-pill-node.test.tsx`): a `button` named "<title>, outside, press Enter to go to it" showing the type icon, title and "Outside"; click focuses without leaving; double-click and ⏎ call `drillUp`, select the real card (or the collapsed group representative), focus it and centre it; it has no drag or resize affordance.
- [ ] T033 [P] [US3] Failing component tests in `app/scope-label-node.test.tsx`: shows the drilled name and count (visible cards + collapsed members), `aria-hidden`, not focusable.
- [ ] T034 [P] [US3] Failing `app/deck-to-flow.test.ts` cases: proxies use `proxyLayout` rects with `draggable: false`, `selectable: false`, `connectable: false`; one `scope-label:` node per drill-in; none at the top level.

### Implementation

- [ ] T035 [US3] Implement `proxyLayout` in `apps/app/src/editor/proxy-layout.ts` and make `exportPortRects` in `app/deck-to-flow.ts` delegate to it (one placement for canvas and export).
- [ ] T036 [US3] Implement `OutsideProxyNode` in `apps/app/src/editor/outside-proxy-node.tsx` (move the "go to" logic from `port-pill-node.tsx`, add centring with `centredOn` in `requestAnimationFrame`, duration 0 under reduced motion; icon via `KIND_STYLE` / `KIND_FALLBACK`); register it as `port` in `app/canvas.tsx`; delete `app/port-pill-node.tsx` and its test.
- [ ] T037 [US3] Implement `ScopeLabelNode` in `apps/app/src/editor/scope-label-node.tsx` (`DESIGN.md` Groups label look) and derive it in `app/deck-to-flow.ts` with the `scope-label:` prefix; register in `app/canvas.tsx`.
- [ ] T038 [US3] Teach `app/use-canvas-handlers.ts` and `app/canvas.tsx` roving focus the prefixes: `port:` is focusable (arrow keys reach proxies, ⏎ activates), never selected, dragged or connected; `scope-label:` is ignored by clicks, marquee and drags.
- [ ] T039 [US3] Check hover focus inside a drill-in treats proxies as neighbours and bundles proxy connectors (T020, T018 port cases); add an integration test in `app/canvas.test.tsx` (hover an inside card → the proxy is in the style's member list).

**Checkpoint**: all three stories work independently and together.

---

## Phase 6: Polish & cross-cutting

- [ ] T040 [P] Export (R9): in `app/export/scene.ts` use `bundleEdges` (folded, flow edges excluded when exporting a flow) and `proxyLayout`; draw the Ink "×n" pill and the dashed proxy in `app/export/render-svg.ts` / `app/export/edge-geometry.ts`; tests in `app/export/*.test.ts` that hover and pinned focus never reach the scene; and a round-trip test that hovering, fanning a bundle and drilling in leave the deck's JSON export byte-identical (FR-016, SC-007).
- [ ] T041 [P] Accessibility pass: light / dark contrast of the Ink pill and proxy text in `packages/ui/test/contrast.test.ts`, reduced motion removes the dim transition (CSS-source test from T007), all states readable without colour.
- [ ] T042 [P] Docs: ADR `docs/decisions/0023-derived-connector-bundles.md` (bundles and proxies are derived, never stored; only automatic-route connectors bundle; connectors with their own route, waypoints or style (022) always draw on their own; hover focus is CSS-only); `apps/app/CLAUDE.md` (hover focus mechanism, `bundle:` / `scope-label:` prefixes, proxies), `.claude/skills/react-flow/SKILL.md` map rows (`bundles.ts`, `hover-focus/`, `proxy-layout.ts`), `docs/backlog.md` 034 status and the 022 note (adjusted / styled connectors never bundle; 022 decides highlight colour for styled connectors).
- [ ] T043 Run `pnpm bench`; save to `specs/034-connection-focus-and-drill/bench-after.md` with the before / after table, "hover → focus painted" (< 16 ms, SC-001) and pan / drag / focus within run-to-run variation (SC-005).
- [ ] T044 Walk `quickstart.md` steps 1–17 in light and dark; record results in `specs/034-connection-focus-and-drill/quickstart-results.md` and screenshots of steps 1, 7, 9 and 13 in `specs/034-connection-focus-and-drill/screens/`.
- [ ] T045 Definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all green (smoke suite unchanged, incl. no third-party requests); no skipped or `.only` tests.

---

## Dependencies

```text
Setup (T001–T002)
  └─▶ Foundational (T003–T008)
        ├─▶ US1 (T009–T017)  🎯 MVP
        ├─▶ US2 (T018–T030)  ── T026 also feeds US1's HoverFocusStyle (bundles as one connection)
        └─▶ US3 (T031–T039)  ── T039 needs T020 / T025 (US2) for proxies as neighbours
              └─▶ Polish (T040–T045)
```

- US1 and US2 are both P1 and can run in parallel after Phase 2; Story 2.3 (hover a bundle) is verified once both are in.
- US3 can start after Phase 2; only T039 waits on US2's T025.
- Within each story: tests → pure modules → `deck-to-flow` → components → canvas wiring → keys.

## Parallel examples

- **After Phase 2**: T009, T010, T011 (US1 tests) ‖ T018, T019, T020, T021, T022 (US2 tests) ‖ T031, T032, T033, T034 (US3 tests).
- **US2 implementation**: T023 (`bundles.ts`) ‖ T024 (`route-path.ts`) ‖ T025 (`focus-set.ts`), then T026 → T027 → T028 / T029 → T030.
- **US3 implementation**: T035 (`proxy-layout.ts`) ‖ T037 (`scope-label-node.tsx`), then T036 → T038 → T039.
- **Polish**: T040 ‖ T041 ‖ T042, then T043 → T044 → T045.

## Implementation strategy

1. **MVP = Phase 1 + 2 + US1**: hover focus with the Deck highlight look. Run the bench (T017 scenario) before going further: if "hover → focus painted" misses 16 ms, fix R1 before building on it.
2. **US2**: bundles, then fan-out, then popover and keys.
3. **US3**: proxies and scope label.
4. **Polish**: export, accessibility, docs, bench after, quickstart, DoD.

Commit after each checkpoint with Conventional Commits (`feat(app): …`, `test(app): …`, `docs: …`), no AI attribution lines.
