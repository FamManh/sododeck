# Quickstart: validate 010 (zoom, groups, focus)

Prerequisites: Node ≥ 24, `pnpm install` done, on the `010-zoom-groups-focus` branch. The pure contracts are in [contracts/visible-graph.md](contracts/visible-graph.md) and the UI behavior in [contracts/zoom-groups-focus-ui.md](contracts/zoom-groups-focus-ui.md).

## 1. Baseline benchmark (before any canvas change)

```bash
BENCH_GROUPS=1 pnpm bench      # also run once without BENCH_GROUPS
```

Copy the report table into `specs/010-zoom-groups-focus/bench-before.md`.

## 2. Unit and component tests

```bash
pnpm --filter @sododeck/app test -- visible-graph levels focus-set collapse-flow-marks deck-to-flow outline ui-store
pnpm --filter @sododeck/app test -- zoom-control level-indicator group-boundary-node collapsed-group-node merged-edge top-bar canvas use-canvas-shortcuts group-inspector
```

Expected: green. Key cases:

- `visible-graph.test.ts`:
  - 2 groups joined by 12 edges, one collapsed → 1 merged edge, count 12; expanded → 12 plain edges (SC-004);
  - nested collapse restores the inner state;
  - `parent` cycles and missing references don't throw;
  - children appear only in their parent's scope (Q1);
  - port pills for edges that leave the scope;
  - same inputs return the same object.
- `levels.test.ts`: 45 → landscape, 46 → system, 90 / 91, 150 / 151; hysteresis holds the level at 46% when coming from landscape; drilled into a node → component.
- `canvas.test.tsx` / `use-canvas-shortcuts.test.tsx`:
  - double-click and Enter drill in; Esc / Backspace go up only with nothing selected, and Backspace with a selection still opens the delete confirmation;
  - Space toggles collapse; F toggles focus;
  - dimmed nodes carry `aria-hidden` and `inert`.
- A document-identity test: `serializeDeck` is equal before and after drill, collapse, focus and level changes, and `editor.canUndo` stays false (SC-005, FR-041).

## 3. Manual check (dev server)

```bash
pnpm dev   # http://localhost:5173
```

1. Library → Import `packages/schema/examples/full.sododeck.json`.
2. Zoom from 100% down to 42%: the indicator reads **Landscape**, components are kind tiles and groups are solid regions. At 60% it reads System, at 120% Container, at 160% Component.
3. Double-click **Delivery platform** (it has children): its containers show at Component level, and the breadcrumb reads `… / System view / Delivery platform`.
4. Double-click the **Core services** label: only Order Service and Dispatch show, fitted, and the breadcrumb adds `Core services`. Outside connections end at dashed port pills; click one to go up and select that component.
5. With nothing selected, press Backspace twice to return to the top. Clicking the **System view** crumb works too.
6. Focus the Platform label (Tab to the canvas, arrow keys), press Space: it collapses into a card with "n nodes · m edges", and connections to Clients / External merge into ×N pills. Hover a pill to see the list, then press Enter on a row to expand the group and select that connection.
7. Select API Gateway and press F: only it and its neighbours stay bright. Select Order Service to move the focus. Press F to turn focus off.
8. Drill into Delivery platform, then open a flow from the Flows tab: the canvas goes back to the whole deck and announces it. Collapse Core services with Space (flow mode allows it): the card shows the ring, merged edges carry the step badges, and stepping with → onto a hidden step shows the dot and "inside Core services" in the player. A step on a merged connection moves the token onto it. Click the card: the first step inside it becomes current. Double-click, Enter-drill and F do nothing; Esc exits flow mode.
9. Repeat 2–8 in the dark theme, and under macOS "Reduce motion" (the card's dot is static).
10. Compare against `docs/design/screens/13`, `19` and `64`–`71` (light and dark). Save screenshots to `specs/010-zoom-groups-focus/screens/` and notes to `visual-check.md`.

## 4. After-change benchmark

```bash
BENCH_GROUPS=1 pnpm bench
```

Expected:

- the `groups-collapsed` scenario runs at ≥ 60 fps average, with p95 ≤ 16.7 ms (SC-001);
- `collapse-toggle` and `focus` each take ≤ 100 ms (SC-002);
- the default scenario does not regress by more than 5% against `bench-before.md`.

Record the results in `bench-after.md`.

## 5. Definition of done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

All must pass. The e2e smoke suite is unchanged, and no new e2e tests are added (constitution VI).
