# Quickstart: Shapes (031)

How to check the feature works. Behaviour: [spec.md](spec.md); names and keys:
[contracts/shape-ui.md](contracts/shape-ui.md); geometry guarantees:
[contracts/shape-api.md](contracts/shape-api.md).

## Prerequisites

- 030 built and merged. `pnpm install`, Node ≥ 24.
- Bench baseline **before** any change: `pnpm bench` → `bench-before.md`.

## Automated checks

```bash
pnpm schema:generate                 # Node.display
pnpm --filter @sododeck/schema test  # parity, display fixtures
pnpm --filter @sododeck/model test   # registry shapes, setNodeDisplay, empty groups, round-trip
pnpm --filter @sododeck/app test     # shape-geometry, shape node, two forms, frame tool, export
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
BENCH_SHAPES=1 pnpm bench            # → bench-after.md
```

## Manual walk (pnpm dev, http://localhost:5173), light then dark

Record results in `quickstart-results.md`, screenshots in `screens/` (compare with frames 120, 122,
123, 127).

1. **Shapes tab (US1).** New deck → Add → Shapes: 13 tiles. Add each of the eleven shapes; type a
   title; long title cut at 3 lines with tooltip.
2. **Process (US1).** Build Start checkout (pill) → Validate cart (rectangle) → Payment OK?
   (diamond) → Orders DB (cylinder) → Order shipped (pill); connectors meet the outlines (zoom to
   300 % on the diamond's points and the parallelogram's slanted sides).
3. **Resize, colour, zoom, states (US1).** Resize a diamond and an actor; colour a cylinder blue;
   zoom to Landscape (geometry only); hover, select, drag (tilt), give one a problem, play a flow
   through them.
4. **Frame first (US2).** Add → Frame → drag a rectangle on empty canvas → type "Payments" → drag
   three cards in, one out. Draw a frame around two existing cards → both join; partly covered
   cards do not. Move a frame over other cards → nothing joins. Draw a frame inside it → child
   group. ⌘Z each step. An empty frame collapses with count 0, saves, exports.
5. **Two forms (US3).** Orders DB card with description, fields, tags, colour, connections →
   "Show as shape" → cylinder → back → everything unchanged (JSON overlay). Three mixed → "Mixed".
6. **Sticky and Text (US4).** Add → Sticky equals the rail sticky; Add → Text has no outline.
7. **Older deck (US5).** Open a deck saved before 031: same look, packs unchanged, JSON unchanged.
8. **Export (US5).** PNG and SVG of the board from steps 2–5: geometry, lip, colours, titles,
   connectors on outlines, no tilt.
9. **Keyboard only.** Add a shape, switch a form, place a frame with ⏎.
