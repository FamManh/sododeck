# 0014. Canvas-first shell: a full-bleed canvas with floating chrome

- **Status:** Accepted
- **Date:** 2026-09-28
- **Feature:** `specs/018-canvas-first-layout` (spec, research R1–R15, contracts)

## Context

The editor used three fixed columns (a 264 px sidebar, the canvas with the JSON panel under it,
a 336 px inspector) under a 56 px top bar. That left about half of a 1440×900 window for the
diagram, which is too little for decks of 100+ components (§g-38). The canvas-first design
(states 86–116) puts the canvas under everything and floats the chrome over it: a deck island, a
tools island, a left rail with flyouts, a history island, a zoom island, an on-demand detail
drawer and a JSON overlay that is hidden by default. Three constraints shape the design:

- The canvas must never resize when chrome opens or closes, and drags that start on the canvas
  must keep working under and around the chrome.
- Panel **content** (02–85) does not change. The panels move; they are not rewritten.
- Shell state is UI state (constitution I). §g-50 asks for drawer width, the pinned flyout and
  the JSON panel to be remembered per deck, but never in the deck file, and not synced between
  tabs.

## Decision

1. **One full-bleed canvas and a pointer-transparent overlay layer.** `CanvasShell`
   (`apps/app/src/editor/shell/`) renders the canvas at `inset: 0` and a sibling overlay layer
   with `pointer-events: none`; each island, flyout, drawer and overlay opts back in with
   `pointer-events: auto`. Nothing shares the canvas's box, so React Flow never re-measures or
   re-fits because of chrome. The step player stays a React Flow panel because it belongs to the
   canvas. The rule editor keeps its top bar and layout.
2. **Shell state in the UI store; per-deck preferences in `localStorage`.** The store's shell
   slice holds the shown flyout, the pinned flyout, the drawer (open, width, mode), Hide UI, the
   minimap, the active tool and the help dialog. Drawer width, pinned flyout and whether JSON is
   open are also saved under `sododeck.shell.<deckId>`, read once when the deck opens, written on
   change, never broadcast, and removed when the library purges the deck. The JSON panel's height
   and tab stay in the global `sododeck.jsonPanel` key; it is hidden by default.
3. **One flyout at a time, plus one pinned.** Opening a flyout replaces the one shown. A pinned
   flyout stays open during canvas work and returns when a temporary flyout closes. A recording
   session (006) opens and pins the flows flyout for its duration, then restores the pin.
4. **The inspector opens on request.** The detail drawer overlays the right side and opens only
   from Enter on a plain component, a double-click, ⌘⇧D, "Open details" or "Deck settings". When
   it would cover the selection the canvas pans horizontally; it never zooms or resizes.
5. **Keyboard regions.** Each island and the drawer is a named region; F6 / ⇧F6 cycle deck →
   tools → rail → history → canvas → zoom → drawer, skipping hidden regions. New keys read
   `event.code` where the character depends on the layout or modifier (⌥1, ⌥2, ⇧1, ⇧2, ⌘\\).
   One `SHORTCUTS` table feeds the tooltips and the help dialog.
6. **Rail tools use today's operations.** Sticky and Connector act on the next click and fall
   back to Select. C opens the palette when no card is focused and the connect popover when one
   is (§g-49). The Group tool is shown disabled until 016 adds "group from selection" (founder
   approval, 2026-09-28).

## Alternatives considered

- **React Flow `<Panel>`s for every island:** they live inside the pane's stacking context; the
  drawer and JSON overlay must also cover the minimap and step player.
- **A CSS grid with overlapping areas:** the same result, harder to reason about for the JSON
  overlay's right edge next to the drawer.
- **Per-deck preferences in the library's IndexedDB record:** asynchronous first paint, and UI
  preferences mixed into library metadata.
- **A stack of flyouts:** more states than the design shows.
- **Radix Popover for flyouts:** closes on any outside interaction and handles focus modally,
  which breaks pinning.
- **Opening the drawer on selection:** takes space the user did not ask for (spec: on request).
- **Hiding the Group tool until 016:** the rail would change shape later and not match state 86.

## Consequences

- `LeftSidebar` and `CanvasToolbar` are removed; their content lives in flyouts, the tools
  island, the views menu (Tidy layout, view settings) and the inspector (Pin).
- Tests that expected a permanent "Inspector" region open the drawer first; the smoke suite opens
  JSON with ⌘J.
- 019 adds the card's details button, the selection toolbar and the context menu on top of this
  shell; 016 enables the Group tool.
