# Contract: tag helpers and DeckEditor methods (033)

Public surface added by 033. Names are the plan's; signatures are the contract tests assert.

## `@sododeck/model`

### Pure helpers (`src/tags.ts`)

```ts
tagKey(text: string): string            // trim, collapse spaces, lower-case
sameTag(a: string, b: string): boolean  // tagKey(a) === tagKey(b)
```

### `DeckEditor` (`editor.ts`)

```ts
setTagColor(tag: string, color: ColorRef | null): void
renameTag(from: string, to: string): TagChange
deleteTag(tag: string): TagChange

interface TagChange {
  cards: number        // nodes whose tags changed
  others: number       // connections, flows, steps, deck tags, view filters whose tags changed
}
```

| Call                           | Effect                                                                                    | Throws `DeckEditError('invalid', …)` when          |
| ------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `setTagColor('pci', 'violet')` | sets `tagColors[<existing spelling or 'pci'>] = 'violet'`                                 | the colour is not a named colour or `#rrggbb`      |
| `setTagColor('pci', null)`     | removes the entry; no-op when absent                                                      | never                                              |
| `renameTag('pci', 'PCI-DSS')`  | rewrites every carrier of key `pci`; moves the colour; de-duplicates arrays by key        | `to` is empty after trimming                       |
| `renameTag('pci', 'PIC')`      | when key `pic` exists, merges onto its display spelling and colour                        | as above                                           |
| `renameTag('pci', 'PCI')`      | same key: respells carriers and the colour key; no merge                                  | as above                                           |
| `deleteTag('pci')`             | removes the tag from every carrier and from every `excludeTags`; removes the colour entry | never; absent tag is a no-op returning zero counts |

All three are one transaction and one undo step, validate the resulting document pieces before writing, and are no-ops (no transaction, no change event) when nothing changes.

## `@sododeck/ui`

```ts
// lib/tags.ts
tagKey(text: string): string
normalizeTag(raw: string): string | null          // trim + single-space, case kept; null when empty
addTag(tags, raw, max?): readonly string[]        // no-op on same key or at max; returns same array when unchanged
removeTag(tags, tag): readonly string[]           // removes by key; same array when absent

// components/tag-chip.tsx  (new optional props)
colour?: { chip: string; ink: string }            // CSS values; absent keeps today's neutral chip
size?: 'default' | 'deck'                         // 'deck' is 21 tall
```

## `apps/app` pure modules (`editor/tags/`)

```ts
deckTags(deck): DeckTag[]                         // cards + tagColors, count desc then name
tagUsage(deck, tag): TagUsage
canonicalTag(deck, typed): string | null          // display spelling when the key exists, else typed normalised; null when empty
tagColours(color: ColorRef | undefined): { chip: string; ink: string; dot: string }
```

## Invariants asserted by tests

- `tagKey` agrees between model and ui on a table of 30 samples.
- JSON → Yjs → JSON keeps `tagColors` content and, for files the app wrote, bytes: entries are read **sorted by tag key** (so replicas that received concurrent entries in different orders still agree), and an empty map is not emitted.
- After any op, no two `tagColors` keys are equal ignoring case.
- Undo after each op restores the previous document exactly (carriers, colour entry, view filters).
