# Quickstart: validate Export (012)

## Prerequisites

- `pnpm install`, Node ≥ 24. `pnpm dev` → app on http://localhost:5173.
- A deck with groups, flows, rules and stickies (e.g. import a sample deck, or `/bench?nodes=40&edges=60&flows=3&groups=4&stickies=4`).

## Automated checks

```bash
pnpm --filter @sododeck/app test -- export     # pure + component tests of this feature
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench                                     # before and after; includes export-preview
```

## Manual scenarios

1. **JSON round-trip (US1, SC-001).** Tools island → Export. Expect JSON selected, scope
   "Whole deck" disabled with its note, footer `<deck>.sododeck.json` + size. Download; in the
   library, Import the file; compare the new deck with the original (JSON panel "Deck" tab).
2. **Compact / no knowledge.** Turn Pretty-print off → preview on one line, size smaller. Turn
   "Include descriptions, links and rules" off → download → import succeeds; no descriptions,
   links or rules in the imported deck.
3. **PNG sizes (US2, SC-004).** Choose PNG → 2× selected. For 1×, 2×, 3× note the footer size,
   download, and check the image size in the OS file info. Toggle Transparent background and
   check the corners are transparent.
4. **SVG.** Download SVG; open in a browser (fonts look like the app) and in a vector tool (text is
   editable). Copy → paste into a text editor → it starts with `<svg`.
5. **Flow (US3).** Enter flow mode on a flow → Export. Expect PNG + "Selected flow"; preview shows
   only the flow's components and connections with step numbers; file name
   `<deck>-<flow>.png`. Switch to JSON (scope disabled) and back (scope "Selected flow" again).
6. **Current view (US4).** Switch to a saved view that hides some components; drill into a group;
   choose "Current view" → preview matches the canvas at that level, full extent.
7. **Keyboard (US5).** ⌘K → "exp" → Enter. Arrows in the format list and scope, Tab through
   options, Download with Enter, Esc → focus back on the canvas. Repeat with VoiceOver: names and
   announcements as in [contracts/export-ui.md](contracts/export-ui.md).
8. **Edge cases.** Empty deck (images show "Nothing to export yet"); a deck named "注文フロー"
   (file name keeps the characters); `/bench?nodes=500&edges=1000` → "Preparing…" then preview
   in < 2 s; with DevTools Network open, confirm no request other than the app's own chunk on first
   open.
9. **Backups unchanged.** Library deck menu "Export .sododeck.json" and the deck inspector button
   still download directly without the dialog.

## Visual check

Screenshots at 1440×900, light and dark, of JSON, PNG, SVG and flow-scope states next to
`docs/design/screens/06-*`, `33-export-png-light.png`, `33-export-svg-light.png`,
`34-export-flow-scope-light.png` in the PR description; list differences (no PDF / Mermaid rows).
