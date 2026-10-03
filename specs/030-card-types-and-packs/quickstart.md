# Quickstart: Card Types and Packs (030)

How to check the feature works. Behaviour: [spec.md](spec.md); names and keys:
[contracts/type-ui.md](contracts/type-ui.md); data: [data-model.md](data-model.md).

## Prerequisites

- `pnpm install`, Node ≥ 24.
- Bench baseline **before** any change: `pnpm bench` → `bench-before.md`.

## Automated checks

```bash
pnpm schema:generate                 # TypeId / PackId / packs; NodeKind removed
pnpm --filter @sododeck/schema test  # parity, new fixtures (unknown ids valid, packs: [] invalid)
pnpm --filter @sododeck/model test   # registry, deckPacks, setPackOn, createDeck packs, problems, round-trip
pnpm --filter @sododeck/ui test      # TYPE_STYLE, icon drift
pnpm --filter @sododeck/app test     # Add flyout, packs view, type picker, views, export icons, thumbnail
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
BENCH_TYPES=1 pnpm bench             # → bench-after.md
```

## Manual walk (pnpm dev, http://localhost:5173), light then dark

Record results in `quickstart-results.md`, screenshots in `screens/`.

1. **New deck (US1).** Library → New deck → rail Add: search, tabs All · Architecture · Process ·
   Logistics · Data, sections 7 / 3 / 2 / 1, footer "Packs · 4 on". Compare with frame 127.
2. **Add (US1).** `/`, type "ware", ⏎ → Warehouse added with the title in edit. Process tab → drag
   Task onto the board. Press 3 → the third visible tile is added.
3. **Packs (US2).** Footer → turn Logistics off: Warehouse leaves Add, the warehouse card stays,
   still editable, exportable and searchable. ⌘Z turns it back on. Turn everything off but one:
   the last switch is disabled with "At least one pack stays on".
4. **Type change (US3).** Select a Service → toolbar "Type: Service" → Queue; then three mixed
   cards → "Type: Mixed" → Task; one ⌘Z each; ids, titles, connections unchanged (JSON overlay).
5. **Views, search, export, library (US4).** View settings "Hide types" → hide Warehouse; search
   "truck route"; export PNG and SVG; check the library thumbnail.
6. **Older deck (US5).** Open a deck saved before 030: same look, Add shows only Architecture,
   "Packs · 1 on", JSON has no `packs`. Export → no `packs` key.
7. **Unknown type (US5).** Import a file with a node `"type": "robot"`: loads, fallback tile, name
   "robot", Problems lists "Unknown card type robot"; export keeps `"robot"`.
8. **Copy check.** No UI text says "Kind" anywhere (toolbar, drawer, bulk drawer, menu, view
   settings, tooltips).
9. **Keyboard only.** Steps 1–4 without the pointer.
