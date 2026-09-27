# Contract: Library and Editor Status UI

User-visible contract for component tests (by role and label) and the smoke suite. Visual target:
design screens 01, 07–09, 72–79, 81, 83–85 (light and dark) with the overrides in spec FR-044.

## Routes

| Path            | Behavior                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `/`             | Library page                                                                                       |
| `/deck/new`     | Creates "Untitled deck" in `?folder=<id>` (or Unfiled), then `replace`-navigates to `/deck/<id>`   |
| `/deck/demo`    | In-memory demo deck, not stored; status text "Demo · not saved" (until 013)                        |
| `/deck/:deckId` | Loads the stored deck; unknown or deleted id → "Deck not found" page with a link "Back to library" |

## Library page

- `banner` landmark (top bar): wordmark, `searchbox` "Search decks", theme toggle, button
  "Import .sododeck.json", button "New deck".
- `navigation` "Library": links/buttons "All decks", "Recent", "Samples"; heading "Folders"; one
  item per folder (`aria-current="page"` when selected); button "New folder"; storage card
  (`region` "Browser storage").
- `main`: `h1` = section title ("All decks", "Recent", "Samples", folder name); text
  "<n> decks · stored in this browser"; `radiogroup` "View" with "Grid" / "List".
- Grid: `list` "Decks"; first item button "New deck" (dashed card); each deck item has a link
  named by the deck name (opens it), text "<n> components · <m> flows · edited <relative>", and a
  button "More actions for <name>".
- List view: `table` with columns Name, Folder, Components, Flows, Edited, actions.
- Empty search: text `No decks match "<query>".`
- Recent empty: text "Decks you open will appear here." (dashed placeholder).
- Samples empty: text "Sample decks are coming soon." and link "Open demo deck" (`/deck/demo`).
- Storage unavailable: `alert` banner "Decks can't be kept in this browser (storage is blocked)."

### Deck menu (⋯ button, right-click, Shift+F10 on a focused card/row)

`menu` with `menuitem`s: "Open", "Rename" (shortcut hint F2), "Duplicate" (⌘D / Ctrl+D),
"Move to folder" (sub-`menu` with `menuitemradio` "Unfiled" + each folder; current one checked),
"Export .sododeck.json", separator, "Delete…".

Keyboard on a focused card/row: Enter opens, F2 renames inline, ⌘D duplicates, Delete/Backspace
asks to delete, Shift+F10 / ContextMenu key opens the menu, arrow keys move focus between cards.

### Folder menu (right-click or Shift+F10 on a folder item)

"Rename" (F2), separator, "Delete folder…". No "Export folder" (§g-33).

### Dialogs

- **New folder**: `dialog` "New folder"; `textbox` "Folder name"; buttons "Cancel", "Create".
  Invalid → field `aria-invalid="true"`, error text with an icon linked by `aria-describedby`,
  focus stays in the field. Messages: "Enter a folder name." / `A folder named "X" already exists.`
- **Delete deck**: `alertdialog` "Delete "<name>"?", text "You can undo this until you reload the
  page.", buttons "Cancel", "Delete deck" (destructive).
- **Delete folder**: `alertdialog` "Delete folder "<name>"?", text "Its <n> decks move to
  Unfiled.", buttons "Cancel", "Delete folder".
- After a confirmed delete: toast "<name> deleted" with button "Undo" and hint "⌘Z", 6 s.

### Toasts

| Event                      | Message                                                      |
| -------------------------- | ------------------------------------------------------------ |
| Import OK                  | `Imported "<name>"`                                          |
| Import invalid             | `That file is not a valid .sododeck.json.`                   |
| Import newer version       | `That file was made with a newer version of Sododeck.`       |
| Import several files       | `Import one file at a time.`                                 |
| Persistent storage granted | `Persistent storage is on`                                   |
| Folder restore name clash  | `Couldn't restore "<name>": a folder with that name exists.` |

### Storage card (`region` "Browser storage")

Meter (`meter` with `aria-valuenow`) and text "<used> of <quota> used"; status "Persistent storage ·
On" (shield icon) / "· Off"; button "Request persistent storage" (Off only); text "Browser
declined. Try again after installing the app." (declined); text "Not persistent in this browser"
(unsupported, no button); warning text with icon "Storage is almost full. Export decks you want
to keep." when usage > 80 %.

## Editor additions

- Top bar breadcrumb: "Local / <deck name>", the name is a button "Rename deck" → inline field
  (Enter saves, Esc cancels, empty refused).
- Save status (`status`, polite live region):
  - "Saving…" with a loader icon (no spin under reduced motion);
  - "Saved in this browser" with a check icon;
  - error: button "Couldn't save — export a backup" (warning icon, clay) + button "Export";
    the first opens a `dialog`/popover "Couldn't save your last change" with "Unsaved since
    <time>", the error name, buttons "Export .sododeck.json" and "Retry" (⌘S hint).
- Top-bar "Export" button enabled: downloads `<name>.sododeck.json`.
- ⌘S / Ctrl+S: retry/flush; the browser's save-page dialog never opens.
- Deck inspector (nothing selected): section heading "Storage", text "Stored in this browser",
  button "Export .sododeck.json".
- Deleted elsewhere: `alertdialog` "This deck was deleted in another tab" with buttons "Keep a
  copy" and "Back to library".

## Smoke suite (`apps/app/tests/e2e/smoke.spec.ts`)

Test 1 becomes: go to `/` → heading "All decks" visible → click "Samples" → click link "Open demo
deck" → 3 `deck-node`s. Tests 2–4 (`/deck/demo`, JSON region, no third-party requests) unchanged.
