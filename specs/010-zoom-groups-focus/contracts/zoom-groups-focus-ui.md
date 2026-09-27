# Contract: UI behavior (010)

What a user, a screen reader and a component test see. Roles and names are the test selectors (Testing Library, AGENTS.md).

## Zoom control + level indicator (design 64–67)

| Element       | Role / name                                           | Behavior                                                                    |
| ------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| Level trigger | `button` "Level: <Name>" (`aria-haspopup="menu"`)     | 4 bars (filled up to current) + name; opens the level menu                  |
| Level menu    | `menu` with 4 `menuitemradio` "Landscape"…"Component" | Checked = current; choosing zooms to the band middle around the view centre |
| Live region   | existing announcer                                    | "Landscape level" etc., once per band change                                |

While drilled into a node, the menu shows Component checked and the other items `aria-disabled`.

## Canvas nodes per level (FR-003)

| Level     | Component node renders                                 | Accessible name   |
| --------- | ------------------------------------------------------ | ----------------- |
| Landscape | kind tile only; groups are solid regions, large labels | "<title>, <kind>" |
| System    | kind tile + title                                      | "<title>, <kind>" |
| Container | + tech subtitle (003 look)                             | "<title>, <kind>" |
| Component | full card: title, tech, owner, tags, rule glyph        | "<title>, <kind>" |

A node with children shows a marker `Layers` + n, named "<n> components inside, press Enter to open".

## Groups

| Element                    | Role / name                                                                                                          | Keys / pointer                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Group label (expanded)     | `button` "<Title> group, <n> nodes" with `aria-expanded="true"`                                                      | click selects; double-click / Enter drills in; Space collapses; chevron click collapses; tooltip "Double-click or ↵ to open" |
| Collapse chevron           | `button` "Collapse <Title>" / "Expand <Title>" (visible on hover / focus)                                            | click toggles                                                                                                                |
| Collapsed card (design 69) | `button` "<Title>, collapsed group, <n> nodes, <m> edges", `aria-expanded="false"`                                   | click selects; double-click / Enter drills in; Space expands; draggable: no                                                  |
| Merged edge (design 69–70) | edge `aria-label` "<N> connections between <A> and <B>"                                                              | hover 150 ms / focus (E) opens popover                                                                                       |
| Merged popover             | `dialog` "Connections between <A> and <B>" containing a `listbox`; each `option` "<label or from → to>, <direction>" | ↑ ↓ move, Enter expands the group(s) and selects the edge, Esc closes                                                        |
| Group inspector            | heading "<Title>"; `switch` "Collapsed"; list "Merged connections"; `button` "Expand group"                          | switch toggles; row click = popover row Enter                                                                                |

## Drill-in (design 19, 66, 67)

| Element               | Role / name                                                               | Behavior                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Breadcrumb            | `nav` "Breadcrumb": `Local / <deck> / System view / <frame>…`             | deck crumb renames (unchanged); "System view" and drill crumbs are `link`-styled buttons; last has `aria-current="page"` |
| Port pill (design 67) | `button` "Go to <outside title>" (dashed pill at the scope edge)          | click / Enter: go up one level, select and reveal that node                                                              |
| Outline "Up" row      | `treeitem` "Up to <parent crumb>"                                         | activate goes up                                                                                                         |
| Empty scope           | text "No components in this group"                                        | —                                                                                                                        |
| Announcements         | "Opened <title>", "Back to <title>", "Went up to <title>" (scope removed) | —                                                                                                                        |

## Focus mode (design 13)

| Element         | Role / name                                                                                | Behavior                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Focus toggle    | `button` "Focus" `aria-pressed`, in the canvas toolbar next to Labels; tooltip "Focus · F" | disabled with tooltip "Not available while a flow is shown" in a flow session / flow mode |
| Dimmed element  | node wrapper `aria-hidden="true"` + `inert`; edge `aria-hidden="true"`; opacity 0.2        | not clickable, not in roving focus                                                        |
| Focused element | full opacity + focus ring; connecting edges highlighted, labels shown                      | —                                                                                         |
| No selection    | announce "Select a component to focus"                                                     | nothing dims                                                                              |

## Flow through a collapsed group (design 71, clarifications Q2 and Q3)

- The card gets a ring when any shown-flow step is hidden inside it, and ring + pulsing dot (static under `prefers-reduced-motion`) when the active step is. Its name gains ", flow step inside".
- Merged edges carry the step badges of their underlying edges, in step order. When the current step is one of them, the merged edge gets 007's current look and the token.
- Cards and merged edges on the played path are not dimmed by flow mode (`.in-flow` / `data-in-flow`).
- Step player: `Step 3 of 7 · Charge card` becomes `Step 3 of 7 · Charge card · inside Core services` (muted text) when the current step's connection is hidden in a collapsed group. The live announcement ends with ", inside Core services".

### Flow mode rules (FR-038, FR-039)

| Input                                | In flow mode                                                             |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Chevron click, Space on label / card | collapse / expand; current step unchanged                                |
| Click collapsed card                 | current step → first played step inside it                               |
| Click merged connection              | current step → next played step among its connections (wraps)            |
| Double-click, Enter (drill)          | nothing                                                                  |
| F, Focus toggle                      | nothing / disabled ("Not available while a flow is shown")               |
| Backspace                            | nothing                                                                  |
| Esc                                  | exit flow mode (007); never goes up a level                              |
| Opening a flow while drilled         | go up to the whole deck, announce "Showing the whole deck for this flow" |

## Keyboard summary

See research R9. All shortcuts are ignored in text fields and dialogs (`isTextTarget`, `inDialog`), and none has a modifier.
