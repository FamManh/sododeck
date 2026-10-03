# Claude Design prompt: canvas-first editor (backlog 018, 019, 020, 016, 017)

Paste the block below into the existing Sododeck Claude Design project (the one with
`Sododeck.dc.html`, `Sododeck State.dc.html`, `Sododeck Extensions.dc.html`). Attach the founder's
reference screenshots (empty board, dense board at 51 %, selection toolbar, More menu, right-click menu,
colour popover) and `DESIGN.md`.

---

Redesign the Sododeck **editor** as a **canvas-first** workspace, like a modern whiteboard. Keep the
Sododeck visual language (DESIGN.md: warm neutrals, orange primary `#f2661c`, Geist / Geist Mono,
12 px node radius, hairline borders, quiet shadows, lucide icons, light and dark themes). Only
the **placement** of the editor chrome changes, plus a few new on-canvas controls. Panel content
(outline tree, flow list, step player, inspector fields, rules, JSON viewer) stays as in the
existing frames. Reuse those components and move them.

**Why:** users draw architecture diagrams with 100+ components. Today the sidebar (264 px), the
inspector (336 px) and the JSON panel leave about half the screen for the canvas. Most edits only
change a title, and details are opened rarely.

**Product rules to respect**

- Local-first, no accounts. Do not design avatars, sharing, comments, presence or AI buttons.
- Keyboard first. Every control has a focus state and a shortcut hint in its tooltip.
- Colour is never the only cue (selection, flow, error states keep an icon, ring or pattern).
- English UI. Use the DESIGN.md tokens only. New tokens (card colours) must come in light and dark
  pairs.

## 1. Shell (backlog 018)

The canvas (dot grid) fills the whole viewport. Chrome floats over it in small white islands with
a hairline border, 12 px radius and the rest shadow. They sit 12 px from the edges.

- **Top-left island:** app menu (≡) · deck name (click to rename) · save-status icon (saved /
  saving / error, tooltip text) · the view switcher (System / Feature / Infra / +) as a compact
  segmented control or a dropdown. The ≡ menu holds Back to library, Import, Export, Deck
  settings, Show JSON (⌘J), Keyboard shortcuts.
- **Top-right island:** Jump to (⌘K) · Labels · Focus · theme toggle · Export (primary). When a
  flow is playing, the step player docks at the bottom centre instead.
- **Left rail** (48 px wide, vertically centred, icon buttons with tooltips and shortcut hints):
  Select (V) · Add component (C, opens the palette flyout) · Sticky (S) · Group (G) · Connector
  (L) · divider · Outline · Flows & features · Rules · Search · divider · Undo · Redo (a separate
  small island below).
- **Flyouts:** open next to the rail (about 280 px wide, full rail height or content height),
  overlay the canvas, one open at a time, with a pin button to keep one open and Esc to close.
  Design: Palette (kinds grid + search), Outline (existing tree), Flows & features (existing
  list), Rules (list).
- **Detail drawer** (right, about 360 px, overlays the canvas, never pushes it). It holds the
  existing inspector content for a component, a connection, a group, several components (bulk)
  or a flow step. Header: kind tile, title, close (Esc), open-full-page for rules. It can be
  resized from its left edge.
- **JSON panel:** hidden by default; when shown (⌘J) it is a bottom overlay island with the
  existing header, the same width as the canvas minus the rail.
- **Bottom-right island:** fit to screen · zoom − / % / + · minimap toggle (the minimap pops
  above it) · keyboard help (?).
- **Hide UI (⌘\\):** every island disappears except a small "Show UI" pill.

## 2. Card quick-edit (backlog 019)

- **Card hover:** a small round "open details" icon appears in the card's top-right corner (like
  a panel icon). Clicking it opens the drawer.
- **Inline title edit:** double-click a card and its title becomes an input inside the card
  (caret, selection highlight, no layout jump). Show the state for a new card from the palette
  with an empty title and a placeholder.
- **Selection toolbar:** floats about 12 px above the selection and flips below near the top
  edge. For **one component**: Open details · Kind · Fill colour · Stroke colour · Owner · Tags ·
  Tech · Links · Rules · More (⋯). For **several components**: the same shared fields, plus
  Align and Group. For **a connection**: Label · Protocol · Direction · Reset route · More. For
  **a group**: Rename · Ungroup · Collapse · More. Popovers open from the toolbar buttons (show
  Owner and Tags).
