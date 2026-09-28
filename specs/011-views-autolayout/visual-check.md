# Visual check (011)

Screenshots at 1440×900 of the production build (`vite preview`, `/deck/demo`), light and dark, in [`screens/`](screens/). Compare with `docs/design/screens/02-*`, `20-*`, `21-*` and `22-*`.

| Design frame                   | Ours (light · dark)                                                                   | Matches                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 02 editor, System view         | [light](screens/02-system-light.png) · [dark](screens/02-system-dark.png)             | Segmented switcher in the top bar's centre slot, current tab raised, "+" at the end; crumb "System view".                                                                                                |
| 20 Infra view                  | [light](screens/20-infra-light.png) · [dark](screens/20-infra-dark.png)               | Clients dimmed to 0.4 (`--sd-opacity-view-dim`); crumb "Infra view". Host subtitles show from the Container zoom level up (010 hides subtitles at System level; the design frame is at Container level). |
| 21 Feature view                | [light](screens/21-feature-light.png) · [dark](screens/21-feature-dark.png)           | Subtitles read "<n> flows · <owner>" from Container level up (same zoom rule).                                                                                                                           |
| 22 Custom view created (toast) | [light](screens/22-custom-toast-light.png) · [dark](screens/22-custom-toast-dark.png) | "Custom 1" tab added and selected; toast `View "Custom 1" created` (2.6 s).                                                                                                                              |

Differences from the frames:

- The focused or hovered tab shows its ⋯ menu button (contract views-ui.md: "shown on hover and focus"); the frames show no menu button.
- The demo deck is smaller than the frames' Logistics deck, so the canvas content differs.

## Undesigned parts, for founder approval

Built from DESIGN.md components and tokens (design-analysis row 634 defaults, clarification Q3):

| Part                                                                        | Screens                                                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| "View settings…" popover                                                    | [light](screens/undesigned-settings-popover-light.png) · [dark](screens/undesigned-settings-popover-dark.png) |
| Tidy layout button, Pin / Unpin toggle, pin glyph, inspector "Pin position" | [light](screens/undesigned-pin-and-tidy-light.png) · [dark](screens/undesigned-pin-and-tidy-dark.png)         |

Not captured: the Tidy layout progress bar with Cancel. It appears only after 500 ms, and the demo deck lays out in well under that. It is covered by the component test `tidy-layout-toolbar.test.tsx`: an indeterminate `progressbar` "Tidying layout" and a ghost "Cancel layout" button replace the Tidy button in the canvas toolbar.
