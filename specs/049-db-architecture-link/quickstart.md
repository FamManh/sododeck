# Quickstart: validating Database Architecture Link

## Prerequisites

- `pnpm install` (Node ≥ 24); then `pnpm dev` (app on http://localhost:5173).
- After schema edits: `pnpm schema:generate`.

## Automated checks

```bash
pnpm --filter @sododeck/schema test      # generate:check + Ajv/Zod parity incl. touches fixtures
pnpm --filter @sododeck/model test       # touches ops, owner op, cascade, round-trip, integrity
pnpm --filter @sododeck/app test         # touched sets, card chip, actions, Touches section, samples
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench                               # run before and after; report both numbers
```

## Manual walkthrough (use the Shop sample, or a deck with two database cards)

1. **Count and chip.** Orders DB shows "N tables inside" and the deck dialect chip. Change the
   dialect in Deck settings: every database card's chip updates.
2. **Create inside.** Press Enter on Orders DB, add a table `refunds`, close the drill-in: the
   count went up by one.
3. **Move.** Right-click `refunds` → Move to database… → Customers DB. Counts change by ∓1. Undo
   returns it.
4. **Proxy.** Inside Orders DB, a foreign key to `customers` shows a dashed proxy named
   `customers`. Double-click it: you land on the real table. Move `customers` into Orders DB: the
   proxy becomes a normal connector.
5. **Touches.** Open the Checkout flow, select "Create order", open Touches, add `orders` (write),
   `order_items` (write), `customers · email` (read). Flip one toggle, remove one, re-add it.
6. **Play, architecture level.** Play the flow to "Create order": Orders DB shows "writes orders
   +1".
7. **Play, drilled in.** Drill into Orders DB without stopping: `orders` and `order_items` are lit,
   `customers · email` is not here (named in the player as another card), W / R markers show on the
   rows (check in greyscale), a touched column that was folded is visible. Press Next: the player
   stays and the lit tables follow.
8. **Filtered view.** In a view that hides `order_items`, the player says "hidden in this view" and
   the saved filter is unchanged.
9. **Delete a card.** Delete Orders DB: the dialog says N tables are kept. Confirm, then undo:
   card and ownership return.
10. **Export SQL.** Orders DB → Export SQL: only its tables, deck dialect; in a Generic deck the
    dialog asks the dialect first; a foreign key to another card's table is a comment.
11. **Samples.** Open Shop, SaaS auth and Blog files (import, or the samples test): each validates
    and the flows play.

## Expected outcomes

Each step matches the acceptance scenarios in `spec.md`. The smoke e2e suite stays green with no
third-party requests; no new e2e tests are added.
