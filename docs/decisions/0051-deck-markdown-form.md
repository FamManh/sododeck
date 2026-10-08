# 0051. The `.sododeck.md` form of a deck

- **Status:** Accepted
- **Date:** 2026-10-07
- **Feature:** 070 (`specs/070-obsidian-plugin/`)
- **Amends:** nothing in the deck format (ADR 0002, 0020); adds a second container for the same JSON

## Context

A notes app understands links, tags and text only in Markdown notes. A plain `.sododeck` file is
invisible to its search and backlinks, and its picture paths break when a picture is moved (the app
rewrites links in notes, not paths in JSON). The founder chose a Markdown form after seeing this
(spec clarifications, 2026-10-07).

## Decision

1. **A note that holds the whole deck.** `.sododeck.md` is a Markdown file with the front matter key
   `sododeck-plugin: parsed` (the marker), an owned region (`%% sododeck:begin …` to
   `%% sododeck:end %%`) and, inside it, a readable part and the canonical deck JSON as a fenced
   `json` block hidden in a `%% … %%` comment. The deck JSON is unchanged: copy it out and it is a
   `.sododeck`. No schema change, no version bump.
2. **Readable text, read back by id.** Titles and prose fields get a heading or a body marker ending
   in the object's stable id (`%%id%%`, `%%id:field%%`). Reading applies edits to those fields by id;
   the readable text wins over the block; a value that would be invalid (an empty required title) is
   ignored; unknown ids and unmarked headings are ignored. Everything not in the table of the
   contract (positions, styles, connections, tables…) stays only in the block.
3. **The text outside the owned region belongs to the user.** Text before and after the region,
   other front matter keys and foreign blocks (headings or paragraphs inside the region that no
   marker explains) are kept byte for byte across any number of writes (`toMarkdown(deck, previous)`).
4. **Edits are compared against what we would have written.** For each title or body the reader
   computes what the writer would have produced for the block's current value and treats an equal
   readable value as "unchanged". So trimming, line endings and escaping never turn into false
   edits, and a deck round-trips byte for byte whatever its prose contains.
5. **A small grammar of our own, no Markdown parser.** The form is line-based and fully specified
   (`specs/070-obsidian-plugin/contracts/markdown-form.md`). A parser would normalise the user's
   text and add a runtime dependency. Escaping is one pass over a four-token table (`%%`, line
   break in a title, literal `<br>`, an `&` that would start one of those) so the reverse is exact;
   property-tested over generated strings.
6. **Pictures.** An asset with a `path` is listed as `- [[path]] %%id%%`, so the app tracks the file
   and rewrites the link on a move; reading takes the visible link as the truth for `assets[id].path`
   when it passes `checkPicturePath`. An embedded picture is listed by name only.
7. **Plain JSON, not compressed.** The note must stay readable, diffable and writable by agents. The
   cost is that the app's search also indexes the JSON text; the comment hides it from reading view.
8. **Lives in `packages/model`, as pure text.** `markdown-form.ts` imports no Yjs (a test follows its
   import graph), so the web app, the plugin and later the skill share one implementation and one
   test corpus. `markdown-marker.ts` (importable as `@sododeck/model/markdown-marker`) holds only the
   front matter check, for code that must not load the schema (the library route's import).
9. **Four new problem codes** (`md-no-marker`, `md-no-deck-block`, `md-deck-block-not-json`,
   `md-two-deck-blocks`) in the catalogue; a block that parses but is not a valid deck is not a
   failure of the form (the editor shows its problems).
10. **The web app** gains "Export .sododeck.md" (library deck menu, deck inspector) and imports the
    form by content (a text whose front matter carries the marker), through the same worker path as
    a `.sododeck`.

## Consequences

- The marker value `parsed` and the region delimiters are part of the format; changing them needs a
  new marker value and a reader for the old one.
- The constitution's "strict JSON file format" line is about the schema; the note embeds that JSON
  unchanged. Listed under Complexity Tracking in the plan.
- A deck block with `%%` in a string is written as `%%`; `JSON.parse` restores it.
- The first draft of the contract put `%%` inside the region's opening hint, which would end the
  comment early; the hint no longer contains it.
