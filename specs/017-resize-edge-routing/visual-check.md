# Visual check (T055)

Screenshots captured from the running app (demo deck, Web App → Order Service → Orders DB)
against the Claude Design prototype frames 100, 112, 113, 114, light and dark. Saved in
`specs/017-resize-edge-routing/screens/`.

## 112 — Resize (light/dark)

Matches the prototype: selection outline, 8 corner/edge handles, size readout pill
(`208 × 132`), hint bar `⇧ Keep ratio · ⌥ From centre · ⌘ No snap · Esc Cancel`. Dark theme
contrast is correct (orange outline/handles on `--color-surface`/`--color-canvas`).

## 113 — Segment drag (light/dark)

Matches the prototype's layout (middle-segment handle, orange route, offset readout).
**Allowed difference** (per task): the segment moves freely, with **no 12 px stop** from a
card edge — the prototype's frame predates this clarification (docs/backlog.md, 2026-09-29).

Hint bar text differs from the frozen prototype mockup: ours reads
`⌘ No snap · R Reset route · Esc Cancel`, the prototype reads
`drag Move segment · ⇧ Snap to grid · R Reset route`. This matches `spec.md`'s User Story 6
hint-bar contract (`"⌘ No snap · R Reset route · Esc Cancel"`) and `gesture-hints.ts`'s
`segment` entry — i.e. our hint bar follows the spec, not the earlier prototype wording.
Not a regression.

## 114 — Endpoint targets (light/dark)

Side targets (hollow rings) render on the hovered card at the same positions and size as the
prototype. **Allowed difference** (per task): no "⌥ Free end" hint, since free (unpinned)
connector ends are out of scope (spec §g-44, ADR 0019).

The captured drag did not land inside react-flow's `reconnectRadius` of the edge's actual
endpoint handle (a Playwright-simulated mouse drag, not a real pointer), so the `endpoint`
canvas-gesture and its hint bar (`Drop on a side to pin it · Esc Keep old end`) were not
triggered in this screenshot — confirmed separately by the passing
`endpoint-connection-line.test.tsx` / `use-segment-key.test.ts` unit tests and by a manual
quickstart run (T058), which exercise the real gesture.

## 100 — Toolbar / connection drawer (light)

Structure matches (drawer anchored above the selected edge, `T`/protocol/direction fields,
`Reset route` action, overflow `…`). Field _content_ differs only because the demo deck used
for capture has no label/protocol set yet (`charge`/`HTTPS`/`One way` in the prototype vs.
empty/`HTTP`/`Forward` defaults here) — not a styling or placement difference.

## Conclusion

No unexpected visual regressions found. All differences are either the two explicitly
allowed ones (no 12 px segment stop, no "⌥ Free end") or wording that follows `spec.md`'s
hint-bar contract rather than the frozen prototype mockup.
