# Contract: UI (055)

## Add flyout

An **Image** tile beside the tool tiles. Click or Enter opens the file picker (`multiple`, `accept`
lists the six types). Keyboard operable, label "Image", tooltip "Add an image (or paste with ⌘V)".
Disabled with a reason in view-only and flow modes.

## Paste, drop

- ⌘/Ctrl+V on the canvas with an image on the clipboard adds it at the pointer, else the visible
  centre. Ignored in text fields, dialogs and overlays. Image wins over text when both are present.
- Dropping files on the canvas adds them at the drop point; non-image files produce the refusal list.
- Several files: placed in a row, 16 px gap, wrapping at the visible width; all selected; one undo step.

## Image on the canvas

Picture fills the box (`object-fit: contain` inside the box; box keeps the natural aspect ratio until
resized freely with the modifier). Corner handles resize (min 32 px). Connection handles as a sticky.
Lock glyph when locked. Caption under the picture when set, plain text, one line with ellipsis.
**Missing** placeholder: bordered box, "image broken" icon, text "Picture missing", file name and
caption kept; announced by the accessible name "Image: <alt or file name>, picture missing".

## Toolbar and inspector

Toolbar: alt text, caption, bring forward / send backward, lock, delete. Inspector: alt, caption,
read-only file name, type, stored size, pixel size; "Replace picture" is **not** offered (out of scope).
Stacking actions also in the context menu and arrange menu, acting on cards and images alike.

## Messages (toast list, announced politely)

- "Added 3 images." (with ⌘Z hint)
- "<name>: type not supported (use PNG, JPEG, WebP, GIF, SVG or AVIF)."
- "<name>: file is 12.4 MB; the limit is 10 MB."
- "<name>: still 6.1 MB after compression; the limit is 5 MB."
- "<name>: could not read this image."
- "<name>: SVG contains scripts or outside links and was not added."
- "<name>: animated GIFs show only the first frame."
- "Could not save the picture: browser storage is full." (nothing added)
- "Pictures in this deck use 104 MB. Large decks may be slow to open." (once per session)

## Export

PNG and SVG draw images in the shared stacking order; SVG embeds `data:` URIs; missing pictures draw
the placeholder; selection and view exports include only images in scope.

## Shortcuts

None new. Existing arrange shortcuts (bring/send) now include images.
