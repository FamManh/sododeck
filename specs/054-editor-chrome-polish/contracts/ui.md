# UI contract: Editor chrome polish

Names are the accessible names tests and screen readers use.

## Tools island (top-right)

Order: **Deck settings** (`Settings2`, tooltip "Deck settings", `aria-pressed` while the deck
drawer is open) · **Jump to… (⌘K)** · **Labels**. Focus is no longer here. Pressing Deck settings
opens the details drawer in `deck` mode; pressing again, or Esc, closes it and returns focus to the
button. The menu item "Deck settings" does the same.

## Rail (left)

Order: Select / Hand · **Focus** (`Focus` icon, `aria-pressed`, tooltip "Focus · F", disabled with
"Focus: not available while a flow is shown" during a flow session or flow mode) · Add component ·
Sticky note · Group · Connector · divider · panels… Same behaviour and shortcut as before.

## View switcher

New deck: tabs **Overview**, **Flows**, "+" . Tab accessible name for presets: "Overview view" /
"Flows view"; custom views keep "<title>, custom view". Crumb: "<title> view".

## Zoom island

Table detail: one button, label `Detail: Auto|Names|Keys|All`, `aria-haspopup="menu"`, menu named
"Table detail" with radio items; each item has a description line (Auto, Names, Keys, All as in
research R4). Absent when the deck has no table. One undo step per choice.

## Actions

- **Spread ends evenly**: tooltip when enabled "Space the connector ends evenly along each side of
  the selected cards"; when disabled "Needs a side with two or more connector ends".
- **Lock / Unlock** (`⌘L`-style shortcut unchanged): offered for `component`, `components`, `group`,
  `mixed`. Announces "Locked N cards" / "Unlocked N cards". A locked group refuses move, resize and
  delete with "Locked · unlock to move or edit".

## Code drawer (right)

- Region `aria-label="Code"`, tabs **DBML** | **SQL**, Copy, Close (× , Esc). No scope switch.
- DBML tab: editable, same apply / error / undo behaviour as 046. SQL tab: read-only, same message.
- Empty deck: same empty states as 046, minus any "select tables" sentence.
- Left edge grip: `role="separator"`, `aria-orientation="vertical"`, `aria-valuemin=320`,
  `aria-valuemax=<max>`, `aria-valuenow`; ←/→ 8 px, ⇧←/⇧→ 40 px, Home / End.
- Opened from the deck menu ("Show DBML / SQL"), the command palette ("Open DBML / SQL"), and from
  the empty-canvas Database card where it linked to the JSON panel's DBML tab.
- Placement: right edge 12 px; with the details drawer open it sits to the details drawer's left.

## JSON panel

Header: JSON | Selection | Deck switch, Copy, collapse, close. No DBML / SQL tabs, no scope switch.
