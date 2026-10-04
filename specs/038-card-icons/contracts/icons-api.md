# Contract: icon sets and resolver API (038)

Pure TypeScript, no React unless stated. Tests in `packages/ui/test/icon-sets/*` and
`packages/model/test/*`. Types in [../data-model.md](../data-model.md).

## `@sododeck/ui/icon-sets`

| Export                               | Contract                                                                                                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ICON_SETS: readonly IconSet[]`      | `[lucide]`. Ids unique. Every catalog entry has generated geometry; every `TYPE_STYLE` icon is in the lucide catalog (test).                                                                                                                           |
| `parseIconRef(value: string)`        | `{ set, name } \| null`. Lowercases. `"server"` → `{ set: 'lucide', name: 'server' }`; `"Lucide:Server"` → lucide / server; `"simple:kafka"` → simple / kafka; `"a b"`, `"a:b:c"`, `":x"`, `"x:"`, `"mdi_db"` → `null`.                                |
| `resolveIcon(ref, sets = ICON_SETS)` | `ResolvedIcon \| null`. Unknown set, unknown name, unreadable → `null`. Alias → the current icon (e.g. a lucide alias of a catalog icon). Same string → same object (cached).                                                                          |
| `iconRef(icon: ResolvedIcon)`        | `"<set>:<name>"`, what the picker writes.                                                                                                                                                                                                              |
| `nodeIcon({ icon?, type }, sets?)`   | `{ icon, source, unavailable }`: custom if `resolveIcon(icon)` ≠ null; else the type icon; else fallback `shapes`. `unavailable` = `icon` set and unresolved.                                                                                          |
| `searchIcons(query, sets?, setId?)`  | Ranked `ResolvedIcon[]`: exact name / label → name or label prefix → keyword prefix → substring; ties in catalog order; empty query → `[]`. Case-insensitive. Optional set filter.                                                                     |
| `IconGlyph` (React)                  | `<svg viewBox="0 0 24 24" aria-hidden>` from `icon.node`; `line`: `fill="none" stroke="currentColor"` with the given `strokeWidth`, round caps / joins; `solid`: `fill="currentColor"`, no stroke. Props `icon`, `size`, `strokeWidth?`, `className?`. |

`TypeTile` gains an optional `icon?: ResolvedIcon`; when given it draws that instead of the type's
lucide component; the tone class still comes from `type`.

## `@sododeck/model`

| Export                                                | Contract                                                                                                                                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor.setNodeIcon(ids: Id[], icon: string \| null)` | One undo step. Throws (writes nothing) if an id is unknown or `icon` is `""`. `null` deletes the key. Nodes already at the value are skipped; nothing to change → no transaction. Any non-empty string accepted. |
| `iconUsage(deck: SododeckFile)`                       | `{ ref, count }[]`, most used first, ties by first appearance in node order; refs as written.                                                                                                                    |

Round-trip (`packages/model/test/round-trip.test.ts`): nodes with `lucide:server`, `server`,
`Server`, `simple:kafka`, `lucide:no-such-icon`, `mdi:database`, `a b` → byte-identical `icon`
values after JSON → Yjs → JSON.

## Export (`apps/app/src/editor/export`)

| Item                  | Contract                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `SceneCard.icon`      | `ResolvedIcon` from `nodeIcon(node)` (replaces `kind: IconKey`). Members and ports likewise.                                   |
| `render-svg` `icon()` | Draws `ResolvedIcon.node` with its `style` (line: stroke; solid: fill), same sizes and stroke widths as today (header 14 / 2). |
| Chrome icons          | `chromeIcon(name)` from the generated lucide table; `icon-paths.ts` and `IconKey` removed.                                     |

## Generator (`pnpm icons:generate`)

Reads `lucide-react/dist/esm/icons/<name>.mjs` for each catalog name and chrome name; writes
`packages/ui/src/icon-sets/lucide.generated.ts` (sorted, Prettier-formatted, header with the
lucide-react version) and `apps/app/public/third-party-notices.txt`. Fails, naming the icon, when a
name is missing from the installed package. A Vitest test runs the same read in memory and fails
when either file is stale.
