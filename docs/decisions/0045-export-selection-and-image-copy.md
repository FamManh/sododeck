# 0045. Export the selection; copy pictures from the export path

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amends:** ADR 0016 (export scopes), 016 clipboard actions
- **Feature:** founder feedback (2026-10-06) on export and the clipboard

## Context

The Export dialog's picture scopes were Whole deck, Current view and Selected flow. The founder
wants the third one to export what is selected on the canvas, not a flow, and wants pictures of a
selection reachable from the canvas context menu (Copy as PNG / Copy as SVG), next to Cut, Copy and
Paste. The dialog's Copy existed for SVG and JSON only; PNG had Download alone.

## Decision

1. **"Selected" replaces "Selected flow".** `ImageScope` is `deck | view | selection`. The selection
   scope draws the current view reduced to the selected components, notes, pictures and groups (a
   group brings its frame, nested groups and members, as a copy does) and the connectors whose two
   ends are drawn. With nothing selected the item is disabled ("Select something on the canvas to
   export it"); the file name ends in `-selection`. `buildScene` keeps its `flow` scope (tested,
   unused by the dialog) as `SceneScope`.
2. **One picture path.** `export/render-image.ts` (`renderImage`) is the only scene → SVG step;
   `export/copy-image.ts` (`copyImage`) is the only picture copy. The dialog's Copy (now on PNG
   too) and the menu's Copy as PNG / SVG both call them, so the menu copies exactly what the dialog
   would (light palette, embedded fonts and pictures, PNG at 2×).
3. **Clipboard formats.** PNG is one `image/png` `ClipboardItem`. SVG is the markup as `text/plain`,
   plus `image/svg+xml` in the same item where `ClipboardItem.supports` says so; without clipboard
   items it falls back to `writeText`. The item is created inside the click with pending blobs, so
   browsers that require a user gesture accept a write whose data is still rendering. The menu's
   render code loads with the export chunk (dynamic import).
4. **Menu clipboard.** Cut, Copy, Paste, Duplicate, Copy as PNG, Copy as SVG are offered for every
   copyable target, now including notes and mixed selections. Paste falls back to the last copy
   held in memory by this tab when the browser cannot or will not read the clipboard.

Everything runs in the browser; no content leaves it (architecture rule 5).

## Consequences

- Exporting only a flow's path is no longer offered in the dialog; Current view during flow mode
  is the closest replacement.
- The in-memory copy lives as long as the tab and is never stored.
