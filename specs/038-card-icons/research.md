# Research: Card Icons (038)

Decisions for [plan.md](plan.md). Names checked on `main` at `9e7f779` (029, 030, 031, 032, 033,
034, 035, 036 built). lucide-react is `1.48.0` in `apps/app`, `packages/ui` and `apps/site`.

## R1. Where icon geometry comes from

- **Decision:** a generated data file, not lucide components. A script
  (`packages/ui/scripts/generate-icons.ts`, run by `pnpm icons:generate`) reads the installed
  lucide-react icon modules (each exports `__iconData = { name, node, aliases? }`) for every name
  in the curated list (R2) plus the app's own icons (export chrome, status icons), and writes
  `packages/ui/src/icon-sets/lucide.generated.ts`: name → `{ node, aliases }`. A test re-reads the
  installed package and fails when the generated file is stale (same idea as `icon-paths.test.tsx`
  and `schema:generate`).
- **Why:** the canvas, the outline and the export must draw an icon the same way (US3 #3, SC-006).
  One geometry table, drawn by one `IconGlyph` component on screen and by `render-svg.ts`'s
  `icon()` in export, gives that for free and replaces the hand-copied `export/icon-paths.ts`
  (backlog §038, ADR 0016 point 5). Geometry as data also lets a later solid set use the same
  renderer with `fill` instead of `stroke` (FR-013).
- **Alternatives:** (a) static imports of ~300 lucide-react components: tree-shakes, but the
  component hides its geometry, so export would still need a copy; (b) deep imports of
  `lucide-react/dist/esm/icons/*.mjs` at runtime: no exports map, no types, breaks on any package
  layout change; (c) `lucide-react/dynamic` (`DynamicIcon`): async per icon, loads chunks at
  runtime, and gives export nothing.

## R2. The curated lucide set

- **Decision:** `packages/ui/src/icon-sets/lucide-catalog.ts`, hand-written data: about 300
  entries `{ name, label, category, keywords }` in 12 categories, in this order: Compute, Data,
  Network, Cloud, Security, People, Devices, Messaging, Files, Business, Logistics, Status &
  Shapes. Every type icon of `TYPE_STYLE` is in the set. Labels are Title Case from the lucide name
  unless a better word exists ("Message square" → "Chat"); keywords cover common synonyms ("db",
  "sql", "storage" on Database). Adding an icon = one entry + `pnpm icons:generate` (FR-011).
- **Why:** founder decision (clarify 2026-10-03); a short list fits diagrams and keeps the bundle
  small (R10).
- **Alternatives:** lucide's own tags (in the lucide repo, not in the npm package; would need a
  new dependency or a vendored JSON).

## R3. Icon references and resolution (one resolver, FR-020)

