---
name: sododeck-deck
description: >-
  Writes and edits Sododeck decks (.sododeck files): architecture components, connectors, groups,
  drill-down levels, step-by-step flows and decision rules, checked by bundled validate and lint
  scripts so the file imports cleanly into Sododeck. Use this whenever the user wants a system,
  architecture, service, data-flow or request-flow diagram, wants to document how a request moves
  through services, has a .sododeck file to change, or asks for a deck built from a description, a
  codebase, a database schema, Mermaid, C4 or OpenAPI, even if they never say "Sododeck".
---

# Sododeck deck

A Sododeck deck is a **model, not a picture**: cards (components), connectors between them, groups,
levels you can drill into, flows that walk along connectors step by step, and decision rules
attached to steps. The app draws and lays it out. Your job is to get the structure right; never
spend effort on coordinates.

Skill {{skillVersion}} · file format version {{formatVersion}} · schema fingerprint {{fingerprint}}.
The full schema is `schema/v1.json`; you rarely need to read it, the references cover what matters.

## Workflow

1. **Pick the mode** and read the one reference it needs (table below). Don't read the others:
   they cost context and don't help the task.
2. **Decide the dials** (detail, audience) from the request; defaults are fine when unsure.
3. **Write the deck to a draft file** (for example `checkout.draft.sododeck`), never straight over
   the user's file. In update mode, start the draft as a copy of their file and edit it in place.
4. **Check it** with `validate.mjs` and then `lint.mjs` (commands below). Fix every `error`, rerun,
   repeat until both exit 0. Each problem gives the `code`, the JSON `path`, the `subject` id and a
   `fix`; follow the fix.
5. **Deliver** with `deliver.mjs`: it moves the draft over the target only when it passes, so a
   broken draft can never replace a good deck.
6. **Hand over** in the format at the end of this file.

```
node <skill>/scripts/validate.mjs draft.sododeck --format text
node <skill>/scripts/lint.mjs draft.sododeck --format text [--mode update|codebase] [--detail …]
node <skill>/scripts/deliver.mjs draft.sododeck target.sododeck [--mode …]
```

`<skill>` is the folder this file is in. `--format text` prints one line when all is well and one
short block per problem, which keeps your context small; leave it out when you want JSON to parse.
All scripts need Node 20 or newer, work offline and read only the files you name.
`references/scripts.md` lists every option and problem code.

## Modes

| The user wants…                         | Mode             | Read                                                                                                                                               |
| --------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| a deck from a description (the default) | `new`            | `references/modeling.md`, plus `flows.md` when they mention a sequence, `rules.md` when they mention a decision or policy                          |
| to change an existing deck              | `update`         | run `summary.mjs` on it first, then the reference for what they ask about (`flows.md` for a new flow, `modeling.md` for new cards and their types) |
| a deck of a code repository             | `codebase`       | `references/from-codebase.md`                                                                                                                      |
| a deck from Mermaid, C4 text or OpenAPI | `text`           | `references/from-text-formats.md`                                                                                                                  |
| database tables and relationships       | `new` / `update` | `references/database.md`                                                                                                                           |

Read `references/taste.md` once for any new deck: it is short and decides whether the deck is
readable.

Pass the mode to lint (`--mode update`, `--mode codebase`) so it applies the right checks.

## Dials

- **Detail** (`--detail` for lint): `faithful` (at most 24 cards per level), `balanced` (12, the
  default), `simplified` (7). Pick `simplified` for an overview or a slide, `faithful` when the
  user wants everything. A system bigger than the budget is split into levels (a parent card you
  can open), not crammed into one screen.
- **Audience**: `engineer` (default: protocols, tech, payload samples), `mixed` (plain titles,
  short descriptions), `executive` (outcomes and owners, no protocols). The audience changes
  wording and which fields you fill, never the structure rules.

## Rules that matter most

- **Ids are permanent.** Pick a short lower-case slug once (`orders`, `orders-db`, `e-pay`) and
  never change it, even when the title changes. Views, notes and links the user adds later attach
  by id; a new id silently detaches them.
- **Only declared structure.** Add a connector only for a call the user described or the code
  shows. If something is likely but unstated, leave it out and list it under "Assumed" in the
  handover, so the user decides. When the request cannot be drawn without a piece it does not name
  ("send a confirmation email" needs something that sends it), add the smallest piece that makes
  it true, and list that under "Assumed" too. Don't add alternatives, retries or failure paths
  nobody asked for.
- **Flows walk along connectors.** Each step names a connector, and each step must start where the
  previous one ended. A reply needs its own connector back (see `flows.md`).
- **Leave positions out** of new decks. The app lays the deck out on import. In update mode, keep
  the positions that exist and give new cards none.

## Update mode

Change only what was asked. Keep every other object and every id exactly as it is, including key
order and wording you did not need to touch; edit the draft rather than regenerating the whole
file, so the user's own diff tools stay quiet too. The user's file is untouched until you deliver,
so before delivering run `node <skill>/scripts/diff.mjs <their file> <draft> --format text` and
show the result: added (`+`), changed (`~`) and removed (`-`), matched by id. Anything removed must
be something they asked to remove; say so explicitly. A `~` on an object you did not mean to touch
is a slip: undo it.

## Handover

End with this, filled in (omit lines that don't apply):

```
Deck: <path> (<n> cards, <n> connectors, <n> flows). validate ✓ lint ✓ (warnings: <n or none>)
What's in it: <3–6 lines from summary.mjs>
Assumed: <what you inferred rather than read, or "nothing">
Warnings kept: <code: why it is fine here>                (only when lint left warnings)
Changes: <diff.mjs text output>                         (update mode)
Fidelity: merged … · collapsed … · left out … · could not map …   (codebase / text modes)
Import: open Sododeck, Library → Import (or drop the file on the library).
        If it reports problems, use "Copy problems" and paste them here.
```
