# Visual check — feature 009

Viewport: `1440×900`  
Source captures: `docs/design/screens/009-check/`

Captured states:

- `14-editor-palette-tab-light.png`
- `30-command-palette-light.png`
- `31-command-palette-filtered-light.png`
- `32-command-palette-no-results-dark.png`
- `62-stickies-light.png`
- `62-stickies-dark.png`
- `63-stickies-flow-light.png`
- `63-stickies-flow-dark.png`

## Comparison notes

No blocking visual regressions were found in the captured states relative to frames 14, 30, 31, 32, 62, and 63.

Expected / allowed differences for the PR:

1. Sticky-note content uses recreated demo text (`Always visible`, `Pinned to Order Service`, `Dimmed note`) instead of the exact prototype copy.
2. Command labels follow research R10 (`Jump to…`, command ordering and wording) rather than any older prototype wording.
3. Colors, spacing, and icons follow `DESIGN.md` tokens and `lucide-react`, which intentionally override prototype mismatches called out in repo guidance.
4. The flow-mode capture uses a recreated two-step demo flow (`Flow demo`) so the inspector and step player text differ from the original reference deck, while preserving the intended layout and note-dimming behavior.
