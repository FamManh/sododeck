# 0036. Sticky notes v2: connector ends, size, fit, shared tags and locks

- **Status:** Accepted
- **Date:** 2026-10-05
- **Feature:** `specs/053-sticky-notes-and-connectors` (research R1-R11)
- **Builds on:** 0010 (stickies), 0031 (group ends), 0022 (schema roadmap)

## Context

Founder feedback (2026-10-05): a note should look like a note, be resizable, take a connector (to
comment on a card), have its own toolbar and tags, fit its text to its size, and connectors should
be editable and lockable several at a time.

## Decision

- **Additive fields, no `version` bump.** `Sticky.size`, `fontSize` (12, 14, 16, 20, 24, 32; absent
  is Auto), `align` (absent is centre), `tags`, `locked` (`const: true`) and `Edge.locked`. Optional,
  appended in a fixed key order after `showInFlows`; an older build keeps unknown optional data
  (ADR 0020).
- **A sticky is a connector end.** `Edge.from` / `to` may name a note, as they may name a group
  (0031). `endpointOf` resolves a node first, then a group, then a note on an id clash, so a file
  written before 053 keeps its meaning; the integrity report flags the clash. An older build shows
  such a connector as a broken reference, the same accepted trade-off as 0031.
- **Shared tags.** A note's tags are the deck's tags: the same colours, renames and suggestions as
  cards and connectors, so no second tag store.
- **Auto-fit is display-only.** The fitted font size is derived from the text, the box, the tag rows
  and the alignment (the largest of a fixed descending list that fits) and is never written, so it
  cannot go stale or bloat the file. The canvas measures the rendered markdown in the DOM; the
  export measures plain text with the same steps and a text measurer.
- **Locks.** `locked: true` on a note or connector is refused by the model (`locked` error) for the
  moves that would change it. The app filters locked ids before a batch and disables the controls,
  and shows a lock glyph, so the model error is a backstop.

## Alternatives considered

- **Store the fitted size:** derived data, goes stale, and every edit would write it.
- **A separate comment-link edge kind:** more code and a second connector model; the spec asks for a
  regular connector.
- **Canvas-only text measuring for the on-screen fit:** wrong for lists, headings and code.
- **A version bump:** nothing is removed or renamed, and 0022 reserves bumps for breaking changes.

## Consequences

- Notes join flows, search, export and the outline as connector ends; the export draws wrapped plain
  text and chips at the fitted size.
- The fit runs at most eleven DOM measurements per edit or resize, never on pan or zoom.
