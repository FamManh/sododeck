# Claude Design prompt: card system (cards, shapes, fields, tags, colour)

Brainstormed with the founder on 2026-10-03; decisions are recorded in
[`design-analysis.md`](design-analysis.md) §g-61. This file has two parts: the agreed
**requirements** (for us and for review), then the **prompt** to paste into the Sododeck Claude
Design project.

## Part 1: requirements (agreed)

### Why

Cards today look like every other React Flow app (rounded box, grey hairline, square kind tile on
the left), and the layout of title, tags and info is weak. Sododeck also needs to grow past six
software-architecture kinds: users should pick the card categories they need, like draw.io's or
Miro's shape libraries.

### Decisions

| #   | Topic              | Decision                                                                                                                                                                                                                                                                                          |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Categories         | All five, as **category packs** a deck turns on: Architecture, Process, Logistics, Basic shapes, Data cards. Users use the ones they need.                                                                                                                                                        |
| D2  | Families           | **Hybrid.** Information **cards** (Architecture, Logistics, Data cards, and Process tasks) share one frame; **shapes** (Process decision / start / end / actor, Basic shapes) are true geometry with text only. In-between types (decision, database…) can switch "show as card ↔ show as shape". |
| D3  | Fields             | Each card type has **default fields**; users can add **typed fields** (text, number, coloured select, status, person, date, date range, link) and choose which show on the card (chip or label–value row) and which stay in the drawer.                                                           |
| D4  | Visual direction   | Claude Design draws **three directions** with the same content: A editorial/quiet (Linear, Eraser), B tactile/playful (Miro, FigJam), C technical/blueprint (IcePanel). The founder picks or mixes.                                                                                               |
| D5  | Tooltip            | **Title only**: an app tooltip with the full title when it is cut. No preview card.                                                                                                                                                                                                               |
| D6  | Title, description | Title wraps, **up to 3 lines**, then "…"; the description (when shown on the card) also up to 3 lines. The card height grows with its content. Full text is in the details drawer.                                                                                                                |
| D7  | Tags               | Up to 10 per card. **Deck-level tag definitions** (name + colour from the shared palette, like Miro): set a colour once, every card shows it. Schema change, additive only.                                                                                                                       |
| D8  | Colour             | **One shared palette** (the 13 named colours, each with fill / stroke / chip variants, light and dark) for card fill and stroke, tags, select options and statuses, plus deck custom colours.                                                                                                     |
| D9  | Size               | Default width fixed (164 today) and resizable; height = the visible regions, computed (not measured) so edges, groups and export agree. **Zooming never changes a card's size**; far zoom only hides detail.                                                                                      |
| D10 | Data-driven types  | A card type is data (family, shape, icon, accent, default fields, which fields show), not a React component per type, so a Canvas 2D renderer (backlog 023) can draw the same cards later.                                                                                                        |

### Card anatomy (information card)

Top to bottom; an empty region is not drawn:

1. **Header:** type icon, optional type name, and a slot for status, pin and problem badges.
2. **Title:** up to 3 lines.
3. **Description / subtitle:** up to 3 lines.
4. **Fields shown on the card:** status, person, date, number…, as chips or label–value rows.
5. **Tags:** up to 10 chips, coloured by the deck's tag definitions.

**Shape:** real geometry (rectangle, ellipse, diamond, cylinder, document, pill, hexagon,
parallelogram, actor…) with centred text, up to 3 lines. No fields or tags on the shape itself.

### Out of scope for this design round

Tooltip previews, AI, comments, presence, sharing, a new renderer, line jumps and connector styles
(backlog 022), the implementation itself (it becomes backlog features after a direction is
picked).

## Part 2: the prompt

Paste the block below into the existing **Sododeck** Claude Design project (the one with
`Sododeck Canvas-first.dc.html`). Attach `DESIGN.md`, screenshots of today's cards (light and
dark, with tags), and the founder's Miro screenshots (tag picker, card details panel).

---

Design the **card system** of Sododeck, a local-first architecture and flow diagram workspace
(canvas-first editor, already designed in `Sododeck Canvas-first.dc.html`). Today's cards look
like every other React Flow app: a rounded box, a grey hairline, a square kind tile on the left.
Give Sododeck cards a recognisable identity, and make the system grow to many card types.

Draw **three directions** as three separate boards with **exactly the same content**, so they can
be compared side by side, each in light and dark:

- **A. Editorial / quiet** (think Linear, Eraser): flat surfaces, hairlines, type-led, colour only
  as an accent. Must stay calm on a dense board of 200+ cards.
- **B. Tactile / playful** (think Miro, FigJam): stronger fills, larger radii, chunky chips, a
  paper-like feel. Friendly, but check it on a dense board.
- **C. Technical / blueprint** (think IcePanel, engineering drawings): visible structure (header /
  body / footer rules), mono labels, a grid feel.

