# Implementation Plan: Read-only JSON Panel in Sync with the Canvas

**Branch**: `004-json-panel-sync` (git branch not created yet) | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-json-panel-sync/spec.md`

**Dependency**: 003 (canvas-basic) is **merged** on `main` (`7b845bc`). The names this plan
uses were checked against `main` on 2026-09-27 (table in research R10). `useEditor()` returns the
`DeckEditor`, which carries `.doc`. `isApplePlatform()` and the `drag:` bench test already exist.
003's editor page re-serializes the whole deck on every change and passes it to the panel as a
prop; 004 replaces that. T002 re-confirms the names if `main` has moved.

## Summary

Fill 003's reserved JSON slot with a read-only panel that always matches the deck.

- **Two tabs**:
  - **Deck** (the default) shows `serializeDeck(snapshot)`, which is the exported file,
    character for character.
  - **Selection** shows the selected component(s) and connection(s) exactly as they appear in
    the file. It uses two small new model helpers, `serializeEntry` and `serializeEntries`.
- **Viewer**: the Monaco viewer M0 already bundles, extended with:
  - one Monaco model per tab;
  - themes built from the design tokens;
  - read-only feedback (a message at the cursor and a throttled announcement);
  - deck undo/redo while the viewer has focus.
- **Sync**: text is computed only for the visible tab. The Deck tab updates at most every
  250 ms (leading and trailing). Updates go into Monaco as minimal line edits, so folds and
  scroll are kept.
- **Header**: the status line, a line count, Copy (with a toast), collapse, and a keyboard-operable
  resize handle.
- **Preferences**: open/closed, height and tab are remembered per browser in the UI store.
- **What's not needed** (measured, [research.md](research.md) R2): a worker, a new dependency, a
  file-format change.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed; no new dependency.

- `monaco-editor` 0.57 and `@monaco-editor/react` 4.7, bundled locally with deep imports (M0).
- `@sododeck/model`, including the 003 snapshot, and `@sododeck/schema`.
- `@sododeck/ui`: `SegmentedControl`, `Button`, the toast, and `lib/contrast` for the theme test.
- `lucide-react` (`Braces`, `Lock`, `Copy`, `ChevronDown`, `ChevronUp`) and Zustand 5.

**Storage**: `localStorage["sododeck.jsonPanel"]` for UI preferences only, wrapped in try/catch.
No deck storage change.

**Testing**:

- Vitest for the pure view models, the store and the model helpers (including a perf test).
- Testing Library component tests for `JsonPanel`, by role and label. Monaco is replaced by a thin
  test double at the `json-viewer` module boundary. The viewer wrapper is tested with a mocked
  `@monaco-editor/react` `Editor` that hands it a fake editor and model. The tests check the
  options, the read-only event, the undo/redo commands, and that updates use `applyEdits`, never
  `setValue`. The pure parts (`lineDiff`, theme, cooldown) have their own unit tests.
- The existing Playwright smoke suite, unchanged. `pnpm bench` gains a "drag with Deck tab open"
  scenario.

**Target Platform**: The latest 2 versions of Chrome, Edge, Firefox and Safari, desktop,
1440×900 reference. Offline-capable.

**Project Type**: Web SPA (`apps/app`) plus internal packages, in the pnpm/Turborepo monorepo.

**Performance Goals**:

- The canvas frame rate with the Deck tab open is within 10% of the frame rate with the panel
  collapsed (500 nodes / 1,000 edges).
- The Deck text lands ≤ 250 ms after the last change (spec limit: 0.5 s).
- The Selection text updates in the same render as the change.
- `serializeDeck` takes < 16 ms on a rich 500 / 1,000 deck (measured 0.4 ms on the bench deck).

**Constraints**:

- The panel text is always produced by `@sododeck/model`. Monaco content is never read back.
- Tokens only; the theme is derived from CSS variables.
- The smoke selectors stay the same: region "JSON", `.monaco-editor`, and the Deck tab shown by
  default.
- Nothing ever calls `setValue` after the initial load.

**Scale/Scope**:

- 1 panel component rewritten, 1 viewer wrapper, about 8 pure functions, 1 store slice.
- 2 model helpers, 1 feature-detect helper.
- 4 visual states to match, in light and dark.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle                         | Check                                                                                                                                                                                                                                                                                                                                                               | Result |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Single source of truth         | The panel only reads: snapshot → text → Monaco. Monaco's model is a rendered, read-only copy that is overwritten from the snapshot and never read back, so it is not a second store (same stance as the backlog hint). Preferences and the tab are UI-only (Zustand + `localStorage`). The panel never writes the deck, except for undo/redo through `DeckEditor`.  | ✅     |
| II. Schema-owned format, lossless | No format change. The app does not serialize the deck itself: Deck text is `serializeDeck`, and Selection text is the new `serializeEntry`/`serializeEntries` in the model, tested to equal slices of the file ([contracts/model-additions.md](contracts/model-additions.md)). No round-trip case is needed (no conversion change). The existing suite stays green. | ✅     |
| III. Stable identity              | Selection is by id from the UI store. Labels are computed from titles for display only.                                                                                                                                                                                                                                                                             | ✅     |
| IV. Local-first, private          | No network. Monaco, the JSON worker and the schema are already bundled, and `enableSchemaRequest: false` stays. The clipboard and `ResizeObserver` are feature-detected in `lib/features.ts` (`supportsClipboardWrite`, `supportsResizeObserver`); the clipboard is local. The smoke no-third-party check stays.                                                    | ✅     |
| V. Performance                    | Serialization measured at 0.4 ms (bench deck), so no worker is needed, and a perf test guards the 16 ms budget. Tabs are lazy, the Deck tab is throttled, and edits are minimal. `pnpm bench` runs before and after with the new "Deck tab open" drag scenario, and both numbers are reported.                                                                      | ✅     |
| VI. Strict types, tested          | Unit tests for every pure function and the store slice. Component tests by role and label for US1–US5. No new e2e; the smoke suite passes unchanged.                                                                                                                                                                                                                | ✅     |
| VII. Accessible by default        | The panel is a region; the tabs are a radiogroup; the resize handle is a separator with values and arrow keys; Copy and collapse have accessible names. The status uses a lock icon plus text. Refused edits are announced (cooldown 3 s). Syntax colors come from tokens and meet ≥ 4.5:1 (tested).                                                                | ✅     |
| VIII. Simplicity, dependencies    | No new dependency. Monaco is reused. No worker. Two 2-line model helpers. No ADR needed: no architectural decision beyond what the backlog and §g-3 already record. Decisions are in research.md.                                                                                                                                                                   | ✅     |

**Post-design re-check (after Phase 1)**: all ✅.

- **Coordination with 003**: this plan changes files that 003 is changing too (`ui-store.ts`,
  `json-panel.tsx`, `editor-page.tsx`, `packages/model/src/index.ts`). This is safe only after
  003 merges.
- **Open point for the founder, not blocking**: the syntax color mapping (research R6).

## Project Structure

### Documentation (this feature)

```text
specs/004-json-panel-sync/
├── plan.md              # this file
├── research.md          # Phase 0: R1–R10
├── data-model.md        # Phase 1: UI state, derived view models, states
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── model-additions.md   # serializeEntry, serializeEntries
│   └── json-panel-ui.md     # roles/names, keyboard, toasts, persistence, smoke hooks
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/model/
├── src/serialize-entry.ts          # serializeEntry, serializeEntries (on canonicalizeEntry)
├── src/index.ts                    # + exports
├── test/serialize-entry.test.ts    # equals file slices for every collection; key order; array form
├── test/serialize-perf.test.ts     # serializeDeck < 16 ms on a rich 500/1,000 deck
└── CLAUDE.md                       # + API

