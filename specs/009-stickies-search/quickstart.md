# Quickstart: validate 009 (Sticky Notes and Command Palette)

Run this after `/speckit-implement`, on a branch cut from the latest `main` (008 merged). User Story 4 (dimming during playback) is not validated here; it is reviewed after 007 merges (spec "Deferred").

## Prerequisites

```bash
nvm use                          # Node ≥ 24
pnpm install
BENCH_STICKIES=0 pnpm bench      # before, on main: save the numbers (apps/app/bench/results/)
```

## Automated checks

```bash
pnpm --filter @sododeck/schema test  # parity, coverage (full example uses collapsed + showInFlows), fixtures, key order
pnpm --filter @sododeck/model test   # stickies, cascade (freed notes), undo, preview, round-trip, search, perf
pnpm --filter @sododeck/ui test      # markdown bold/italic, command-dialog keyboard + ARIA, contrast
pnpm --filter @sododeck/app test     # sticky node, inspector, outline notes, N / ⌥C / ⌘K, palette results, commands
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
BENCH_STICKIES=100 pnpm bench        # after: ≥ 60 fps at 500 nodes / 1,000 edges; "⌘K type → results" < 50 ms at 2,000 nodes
```

## Manual walkthrough (`pnpm dev` → http://localhost:5173, demo deck)

1. **Add notes (US1)**:
   - Palette tab: drag Note onto empty canvas and type "Open question: retry on timeout?". Click away. Expected: a free amber note with formatted text.
   - Hover Order Service, press N, and type `**Owner** moving to Platform`. Expected: the note is pinned and shows a dotted leader and pin, the footer reads "Pinned to Order Service", and **Owner** is bold.
   - Press N on empty canvas, then click away without typing. Expected: the note disappears, "Empty note removed" is announced, and ⌘Z does not bring it back.
2. **Pinned behavior (US1)**:
   - Drag Order Service. Expected: its note follows.
   - Drag the note. Expected: it stays pinned at the new offset.
   - Inspector ANCHOR → Free. Expected: the note doesn't move and the leader disappears.
   - Pin it again to Pricing Service. Expected: it doesn't move and the leader now goes to Pricing Service.
3. **Collapse (US1)**: select a note and press ⌥C. Expected: it shows one line with a chevron, and the JSON panel shows `"collapsed": true`. ⌥C again removes the key.
4. **Component delete (US1, Q1)**:
   - Delete Order Service while a note is pinned to it. Expected: the dialog says 1 pinned note will stay unpinned; after confirming, the note stays at the same place, free, and the toast says "· 1 note unpinned".
   - ⌘Z. Expected: the component and the pin are back.
5. **Note delete (US1)**: select a note and press Delete. Expected: confirmation, then an Undo toast; Undo restores the note with the same id (check the JSON panel).
6. **Outline (US1)**: Outline tab → Notes · n. Choosing a note selects it and centres it.
7. **Stay visible flag (US4, 009 part)**: turn on "Stay visible during flows". Expected: `"showInFlows": true` in the JSON panel, and one ⌘Z turns it off.
8. **Search (US2)**:
   - Press ⌘K (Ctrl+K). Expected: commands, then flows.
   - Type "reattempt". Expected: the rule "Reattempt policy" and the step whose condition mentions it, each with a kind and a snippet; Enter opens the rule editor on that rule.
   - Reopen, type "order", press ↓↓ and Enter. Expected: the third result opens and is selected and centred.
   - Type "zzqx". Expected: "No results", and Enter does nothing.
   - Type "ORDER svc" with accents, e.g. "órder". Expected: the same matches as "order".
9. **Commands (US3)**: run Toggle dark mode, Export deck…, Open rule editor, Go to library and New deck, and check each matches its button. Toggle focus mode is not listed.
10. **Keyboard only (SC-007)**: do steps 1, 3, 5 and 8 without a mouse. Tab to the canvas, use the arrow keys to reach a component, and press N; the focus ring is visible throughout.
11. **Round-trip (SC-005)**: export the deck, re-import it, and diff the stickies. Expected: identical.
12. **Visual check**: compare frames 14, 30, 31, 32 and 62 (light and dark) and record the results in `specs/009-stickies-search/visual-check.md`.