For each direction, add a short note: its tokens (radius, border, shadow, type scale, spacing),
what makes it distinct from a generic React Flow card, and its risks.

### The system to design

**Two families.**

- **Information cards** (Architecture, Logistics, Data cards, and Process tasks) share one frame with
  these regions, top to bottom, each hidden when empty: header (type icon, optional type name, a
  slot for status, pin and problem badges) · title (wraps, max 3 lines, then "…") · description
  or subtitle (max 3 lines) · fields shown on the card (chips or label–value rows) · tags (max
  10). The card's height grows with its content; its width is fixed by default (164 px today, may
  change if a direction needs it) and resizable.
- **Shapes** (Process decision, start / end and actor, and the Basic-shapes category): true
  geometry with centred text (max 3 lines): rectangle, rounded rectangle, ellipse, diamond, pill (start / end), cylinder, document,
  parallelogram, hexagon, actor, sticky note, text, frame. No fields or tags on the shape.
- In-between types (decision, database, document) can be shown **as a card or as a shape**: show
  both forms of the same object.

**Typed fields.** Card types come with default fields, and users add their own: text, number,
coloured select, status, person (free text with initials), date, date range, link. Design how each
type looks on the card (chip vs label–value row) and how a card shows "3 more fields" that stay in
the drawer. Also design the field editor in the details drawer (add field, pick its type, toggle
"show on card").

**Tags.** Tags are defined once per deck with a colour; every card with the tag shows that
colour. Design: the tag chip on cards (small, it must fit 10 on a card), the tag picker popover
(search / create, the deck's tags with their colours, edit a tag's colour and name; see the Miro
screenshot), and the tag row in the details drawer.

**Colour.** One shared palette for card fill, card stroke, tags, select options and statuses:
the 13 named colours in DESIGN.md "Card Colours" (red … slate), each needing **fill / stroke /
chip** variants in **light and dark**, plus deck custom colours. Propose the chip variant per
direction and check text contrast (WCAG AA 4.5:1). Colour is decoration chosen by the user and
never carries state.

**Tooltip.** Only the full title, shown when the title is cut. No preview card.

### Sample set (the same on all three boards)

1. Architecture: Service "Order Service" (tech "Go", owner "Payments team", tags `critical`,
   `pci`); Database "Orders DB" as a card **and** as a cylinder shape.
2. Process: Task (status "In progress", assignee "Lan", due date); Decision as a diamond;
   Start / End as pills; Actor.
3. Logistics: Warehouse "Warehouse HCM" (capacity 82 % as a progress bar, SLA 24 h, status
   "Open"); Truck / route.
4. Basic shapes: rectangle, ellipse, diamond, sticky, text, frame.
5. Data card (Jira / Miro style): status, assignee, estimate, date range and 8 coloured tags
   (`1 pt`, `11 pts`, `2 pts`, `3 pts`, `5 pts`, `8 pts`, `Lan`, `PIC`).

**Content edge cases:** a one-line title; a long title cut at 3 lines with its tooltip; a card
with no fields and no tags (the minimal card); a card with 10 tags; a wide (resized) card and a
narrow one.

### States (on a representative card per family)

Default · hover · selected · editing the title in place (it must look **exactly** like the shown
title: same type, same wrapping, no field box) · has a problem · current step of a playing flow
(problem and flow step must not rely on colour alone) · dimmed (focus mode / flow) · being
dragged · connection target · has child components (Enter opens them) · collapsed group (a
stacked card, design 69).

### Zoom

The same card at the four semantic levels: Landscape (≤ 45 %: type icon and colour only),
System, Container, Component (> 150 %). **The card's size never changes with zoom**; only detail
appears or disappears. Show how a dense board reads at Landscape.

### Supporting pieces

- The **card type palette** (the rail's Add flyout): categories as sections or tabs, a search,
  turning a category pack on or off for the deck.
- A **sample board** with about 20 cards mixing all five categories, connected, to judge the
  whole.

### Rules

- Keep Sododeck's base language unless a direction deliberately changes it: Geist / Geist Mono,
  warm neutrals, orange primary, lucide icons, light and dark. New tokens come in light and dark
  pairs.
- Every state is readable without colour (WCAG 2.2 AA); every control has a focus state.
- Connection handles: do not use the default React Flow grey dots; show how handles and
  connector ends look in each direction.
- Local-first, English UI. No avatars, sharing, comments, presence or AI buttons.
- Cards must be describable as data (regions, field types, shape, colour tokens), because a
  Canvas 2D renderer will draw them too: avoid effects that only CSS can do (backdrop blur,
  complex gradients, filters).

### Deliver

Three boards (A, B, C), each with: the sample set, the edge cases, the states, the four zoom
levels, the palette (13 colours × fill / stroke / chip × light / dark with contrast notes), the tag
chip and picker, field chips, the type palette, and the sample board. End with a one-page
comparison of the three directions.
