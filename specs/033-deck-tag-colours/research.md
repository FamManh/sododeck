# Research: Deck Tag Colours (033)

Decisions behind [plan.md](plan.md). Each entry gives the decision, why, and what else was considered. Code names were checked on `main` at `2e85e4a` (029 merged).

## R1. File format: root `tagColors`

**Decision**

- Add optional root `tagColors`: an object whose keys are tag text and whose values are `$defs/ColorRef` (`additionalProperties: { $ref: ColorRef }`), declared **after** `swatches` and before `nodes`. Canonical key order comes from declaration order (`key-order.ts`); a map-like object keeps its own key order.
- Add semantic rule **S8** in `semantic-rules.ts`: every key is non-empty after trimming and no two keys are equal when case is ignored (`tagKey`). The Zod generator drops `propertyNames` (see S2, S3 in the file header), and JSON Schema cannot compare keys, so this lives next to the other semantic rules, with invalid fixtures.
- `version` stays `1`. Absent `tagColors` means every tag is slate. A key with no card carrying it is valid.

**Why**: ADR 0022 already fixes the shape (root map, key = tag as first typed, one entry per case-insensitive tag, "a tag with no entry is valid"). Additive optional fields do not bump the version (constitution II, ADR 0002).

**Alternatives**: colour inside `deck.tags` (breaks files that store plain strings there, ADR 0022); a list of `{ tag, color }` objects (needs a uniqueness rule anyway and is harder to edit key by key in Yjs); a per-node colour (the colour would drift between cards).

## R2. Yjs layout: always-present `meta.tagColors`

**Decision**: `fromJSON` always sets `meta.tagColors` to a `Y.Map<string>` (possibly empty); `readMeta` emits it only when non-empty. A helper `tagColorsMap(doc)` returns the stored map, or a detached one for a stored document that predates it (the same technique `swatchesArray` uses), and the first write attaches it.

**Why**: when two tabs each create the nested type for the first time, one wins and the other's keys are lost. Creating it at load removes that race, exactly as for `swatches` (020, `deck.ts`). Per-key writes then merge. Documents already stored in IndexedDB have no map: the lazy attach covers them without a migration (ADR 0021 layout 2 is unchanged in shape; only the comment block in `deck.ts` grows one line).

**Alternatives**: a plain JSON value stored under one key (a whole-map last-write-wins: two tabs colouring different tags would overwrite each other); encoding the colour on the node map (see R1).

## R3. Model operations

**Decision**: three operations in `ops/tags.ts`, each in one `ctx.transact` (one undo step) and each validating before writing, as `ops/swatches.ts` does:

- `setTagColor(tag, color | null)`: finds the existing key by `tagKey`, keeps that key's spelling and sets or deletes the value; with no existing key the entry is written under the spelling given. Validates the value as a `ColorRef`. Setting `null` on an absent key does nothing.
- `renameTag(from, to)`: rewrites every carrier whose tag has `from`'s key to the target spelling and de-duplicates by key inside each array, keeping the first position. Carriers: `nodes`, `edges`, `flows` and `steps` `tags`, deck `tags`, and every view's `excludeTags`. Moves the colour entry to the new key. If `to`'s key already exists on another spelling, the existing spelling (the colour key, else the first spelling in deck order) is the target, and if both tags have a colour the target's colour is kept; this is the **merge**. A change of case only (same key) rewrites the spelling and the colour key, with no merge.
- `deleteTag(tag)`: removes the tag from every carrier (an emptied `tags` array becomes absent, as the app writes it today), from `excludeTags`, and deletes the colour entry.

All three return a summary (`{ cards, others }` counts of carriers touched) so the app can announce it and fill the confirmation line. Counts for the confirmation are computed before the call by the pure `tagUsage(deck, tag)` (R4).

**Why**: the tag is its text (ADR 0022), so a rename must rewrite every reference in one step or filters and suggestions silently drift. Doing it in the model keeps conversion and invariants in one place (constitution II) and gives one undo step for free (`ctx.transact`). The editor's `batch` could chain `update` calls from the app, but each call validates a whole object, and a half-failed batch cannot roll back (`editor.ts` `batch` comment).

**Alternatives**: app-side loops over `editor.update` (slow, partial failure leaves a half-renamed deck, and the logic would be untestable at the model level); soft rename that stores aliases (new concept, nothing else needs it).

## R4. Case rule and one `tagKey`