apps/app/src/
├── lib/features.ts                 # + supportsClipboardWrite(), supportsResizeObserver() (isApplePlatform exists)
├── state/ui-store.ts               # jsonPanel {open,height,tab} replaces jsonPanelOpen; persisted
├── state/json-panel-prefs.ts       # readJsonPanelPrefs / writeJsonPanelPrefs (validation, try/catch)
├── editor/
│   ├── json-panel.tsx              # region, resize handle, header, tabs, empty state, collapsed bar
│   ├── json-panel-header.tsx       # JSON label, SegmentedControl, status, line count, Copy, collapse
│   ├── json-resize-handle.tsx      # separator: pointer drag + keys
│   ├── json-viewer.tsx             # (renamed from json-editor.tsx) Monaco wrapper: two models, minimal edits, read-only hooks, undo/redo commands
│   ├── monaco-setup.ts             # + readOnlyMessage contribution
│   ├── monaco-theme.ts             # sododeck-light/dark from CSS tokens
│   ├── json-panel-view.ts          # selectionView, selectionText, countLines, copyToastText
│   ├── line-diff.ts                # lineDiff
│   ├── panel-height.ts             # clampPanelHeight
│   ├── cooldown.ts                 # createCooldown
│   └── use-throttled-deck-text.ts  # lazy + 250 ms leading/trailing Deck text
├── routes/editor-page.tsx          # stop computing json; JsonPanel reads snapshot/editor itself
apps/app/bench/perf.bench.ts        # + "drag with JSON Deck tab open" scenario
apps/app/CLAUDE.md                  # JSON panel: text from the model only, prefs key, viewer notes
```

Each `.ts`/`.tsx` gets a sibling `*.test.ts(x)`, including `json-viewer.test.tsx` (with a mocked
Monaco). `monaco-theme.test.ts` checks contrast in both themes, using tokens loaded from
`@sododeck/ui/tokens.css?raw`.

**Structure Decision**: The UI work is in `apps/app/src/editor` and the UI store. The two text
helpers go in `packages/model`, because constitution II forbids the app from serializing the
document itself. `packages/ui` and `packages/schema` are not touched.

## Implementation order (for /speckit-tasks)

1. **Gate.** 003 is merged. Re-check the 003 names (research R10). Run `pnpm bench` and save the
   baseline.
2. **Model helpers.** `serializeEntry` and `serializeEntries`, with the slice-equality tests and
   the perf guard.
3. **Foundations.** `supportsClipboardWrite`, prefs read/write, the store slice (replacing
   `jsonPanelOpen`), and the pure functions: `countLines`, `lineDiff`, `clampPanelHeight`,
   `createCooldown`, `selectionView`, `selectionText`, `copyToastText`.
4. **Viewer.** `json-viewer.tsx`:
   - two models;
   - initial value, then minimal edits;
   - options from research R3;
   - `readOnlyMessage` and the cooldown announcement;
   - undo/redo commands;
   - token themes (`monaco-theme.ts`).
5. **US2 (Deck tab), P1.** `use-throttled-deck-text`, and the Deck tab wired to the snapshot.
   Remove the serializing in `EditorPage`. The smoke suite must still pass.
6. **US1 (Selection tab), P1.** Selection label and text, the empty state with "Show Deck JSON",
   and no automatic tab switching.
7. **US3 (read-only feedback), P2.** Header status, and a component test for the refused-edit
   announcement.
8. **US4 (Copy), P2.** Button, toasts, the failure path, disabled when empty.
9. **US5 (collapse and resize), P3.** Collapsed bar, resize handle (pointer and keys), persistence.
10. **Finish.**
    - Accessibility pass.
    - Visual check against 02, 16 and 17 (light and dark), with the syntax colors shown to the
      founder.
    - Bench after the change (the new scenario is within 10%).
    - `apps/app/CLAUDE.md` and `packages/model/CLAUDE.md`.
    - The full DoD command set.

## Complexity Tracking

No constitution violations; nothing to justify.
