# 044 ↔ 043 integration notes

043 (`specs/043-db-editing`, branch `FamManh/feat-schema-editing`) is built in parallel with 044.
044 is built on `main` without it. When 043 is merged, pull `main` into the 044 branch and work
through this list. Written 2026-10-04.

## Founder decision (2026-10-04)

**Table names follow 043's copy rule.** 043 (commit `88b4a37`, research R10, FR-020) makes
`pasteFragment` rename a pasted `db-table` whose name is taken in its schema (case-insensitive)
to `name_copy`, `name_copy_2`, … (`copyName` in `packages/model/src/ops/paste.ts`). 044 uses the
same rule instead of its first spec ("add a new table with the same name"):

- A table name already in the target deck (same schema, case-insensitive) → imported as
  `name_copy` (then `_copy_2`, …), listed under **Changed** (`name-exists`: "a table named orders
  already exists, imported as orders_copy").
- A table name repeated inside the import (same schema) → the second one gets the same rule,
  listed under **Changed** (`renamed-duplicate`).
- `buildPlan` applies the rule itself (helper `copyName` in `apps/app/src/db/import/names.ts`,
  same algorithm), so the fragment it hands to `pasteFragment` has no clashing names and 043's
  paste rename does nothing for an import.

## To do after pulling 043

1. **`copyName`**: delete 044's local helper and import `copyName` from `@sododeck/model`
   (043 exports it). Keep `names.test.ts` cases; they must still pass.
2. **Paste rename is a no-op for imports**: add a case to `apply-import.test.ts`: import a
   table named `orders` into a deck holding `orders` → exactly one `orders_copy`, no
   `orders_copy_copy`. If the deck changed between plan and apply (user created `orders_copy`
   meanwhile), 043's paste renames again; the report text may then be one step behind. Accept
   or recompute the report name from the paste result.
3. **`pasteFragment` / `Fragment` API**: 043 adds optional `external` and `enums` to `Fragment`
   and `droppedRelationships` to the paste result, and `createFragment` takes
   `Id | FragmentOptions`. 044 builds a fragment with neither key (enums go through `addEnum`
   so a same-named deck enum is **not** linked, spec Assumptions). Check `applyImport` still
   type-checks and that `droppedRelationships` is 0 for imports.
4. **Enums by name**: 043 paste links fragment `enums` to same-named deck enums. 044 must keep
   adding its enums as new ones (`enum-name-exists` in the report). Do not move import enums
   into `fragment.enums` unless the spec changes.
5. **Locked nodes** (043 R11, `node.locked`): importing into a database card sets `parent` on
   new tables. Decide whether a locked card blocks import into it (probably: offer the target
   only when the card is not locked). Not handled by 044 today.
6. **Shared files, expect merge conflicts**:
   - `apps/app/src/editor/empty-canvas-card.tsx`: 043 adds "Add table", 044 adds "Import SQL or
     DBML". Keep both actions.
   - `apps/app/src/editor/palette.tsx`: 043 changes the Database section (Table tile →
     `addTable`, "Table group" frame tile, letter badges); 044 adds the footer import item.
   - `apps/app/src/state/ui-store.ts` (+ test): 043 adds editing state and filters locked nodes
     in `selectionTargets`; 044 adds `importDialog` and `importReports`.
   - `apps/app/CLAUDE.md`: both add bullets.
   - Possibly `apps/app/src/editor/shell/use-shell-shortcuts.ts`, `deck-menu.tsx`.
7. **Dialect conversion**: 043 was split; the deck-wide dialect switch and its type conversion
   moved to a later drawer feature (043 T055). That feature should reuse
   `apps/app/src/db/import/convert-types.ts` (built from 045's `COMMON_TYPES`) rather than a
   second table.
8. **Row highlight**: suggestions use `setHoverFocus({ source: 'column', … })` from 042. If 043
   changes `hoverFocus`, re-check the suggestion hover in `import-report-panel.tsx`.
9. Re-run the full DoD set after the merge: `pnpm lint && pnpm typecheck && pnpm test &&
pnpm build && pnpm e2e`.
