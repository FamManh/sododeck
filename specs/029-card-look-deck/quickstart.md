# Quickstart: validating 029 (Card Look "Deck")

## Prerequisites

- `pnpm install` (Node ≥ 24), on branch `029-card-look-deck` with `main` at or after `c1c8acd` (036).
- Before any code change: `pnpm bench` (plus `BENCH_ROUTES=1`, `BENCH_COLOURS=1`, `BENCH_GROUPS=1`) → copy the report numbers to `bench-before.md`.

## Automated checks

```bash
pnpm schema:generate                      # after adding EdgeShape / EdgeStyle
pnpm --filter @sododeck/schema test       # Ajv/Zod parity, S7 fixture, coverage, key order
pnpm --filter @sododeck/model test        # setEdgeShape, edgeShape, reset-route pinning, round-trip, concurrency
pnpm --filter @sododeck/ui test           # ink-on-chip ≥ 4.5:1, dot-on-fill ≥ 3:1, both themes
pnpm --filter @sododeck/app test          # route-path geometry, card-layout, actions, drawer, export scene/svg
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

## Manual scenarios (`pnpm dev`, app on :5173)

| #   | Do                                                                               | Expect                                                                                                                           | Spec        |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Open the demo deck; export JSON before and after opening                         | Deck look everywhere; JSON identical                                                                                             | US1, SC-001 |
| 2   | Compare canvas with screens 117, 119–122, 125–126 (light, dark)                  | Frame, lip, tile, title, tags, states match (§g-66–§g-80 deviations allowed)                                                     | SC-008      |
| 3   | Hover, select, drag a card with a problem; screenshot in greyscale               | Lift + 5px lip; orange solid outline; dashed Clay outline + "⚠ n" badge; tilt while dragging; drop position equals untilted drop | US2, SC-003 |
| 4   | Zoom 30 % → 400 % on the bench deck; read a card's size in the drawer / devtools | Size constant; no lip < 60 %; tag dots at System; icon only at Landscape                                                         | US4, SC-002 |
| 5   | Select 3 connectors (mixed types); toolbar → Line type → Straight; ⌘Z            | All straight; one undo restores each                                                                                             | US3, SC-005 |
| 6   | On an old deck with a moved elbow segment: switch Curved → Elbow                 | Segment back where it was                                                                                                        | FR-026      |
| 7   | Pick Elbow, draw a new connector; reload; draw another                           | First elbow, second curved                                                                                                       | FR-028a     |
| 8   | Collapse a group with outside connectors; press ⏎                                | Fanned hand, merged connectors with counts; expands                                                                              | US5         |
| 9   | Export SVG and PNG of the demo deck                                              | Tags and line types drawn; resting cards                                                                                         | US6, SC-009 |
| 10  | OS "reduce motion" on; hover cards                                               | No lift animation                                                                                                                | FR-042      |

## Bench (after)

`pnpm bench` with the same flags plus `BENCH_LINE_TYPES=1` → `bench-after.md`. Pass: no lower median pan FPS and no more long frames than `bench-before.md`, beyond noise (SC-004, FR-041).

## Evidence to keep

`specs/029-card-look-deck/screens/` (light and dark captures for rows 117–126), `visual-check.md`, `bench-before.md`, `bench-after.md`.
