Design artifacts (mockups, exports) for Sododeck. The design system itself is [/DESIGN.md](../../DESIGN.md).

| Path                                       | What                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`claude-design/`](claude-design/)         | Read-only copy of the Claude Design prototype (project "Sododeck", `8e9232a3-578d-4728-9f55-b53d02281efe`), imported 2026-09-27; `Sododeck State.dc.html`, `Sododeck Extensions.dc.html` and `sododeck-states.js` (states 41–85) added the same day. Files are byte-for-byte originals; do not edit. |
| [`screens/`](screens/)                     | Screenshots of every screen and state of the prototype (1440×900 @2x), captured with Playwright.                                                                                                                                                                                                     |
| [`design-analysis.md`](design-analysis.md) | Inventory, tokens, data mapping, behavior and gap analysis vs `docs/spec.md`.                                                                                                                                                                                                                        |

The prototype is a **visual and behavioral reference only**. Never copy its code into `apps/app`: it is a single-file mock (inline styles, hard-coded colors, `localStorage`, CDN React, Google Fonts, Material Symbols) that breaks several constitution rules. We re-implement it with React, Tailwind tokens, shadcn/ui, React Flow and Yjs.

## Re-capturing screenshots

The prototype takes a `screen` prop (`library | editor | flow | rules | empty | export`) and a `theme` prop (`light | dark`) from the `data-props` defaults in `Sododeck.dc.html`. To re-capture: copy `claude-design/` to a temp folder, make one copy of the HTML per screen/theme with those defaults changed, serve the folder over HTTP (`python3 -m http.server`), then drive it with Playwright at 1440×900, `deviceScaleFactor: 2` (states such as focus mode, palette, command palette are reached by clicking/typing, see the file names). Note the prototype loads React from unpkg and fonts from Google, so capture needs network access; this never applies to the real app.

### States 41–85 (`Sododeck State.dc.html`)

`Sododeck State.dc.html` renders one frame from `sododeck-states.js` (`window.SODO_ST.LIST`, states 41–85, sections A flows · B canvas editing · C scale · D library and status). It takes a `state` prop (`"41"`…`"85"`) and a `theme` prop (`light | dark`) from its `data-props` defaults. `Sododeck Extensions.dc.html` is the board that lays those frames out with the design notes (user did / what changed / keyboard / empty-error-motion) and the list of new components and tokens.

To re-capture: same as above, but make one copy of `Sododeck State.dc.html` per state and theme with the two defaults changed, and save `NN-slug-theme.png` using the `id` and `slug` from `LIST`. Wait until `window.SODO_ST` and `window.lucide` exist, then about one second more for the icons to be filled in. The State file also loads lucide from unpkg.

Files fetched through the design preview server carry an injected `<style data-omelette-injected>` + `<script data-omelette-injected>` block after `<head>`; strip it (plus the two newlines that follow) to get the original bytes. The JS files are served unchanged.
