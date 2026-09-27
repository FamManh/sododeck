# Contract: flow playback UI (007)

The user-visible contract. Component tests assert it through roles, labels and text
(constitution VI). Design frames: 03, 24, 26, 27, 44, 46 (light and dark where available). Spec FR
numbers are in brackets.

## Entering and leaving [FR-001–003]

- Activating a flow row button (006 "Features" list, or the flow list in the flow panel) enters
  flow mode on the first step of the played path, paused.
- Top bar: a chip "Flow mode · <flow title>" with a button "Exit flow mode" (icon ×).
- Left panel region `complementary` "Flow":
  - button "Back to canvas";
  - list "Flows in <feature>" with the open flow's button `aria-current="true"`;
  - list "Steps" (006 rows); the current step's row button has `aria-current="step"` and the
    current style (filled number badge + tinted row, not color alone: the badge is filled).
- Exit (Esc when focus is not in a text field / menu / dialog, "Exit flow mode", "Back to canvas"):
  canvas back to normal, inspector shows the deck, the flow row in "Features" shows an icon and the
  text "Last played" (sr and tooltip) until another flow is opened or the deck closes.
- "Edit steps" ends flow mode and starts 006 edit mode; Done / Cancel reopen flow mode on step 1.

## Canvas [FR-004–009, FR-012]

- The canvas wrapper has `data-flow-mode` while in flow mode.
- Members of the played path (nodes and edges) carry `.in-flow`; other nodes, edges, edge labels
  and group boundaries render at reduced opacity.
- Flow edge labels show the step badge(s) ("Step 4", "Step 4b, error path" as `img` names, 006).
- Current step: its edge is thicker with a filled label; its two nodes have the selection ring and
  `aria-current="step"`; a token circle (`data-testid="flow-token"`) sits on the edge, animated
  with `<animateMotion>` unless reduced motion, in which case it is static at the midpoint.
- No connection handles, no drag, no drop, no reconnect, C / E / Enter / Delete do nothing.
- Click a member node → the first played step touching it; click a member edge → the next played
  step on it after the current one (wrapping); click a dimmed element or the pane → nothing.
- Opening fits the played path in view; later steps pan only if the current edge's nodes are out
  of view; zoom never changes after opening.

## Step player [FR-010–017, FR-024]

`region` "Step player" at the bottom centre of the canvas:

| Element       | Role / name                                                                                                             | Behavior                                                                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Previous      | `button` "Previous step"                                                                                                | Disabled on the first step.                                                                                                                                                           |
| Play / Pause  | `button` "Play" / "Pause" (`aria-pressed` false / true)                                                                 | Play on the last step restarts at step 1.                                                                                                                                             |
| Next          | `button` "Next step"                                                                                                    | Disabled on the last step.                                                                                                                                                            |
| Position      | text "<flow> · Step <n> of <m>" and the step title (or "<from> → <to>")                                                 | Updates with the current step.                                                                                                                                                        |
| Speed         | `button` "Speed 1×" / "Speed 2×"                                                                                        | Toggles and pauses.                                                                                                                                                                   |
| Progress      | `list` "Progress"; each segment a `button` "Go to step <n> of <m>"                                                      | Filled up to the current; current has `aria-current="step"`; error and broken segments add ", error path" / ", connection deleted" to the name and a pattern (dashed) not only color. |
| Branch picker | `radiogroup` "At step <fork number>" with one `radio` per alternative (label; error ones with icon and sr "error path") | Only when the current step is the fork step or on an alternative.                                                                                                                     |
| Empty flow    | text "No steps"; all controls disabled                                                                                  |                                                                                                                                                                                       |

Keys (anywhere in the editor, not in text fields, dialogs, menus or the radiogroup):

| Key   | Action                                                             |
| ----- | ------------------------------------------------------------------ |
| → / ← | Next / previous step (pauses).                                     |
| ↓ / ↑ | Next / previous alternative, only while the picker shows (pauses). |
| Esc   | Exit flow mode.                                                    |

Autoplay: advances every 1.7 s at 1×, 0.85 s at 2×; stops on the last step; pauses on any manual
navigation, speed change, alternative change, the tab being hidden, or exit.

## Inspector: step view [FR-019–021]

`complementary` "Inspector" shows:

- heading "Step <n> of <m> · <flow>" (text "STEP n OF m · <flow>" styled uppercase);
- from and to kind tiles with names "From: <title>" / "To: <title>", or the text "Connection
  deleted" with an alert icon;
- the protocol as text (e.g. "gRPC") when set;
- for an alternative step: "Branch <label>" and, for error paths, an alert icon + "Error path";
- 006's editable fields: Title, Description, Condition, SLA target (placeholder "No SLA target");
- section "Rules": a `list` of attached rule titles, "Missing rule <id>" with an icon for unknown
  ids, or the text "No rules attached". No table, no "Edit rule" (008).
- No measured SLA, no meter.

## JSON panel [FR-022]

- Selection tab label "Step <n>" (full name "Step <n>: <flow>"), read-only, content = the current
  step object as it appears in the file. Deck tab unchanged.

## Announcements [FR-023]

The polite live region (006 `Announcer`) receives exactly one message per current-step change:

- "Step 5 of 8: Order Service → Payment Service"
- "Step 4b of 5: Payment Service → Notification Service, branch payment failed"
- "Step 3 of 8: connection deleted"
- On a deleted flow: toast and announcement "This flow was deleted".