- **Decision:** pure functions in `packages/ui/src/icon-sets/resolve.ts` (no React):
  - `parseIconRef(value)`: trims nothing, lowercases for matching; `"server"` → lucide / server;
    `"lucide:server"` → lucide / server; `"simple:kafka"` → simple / kafka; anything else (two
    colons, spaces, characters outside `a-z 0-9 -` after lowercasing) → `null` (unreadable).
  - `resolveIcon(ref, sets = ICON_SETS)`: parse, find the set, then the icon by name or alias;
    returns `ResolvedIcon { set, name, label, node, style }` or `null`. Results are cached per
    string (a `Map`), so 500 cards cost 500 map lookups.
  - `nodeIcon({ icon, type }, sets?)`: custom icon if it resolves, else the type icon (from
    `TYPE_STYLE`'s lucide name, now a name in the generated table), else the fallback (`shapes`).
    Returns `{ icon: ResolvedIcon, source: 'custom' | 'type' | 'fallback', unavailable: boolean }`
    (`unavailable` = a stored ref that did not resolve; drives the drawer note, FR-024).
- **Why:** every surface (R6) calls `nodeIcon`, so the precedence lives in one place. `packages/ui`
  cannot import `@sododeck/model`, and does not need to: it takes `type` and `icon` strings.
- **Alternatives:** resolver in `packages/model` (model would need icon data, which is UI);
  resolving in `deck-to-flow` only (outline, inspector and export would each re-implement it).

## R4. File format

- **Decision:** no structural schema change. `node.icon` stays `Text` (non-empty string); its
  description becomes "Icon reference `set:icon` (e.g. `lucide:server`); without a set it means
  lucide. A reference the app cannot show is kept and the type icon is shown." `pnpm
schema:generate`; parity test unchanged. The picker always writes `lucide:<name>` in lowercase.
  New **ADR 0028 Icon references and icon sets** records R1–R4 and the "icon set" term; ADR 0022
  gets a row for `node.icon` (refined by 038).
- **Why:** clarify 2026-10-04 Q1: free text stays valid (ADR 0020); empty is already invalid. An
  additive description change does not bump the version (constitution II).
- **Alternatives:** a `pattern` on `icon` (rejects files valid today); an object
  `{ set, name }` (format change, migration).

## R5. Model op

- **Decision:** `setNodeIcon(nodeIds, icon: string | null)` in `packages/model/src/ops/node-icon.ts`,
  copied from `setNodeDisplay` (`ops/node-display.ts`): check every id exists, validate the new
  node, skip nodes that already have the value, one `ctx.transact` (one undo step), `null`
  deletes the key (FR-004). Exposed as `editor.setNodeIcon`. The op does not filter by card or
  shape; the app passes only nodes whose `effectiveFamily` is `'card'` (R7). `iconUsage(deck)`
  (ref → count, most used first, unresolved refs included as written) in `packages/model/src/
icons.ts` feeds "Used in this deck" (US5), memoised per snapshot in the app.
- **Why:** a template that already handles validation, no-op skips and one transaction; Yjs syncs
  it to other tabs (FR-041) like any write; clipboard copies whole nodes, so pasted cards keep the
  reference.

## R6. Surfaces that draw the node's icon

From the survey, every place that draws a node's type icon today, and the change:

| Surface                                                         | Today                                        | Change                                                                                        |
| --------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Card header tile, Landscape                                     | `deck-node.tsx` `typeStyle(data.kind).icon`  | `data.icon` added in `deck-to-flow.ts` `toFlowNode` (+ cache compare); draw `nodeIcon` result |
| Collapsed group members                                         | `memberKinds: string[]` (`visible-graph.ts`) | `members: { kind, icon? }[]` (+ cache compare in `deck-to-flow.ts`)                           |
| Drill-in proxies (034)                                          | `proxy-layout.ts` `entry.outside.type`       | carry `icon` next to `kind` through `exportPortRects` / `portNodes`                           |
| Outline                                                         | `outline.ts` `item.kind = n.type`            | add `icon` to the node item                                                                   |
| Drawer header, step inspector, rules "used in", connect popover | `node.type` / `kind`                         | pass `node.icon` too                                                                          |
| Command palette results                                         | no icon (slot unused)                        | fill `CommandDialogItem.icon` with the node's icon (US3 #2 "search results")                  |
| Export (PNG / SVG)                                              | `IconKey` + `ICON_PATHS`                     | scene carries the resolved `IconNode` + style; `icon-paths.ts` deleted, chrome icons by name  |
| Add palette, Packs panel, minimap, shape node                   | type pickers / no icons                      | unchanged (spec: types keep their icons; shapes draw no icon)                                 |

`TypeTile` (`packages/ui`) and `NodeTypeTile` / `TypeGlyph` (app) take an optional `icon` and keep
their `type` prop for the tone and shape glyphs. The tile tone stays the type's (FR-023: same
colour rules).

## R7. Picker placement and availability

- **Decision:** a new toolbar field `'icon'` (`ToolbarFieldId` in `state/ui-store.ts`, names in
  `field-popover.tsx`), opened by a new shared action `style.icon` in
  `actions/style-actions.ts` next to `style.colour`: `where.toolbar` and `where.menu` for
  `component` / `components` / `mixed`, default `modes` (edit only, so not in flow mode or
  recording), `applies` = the selection has at least one node drawn as a card. In the drawer the
  header icon tile of the node inspector (`InspectorFrame` icon, `node-inspector.tsx`) becomes a
  `button` "Change icon" that opens the same `IconPicker` in a popover anchored to the tile (founder,
  2026-10-04: no Appearance row). Hover / focus shows a small pencil badge on the tile so it reads as
  clickable. Nodes drawn as shapes keep a plain, non-clickable tile. The bulk drawer has no type tile,
  so several cards are changed from the toolbar or the context menu. The view-only editor (< 1024 px) has no toolbar or drawer edits
  already. Mixed selection: the header line says "Changes N cards".
- **Why:** mirrors 020's colour picker, which users already know (FR-030); the action list keeps
  menu and toolbar in sync (019).

## R8. Picker component

- **Decision:** `apps/app/src/editor/icons/icon-picker.tsx` (+ `icon-search.ts`, pure):
  `SearchField` on top (autofocus; typing anywhere in the picker goes there), "Used in this deck"
  section, then one section per category (or a flat ranked list while searching), "Reset to type
  icon" button, footer with the hovered / selected icon's label. Grid: `role="grid"` per section
  with 2-D arrows, reusing the `neighbour()` helper from `palette.tsx` (moved to
  `editor/grid-nav.ts`); cells are `role="gridcell"` buttons with `aria-label` = label,
  `aria-selected` and a ring + check mark on the current icon (FR-033). "Mixed" text when the
  selection differs. Esc closes and returns focus (popover default). Set filter: rendered only
  when `ICON_SETS.length > 1` (FR-032).
- **Search:** case-insensitive over name, label and keywords; rank: exact name / label, then name
  or label prefix, then keyword prefix, then substring; ties by catalog order. 300 entries: a
  linear scan is well under 1 ms (SC-002). No debounce.
- **Alternatives:** `SwatchGrid` (single radiogroup, no sections; 300 tabbable radios in one group
  is fine for arrows but loses the section structure); `CommandDialog` (list, not grid).

## R9. Unknown and unavailable icons

- **Decision:** `nodeIcon(...).unavailable` → the drawer's header tile shows the type icon with a
  small warning badge; its tooltip and the picker's header show the stored value in mono text and
  "Icon not available in this version" (FR-024); no problem kind is added. Picking an icon
  replaces the value; Reset removes it. Values are never rewritten on load or save (FR-005), which
  `packages/model/test/round-trip.test.ts` covers with `simple:kafka`, `lucide:no-such-icon`,
  `server`, `Server`, `mdi:database`, `a b`.

## R10. Bundle and performance

- **Decision:** the catalog and generated geometry live in the editor's lazy chunk (the editor
  route is already `lazy` in `app/router.tsx`). Budget: editor chunk + ≤ 25 KB gzip (estimate:
  ~300 icons × ~250 B geometry + ~10 KB labels / keywords ≈ 20 KB gzip). Record before / after
  in `bundle-size.md`. Bench: new `BENCH_ICONS=1` (every card gets a custom icon, round-robin over
  the set); compare with `bench-before.md` (SC-005: within 5 %). `IconGlyph` is a plain `<svg>`
  with no state; `nodeIcon` is cached per string.
- **Alternatives:** lazy-load the set on first picker open: cards with custom icons would flash
  the type icon on open, and export would need to await it.

## R11. Extensibility proof (FR-013, SC-004)

- **Decision:** `ICON_SETS` is an array of `IconSet { id, name, licence, style, icons, aliases }`.
  Every function that needs sets takes `sets` with `ICON_SETS` as the default. A test-only solid
  set (`packages/ui/test/fixtures/solid-test-set.ts`, 3 icons, `style: 'solid'`) is passed in
  tests that check: parse + resolve, `IconGlyph` draws `fill="currentColor"` and no stroke, the
  picker shows the set filter and its icons, a card shows it, and the export scene / SVG draws it
  filled. Nothing outside the fixture changes.

## R12. Licence notice

- **Decision:** clarify 2026-10-04 Q3 defers in-app placement. The generator also writes
  `apps/app/public/third-party-notices.txt` with the lucide-react `LICENSE` (ISC plus the Feather
  notice), headed by the set name and version; a test checks it matches the installed `LICENSE`.
  Served as a static file with the app; no UI link yet (`TODO(open-source)` in the generator).
