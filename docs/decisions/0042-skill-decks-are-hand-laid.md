# 0042. Decks from the AI skill are hand-laid and modelled as hand-offs

- **Status:** Accepted
- **Date:** 2026-10-05
- **Feature:** `specs/027-ai-deck-skill`
- **Amends:** 0040 (its last bullet: "Decks from the skill leave positions out")

## Context

Decks the skill produced from a real codebase were hard to read. A 24-card deck with 13 flows had
no positions, so the import layout placed every card; it drew message topics as cards, so most
flows went into a topic card and back out; and it modelled calls instead of hand-offs, so flows
zig-zagged over the same connectors. The same system, laid out by hand on a column grid, with
topics as connector labels, side reads and writes as dashed connectors and each flow as one walk
along hand-offs, read cleanly at 42 cards on one screen, with nested groups instead of drill-down
levels.

## Decision

- **The skill places every card and note.** Positions come from a column grid (data left to
  right); the skill's `layout.md` reference teaches it, with a generator-script pattern for decks
  over about 15 cards. The app's import layout stays for files without positions (older skill
  output, other tools); the skill no longer relies on it.
- **New authoring checks** in the model's catalogue, reported by the skill's lint only:
  `card-without-position`, `connector-crosses-card` (straight line between card centres, or through
  `route.waypoints`, within 6 px of another card on the same level), `frame-covers-card` (a group
  frame reaching a card of another group) and `frames-overlap` (sibling frames). Card boxes are
  assumed 184 × 96 unless `size` is set, because real heights are measured by the app.
- **`positions-mixed` is retired** (every card needs a position now, in every mode).
- **Budgets per screen go up** (faithful 60, balanced 30, simplified 10): frames carry structure,
  so a screen holds more before it stops reading, and a flow should not need drill-in.
- **Name and distribution.** The skill is renamed `sododeck-diagram` (was `sododeck-deck`). It is
  no longer zipped or hosted by the site: the build writes the folder only, and it is published
  by building into the public repository `FamManh/sododeck-diagram-skill` (Claude Code plugin
  marketplace + plain skills folder, with example decks and screenshots). `/docs/ai-skill` links
  there. This replaces 0040's archive and `/downloads/` bullets.
- **Modelling conventions** (references, not checks): a broker topic is a connector label, never
  a card; solid connectors are hand-offs and the only ones flows use; dashed connectors are side
  reads and writes; branches fork only at the end of a flow, so mid-flow exits go in rules and
  descriptions; codebase mode traces each hop in code and records disagreements as gap notes.

## Consequences

- Skill decks open looking the way the agent intended, and lint catches the common layout
  mistakes before the user sees them.
- The layout checks approximate card heights; a card with many visible fields can be taller than
  96 px and touch a line lint called clear. The 6 px margin and the row step in `layout.md` leave
  room for that.
- Agents spend more effort on a new deck (placing cards, fixing layout warnings); the generator
  pattern keeps that effort to editing a grid.