**Decision**

- `tagKey(text) = text.trim().replace(/\s+/g, ' ').toLowerCase()`; `sameTag(a, b) = tagKey(a) === tagKey(b)`. The stored text is the trimmed, single-spaced text **with its case kept** (founder, §g-64).
- Display spelling of a key: the `tagColors` key when the key has one, else the first spelling met scanning `nodes`, `edges`, `flows`, steps, then deck `tags`, in stored order. It is derived, never stored on its own.
- `canonicalTag(deck, typed)` returns the display spelling when the key exists, else `typed` normalised. Every add path calls it, so "pic" becomes "PIC" when "PIC" exists.
- `deckTags(deck)` returns `{ tag, key, count, color }` for every tag on a card or in `tagColors`, sorted by count (high first), then by name ignoring case. `count` is cards only. `tagUsage(deck, tag)` returns `{ cards, others: { connections, flows, steps, deckTag } }` for the delete / merge text.
- Older decks: nothing is rewritten on open. Two spellings of one key list as one tag; the first rename, recolour or delete of that tag rewrites every spelling to the display one (for recolour: the colour is stored under the display spelling and cards are left alone until the tag is renamed or the user edits the card).
- `tagKey` is a one-liner needed by `packages/model` (ops), `packages/schema` (S8) and `packages/ui` (`TagInput`). `ui` must not depend on `model` (dependency direction), and `model` must not depend on `ui`. The rule is kept in each leaf (`schema/src/semantic-rules.ts` inlines it, `model/src/tags.ts` exports it, `ui/src/lib/tags.ts` has its own) and an app-level test asserts that the model and ui versions agree on a table of 30 samples (accents, spaces, mixed case).

**Why**: the spec says matching ignores case and the first spelling wins; both need one definition of "same tag". Display spelling from the data (colour key, then first seen) keeps the rule deterministic without a stored field.

**Alternatives**: `toLocaleLowerCase()` (locale-dependent results, surprising for "İ"); a new shared package for three lines; a stored `canonical` spelling (a second source of truth).

## R5. Drawing the pills

**Decision**

- `tagColours(color: ColorRef | undefined)` (app, `tags/tag-colours.ts`) returns `{ chip, ink, dot }`: a named colour gives `var(--color-card-<name>-chip|ink|dot)`; a hex gives the hex as chip and dot and the readable ink (`readableText`) as `var(--color-card-text-dark|light)`; no colour gives the slate tokens. The chip mapping in `style/card-style.ts` `resolveLook` is factored into this function so cards and tags share one mapping.
- `toFlowNodes` puts `tags: { text, chip, ink, dot }[]` in node data (first ten). The cache check in `deck-to-flow.ts` includes the identity of `tagColors`, so a recolour invalidates every card that shows a coloured tag; the cost is the same as a card colour change.
- `deck-node.tsx` styles each `<li>` with inline `--tag-chip`, `--tag-ink`, `--tag-dot` set per tag; classes read those variables. Sizes, wrap and truncation are unchanged, so `cardLayout` and `card-tags.ts` do not change.
- Pills follow the tag colour, not the card colour (refinement 2 in the plan). Header tile and field chips keep following the card colour.

**Why**: a tag has one colour everywhere (spec FR-002); sharing the card's mapping avoids two copies of the named / hex / contrast logic.

**Alternatives**: tokens per tag in CSS (the set of tags is user data); resolving colours inside `DeckNode` from the store (it would subscribe to the document, against the data flow where `deck-to-flow` derives the view data).

## R6. One picker, one editor

**Decision**

- `TagPicker`: a search field, a `listbox` of the deck's tags (colour dot, name, card count, pencil), and a trailing "Create tag “…” ⏎" row when the text matches no tag by key. Rows for tags on the selection show a check (all) or a dashed "n of N" (some), reusing the bulk-edit meaning (008, 019). ⏎ on a row toggles it on the selection; ⏎ on the create row adds the canonical spelling.
- `TagEditor` replaces the list inside the same popover (back arrow and Esc return to the list): name input, `SwatchGrid` with the 13 colours and the deck's colours (`swatches`), a "No colour" swatch, and "Delete tag · used on N cards".
- Hosts: the drawer's `CardTagsField` (one card), `BulkTags` (several cards) and the selection toolbar's Tags popover (019) all open the same picker. The old `tagChoices` list in `quick-edit` is replaced by the picker's own row model.
- Renaming to an existing key opens an inline confirmation ("Merge into “PIC”? 6 cards change") before calling `renameTag`; delete confirms the same way.
- The max of ten per card is enforced in the app write path as today: the row is disabled with the "10 tags max" note, and bulk add skips full cards with an announcement (existing behaviour).

