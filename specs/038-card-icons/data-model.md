# Data Model: Card Icons (038)

Two parts: what the file stores (one optional string) and what the app ships as data (icon sets).

## Stored: `node.icon` (file format, `packages/schema`)

| Field       | Type                                | Rules                                                                                        |
| ----------- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `node.icon` | `Text` (non-empty string), optional | Unchanged shape. Absent = the type icon. Any non-empty text is valid (ADR 0020, clarify Q1). |

- **Written by the app:** only `lucide:<name>` in lowercase, from the picker (FR-002). Reset
  deletes the key (FR-004).
- **Read by the app** (`parseIconRef`, case-insensitive): `set:name` or `name` (= lucide).
  `set` and `name`: `[a-z0-9-]+` after lowercasing. Anything else is unreadable.
- **Never rewritten** on load, save, copy / paste or round-trip (FR-005); `Server` stays `Server`.
- **Yjs:** a plain key on the node's `Y.Map` (like `display`); last write wins between tabs.
- **No problem kind:** unreadable or unknown references are not deck problems (FR-024).

## Shipped data: icon sets (`packages/ui/src/icon-sets/`)

### IconSet

| Field        | Type                                       | Notes                                                                            |
| ------------ | ------------------------------------------ | -------------------------------------------------------------------------------- |
| `id`         | string `[a-z0-9-]+`                        | The `set` part of a reference. `lucide` today.                                   |
| `name`       | string                                     | Shown in the picker's set filter (only with 2+ sets).                            |
| `licence`    | `{ spdx: string; notice: string }`         | `ISC`; notice text goes to `third-party-notices.txt`.                            |
| `style`      | `'line' \| 'solid'`                        | `line`: stroke `currentColor`, no fill. `solid`: fill `currentColor`, no stroke. |
| `icons`      | `readonly IconEntry[]`                     | Catalog order = picker order within a category.                                  |
| `aliases`    | `Readonly<Record<string, string>>`         | Old name → current name (from lucide's `aliases`, FR-012).                       |
| `categories` | `readonly { id: string; label: string }[]` | Section order in the picker.                                                     |

### IconEntry

| Field      | Type                | Notes                                                      |
| ---------- | ------------------- | ---------------------------------------------------------- |
| `name`     | string `[a-z0-9-]+` | Stable; the `name` part of a reference. Unique in its set. |
| `label`    | string              | Tooltip, accessible name, footer ("Search").               |
| `category` | string              | One of the set's category ids.                             |
| `keywords` | `readonly string[]` | Lowercase search words.                                    |
| `node`     | `IconNode`          | `[tag, attrs][]`, 24 × 24 viewBox; generated for lucide.   |

`IconNode` moves from `export/icon-paths.ts` to `packages/ui` unchanged:
`readonly (readonly [tag: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon' | 'ellipse', attrs])[]`.

### Lucide set files

| File                  | Kind         | Content                                                                 |
| --------------------- | ------------ | ----------------------------------------------------------------------- |
| `lucide-catalog.ts`   | hand-written | ~300 `{ name, label, category, keywords }`, 12 categories (research R2) |
| `lucide.generated.ts` | generated    | name → `{ node, aliases }` for catalog names + app chrome icons         |
| `lucide.ts`           | hand-written | joins the two into the `IconSet`                                        |
| `index.ts`            | hand-written | `ICON_SETS = [lucide]`                                                  |

App chrome icons (export only, not in the picker): `rules`, `children`, `sticky`, `chevron`,
`enter`, the six status icons, `date`, `date-range`, `link` — the non-type keys of today's
`ICON_PATHS`, now looked up by their lucide names.

## Derived (not stored)

### ResolvedIcon

`{ set: string; name: string; label: string; node: IconNode; style: 'line' | 'solid' }`

### NodeIconResult (`nodeIcon({ icon, type })`)

| Field         | Type                               | Meaning                                               |
| ------------- | ---------------------------------- | ----------------------------------------------------- |
| `icon`        | `ResolvedIcon`                     | What to draw.                                         |
| `source`      | `'custom' \| 'type' \| 'fallback'` | Precedence result (FR-020).                           |
| `unavailable` | boolean                            | `node.icon` is set but did not resolve (drawer note). |

Precedence: custom (resolves) → type icon (`TYPE_STYLE[type]`'s lucide name) → fallback
(`shapes`). Nodes whose `effectiveFamily` is `'shape'` never draw it (clarify Q2).

### IconUsage (`iconUsage(deck)`, `packages/model/src/icons.ts`)

`readonly { ref: string; count: number }[]` over all nodes with `icon`, most used first, ties by
first appearance; refs counted as written (so `server` and `lucide:server` are separate rows; the
picker merges rows that resolve to the same icon). Feeds "Used in this deck"; empty → section
hidden.

## State transitions (per node)

```text
no icon ──pick──▶ icon = "lucide:x" ──pick──▶ icon = "lucide:y"
   ▲                     │                          │
   └───────reset─────────┴──────────reset───────────┘
unreadable/unknown ref (from file) ──pick──▶ "lucide:x"   ──reset──▶ no icon
display: card ⇄ shape   (icon kept; drawn only as card)
```
