# Quickstart: validate Table Relationships (042)

## Prerequisites

- 041 (table card) merged on `main`; branch `042-db-relationships` rebased on it.
- `pnpm install`; Node ≥ 24.
- A "Shop" deck with relationships: the 040 round-trip fixture (`packages/model/test` "Shop"
  schema) imported through the deck menu (Import…), or the sample used by 041's quickstart.

## Automated checks

```bash
pnpm --filter @sododeck/schema test      # RelationshipDisplay parity fixtures
pnpm --filter @sododeck/model test       # round-trip, setRelationshipDisplay ops, concurrency
pnpm --filter @sododeck/app test         # geometry, marks, labels, drag, focus, settings, export
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

Unit / component suites expected (next to code in `apps/app/src/editor`):

| Area                    | Asserts                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `rowAnchorY`            | row centre for All / Keys; pill and title fallbacks; missing id → title                    |
| Keys rule               | connected non-key row kept at Keys; "+n" excludes it                                       |
| `relationshipSides`     | facing sides; overlap → shorter side, right on tie; self → right                           |
| `relationshipPath`      | stubs of 24 on curved / elbow; straight uses line angle; bends honoured                    |
| `selfLoopPath`          | bulge `max(56, Δy/2)`; never inside the card box                                           |
| `endOf` / `crowPath`    | 4 cardinalities × optional flags; sizes 12 / ±6 / 16 / r 4                                 |
| composite               | stubs per visible member; ≤ 1 visible → single end; mismatched lengths draw                |
| `relationshipLabel`     | name, ON DELETE, "(a, b)", "n–n"; `no-action` omitted                                      |
| label visibility        | follow / hover / always / off × Labels tool × focus                                        |
| `typeMismatch`          | type, size, enum; case-insensitive                                                         |
| `columnTargetAt`        | row hit; header → single PK; composite PK → none; outside → none                           |
| `columnConnectionCheck` | self allowed; second FK allowed; same pair same direction → existing id                    |
| connect actions         | create writes n–1 + optional sides (nullable / not null / PK); one undo; duplicate selects |
| reconnect               | single end retargets in one step; composite snaps back + hint                              |
| bundles                 | relationship never folds at ≥ 90 %; folds at System                                        |
| `columnFocusSet`        | edges, members, rows; none for unrelated column                                            |
| ports / keyboard        | ports named, ↓ / ↑ row focus, C opens column connect popover and connects                  |
| Deck settings           | "Show on relationships" controls, one undo each                                            |
| export                  | SVG has relationship paths, marks and Always labels; scene perf budget kept                |

## Manual walkthrough (compare with frames 159, 158, 162; light and dark)

1. Open "Shop" at 100 %, deck detail All. `orders.customer_id` → `customers.id`: zero-or-many at
   `orders`, exactly one at `customers`; line on the row centres. Drag `customers` to the other
   side: ends switch sides, stay on the rows.
2. Switch the line type to elbow and straight: stubs on curved / elbow, marks along the line on
   straight.
3. Check `categories.parent_id` loop, `shipment_items` composite bracket, the two `addresses`
   keys (two lines), `products` ↔ `categories` n–n with an "n–n" pill.
4. Drag from `reviews.product_id`'s port onto `products.id`: n–1 created, crow's foot at
   `reviews`; ⌘Z removes it. Drop an `int` column on a `uuid` key: "Types differ" chip, still
   connects. Drop on a table header: connects to its PK. Press Esc mid-drag: nothing.
5. Keyboard only: Tab to `reviews`, ↓ to `customer_id`, C, type "cust", Enter.
6. Hover `orders.customer_id`: its line, `customers.id` and `customers` lit; the rest dims.
7. Deck detail Keys: connected rows stay; set `addresses` to Names: lines meet the title. Zoom to
   60 %: lines run table to table; `orders`–`addresses` bundles "×2".
8. Deck settings → Show on relationships: Labels Always, Notation 1 / n, Cardinality ends off;
   reload; check another tab.
9. Select a relationship, drag its `customers` end onto `accounts.id`; drag a composite end: snaps
   back with the hint. ⌫ deletes; ⌘Z restores.
10. Export PNG and SVG with labels Always: same lines, marks and labels as the canvas.

## Performance

```bash
BENCH_TABLES=150 pnpm bench              # before (plain connectors between tables)
BENCH_TABLES=150 BENCH_REL=1 pnpm bench  # after (relationships with column ends)
```

Save the numbers as `bench-before.md` / `bench-after.md` in this folder; pan / zoom / drag frame
time within 10 % (SC-006).
