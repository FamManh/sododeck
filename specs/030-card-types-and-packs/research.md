# Research: Card Types and Packs (030)

Decisions for [plan.md](plan.md). Names checked on `main` (2026-10-03, after 022 docs / 033 / 035).

## Where kinds are hard-coded today

| Place                                                                                                                                              | What it does with the kind                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/schema/schema/v1.json`                                                                                                                   | `$defs/NodeKind` enum (6 values) for `Node.type`, `View.excludeKinds`, `View.dimKinds`                                                                       |
| `packages/ui/src/lib/icons.ts`                                                                                                                     | `COMPONENT_KINDS`, `ComponentKind`, `KIND_STYLE` (icon, label, tile tone), `KIND_FALLBACK` (Shapes, "Component"), `toComponentKind` (aliases `edge`, `data`) |
| `packages/ui/src/components/kind-tile.tsx`                                                                                                         | tile for a kind or fallback                                                                                                                                  |
| `apps/app/src/editor/kind-label.ts`                                                                                                                | label, unknown → "Component"                                                                                                                                 |
| `apps/app/src/editor/palette.tsx`, `palette-order.ts`                                                                                              | Add flyout: six tiles, hints, order; number keys 1–6                                                                                                         |
| `apps/app/src/editor/shell/use-shell-shortcuts.ts`                                                                                                 | `Digit1`–`Digit6` add `PALETTE_ORDER[n]` while the palette is open                                                                                           |
| `apps/app/src/editor/inspector/choices.ts`, `node-inspector.tsx`, `bulk-inspector.tsx`, `quick-edit/field-popover.tsx`, `actions/field-actions.ts` | "Kind" pickers (`KIND_OPTIONS`)                                                                                                                              |
| `apps/app/src/editor/views/view-settings-popover.tsx`, `view-filter.ts`, `packages/model/src/views.ts`, `ops/views.ts`                             | hide / dim kinds                                                                                                                                             |
| `apps/app/src/editor/export/icon-paths.ts`, `export/scene.ts`                                                                                      | export icons (lucide geometry copied, drift-tested)                                                                                                          |
| `apps/app/src/library/deck-thumbnail.tsx`, `storage/library-db.ts`                                                                                 | thumbnail summary stores kind per node                                                                                                                       |
| `packages/model/src/search/index.ts`, `command-palette/palette-results.ts`                                                                         | search entries carry the kind label                                                                                                                          |
| `deck-node.tsx`, `collapsed-group-node.tsx`, `outside-proxy-node.tsx`                                                                              | header tile and type name                                                                                                                                    |
| `apps/app/src/bench/generate-deck.ts`                                                                                                              | bench deck kinds                                                                                                                                             |

Connection rules (`connection-rules.ts`) and zoom levels do not depend on the kind.

## R1. Where the type registry lives

- **Decision:** two halves, both pure data:
  - `packages/model/src/card-types.ts`: `CARD_TYPES` (id, name, pack, category, family, order) and `PACKS` (id, name, order), `DEFAULT_PACKS_NEW_DECK`, `LEGACY_PACKS = ['architecture']`, `cardType(id)`, `typesOfPacks(packIds)`, `isKnownType(id)`. No icons, no React. Model needs it for the unknown-type problem, search labels and pack defaults.
  - `packages/ui/src/lib/icons.ts`: `TYPE_STYLE: Record<string, { icon, tone }>` keyed by type id, replacing `KIND_STYLE` (labels move to the model registry). `KIND_FALLBACK` keeps the Shapes icon and neutral tone; its label is no longer used (unknown types show their id).
  - An app test asserts every `CARD_TYPES` id has a `TYPE_STYLE` entry and an export icon path (no type without an icon).
- **Why:** dependency direction is `app → model → schema` and `app → ui`; `ui` must not import `model`, and `model` must not import React or icons. Splitting data from icons keeps both rules.
- **Alternatives:** one registry in `ui` (model could not report unknown types or label search results); one in `schema` (the file format package would carry app catalogue data, against ADR 0022 "defined in code, not in the file" spirit of keeping schema about the format).

## R2. File format (ADR 0022 row; new ADR 0025)

- **Decision:**
  - Replace `$defs/NodeKind` (enum) with `$defs/TypeId`: string, pattern `^[a-z][a-z0-9-]{0,47}$`, description listing the built-in ids. `Node.type`, `View.excludeKinds` and `View.dimKinds` reference it. The key names stay (`type`, `excludeKinds`, `dimKinds`) so no file changes.
  - Add root `packs`: array of `PackId` (same pattern), `uniqueItems`, `minItems: 1`; declared after `tagColors`. Absent = `["architecture"]`.
  - No semantic rule: unknown type and pack ids are valid in the file and reported as problems by the model.
  - ADR **0025** "Card type registry" (0023 reserved by 034, 0024 by 022) records R1, R2, the legacy-pack rule, the unknown-id behaviour and the "Kind" → "Type" rename; ADR 0022's 030 rows are marked built and refined.
- **Why:** an open id set is what ADR 0022 asks for; the pattern keeps ids simple and future-proof (`truck-route`). Keeping key names means every pre-030 file is valid unchanged.
- **Alternatives:** keep the enum and add the new ids (a file from a newer version would fail validation and not load, against FR-013); `anyOf` enum-or-string (same as a string for validation, noisier types).

## R3. Built-in types, names, icons, tones

| Pack         | Id            | Name (UI)   | Icon (lucide)       | Tile tone               |
| ------------ | ------------- | ----------- | ------------------- | ----------------------- |
| Architecture | `service`     | Service     | `Box`               | primary-soft (as today) |
|              | `database`    | Database    | `Database`          | blue-soft (as today)    |
|              | `gateway`     | Gateway     | `Router`            | inverse (as today)      |
|              | `client`      | Client      | `MonitorSmartphone` | surface-2 (as today)    |
|              | `queue`       | Queue       | `ArrowLeftRight`    | amber-soft (as today)   |
|              | `external`    | External    | `Cloud`             | clay-soft (as today)    |
|              | `component`   | Component   | `Puzzle`            | surface-2               |
| Process      | `task`        | Task        | `SquareCheck`       | success-soft            |
|              | `decision`    | Decision    | `Diamond`           | amber-soft              |
|              | `document`    | Document    | `FileText`          | blue-soft               |
| Logistics    | `warehouse`   | Warehouse   | `Warehouse`         | success-soft            |
|              | `truck-route` | Truck route | `Truck`             | amber-soft              |
| Data cards   | `issue`       | Issue       | `Ticket`            | clay-soft               |

- **Decision:** as above. "Gateway" keeps its current name (frame 127 says "API gateway"; SC-002 "older decks look the same" wins). All icons exist in the installed `lucide-react` (checked). Tones reuse the existing soft tokens; the icon, not the tone, tells types apart (VII).
- **Alternatives:** per-category tones (fewer distinct tiles inside a pack).

## R4. Packs in the document (ADR 0021)

- **Decision:** `meta.packs` is a nested `Y.Map<true>` keyed by pack id, created lazily on the first pack change (so pre-030 decks stay byte-identical, FR-005-style rule in spec FR-003). Read: absent map → `LEGACY_PACKS`; present → keys in registry order, then unknown ids sorted. A new deck (library "New deck", import of a file without `packs` excluded) gets the map with every 030 pack at creation. Toggle op `setPackOn(packId, on)` refuses to turn the last pack off (model guard + UI disabled switch). One transaction = one undo step.
- **Why:** a map makes concurrent toggles of different packs merge (spec edge case "two tabs"), and sorted emission gives every replica the same bytes (ADR 0021 guarantee, as 033's `tagColors`).
- **Alternatives:** `Y.Array` of ids (concurrent toggles can duplicate or drop ids); a plain JSON value (last writer wins for the whole list).

## R5. Add flyout

- **Decision:** rewrite `apps/app/src/editor/palette.tsx` as the frame-127 flyout inside the existing `Flyout` host (keeps pin, Esc, focus return): `SearchField` ("Search types…", `/` focuses it while the flyout is open), a `tablist` (All + one tab per category whose pack is on), sections with a heading and count, tiles in a 3-column `grid` (roving focus, arrows move, ⏎ adds), drag to the canvas as today (`addComponent`, `centredOn`), number badges 1–9 on the first nine visible tiles, footer button "Packs · N on" that swaps the flyout body to "Packs in this deck" (back arrow returns). `PALETTE_ORDER` becomes the registry order; `use-shell-shortcuts.ts` reads the visible tile list from the UI store instead of `PALETTE_ORDER`.
- **Why:** one flyout, the existing host behaviour, no new chrome.
- **Alternatives:** a separate packs dialog (frame 127 shows it in the same panel).

## R6. Type picker and "Kind" → "Type"

- **Decision:** `KIND_OPTIONS` becomes `typeOptions(deck, current)`: types of packs that are on plus each selected card's current type, grouped by category (section headers in the existing toolbar popover / select). Labels "Kind" → "Type" in toolbar, drawer, bulk drawer, menus, view settings ("Hide types", "Dim types"), announcements, design gallery. Internal names (`ToolbarFieldId 'kind'`, `kindLabel`) are renamed to `type` where touched, not as a sweeping refactor.
- **Why:** clarify Q1; the stored field is already `type`.

## R7. Unknown types

- **Decision:** new `ProblemKind` `'unknown-card-type'` in `packages/model/src/problems.ts` ("Unknown card type <id>"; one per type id, listing its cards); the canvas draws the fallback tile and the raw id as the type name; the id is preserved on save (no rewrite). Unknown pack ids in `packs` are kept and reported (`'unknown-pack'`), never shown in the packs panel.
- **Why:** FR-013; matches ADR 0022.

## R8. Performance

- **Decision:** registry lookups are `Map` gets; `deck-to-flow` already caches node data by inputs and adds nothing per frame. Bench: `BENCH_TYPES=1` gives the 500 nodes a round-robin of the 13 types (SC-007); before / after tables.