- **Context menu** (right-click, and "More ⋯"), sectioned with right-aligned shortcut hints:
  - Component: Open details ⏎ · Rename F2 · Copy ⌘C · Paste ⌘V · Duplicate ⌘D · Copy JSON ·
    Group selection ⌘G · Align ▸ · Arrange ▸ (bring to front, send to back) · Delete ⌫.
  - Connection: Edit label · Reset route · Delete.
  - Group: Rename · Ungroup ⇧⌘G · Collapse · Select members · Delete group (keep members).
  - Empty canvas: Paste · Add component ▸ · Add sticky · Select all ⌘A · Fit to screen ⇧1.
  - Show disabled items (for example Paste with an empty clipboard).

## 3. Card colours (backlog 020)

- A **colour popover** for Fill and Stroke with "No colour", a fixed palette of about 12 named
  colours (for example red, orange, amber, yellow, lime, green, teal, cyan, blue, indigo, violet,
  pink, slate) and a row of the deck's custom swatches ending in a **"+"** button. "+" opens a
  small hex / colour-picker field with Add. A custom swatch has a remove action. Show the
  selected state (check mark, not colour only).
- Show cards with each named fill and a coloured stroke, in **light and dark** themes, with the
  title, subtitle and rules badge still readable (AA contrast). Show a very dark custom fill
  where the text flips to light.
- Show a coloured card that is also selected, on a flow path, and in an error state, so the
  rings and badges stay visible on colour.

## 4. Editing affordances (backlog 016, 017)

- **Marquee:** Shift+drag selection box (plain drag pans), and the multi-selection frame with
  the toolbar above it.
- **Group:** a selected group (boundary highlighted, label chip selected) being dragged with its
  members; drop-into-group hover highlight when a card is dragged over a group.
- **Snapping:** alignment guide lines (primary-coloured hairlines with small distance labels)
  while dragging a card near others.
- **Resize:** 8 handles on a single selected card, with a size readout (W × H) while resizing.
- **Connector routing:** a selected connection shows a handle on its middle segment (drag to move
  the segment) and endpoint handles that snap to a card side (highlight the four side targets
  while dragging an end).

## Deliver

New states numbered from **86** onward, each in **light and dark**, at 1440×900:

1. 86 Canvas-first shell, empty deck (all islands, rail, empty-canvas card).
2. 87 Dense deck at about 50 % zoom (≥ 60 components, groups, many connections) to show how much
   space the canvas now has.
3. 88 Palette flyout open. 89 Outline flyout pinned. 90 Flows flyout with a flow selected.
4. 91 Detail drawer open on a component (inspector content). 92 Drawer for multi-selection.
5. 93 JSON panel shown as a bottom overlay. 94 Hide UI mode.
6. 95 Card hover with the details icon. 96 Inline title edit. 97 New card with an empty title.
7. 98 Selection toolbar (one component). 99 Toolbar (multi-selection with Align). 100 Toolbar on
   a connection. 101 Toolbar on a group.
8. 102 Context menu on a component. 103 on the empty canvas. 104 on a group.
9. 105 Fill colour popover. 106 "+" add custom colour. 107 Coloured cards gallery (all named
   fills, a stroke example, a dark custom fill; selected / flow / error on colour).
10. 108 Marquee selection. 109 Dragging a group. 110 Drop-into-group highlight. 111 Alignment
    guides. 112 Resizing a card. 113 Dragging a connector segment. 114 Endpoint side targets.
11. 115 Keyboard: focus ring moving through islands (F6) and the context menu opened with
    Shift+F10.
12. 116 Narrow window (1024×768): the rail stays, the drawer overlays more of the canvas, and the
    top islands collapse text into icons.

Also update the component inventory: island, rail button, flyout, drawer, selection toolbar,
toolbar popover, context menu, colour popover and swatch, resize handle, segment handle, snap
guide. For each, give sizes, spacing, tokens and focus, hover, pressed and disabled states. Note
the new card-colour tokens as light/dark pairs.
