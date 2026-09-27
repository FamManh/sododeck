# Data model: Read-only JSON Panel (004)

004 adds **no document data** and does not change the file format. The panel is a view of the
deck. Everything it stores is UI-only.

## Document data read (from the deck snapshot, `@sododeck/model`)

| Data                                         | Used for                                                 |
| -------------------------------------------- | -------------------------------------------------------- |
| Whole `SododeckFile`                         | Deck tab text (`serializeDeck`)                          |
| `nodes[]` (`id`, `title`, all)               | Selection entries and label                              |
| `edges[]` (`id`, `label`, `from`, `to`, all) | Selection entries and label ("Source → Target" fallback) |

## UI state (Zustand UI store, `apps/app/src/state/ui-store.ts`)

Replaces 003's `jsonPanelOpen: boolean`.

```ts
type JsonTab = 'selection' | 'deck';

interface JsonPanelPrefs {
  open: boolean; // default true
  height: number; // px, default 212, clamped by clampPanelHeight
  tab: JsonTab; // default 'deck' (clarification Q3)
}

// UiState additions
jsonPanel: JsonPanelPrefs;
setJsonPanelOpen(open: boolean): void; // toggleJsonPanel() kept as a wrapper
setJsonPanelHeight(height: number): void;
setJsonTab(tab: JsonTab): void;
```

- **Persistence**: `localStorage["sododeck.jsonPanel"]` = `JSON.stringify(JsonPanelPrefs)`.
  - It is read once when the store is created. Parse errors, wrong types, an unknown `tab` or a
    height that is not finite all fall back to the defaults, field by field.
  - It is written on each setter. Reads and writes are wrapped in try/catch, because storage can
    be blocked.
- **Never** stored in the deck and never in the exported file (FR-026).
- **Reads (never writes)**: `selection` (`{ nodes, edges }` ids) and `announce()` from 003.

## Derived view models (pure, `apps/app/src/editor/`)

| Function                         | Input                      | Output                                                 | Rules                                                                                                 |
| -------------------------------- | -------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `selectionView(deck, selection)` | snapshot, selection ids    | `{ label, fullLabel, entries: {collection, value}[] }` | Nodes then edges, each in deck order; missing ids skipped. Label rules: see research R9.              |
| `selectionText(entries)`         | entries                    | `string` (`''` when empty)                             | 1 entry → `serializeEntry`; n entries → `serializeEntries` (JSON array). Both from `@sododeck/model`. |
| `countLines(text)`               | text                       | number                                                 | `''` → 0. A trailing `\n` does not count as a line. Label: "1 line" / "`n` lines".                    |
| `lineDiff(oldText, newText)`     | two texts                  | `null` (same) or `{ startLine, endLine, text }`        | Common leading/trailing lines removed. Applying it to `oldText` yields `newText` (property test).     |
| `clampPanelHeight(h, available)` | requested px, main area px | px                                                     | Minimum 96, maximum `available − 200`. If the maximum is below the minimum, returns the minimum.      |
| `createCooldown(ms)`             | ms                         | `() => boolean`                                        | True at most once per `ms` (read-only announcement, research R4).                                     |
| `copyToastText(tab, view)`       | tab, selection view        | string                                                 | "Copied Deck JSON" / "Copied `<fullLabel>` JSON" / "Copied `n` items as JSON".                        |
| `readJsonPanelPrefs(raw)`        | `string \| null`           | `JsonPanelPrefs`                                       | Validation and defaults, as above.                                                                    |

## States

```text
Panel:  expanded ⇄ collapsed          (collapse control; persisted)
Tab:    deck ⇄ selection              (user only; never switched by the app, clarification Q2)
Selection tab content: empty message | one entry | array of n entries  (follows UI selection)
Deck tab text updates: idle → pending (throttle 250 ms, leading + trailing) → applied (minimal edit)
Hidden tab or collapsed panel: no text computed; on show, compute once and apply
```
