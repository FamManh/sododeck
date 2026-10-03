# Research: Typed Fields (032)

Decisions for [plan.md](plan.md). Names checked on `main` at `884586b` (030 built, 022 / 033 / 034 /
035 / 036 built; 031 specified, not built).

## R1. Where field definitions live

- **Decision:** three sources, merged by one pure function `fieldsOfType(deck, typeId)` in
  `packages/model/src/fields.ts`:
  1. **Built-in fields** (code): `tech` (text), `host` (text) for Architecture types, `owner`
     (person) for every type. Values stay on `node.tech` / `node.host` / `node.owner`.
  2. **Default fields** (code, per type, from the founder's table in the spec): stable ids
     `task.status`, `task.assignee`, `task.due`, `document.link`, `warehouse.capacity`,
     `warehouse.sla`, `warehouse.region`, `truck-route.departure`, `issue.status`,
     `issue.assignee`, `issue.dates`, `issue.estimate`. Added to 030's `CardType` as
     `defaultFields` in `card-types.ts`.
  3. **Deck fields** (stored, root `fields`): user fields, plus any built-in or default field the
     user changed (stored with the same id, overriding the code definition).
     A type's defaults are **materialised** into `fields` the first time the user changes any default
     field of that type (rename, options, on-card, order, kind, delete), and the type id is added to
     root `fieldDefaults` (types whose defaults now live in the deck). From then on, only the deck's
     entries count for that type, so a deleted default stays deleted (FR-004a). Setting a value never
     materialises definitions (values point at the stable id).
- **Why:** "nothing stored until changed" (FR-004a, FR-005) and "a deleted default stays deleted"
  need a per-type marker; materialising a whole type at once keeps the merge rule simple (either
  code defaults or deck entries, never a mix) and ADR 0022's "absent = only the built-in fields".
- **Alternatives:** write defaults into every new deck (adds data to every deck and to decks that
  never use Task); per-field tombstones (`deleted: true` entries: noisy and easy to get wrong).

## R2. File format (ADR 0022 rows, refined; new ADR 0027)

- **Decision:**
  - Root `fields`: array of `FieldDef` `{ id, name, kind, types?, onCard?, unit?, options? }`;
    `kind` enum `text | number | select | status | person | date | dateRange | link | progress`;
    `types`: `TypeId[]` (absent = every type); `onCard` default false; `unit` only for number;
    `options` only for select / status: `{ id, label, color?, icon? }` (`icon` only for status,
    enum `circle | circle-dashed | circle-dot | circle-check | eye | door-open`).
  - Root `fieldDefaults`: `TypeId[]`, unique.
  - `Node.values`: object, field id → value (ADR 0022 shapes: string for text / person / date
    `YYYY-MM-DD` / select & status option id; number for number / progress; `{ from, to }` for
    dateRange; `{ url, label? }` for link).
  - Built-in ids `tech`, `host`, `owner` may appear in `fields` (to store order / on-card); their
    kinds are fixed (S12); `values` never holds them (S13).
  - Semantic rules (Zod drops these): **S12** a field id appears once; built-in ids have their
    fixed kind; `unit` only on number; `options` only on select / status; option ids unique within
    a field; **S13** `values` keys are not built-in ids. Values that point at no field or option,
    or have the wrong shape, are **valid** and reported as problems (ADR 0022 "kept and
    reported").
  - Order: `fields` is a list in deck order (ADR 0022 says layout 2); the order of a type's fields
    is the deck order filtered to that type, with code fields (not yet materialised) after the
    built-ins in code order.
- **Why:** additive and optional; validation stays permissive for content (dangling values load) and
  strict for shape. ADR 0027 records R1, R2, R5, R6.

## R3. Yjs layout (ADR 0021)

- **Decision:** `fields` is a layout-2 list (`Y.Map<id, Y.Map>` with `$order`), each field's
  `options` a child list; `name` and option `label` are plain strings (short labels, not markdown);
  `fieldDefaults` a `Y.Map<true>` like 030's `packs`; `node.values` a nested `Y.Map<field id,
value>` written key by key, so two tabs editing different fields of one card both survive.
  Emit order: `fields` by order key; `values` keys sorted by field order then id.
- **Why:** matches ADR 0021 / 0022 ("fields and options use layout 2 from the start").

## R4. Model ops (one transaction = one undo step)

- **Decision:** `packages/model/src/ops/fields.ts`: `addField(def, { after? })`,
  `updateField(id, patch)` (name, types, onCard, unit), `moveField(id, beforeId | null)`,
  `deleteField(id)` (removes the definition and every value), `setFieldOptions` /
  `addOption` / `updateOption` / `moveOption` / `deleteOption` (removes values using it),
  `changeFieldKind(id, kind)` (converts or clears values, R6), `setValues(nodeIds, fieldId,
value | null)` (built-in ids write `node.tech` / `host` / `owner`). Every op that touches a
  default field first materialises that type's defaults (R1). All validate first.
- **Why:** each user action maps to one call, so undo granularity matches the UI (SC-003).

## R5. Card display and layout

- **Decision:** `apps/app/src/editor/card-fields.ts` (pure) builds the card's field view from the
  node, the type's fields and the deck: `header` (first on-card status with a value), `chips`
  (select, status, person, date, dateRange in field order), `rows` (text, number, link, progress),
  `hidden` (count of values in fields not on the card). `card-layout.ts` adds the fields block:
  chip shelf measured like the tag block (21 px chips, gap 4, wrapping), rows 19 px each,
  "+N fields" pill 20 px; the minimum height includes the fields block (same rule as tags).
  `deck-node.tsx` draws the block between description and tags (`DESIGN.md` order); the header's
  status slot shows the status chip (icon only under 150 px). Zoom: Component and Container show
  all; System shows chips as 6 px dots in the option colour, no rows (box size unchanged);
  Landscape none. Chip colours reuse 033's `tag-colours.ts` (chip / ink / dot for a `ColorRef`).
  Date format: `Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })` plus the year when
  not the current year; ranges "6–17 Oct".
- **Why:** `DESIGN.md` "Card system (Deck)" item 4 and frame 124; one size per zoom level (§g-58).

## R6. Kind change conversions

- **Decision:** a pure `convertValue(fromKind, toKind, value, ctx)` in `packages/model/src/
field-values.ts` implements the clarify table: text ↔ person; select ↔ status (options carried;
  status options gain `circle` icons, select drops icons); number ↔ progress (progress keeps 0–100
  only); number / date / select / status (label) / person / link (url) → text; text → number when
  `Number(text.trim())` is finite; date → dateRange `{ from: d, to: d }`; dateRange → date (`from`);
  text → select / status (distinct trimmed texts become options in first-seen order, colour none).
  Anything else → cleared. `changeFieldKind` computes the cleared count first so the UI can
  confirm "N values will be cleared", then applies kind, options and values in one transaction.
- **Why:** clarify Q2 (founder chose "any kind, keep what converts, confirm the rest").

## R7. Person suggestions

- **Decision:** generalise `inspector/derive.ts` `ownerSuggestions(deck)` into
  `personSuggestions(deck)` over `node.owner` and every person value; `ComboField` (as
  `OwnerField` uses it) for person inputs; on commit, `canonicalPerson(deck, text)` returns the
  existing spelling when one matches ignoring case and spacing.

## R8. Drawer field editor

- **Decision:** `apps/app/src/editor/fields/typed-fields-section.tsx` replaces the Owner / Tech /
  Host rows in `inspector/node-inspector.tsx` with one "Fields" list (frame 124): drag handle,
  kind icon, name, value control, "On card" switch (description "Applies to every <type>"); a
  row menu (Rename, Change kind…, Options…, Also use for…, Delete); "Add field" inline form (name,
  kind menu, options for select / status, "Show on card", ⏎ adds, Esc cancels). Value controls per
  kind in `fields/value-controls/`. The bulk drawer shows the fields of a single-type selection
  with "Mixed".
- **Why:** frame 124; reuses `ComboField`, `SwatchGrid`, `PickField`, `one-step.ts`.

## R9. Search, export, problems, clipboard

- **Decision:** search adds `SearchField` `'field'` over text, person, number (as typed), option
  labels and link labels; export `scene.ts` / `render-svg.ts` draw the fields block (light theme);
  problems add `field-value-dangling` (field or option missing, or wrong shape) with a "Remove
  value" fix; copy / paste carries `node.values` unchanged (dangling across decks, reported).
- **Why:** FR-017–FR-021.

## R10. Performance

- **Decision:** `fieldsOfType` memoised per deck snapshot and type; `card-fields` per node data;
  `deck-to-flow` cache keys include `values`, the type's field list identity and `fieldDefaults`.
  Bench option `BENCH_FIELDS=1`: 500 cards of Task / Warehouse / Issue with four on-card values.
