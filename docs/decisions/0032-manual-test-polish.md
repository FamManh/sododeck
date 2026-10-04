# 0032. Manual-test polish: Focus mode owns hover, new zoom bands, pack display order

- **Status:** Accepted
- **Date:** 2026-10-04
- **Feature:** `specs/051-manual-test-polish` (research R1–R9)
- **Amends:** 0023 (connection focus, 034), 0025 (card type registry), DESIGN.md frame 123
  (zoom levels), `docs/spec.md` G-4

## Context

The founder's manual test of the editor found nine small problems. Most are plain bugs (the
export row, the save spinner, the drag tilt, the duplicate-drag look). Four answers change
earlier decisions, so they are recorded here.

## Decision

1. **Hover focus runs only inside Focus mode** (redefines 034). Outside Focus mode, hover,
   keyboard focus and selection never dim the canvas. Focus mode is a mode the user turns on
   (F or the tools island), **with or without a selection**; it no longer turns itself off
   when the selection empties. Inside it, one selected component or group pins the focus
   (`editor/focus-target.ts` `focusTargetId`, shared by the canvas, the F key and the hover
   hook); with nothing pinned, hover drives it through 034's generated stylesheet. The 034
   hover benchmark turns Focus mode on first.
2. **Zoom levels are ≤ 30 % / 31–50 % / 51–150 % / > 150 %** (redefines frame 123: 45 / 90 /
   150). Card details (type name, description, field chips, tags) now show down to 51 %.
   Landscape moved to 30 % together with System: moving System alone would leave a 46–50 %
   band that the ±2 hysteresis makes flicker. Zoom-to-level targets are 0.2 / 0.4 / 1.0 /
   1.75. The 60 % lip rule is unchanged.
3. **Pack display order is separate from file order** (amends 0025). Add tabs and sections,
   the Packs panel and the type pickers show Basic shapes, Process, Data cards, Database,
   Architecture, Logistics (`PACK_DISPLAY_ORDER`, `Pack.order`). `PACK_LIST` and `sortPacks`
   keep the file order, so every written `packs` array stays byte-identical. Logistics gets
   `onByDefault: false`: a new deck starts with the five other packs. Stored decks and imports
   keep their `packs` exactly.
4. **G-4 is retired** by founder decision (2026-10-04). The library's "Persistent storage"
   card, its `storage.persist()` / `estimate()` calls and their feature detects are deleted.
   Autosave and the backup reminders are unchanged.

Not ADR-level, recorded for completeness: an ⌥ duplicate-drag creates the copies inside the
open drag gesture as soon as ⌥ is active (originals back at their start, copies moving; ⌥ up
removes them; drop is one undo step; Esc or blur leaves nothing), dragged cards lift without
tilting, and "Saving…" shows only when a write has waited 1 s.

## Consequences

- Hover never dims the canvas by surprise; Focus mode is one key away and stays on until
  turned off.
- More cards render their Container markup at 51–90 %. The bench before and after is in
  `specs/051-manual-test-polish/bench-*.md`.
- Keys 1–9 in Add follow the display order, so they now start with Basic shapes.
- Without G-4 the app no longer asks the browser to keep its storage; the backup reminders
  (G-5) and export remain the safety net.
