# Visual check: 019 card quick edit

Screenshots of the production build (`vite preview`) at 1440×900, light and dark, are in [`screens/`](screens/). They were taken on a small imported deck (6 components, one group, 5 connections) with a scripted Playwright walk. Compare them with `docs/design/screens/` 95–104 and the menu in 115.

| Frame                     | Ours                                                            | Match                                                                                                         |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 95 card hover             | `95-card-hover-*`                                               | Details button at the top-right corner of the card (22 px inverse circle); the card lifts with `shadow-hover` |
| 96 inline edit            | `96-inline-edit-*`                                              | The title is edited inside the card and the card keeps its size                                               |
| 97 new card               | `97-new-card-*`                                                 | Empty field with the placeholder "Name this component" and a caret                                            |
| 98 toolbar, one component | `98-toolbar-one-*`                                              | Toolbar above the card; the Owner popover has a filter and a "Use 'pay'" row                                  |
| 99 toolbar, several       | `99-toolbar-multi-*`                                            | "3 selected", Mixed values, Tags popover with partial chips "n of N"                                          |
| 100 toolbar, connection   | `100-toolbar-connection-*`                                      | Label · Protocol · Direction · More                                                                           |
| 101 toolbar, group        | `101-toolbar-group-*`                                           | Rename · Ungroup · Collapse · Select members · More                                                           |
| 102–104 menus             | `102-menu-component-*`, `103-menu-canvas-*`, `104-menu-group-*` | Rows are text; Delete is clay and has a trash icon; submenus have chevrons                                    |
| 115 keyboard              | `115-keyboard-menu-*`                                           | ⇧F10 opens the same menu, with its first item focused                                                         |

## Differences

These are allowed:

- **Owned by 016:** Copy, Paste, Duplicate, Group selection, Align in the menus and the toolbar, and the "⏎ Save · ⌘⏎ Save and add another · Esc Keep as Untitled" hint bar under a new card (97). The hint bar is part of 016's inventory.
- **Owned by 017:** Reset route on the connection toolbar, and the selection handles.
- **Owned by 020:** Fill and Stroke in the toolbar.
- **Arrange ▸:** only "Bring to front" and "Send to back" (FR-030). The design also has "Bring forward" and "Send backward".
- **Tokens and icons:** DESIGN.md tokens and lucide icons are used. Shortcut hints read "Ctrl+…" outside Apple platforms.

These are open, for founder review:

1. **Toolbar field buttons show their value as text** ("Checkout", "Go", "Mixed"). In 98 the Owner button is icon-only. Only Kind shows a value there ("Service ▾"). We keep the text so the value is readable without opening the popover. The names carry the value either way ("Owner: Checkout").
2. **The Owner popover lists the owners used in the deck.** It has no member counts, and no "Edit teams in Deck settings" footer. The deck has no team list: teams are §g-40 territory.
3. **The popover can cover the selected card.** It opens under its button, as in 98. When the selection sits just under the toolbar, the popover overlaps it.
4. **New card placement.** 97 shows the palette flyout still open after adding. The palette closes after an add unless it is pinned (018 rule, spec US2 AC6).
