# 0028. Icon references and icon sets: generated geometry, one resolver, permissive text

- **Status:** Accepted
- **Date:** 2026-10-04
- **Feature:** `specs/038-card-icons` (research R1–R12)
- **Builds on:** 0016 (export rendering, point 5 superseded here), 0020 (file format
  compatibility), 0022 (schema roadmap, `node.icon`), 0025 (card type registry)

## Context

A card shows the icon of its type. Users want to pick their own, and more icon sets (for example
brand logos) are likely later. The canvas, the outline, the drawer, search and the PNG / SVG export
must draw the same icon, and a deck written by a newer version must still open here.

## Decision

1. **Generated geometry, not components** (R1). `pnpm icons:generate` reads the installed
   lucide-react and writes `packages/ui/src/icon-sets/lucide.generated.ts` (name → shapes and
   aliases) for the catalog plus the export's chrome icons. One `IconGlyph` draws it on screen and
   `render-svg` draws it in export, so both agree and `export/icon-paths.ts` (a hand copy) is
   deleted. A test fails when the file is stale. `lucide-react/dynamic` is not used (async, and no
   geometry for export).
2. **A curated catalog** (R2). About 300 icons in 12 categories, hand-written data (name, label,
   category, keywords) in `lucide-catalog.ts`. Adding an icon is one entry plus a generate run.
3. **One resolver** (R3). `parseIconRef`, `resolveIcon`, `nodeIcon` in `@sododeck/ui/icon-sets`:
   a custom icon that resolves, else the type's icon, else the fallback. Every surface calls
   `nodeIcon`; none re-implements the precedence. Results are cached per string.
4. **Permissive stored text** (R4, R9). `node.icon` stays a non-empty `Text`; its description now
   says `set:icon` (a bare name means lucide). Anything else is valid, kept byte for byte, and
   shown as the type icon with a note in the drawer. The picker writes `lucide:<name>` in lower
   case only; Reset removes the key. No version bump, no new problem kind.
5. **"Icon set", not "pack".** Packs (030) group card types; an icon set is a family of icons
   with one drawing style (`line` or `solid`) and one licence. `ICON_SETS` is an array and every
   function takes `sets`, so a second set is data plus one registration (R11; a test-only solid
   set proves it).
6. **Model** (R5). `setNodeIcon(ids, icon | null)` is one undo step and accepts any non-empty
   text; the app passes only nodes drawn as cards. `iconUsage(deck)` counts references as written
   for "Used in this deck".
7. **Notices** (R12). The generator writes `apps/app/public/third-party-notices.txt` from the
   installed lucide-react `LICENSE`. Where the app links it is deferred to the open-source decision
   (`TODO(open-source)`).

## Consequences

- Decks without custom icons are written and exported byte-identical.
- The editor chunk grows by the catalog and geometry (budget ≤ 25 KB gzip, measured in
  `specs/038-card-icons/bundle-size.md`).
- A lucide upgrade that drops a catalog icon fails the generator, naming it; lucide aliases keep
  old references resolving.
- Other sets (brand logos, solid styles), uploaded icons and icon colour options remain out of
  scope.
