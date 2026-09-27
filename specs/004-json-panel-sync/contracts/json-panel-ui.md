# Contract: JSON panel UI (004)

Roles, names and keys that component tests and the smoke suite rely on. Visual reference:
`docs/design/screens/02-editor-node-selected-*.png`, `16-editor-json-deck-tab-light.png`,
`17-editor-json-collapsed-light.png`. Allowed differences: the status text and lock icon,
DESIGN.md tokens, lucide icons.

## Layout

| State     | Height                                                           | Content                                |
| --------- | ---------------------------------------------------------------- | -------------------------------------- |
| Expanded  | `jsonPanel.height` (default 212 px, 96 px to available − 200 px) | resize handle, 40 px header, code area |
| Collapsed | 36 px                                                            | `Braces` icon, "JSON", expand control  |

## Roles and accessible names

| Element           | Role / name                                                                                             | Notes                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Panel             | `region` "JSON"                                                                                         | **Smoke hook**, unchanged                                                  |
| Resize handle     | `separator` "Resize JSON panel", `aria-orientation="horizontal"`, `aria-valuenow/min/max` (px)          | Expanded only; focusable                                                   |
| Tab switch        | `radiogroup` "JSON view" with `radio` items                                                             | `SegmentedControl` from `@sododeck/ui`. Checked state is exposed.          |
| Selection item    | `radio`, accessible name = full label ("Order Service", "Checkout → Orders", "4 selected", "Selection") | Visible text truncated with an ellipsis; `title` = full label              |
| Deck item         | `radio` "Deck"                                                                                          |                                                                            |
| Status            | text "Read-only · synced with canvas" with a `Lock` icon (`aria-hidden`)                                | Secondary ink; not color-only                                              |
| Line count        | text "`n` lines" / "1 line"                                                                             | Hidden when the tab shows no code                                          |
| Copy              | `button` "Copy JSON"                                                                                    | Disabled when no code                                                      |
| Collapse / expand | `button` "Collapse JSON panel" / "Expand JSON panel", `aria-expanded`                                   | Same names as M0                                                           |
| Code area         | Monaco, `ariaLabel` "Deck JSON, read-only" / "Selection JSON, read-only"                                | `.monaco-editor` inside the region (**smoke hook**)                        |
| Empty selection   | text "Select a component or connection to see its JSON." plus a `button` "Show Deck JSON"               | The button switches to the Deck tab (a user action, so FR-004 still holds) |

## Keyboard

| Where         | Keys                                            | Effect                                                                                |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| Tab switch    | ← / →                                           | Switch tab (radio semantics)                                                          |
| Resize handle | ↑ / ↓                                           | Height ± 16 px                                                                        |
| Resize handle | Home / End                                      | Minimum / maximum height                                                              |
| Code area     | arrows, Page Up/Down, Home/End, ⌘/Ctrl+Home/End | Move the caret and scroll                                                             |
| Code area     | Shift + movement, ⌘/Ctrl+A                      | Select text                                                                           |
| Code area     | ⌘/Ctrl+C                                        | Copy the selected text                                                                |
| Code area     | ⌥⌘[ / ⌥⌘] (Ctrl+Shift+[ / ] on Windows/Linux)   | Fold / unfold at the caret (Monaco defaults)                                          |
| Code area     | ⌘/Ctrl+F                                        | Find (already bundled)                                                                |
| Code area     | ⌘/Ctrl+Z, ⇧⌘Z / Ctrl+Y                          | Deck undo / redo (research R5)                                                        |
| Code area     | any typing, paste, cut, delete                  | Nothing changes; read-only message at the caret; announcement at most every 3 s       |
| Code area     | Esc, then Tab                                   | Leave the code area (Monaco traps Tab only while editing; read-only does not trap it) |

## Announcements (via 003's live region)

- Refused edit: "Read-only. Edit on the canvas or in the inspector." (cooldown of 3 s)
- Copy success and failure: the toast text (Radix toasts announce themselves)

## Toasts

| Trigger         | Text                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| Copy on Deck    | "Copied Deck JSON"                                                         |
| Copy on 1 item  | "Copied `<full label>` JSON"                                               |
| Copy on n items | "Copied `n` items as JSON"                                                 |
| Copy failed     | "Couldn't copy — select the text and press ⌘C" (Ctrl+C on other platforms) |

## Persistence

`localStorage["sododeck.jsonPanel"]` = `{ "open": boolean, "height": number, "tab": "deck" | "selection" }`.
The deck is never involved.

## Smoke-suite hooks that must keep working (no edits planned)

- The region "JSON" contains `.monaco-editor`.
- The default (fresh browser) tab is Deck, so the region contains
  `https://sododeck.com/schema/v1.json` and `"web-app"`.
- No third-party requests.
