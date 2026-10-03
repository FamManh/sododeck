# Claude Design prompt: connector style (022)

Written 2026-10-03, after board B "Deck" was picked (§g-63). Backlog 022 had no design: board B
(frames 117–127) draws connector **states** and **bundles** (117–119) but no way to **style** a
connector. This file has two parts: the **requirements** (for us and for review), then the
**prompt** to paste into the Sododeck Claude Design project.

## Part 1: requirements

Source of truth: `docs/backlog.md` §022 (scope, schema, acceptance criteria). Line type (curved,
elbow, straight) and the connector look already exist (029); 034 owns hover focus, bundles and
drill-in; 022 owns everything the user can change on one connector.

| #   | Topic           | Decision                                                                                                                                                                              |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Direction       | **Board B "Deck" only.** No new directions. Reuse its connector tokens (2px curve, lip-free line, 22px count pill, label pill).                                                       |
| C2  | Toolbar         | One floating toolbar above the selected connector: line type, dash, weight, colour, animated, label, direction, reset route.                                                          |
| C3  | Line type       | Curved (default), elbow, straight (029). Shown as a three-way segmented control, not a menu.                                                                                          |
| C4  | Dash and weight | Dash: solid, dashed, dotted. Weight: a slider with fixed steps 1–6 px, default 1.5 px (today's width).                                                                                |
| C5  | Colour          | The shared 13-colour palette (stroke variant), the deck's custom swatches, and "No colour" (today's neutral).                                                                         |
| C6  | Waypoints       | Free bend points for elbow and curved lines, movable in any direction. Small round handles (about 8 px) only on hover or while selected, with a larger invisible hit area.            |
| C7  | Free anchors    | An end attaches anywhere along a side; snaps at 25 / 50 / 75 %. Frame 118 c already draws it: reuse that readout and dashed old route.                                                |
| C8  | Label position  | Drag the label along the line (a fraction 0–1, default 0.5); a small readout while dragging.                                                                                          |
| C9  | Animated line   | A per-connector toggle; dashes run from source to target (both ways for two-way). Off by default. Static under reduced motion: direction stays readable from end dots and arrowheads. |
| C10 | Many at once    | A multi-selection of connectors shares the toolbar; mixed values show a "mixed" state, not a wrong value.                                                                             |
| C11 | Flow wins       | While a flow shows, 006/007's highlight wins over the connector's own style (frame 117 states).                                                                                       |

### Out of scope for this design round

Line jumps, arrowhead shapes, relationship types and the legend (034 / `edge.relation`), hover
focus and bundles (034), automatic obstacle-avoiding routing, per-view styles, the implementation.

## Part 2: the prompt

Paste the block below into the existing **Sododeck** Claude Design project (the one with
`Sododeck Cards.dc.html`). Attach `DESIGN.md` ("Card system (Deck)" > Connectors) and screenshots
117, 118 and 119 of board B.

---

Design the **connector styling** controls of Sododeck, in board B "Deck" only (same tokens as
frames 117–119: 2px smooth curves, filled pill labels, 22px Ink count pill, Deck Orange for
selection). Add a new row to `Sododeck Cards.dc.html` for board B, light and dark, 1180 px wide
like the other plates. Do not touch boards A and C.

Draw these frames, each with the same sample deck as frame 118 (Order Service, Payment gateway,
Orders DB, API Gateway):

1. **Connector toolbar.** A connector is selected. A floating toolbar sits above its midpoint:
   line type (curved / elbow / straight, segmented), dash (solid / dashed / dotted), weight, colour,
   animated toggle, label, direction, reset route. Show the toolbar closed, and with each popover
   open (dash and weight together; colour with the 13 swatches, the deck's custom swatches, a "+"
   and "No colour").
2. **Weight slider.** Fixed steps 1–6 px, current value shown, default marked. Show a connector at
   each step next to the slider.
3. **Waypoints.** An elbow connector and a curved connector, selected: the midpoint handle that
   adds a bend, two bend points in place, one being dragged in any direction, and the "remove bend"
   affordance (double-click or ⌫). Handles are about 8 px round knobs, visible only on hover or
   when selected, with a halo while active.
4. **Free anchors.** Reuse frame 118 c: an end dragged along the left side of Orders DB, snapping
   at 25 / 50 / 75 %, "left side · 78 %" readout, the old route dashed until release. Add the
   same on the right side and the bottom.
5. **Label position.** Dragging a label along a curved connector toward the source end, with a
   readout ("label · 20 %") and the label staying on the line; the same after a card moved.
6. **Animated line.** Three connectors: a forward flow, a two-way flow, and the reduced-motion
   rendering (static, direction shown by end dots and arrowheads only). Draw the running dashes as
   a strip of three states so motion can be judged on a still.
7. **Multi-selection.** Three connectors selected with different dash and weight: the toolbar
   shows "mixed" for the values that differ and a real value for those that agree.
8. **Drawer section.** The connector's "Appearance" section in the detail drawer with the same
   controls as fields (type, dash, weight, colour, animated, label position, reset).
9. **States on a styled connector.** A coloured, dashed, weight-3 connector in: resting, hover,
   selected, current flow step (flow wins: Deck Orange 3.25px over the halo), error path (Clay),
   dimmed by focus (20 %), and being dragged.
10. **Narrow toolbar.** The toolbar at the 1024 px layout: icons only, popovers unchanged.

Rules:

- Colour is never the only cue: dash, weight and arrowheads carry meaning too; selection and error
  differ by more than hue.
- Use DESIGN.md tokens only. If you need a new size or colour, name it and say why.
- Keep controls at 28–34 px (as the other islands and toolbars), keyboard order left to right,
  every control with a tooltip.
- Light and dark for every frame. Text in English.

### Deliver

The new row in `Sododeck Cards.dc.html` plus its data in `sododeck-cards.js`, frames numbered after
127, and a short note listing any token you had to add or any place you broke a DESIGN.md rule.
