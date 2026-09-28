# Contract: Export dialog (user-visible)

Component tests assert these roles, names and texts (Testing Library, by role / label). Design
references: `docs/design/screens/06-export-json-*.png`, `33-export-png-light.png`,
`33-export-svg-light.png`, `34-export-flow-scope-light.png` (without the PDF and Mermaid entries).

## Entry points

| Where                                                     | Control                                                              | Result                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| Tools island                                              | button "Export" (icon-only in a narrow window, same accessible name) | opens the dialog; focus returns here on close   |
| Deck island ≡ menu                                        | menu item "Export…"                                                  | opens the dialog; focus returns to the ≡ button |
| ⌘K palette                                                | command "Export deck…"                                               | opens the dialog; focus returns to the canvas   |
| Library deck menu, deck inspector storage, autosave error | "Export .sododeck.json" / "Export"                                   | **unchanged**: direct JSON download, no dialog  |

## Dialog

- `role="dialog"`, accessible name **"Export deck"**, description **"Exports are generated in your
  browser. Nothing is uploaded."** Close button: name "Close". Width 820 px.
- Esc, the Close button and a click on the scrim close it (FR-005).

### Format list

- `role="radiogroup"`, name **"Format"**; ↑ / ↓ move and select.

| Radio (accessible name) | Visible text                             |
| ----------------------- | ---------------------------------------- |
| "JSON"                  | JSON · ".sododeck.json · re-importable"  |
| "PNG"                   | PNG · "Raster image for docs and slides" |
| "SVG"                   | SVG · "Vector, editable in Figma"        |

Each radio's description (`aria-describedby`) is its subtitle.

### Scope

- Heading "Scope"; `role="radiogroup"`, name **"Scope"**, items "Whole deck", "Current view",
  "Selected flow"; ← / → move, skipping disabled items.
- JSON selected: the group shows "Whole deck", is disabled, and the note **"JSON always contains
  the whole deck"** is its description.
- Outside flow mode: "Selected flow" disabled, tooltip **"Open a flow to export it"**.
- Flow deleted while open: note **"The flow was deleted, so the whole deck is shown."**
  (announced).

### Options

| Format | Control (role, name)                           | Default |
| ------ | ---------------------------------------------- | ------- |
| JSON   | switch "Include descriptions, links and rules" | on      |
| JSON   | switch "Pretty-print"                          | on      |
| PNG    | radiogroup "Scale": "1×", "2×", "3×"           | 2×      |
| PNG    | switch "Transparent background"                | off     |
| SVG    | switch "Transparent background"                | off     |

A scale too large for the browser is disabled with tooltip **"Too large for this browser"**.

### Preview

- Region named **"Preview"**.
- JSON: the start of the file as text.
- PNG / SVG: `img`, alt **"Preview of <file name>"**.
- Preparing: text **"Preparing…"** (live region, polite); Copy and Download disabled.
- Empty image scope: **"Nothing to export yet"**; Copy and Download disabled.
- Error: **"Couldn't create this export"** + button **"Retry"**.

### Footer

| Format | File name example                                               | Size hint example | Buttons        |
| ------ | --------------------------------------------------------------- | ----------------- | -------------- |
| JSON   | `logistics-delivery.sododeck.json`                              | "11.9 KB"         | Copy, Download |
| PNG    | `logistics-delivery.png` / `logistics-delivery-place-order.png` | "2180 × 1320 px"  | Download       |
| SVG    | `logistics-delivery.svg`                                        | "148.2 KB"        | Copy, Download |

- Download (primary, name "Download"): saves the file; toast **"Downloaded <file name>"**; dialog
  stays open.
- Copy (name "Copy"): toast **"Copied"**; on failure toast **"Couldn't copy — use Download
  instead"**.
- Toast texts are also announced through the store's `announce`.

## Output guarantees

- JSON: valid `.sododeck.json` of the whole deck; with default options byte-identical to the
  backup export (`serializeDeck`).
- SVG: standalone document, `<text>` elements, embedded fonts, no external references
  (`href` / `url(` only `data:` or `#` fragments).
- PNG: pixel size equals the footer.
- No network request at any step.
