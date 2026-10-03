# 0027. Typed fields: three sources, materialised defaults, per-key values

- **Status:** Accepted
- **Date:** 2026-10-03
- **Feature:** `specs/032-typed-fields` (research R1–R10)
- **Builds on:** 0022 (schema roadmap, "Typed fields"), 0025 (card type registry), 0021
  (collaboration-ready document)

## Context

Cards need typed attributes (status, assignee, capacity…) defined per card type, a value per card,
and a chosen subset drawn on the card. Types come with default fields (frame 120), and today's
Tech, Host and Owner must join the same list without moving their data. Older decks must stay
byte-identical, and two tabs editing one card must both keep their change.

## Decision

1. **Three sources, one merge** (R1). `fieldsOfType(deck, type)` in `packages/model/src/fields.ts`
   lists, in order: the type's **code defaults** (`CardType.defaultFields`, ids `<type>.<name>`),
   the deck's **own fields** that apply to the type (deck order), then the **built-ins** Tech and
   Host (Architecture types) and Owner (every type). A card also lists Tech / Host when it holds a
   value for them although its type does not (`fieldsOfNode`). Built-ins come last because a
   card's own fields matter more (frame 124 lists Task: Status, Assignee, Due date, then Owner);
   this deviates from the plan's "built-ins first" wording. Memoised per field list identity and
   type.
2. **Materialising** (R1). The first change to a default field of a type writes **all** of that
   type's defaults into `fields` (before the first stored field of the type, so the order shown
   does not move) and adds the type to root `fieldDefaults`, in the same undo step. From then on
   only the deck's entries count for that type, so a deleted default stays deleted. Setting a
   value never materialises. A built-in gets a deck entry (name, kind, `onCard`) only when it is
   turned on the card or reordered; its name, kind and types stay the code's.
3. **File format** (R2). Root `fields` (`FieldDef { id, name, kind, types?, onCard?, unit?,
options? }`, `FieldOption { id, label, color?, icon? }`) and `fieldDefaults` (`TypeId[]`) after
   `packs`; `Node.values` (field id → `FieldValue`: string, number, `{ from, to }` or
   `{ url, label? }`) after `host`. Refines 0022: `unit` on number fields, status `icon`
   (`circle`, `circle-dashed`, `circle-dot`, `circle-check`, `eye`, `door-open`), `fieldDefaults`,
   and built-in entries. Semantic rules: **S12** (unique field ids, built-in kinds fixed, `unit`
   only on number, `options` only on select / status, unique option ids, `icon` only on status
   options) and **S13** (`values` keys are ids and never `tech` / `host` / `owner`). No version
   bump.
4. **Dangling values are valid.** A value whose field or option is gone, whose shape does not fit
   its field (progress 140, date "14/10"), or whose field no longer applies to the card's type is
   kept, not drawn, and reported as `field-value-dangling` with a "Remove value" fix.
5. **Document layout** (R3, refined). `meta.fields` is a layout-2 list with an `options` child
   list per field; `meta.fieldDefaults` a `Y.Map<true>`; both created lazily (a file that has
   them, or the first definition change). **Values are one node key each, `$value:<field id>`**,
   not the nested `values` map the plan named: two tabs setting the first values of one card
   would each create a nested map and one would be lost. Readers rebuild `values`; output sorts
   its keys by field id (replicas receive keys in different orders).
6. **On card is per field definition** (clarify Q1), so per type; the drawer's switch says
   "Applies to every <type>" (every listed type for a shared field, "every card" for Owner).
7. **Kind changes** (R6) keep what converts (text ↔ person, select ↔ status with the same option
   ids, number ↔ progress within 0–100, values → text, text → number, text → options by label,
   date ↔ range) and clear the rest after "N values will be cleared", in one undo step. Built-ins
   never change kind.
8. **People** (R7). Person fields and Owner suggest names already used in the deck; a typed name
   equal to one ignoring case and spacing is written in the existing spelling. No people list and
   no bulk rename.

## Consequences

- A deck that never touches fields is written byte-identical; one that only sets values gains
  `node.values` but no `fields`.
- The first field definition created concurrently in two tabs can still lose one tab's list
  (like `packs`); values and later definition edits merge key by key.
- Filtering or sorting by values, formulas and relations remain out of scope; per-view
  visibility would be a view-level override of `onCard`.
