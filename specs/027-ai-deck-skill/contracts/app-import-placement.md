# Contract: placing unplaced cards on deck import (027 FR-024)

## Library worker

`importFile(text, name)` → `ImportedDeck` gains:

```ts
/** The loaded file, only when at least one card has no `position` (027 FR-024). */
unplaced?: SododeckFile;
```

## `apps/app/src/layout/place-unplaced.ts` (moved from `import-mermaid/layout-input.ts`)

```ts
export function hasUnplacedCards(file: SododeckFile): boolean;
export function placementRequest(
  file: SododeckFile,
  direction?: LayoutRequest['direction'],
): LayoutRequest;
// nodes: every card (size from its stored size or default); groups: every group;
// edges: only those whose both ends are cards or groups; pinned: every card with a position.
export function applyPlacement(file: SododeckFile, result: LayoutResult): SododeckFile;
// writes positions for unplaced cards only, keeps placed cards and existing group frames,
// fits frames for groups without one.
```

Mermaid import keeps its behaviour: no card is placed, so nothing is pinned and every group gets a
frame (`toLayoutRequest` / `applyLayout` become thin wrappers or are replaced).

## `importDeckFile`

```
imported = worker.importFile(text, fileName)
if imported.unplaced:
  placed  = applyPlacement(imported.unplaced, await layout(placementRequest(imported.unplaced)))
  stored  = worker.importFile(JSON.stringify(placed), fileName)
  report  = imported.openReport            // problems refer to the user's file
else stored = imported
addDeck(stored)
```

A failed or cancelled layout throws before anything is stored (as for Mermaid import). A deck
whose cards are all placed takes exactly today's path.