**Why**: backlog and frame 125 define one picker and one editor; three hosts with three implementations would drift. The editor inside the popover keeps keyboard order simple (no nested popover focus traps).

**Alternatives**: a separate dialog for the editor (extra focus trap and a heavier flow for a small edit); keeping the toolbar's choice list (a second, colourless list of tags).

## R7. Drawer tag row keyboard

**Decision**: `CardTagsField` renders the row as a `list` of 21px pills with a × button each (`TagChip` with `size="deck"`), then a dashed "+ tag" button. ⌫ or Delete on a focused × removes the tag from that card (already in `TagChip`); ⏎ or Space on the "+ tag" button, or ⏎ on the row's container, opens the picker; Esc closes it and returns focus to the button. After a removal, focus moves to the next pill, else the "+ tag" button (the behaviour `TagInput` has today).

**Why**: frame 125 "drawer tag row with keyboard focus" and spec FR-007. `TagInput`'s free text field is not the design: the picker is the entry point.

**Alternatives**: keeping the inline combobox next to the picker (two ways to add, two sets of case rules).

## R8. Tags on connections, flows, steps and the deck

**Decision**: they keep `TagsField` and `TagInput` with neutral chips. `TagInput` and `ui/lib/tags` become key-based and case-keeping; `TagsField` maps newly typed tags through `canonicalTag`. They are not listed in the picker, but `renameTag` and `deleteTag` reach them (R3) and `tagSuggestions` keeps listing them for autocomplete.

**Why**: spec scope (cards only for colour), with consistency of spelling and rename.

**Alternatives**: colouring those chips too (explicit out-of-scope in the spec).

## R9. Export

**Decision**: `SceneCard.tags` becomes `{ text, color }` entries; `render-svg.ts` looks the colour up in the light palette (`export-palette.ts` already holds chip and ink per named colour, 029) and uses `readableText` for a hex. Uncoloured tags use the slate pair. Pill geometry does not change (`tagChips`).

**Why**: FR-015, and one palette for export (ADR 0016: export is light only).

**Alternatives**: leave export neutral (the card on screen and in the file would disagree).

## R10. Tokens and contrast

**Decision**: no new tokens. `--sd-card-<colour>-chip|ink|dot` exist for 13 colours × 2 themes and the slate set exists (029, DESIGN.md). Add `test/contrast.test.ts` cases for `readableText` over a sample of 24 custom hex values (primary hues, near-white, near-black) at 10.5px / 500, ≥ 4.5:1.

**Why**: SC-003. The named pairs are already tested; only custom hex needed cases.

**Alternatives**: restricting tags to the 13 named colours (the spec allows deck colours).

## R11. Performance and bench

**Decision**: derivations (`deckTags`, `tagUsage`) are pure and memoised on the deck snapshot in the components that use them. The canvas change is data on `<li>` (inline variables); run `pnpm bench` before and after with a deck where every card has 3 to 10 tags and 8 tags are coloured (a `BENCH_TAGS` variant of `perf.bench.ts` if the base deck has none) and report both. Model ops are measured in a Vitest case on 500 cards (recolour, rename, delete under 100 ms).

**Why**: AGENTS.md "Performance-sensitive changes to the canvas: run `pnpm bench` before and after"; the node data grows by a small object per tag.

**Alternatives**: none; this is a gate.

## R12. Docs and ADRs

**Decision**: ADR 0022: mark the `tagColors` row as built by 033 and add three lines (S8, rename and delete rewrite all carriers, display spelling rule). ADR 0021: one line in the layout comment (`meta.tagColors`). `DESIGN.md`: the Components `tag-chip` entry (21px deck chip with colour, drawer row) and the card pill rule (tag colour, slate default). Package `CLAUDE.md`s for `schema` (S8), `model` (tag ops, `tags.ts`), `ui` (case-keeping `tags.ts`, `TagChip` colour) and `app` (the `tags/` folder). `docs/backlog.md` §033 status. No new ADR: every decision refines ADR 0022.

**Alternatives**: a new ADR for the case rule (it is a founder decision already recorded in §g-64 and in ADR 0022's key rule).
