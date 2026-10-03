# Contract: tag UI (033)

What a user and assistive technology can rely on. Tests assert by role and accessible name, not class names. Visual reference: frame 125 (`docs/design/screens/125-deck-tags-light.png`, `…-dark.png`); `DESIGN.md` wins where they differ.

## Card tag pills (canvas)

| Element      | Contract                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| List         | `list` named "Tags"; one `listitem` per tag, at most 10, text always visible at Container level and up.                        |
| Pill         | 18 tall, `chip` background and `ink` text of the **tag's** colour; no colour gives slate. Title attribute holds the full text. |
| System level | 6px dot in the tag's `dot` colour; each `listitem` named with the tag text.                                                    |
| Landscape    | no tags (unchanged).                                                                                                           |

## Drawer tag row (one card)

| Element       | Role / name                 | Keys and behaviour                                                                            |
| ------------- | --------------------------- | --------------------------------------------------------------------------------------------- |
| Row           | `list` "Tags"               | 21 tall pills with ×, wrapping.                                                               |
| Pill remove   | `button` "Remove tag <tag>" | ⌫ / Delete / click removes from this card only; focus moves to the next pill, else "Add tag". |
| Add           | `button` "Add tag"          | ⏎ or Space opens the picker; at 10 tags the button is replaced by the note "10 tags max".     |
| Announcements | live region                 | "<tag> added", "<tag> removed".                                                               |

## Tag picker (drawer, bulk drawer, selection toolbar)

| Element    | Role / name                    | Keys and behaviour                                                                                                                               |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Container  | `dialog` "Tags"                | Esc closes and returns focus to its opener.                                                                                                      |
| Search     | `searchbox` "Filter tags"      | Typing filters by `tagKey`; ↓ moves into the list.                                                                                               |
| List       | `listbox` "Deck tags"          | `option` per tag: name, colour dot, count; selected (on all), partial "n of N" (on some). ↑ ↓ move, ⏎ toggles on the selection. Most used first. |
| Create row | `option` "Create tag “<text>”" | Present only when no tag matches by key; ⏎ adds with the canonical spelling and no colour.                                                       |
| Edit       | `button` "Edit tag <tag>"      | Pencil on each row; opens the editor.                                                                                                            |
| Full cards | note                           | Adding to a full card is refused with "10 tags max"; in bulk, full cards are skipped and announced (existing wording).                           |

## Tag editor (inside the picker popover)

| Element       | Role / name                             | Keys and behaviour                                                                                                                                               |
| ------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Back          | `button` "Back to tags"                 | Esc does the same, then Esc again closes the popover.                                                                                                            |
| Name          | `textbox` "Tag name"                    | ⏎ renames. Empty is refused with a message. A name that matches another tag asks "Merge into “<tag>”? N cards change" with Merge / Cancel.                       |
| Colour        | `radiogroup` "Tag colour"               | 13 named swatches, the deck's colours, and "No colour"; arrow keys move, each `radio` named ("Violet", "#7a3cff"). Choosing applies at once (one undo step).     |
| Delete        | `button` "Delete tag · used on N cards" | Asks to confirm; a second line lists other carriers ("Also on 2 connections and 1 flow") when there are any. After confirming, focus returns to the picker list. |
| Announcements | live region                             | "<tag> renamed to <new>", "<tag> merged into <other>", "<tag> deleted, removed from N cards", "<tag> colour set to <name>".                                      |

## Bulk drawer and toolbar

- `BulkTags`: solid pill when on all selected cards, dashed pill with "k/n" on some, each in the tag's colour; "Add <tag> to all" and "Remove <tag> from all" keep their names.
- Toolbar "Tags" opens the same picker; its disabled and mixed states follow 019.

## Other tag fields

Connections, flows, steps and the deck keep "Add tag" combobox chips (neutral). Adding "pic" when "PIC" exists writes "PIC".

## View settings

"Hide tags" lists tags by display spelling and matches by `tagKey`; hiding "pci" hides cards carrying "PCI".
