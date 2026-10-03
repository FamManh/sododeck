# Quickstart: Typed Fields (032)

How to check the feature works. Behaviour: [spec.md](spec.md); names and keys:
[contracts/fields-ui.md](contracts/fields-ui.md); API rules: [contracts/fields-api.md](contracts/fields-api.md).

## Prerequisites

- `pnpm install`, Node ≥ 24 (030 is on `main`).
- Bench baseline **before** any change: `pnpm bench`, `BENCH_TYPES=1 pnpm bench` → `bench-before.md`.

## Automated checks

```bash
pnpm schema:generate                 # fields, fieldDefaults, values
pnpm --filter @sododeck/schema test  # parity, S12 / S13 fixtures
pnpm --filter @sododeck/model test   # fieldsOfType, materialise, ops, conversions, round-trip, problems
pnpm --filter @sododeck/app test     # card fields block, layout, drawer editor, bulk, search, export
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
BENCH_FIELDS=1 pnpm bench            # → bench-after.md
```

## Manual walk (pnpm dev, http://localhost:5173), light then dark

Record results in `quickstart-results.md`, screenshots in `screens/` (compare with frames 120, 124).

1. **Defaults (US1).** New deck → add a Task: drawer lists Status, Assignee, Due date, Owner; JSON
   has no `fields` / `values`. Set Status "In progress", Assignee "Lan", Due 14 Oct → the card
   shows the status in the header and Lan / 14 Oct chips (frame 120).
2. **Add field (US1).** On a Warehouse: Add field "Temperature zone", Select, options Ambient /
   Chilled / Frozen, Show on card → ⏎. Every warehouse lists it; JSON shows `fields` with the
   warehouse defaults materialised and `fieldDefaults: ["warehouse"]`.
3. **Kinds and validation (US1).** Enter a value of each kind; try letters in Number, 140 in
   Capacity, end before start in a range, `ftp:x` in a link → refused with a message.
4. **On card (US2).** Toggle Capacity / SLA / Region / Status on and off: every warehouse updates;
   "+N fields" counts hidden values and opens the drawer. Zoom to System (chip dots, no rows) and
   Landscape (none). Resize a card: height never below the fields block.
5. **Manage (US3).** Rename SLA, recolour an option, reorder by drag and ⌥↑, "Also use for…"
   Truck route, delete Docks used on 4 cards (count shown), change Estimate Text → Number with one
   non-number (confirmation "1 value will be cleared"). ⌘Z each.
6. **Built-ins (US4).** Service card lists Tech, Host, Owner; turn Owner on → person chips on every
   service; rename / delete not offered. Typing "lan" in Assignee writes "Lan".
7. **Elsewhere (US5).** Select three warehouses → bulk "Mixed" → set Region once. Search "Frozen".
   Export PNG and SVG. Copy a card into another deck → values kept, Problems lists them.
8. **Older deck.** Open a deck saved before 032 → unchanged, JSON unchanged.
9. **Keyboard only.** Steps 1, 2, 4 and 5 without the pointer.
