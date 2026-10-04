# 0025. Card type registry, open type ids and deck packs

- **Status:** Accepted
- **Date:** 2026-10-03
- **Feature:** `specs/030-card-types-and-packs` (research R1–R7)
- **Builds on:** 0022 (schema roadmap), 0021 (collaboration-ready document), 0004 (field decisions)

## Context

A card's type was a six-value enum in the schema and was hard-coded in about twenty places (icons,
labels, the Add flyout, pickers, view filters, export, thumbnails). New types (Process, Logistics,
Data) and a per-deck choice of which types to offer need an open set of ids, one registry every
place reads, and a way to store the choice without changing any older file.

## Decision

1. **Registry split along the package rules.** Names, packs, categories and order live in
   `packages/model/src/card-types.ts` (pure data; the model needs it for problems and search).
   Icons and tile tones live in `packages/ui/src/lib/icons.ts` (`TYPE_STYLE`, keyed by type id).
   `ui` never imports `model` and `model` never imports React; an app test checks every registry
   id has a tile style and an export icon.
2. **Open ids in the file.** `$defs/NodeKind` is replaced by `$defs/TypeId` (pattern
   `^[a-z][a-z0-9-]{0,47}$`) for `node.type`, `view.excludeKinds` and `view.dimKinds` (key names
   unchanged). A new optional root `packs` (`PackId[]`, unique, at least one) follows `tagColors`.
   No version bump: every older file stays valid and is written back byte-identical.
3. **Legacy and new decks.** A file without `packs` reads as `["architecture"]` and is written
   without it until the user changes packs. A new deck (`createDeck()`) starts with all four packs
   on (amended by ADR 0032: every pack but Logistics, and packs are shown in a display order
   separate from this file order). `meta.packs` is a lazily created `Y.Map<true>` keyed by pack id (two tabs toggling
   different packs both keep their change); it is read in registry order, unknown ids sorted
   after, so every replica writes the same bytes. `setPackOn` refuses to turn off the last pack.
4. **Unknown ids are valid.** A type or pack id this version does not know loads, is kept on save
   and export, draws as a generic card (Shapes icon, neutral tile) with the raw id as its name, and
   is reported by the `unknown-card-type` and `unknown-pack` problems. It never blocks loading.
5. **Names.** "Gateway" keeps its name (older decks must look the same). Every "Kind" label in the
   UI becomes "Type"; internal identifiers are renamed only where touched.
6. **Add flyout and pickers.** The Add flyout lists the types of the packs that are on (search,
   category tabs, sections, keys 1–9 on the visible tiles); "Packs · N on" opens "Packs in this
   deck" in the same flyout. Type pickers list the packs-on types grouped by category plus each
   selected card's current type, so a picker never hides what a card is. Turning a pack off never
   changes a card.
7. **Search.** A card's type name is a searchable field, so "truck route" finds its cards.

## Consequences

- 031 adds a `shapes` category and pack to the same registry; 032 adds default fields per type.
- A file with `packs` is read by earlier app versions only if they accept the key (compatibility
  is 025's; they reject unknown root keys).
- Connection rules and zoom levels still do not depend on the type.
