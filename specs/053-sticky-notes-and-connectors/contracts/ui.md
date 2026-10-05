# Contract: UI behaviour

Names and labels are English UI copy. Shortcuts in mono. All controls are keyboard reachable with
visible focus and accessible names.

## Sticky on the canvas

- Paper look: soft shadow, light gradient, lifted corner; no header, icon, fields or lip; five colours
  from existing tokens; light and dark.
- Tags: small coloured chips along the bottom, wrap, collapse to "+N"; never cover text.
- Handles: four side connection handles shown on hover and when selected (like groups); Enter on a
  focused sticky opens the connect popover.
- Resize: corner and side handles on a selected, expanded, unlocked sticky; min 96 × 96; one undo step.
- Text: Auto fit by default (largest of 32 … 9 px that fits); fixed size when `fontSize` is set;
  below 9 px clipped with a visible "more" cue.
- Lock: a small lock glyph; no move, resize, delete or reconnect.

## Sticky toolbar (one or more stickies selected)

Order: text size ▾ (Auto, 12, 14, 16, 20, 24, 32) · Bold · Align (cycles left, centre, right) · Link ·
Colour ▾ (five swatches, current ticked) · Tags (opens the shared tag picker) · | · Expand/Collapse ·
Pin/Unpin · Lock/Unlock · Delete.
Hides while dragging, panning, editing the title or in flow mode; flips to stay in the viewport.
Applies to all selected stickies in one undo step.

## Add flyout

The "Sticky" tile is a pad of three offset notes in `lastStickyColour`. Click: place at view centre.
Drag: drop where released, always free (never pinned), new note in edit mode. Key `S` keeps the
current tool behaviour.

## Connections toolbar (several connectors selected)

Order: Arrow ends ▾ (start, end) · Line type ▾ · Colour ▾ · Weight ▾ · | · Lock/Unlock · More ⋯.
"Mixed" shown when values differ; nothing changes until a value is picked. Per-connector bend and
anchor handles stay hidden unless exactly one connector is selected.

## Connecting

Drag from any sticky handle to a card, group or sticky; drag an existing connector end onto a sticky;
drag from a card handle onto a sticky. Self-connections refused. Hover target highlight as for cards.

## Delete confirmation

Lists connectors that go with the sticky(ies); one undo restores all.
