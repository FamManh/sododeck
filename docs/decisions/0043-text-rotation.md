# 0043. Turned text: `node.rotation`, paint-only

- **Status:** Accepted
- **Date:** 2026-10-06
- **Feature:** founder feedback on the text component (2026-10-06), follow-up to
  `specs/031-shapes` (which had rotation out of scope)

## Context

The founder asked for the free text on the canvas to be rotatable. No component could be rotated
before: 031 left rotation out of scope, and the only turns in the app are paint-only effects (the
drag tilt and the fanned hand of a collapsed group, §g-74). A turn the user sets must be saved in
the file, so it needs a field in format v1.

## Decision

1. **Schema.** `Node.rotation` is an optional number: degrees clockwise around the centre of the
   box, from -180 to 180, written right after `size` and shared by every view. Absent means not
   turned; the app removes the key at 0 and writes values wrapped to (-180, 180] in tenths of a
   degree. Additive, so no version bump (ADR 0031 precedent).
2. **Text only.** Only the `text` type (geometry `none`) is drawn turned. On any other type the
   value is kept and ignored, like `display` on single-form types. Cards and other shapes can be
   added later without a format change.
3. **Paint-only.** Like the drag tilt, the turn is the CSS `rotate` property on the shape's art
   and title (`.sd-shape-turn`, variable `--sd-turn`), never on the React Flow node. The box,
   snapping, marquee hit tests, connection handles, connectors and resize controls stay
   axis-aligned. A text is rarely connected, and keeping geometry unturned avoids touching
   routing, groups and the export's edge geometry. The image export turns the same group around
   the same centre (`render-svg.ts`).
4. **Control.** A selected, unlocked text outside flow mode shows a round knob below its box (the
   selection toolbar floats above). Dragging previews through `--sd-turn` and writes once on
   release (whole degrees, 15° steps with Shift); double-click turns it back. The knob is a
   `slider` for the keyboard: ←/→ turn by 15° (1° with Shift), Home turns it back. Every write is
   one undo step.

## Consequences

- An older build reports `rotation` as an unknown key, as with every additive field (ADR 0031).
- A turned text's words can reach outside its box; the export's bounds still use the box.
- Connectors to a turned text end on the unturned box.
