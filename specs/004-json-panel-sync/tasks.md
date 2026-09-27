---
description: 'Task list for 004-json-panel-sync (Read-only JSON Panel in Sync with the Canvas)'
---

# Tasks: Read-only JSON Panel in Sync with the Canvas

**Input**: Design documents from `specs/004-json-panel-sync/`

**Prerequisites**:

- [plan.md](plan.md) and [spec.md](spec.md), including the Clarifications of 2026-09-27:
  - Q1: several selected items are shown as a plain array;
  - Q2: the panel never switches tabs on its own;
  - Q3: the default tab is Deck.
- [research.md](research.md) (R1–R10) and [data-model.md](data-model.md).
- [contracts/model-additions.md](contracts/model-additions.md) and
  [contracts/json-panel-ui.md](contracts/json-panel-ui.md).
- [quickstart.md](quickstart.md).
- **003 (canvas-basic) merged to `main`.** Do not start before that (backlog rule).

**Tests**: Required (constitution VI). Write each task's tests first, see them fail, then
implement.

- **Unit (Vitest)**: pure functions and stores. In `apps/app` they go in `*.test.ts` next to the
  code; in packages they go in `test/`.
- **Component (Testing Library)**: query by the roles and labels in
  [contracts/json-panel-ui.md](contracts/json-panel-ui.md), never by class names.
  - Monaco does not run in jsdom. Panel tests `vi.mock('./json-viewer')` with a double that
    renders `<pre aria-label={ariaLabel}>{text}</pre>`, plus buttons that call
    `onReadOnlyAttempt`, `onUndo` and `onRedo`.
  - The viewer's own logic is unit-tested through pure helpers (`lineDiff`, `toRangeEdit`,
    `buildMonacoTheme`).
- **E2E**: **no new Playwright tests** (constitution VI, TODO(e2e)). The smoke suite
  (`apps/app/tests/e2e/smoke.spec.ts`) must stay green **without edits**. Its hooks are listed at
  the end of json-panel-ui.md.

**Read first**:

- `AGENTS.md`, `apps/app/CLAUDE.md`, `packages/model/CLAUDE.md`, `packages/ui/CLAUDE.md`, `DESIGN.md`.
- Design screens `docs/design/screens/02-editor-node-selected-{light,dark}.png`,
  `16-editor-json-deck-tab-light.png` and `17-editor-json-collapsed-light.png`.

**Hard rules for every task**:

- The panel **only reads** the deck: through `useDeckSnapshot(doc)`, with text from
  `serializeDeck`, `serializeEntry` or `serializeEntries` (`@sododeck/model`).
  - Never call `JSON.stringify` on deck data in the app.
  - Never read text back from Monaco.
  - The only writes are `editor.undo()` and `editor.redo()`.
- Preferences and the chosen tab are UI-only (Zustand + `localStorage`). They never go in the deck.
- UI uses tokens only (no hex values in app code; the Monaco theme reads them from CSS variables),
  `lucide-react` icons, and `focusRing` from `@sododeck/ui/lib/focus` on every interactive element.
- No new dependency. No network.

**Commits**:

- Conventional Commits, small: `feat(model): …`, `feat(app): …`, `test(app): …`, `docs: …`.
- **No `Co-Authored-By:` or any other AI attribution line** (AGENTS.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5 from spec.md

## Path Conventions

pnpm monorepo, repo-relative paths: `apps/app/src/…` (tests next to code) and
`packages/model/src|test/…`. To run one package: `pnpm --filter @sododeck/<name> <script>`.

---

## Phase 1: Setup

**Purpose**: Gate on 003, re-check its names, record the baseline. No behavior change.

- [ ] T001 Gate and branch:
  - Confirm 003 is merged on `main` (`git log --oneline main`).
  - Create the branch `004-json-panel-sync` from `main`.
  - Run `pnpm lint && pnpm typecheck && pnpm test` and confirm they are green.
- [ ] T002 Confirm the 003 names in research R10 still hold. They were checked against `main`
      at `7b845bc` on 2026-09-27; see the table in R10. If `main` has moved since, re-run the
      check (`rg` for each name) and update R10 and the affected tasks. The names in use:
  - `useEditor()` in `apps/app/src/model/use-editor.ts`, returning the `DeckEditor`, which
    carries `.doc`.
  - `useDeckSnapshot(doc)` in `apps/app/src/model/use-deck-snapshot.ts`.
  - `useUiStore`: `selection` (`{ nodes, edges }`), `select`, `announce(text)`, `jsonPanelOpen`
    and `toggleJsonPanel`.
  - `canonicalizeEntry(field, value)` in `packages/model/src/key-order.ts`.
  - `useToast()` → `{ toast }` from `@sododeck/ui/components/toast`, with the provider mounted in
    `apps/app/src/routes/editor-page.tsx`.
  - `isApplePlatform()` in `apps/app/src/lib/features.ts`.
- [ ] T003 [P] Record the performance baseline:
  - Run `pnpm bench` and `BENCH_CPU_THROTTLE=4 pnpm bench`.
  - Note both report paths in `apps/app/bench/results/`. They are the "before" numbers for the
    final report (constitution V).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Model text helpers, preferences, the store slice, the pure view models, and the
Monaco viewer wrapper. **⚠️ No user story work starts before this phase is done.**

### Model helpers ([contracts/model-additions.md](contracts/model-additions.md))

- [ ] T004 [P] Write `packages/model/test/serialize-entry.test.ts` (failing first):
  - **File slices.** For every collection that has entries in the round-trip fixtures
    (`test/fixtures` or whatever `test/round-trip.test.ts` uses), and for every rule in `rules`:
    `serializeEntry(c, o)` equals that object's lines inside `serializeDeck(file)`, with the file's
    nesting indent removed and without the trailing comma. Find the slice by locating
    `"id": "<id>"` and walking to the matching brace, or by comparing against
    `JSON.stringify(canonicalize(file)[c][i], null, 2)` re-indented.
  - **Key order.** For a node whose keys are shuffled, the result equals the canonical form.
  - **Array form.** `serializeEntries([])` is `"[]"`; for two nodes and one edge it equals
    `JSON.stringify([...canonical], null, 2)`; there is no trailing newline.
- [ ] T005 Implement `packages/model/src/serialize-entry.ts`:
  - `serializeEntry(collection, value)` = `JSON.stringify(canonicalizeEntry(collection, value), null, 2)`.
  - `serializeEntries(entries)` = the same over `entries.map(e => canonicalizeEntry(e.collection, e.value))`.
  - Types: `EntryCollection = Collection | 'rules'` and `Entry`.
  - Export both functions and both types from `packages/model/src/index.ts`. T004 must be green.
- [ ] T006 [P] Write `packages/model/test/serialize-perf.test.ts`:
  - Build a rich deck in the test: 500 nodes with `description` (~200 characters), `tech`, 3
    `tags` and 2 `links`, and 1,000 edges with `label` and `protocol`.
  - Load it with `fromJSON` and take `toJSON`.
  - Warm up, then assert that the median of 10 `serializeDeck` runs is < 16 ms (research R2).
  - Add a comment: "if this fails, move serialization to a worker (TODO(perf))".

### App foundations

- [ ] T007 [P] Add two feature detects to `apps/app/src/lib/features.ts` (constitution IV,
      architecture rule 6), with cases in `apps/app/src/lib/features.test.ts`:
  - `supportsClipboardWrite()`: true only when `navigator.clipboard?.writeText` is a function.
    Test: API present, absent, no `navigator`.
  - `supportsResizeObserver()`: true when `typeof ResizeObserver !== 'undefined'`. Test: present
    and absent.
  - `isApplePlatform()` already exists; do not add it again.
- [ ] T008 [P] Create `apps/app/src/state/json-panel-prefs.ts` with a test
      `json-panel-prefs.test.ts`:
  - `JSON_PANEL_KEY = 'sododeck.jsonPanel'`, `DEFAULT_JSON_PANEL = { open: true, height: 212, tab: 'deck' }`.
  - `readJsonPanelPrefs(raw: string | null)` validates **field by field**. Invalid JSON, wrong
    types, an unknown `tab` or a height that is not finite fall back to the default for that
    field.
  - `loadJsonPanelPrefs()` and `saveJsonPanelPrefs(prefs)` wrap `localStorage` in try/catch
    (blocked storage → defaults, and writes are ignored).
  - Tests: every invalid shape, partial objects, and a `localStorage` that throws.
- [ ] T009 Replace `jsonPanelOpen` with the `jsonPanel` slice in `apps/app/src/state/ui-store.ts`
      (depends on T008; data-model.md):
  - State: `jsonPanel: JsonPanelPrefs`, initialised from `loadJsonPanelPrefs()`.
  - Setters `setJsonPanelOpen`, `setJsonPanelHeight` and `setJsonTab`. Each one saves.
  - Keep `toggleJsonPanel()` as a wrapper.
  - Update every `jsonPanelOpen` reader (`rg jsonPanelOpen apps/app/src`).
  - Extend `apps/app/src/state/ui-store.test.ts`:
    - the defaults;
    - each setter updates the store and writes `localStorage`;
    - selecting nodes or edges never changes `jsonPanel.tab` (clarification Q2).

### Pure view models (data-model.md "Derived view models")

- [ ] T010 [P] Create `apps/app/src/editor/line-diff.ts` with a test `line-diff.test.ts`:
  - `lineDiff(oldText, newText)` returns `null` when the texts are equal. Otherwise it returns
    `{ startLine, endLine, text }` (1-based, `endLine` inclusive in the old text) after removing the
    common leading and trailing lines.
  - `toRangeEdit(diff, oldLineCount)` returns a Monaco-shaped `{ range: { startLineNumber, startColumn, endLineNumber, endColumn }, text }`.
    Handle pure insertions, pure deletions and edits at the start or end of the file.
  - Test with a seeded random property check: 200 random line edits on a 50-line text; applying
    the edit to the old text (string helper in the test) gives the new text.
- [ ] T011 [P] Create `apps/app/src/editor/panel-height.ts` with a test `panel-height.test.ts`:
  - `PANEL_MIN = 96`, `CANVAS_MIN = 200`, `PANEL_COLLAPSED = 36`.
  - `clampPanelHeight(requested, available)` keeps the height between `PANEL_MIN` and
    `available − CANVAS_MIN`. If that maximum is below the minimum, it returns the minimum.
  - Tests: below the minimum, above the maximum, a tiny window, `NaN` (→ minimum).
- [ ] T012 [P] Create `apps/app/src/editor/cooldown.ts` with a test `cooldown.test.ts`:
  - `createCooldown(ms, now = Date.now)` returns `() => boolean`: true on the first call, false
    until `ms` has passed, then true again.
  - Tests use an injected clock.
- [ ] T013 Create `apps/app/src/editor/json-panel-view.ts` with a test `json-panel-view.test.ts`
      (depends on T005):
  - `countLines(text)`: `''` → 0; a trailing `\n` is not counted. `lineCountLabel(n)` gives
    "1 line" or "`n` lines".
  - `selectionView(deck, selection)` returns `{ label, fullLabel, entries }` (research R9):
    - nodes first, then edges, each in **deck order** (not click order);
    - missing ids are skipped;
    - labels: node title; edge label; unlabeled edge → "`<from title>` → `<to title>`" (a missing
      title falls back to the id); two or more items → "`n` selected"; none → "Selection".
  - `selectionText(entries)`: `''` for none; `serializeEntry` for one; `serializeEntries` for
    several.
  - `copyToastText(tab, view)`: "Copied Deck JSON", "Copied `<fullLabel>` JSON" or
    "Copied `n` items as JSON".
  - Tests cover each rule, including a mixed selection (3 nodes + 1 edge → a 4-item array, nodes
    first; clarification Q1).

### Viewer (research R3, R6)

- [ ] T014 [P] Create `apps/app/src/editor/monaco-theme.ts` with a test `monaco-theme.test.ts`:
  - `THEME_TOKENS`: the list of CSS variables used, following the R6 table (`--sd-code`,
    `--sd-ink`, `--sd-blue-ink`, `--sd-primary-ink`, `--sd-amber-ink`, `--sd-muted`,
    `--sd-primary-soft`, `--sd-surface-2`).
  - `readThemeTokens(el = document.documentElement)` uses `getComputedStyle`.
  - `buildMonacoTheme(tokens, base: 'vs' | 'vs-dark')` is pure and returns
    `IStandaloneThemeData`, with rules for `string.key.json`, `string.value.json`, `number`,
    `keyword` and `delimiter`, and colors for background, gutter, line numbers, selection and
    current line.
  - Test: load the token file by package name, never by a relative path across packages
    (AGENTS.md): `import tokensCss from '@sododeck/ui/tokens.css?raw'` (the path is exported by
    `packages/ui/package.json`). Parse the light (`:root`) and dark values out of it, the way
    `packages/ui/test/contrast.test.ts` does. Build both themes. Assert that every syntax foreground has ≥ 4.5:1 contrast
    on `--sd-code`, using `@sododeck/ui/lib/contrast`. If a pair fails, report it and pick the
    next ink token. **Do not add a new token without asking.**
- [ ] T015 Update `apps/app/src/editor/monaco-setup.ts`:
  - Add the deep import `monaco-editor/editor/contrib/readOnlyMessage/browser/contribution`,
    next to the other contrib imports.
  - Export `SELECTION_MODEL_PATH = 'sododeck://selection/current.json'`. It must not match the
    schema's `*.sododeck.json` fileMatch.
  - Export a `defineSododeckThemes(monaco)` that calls `monaco.editor.defineTheme('sododeck-light'|'sododeck-dark', buildMonacoTheme(readThemeTokens(), …))`.
- [ ] T016 Rename `apps/app/src/editor/json-editor.tsx` to `apps/app/src/editor/json-viewer.tsx`
      (`git mv`) and rewrite it as the Monaco wrapper (depends on T010, T014, T015). It stays a
      default export for `React.lazy`.
  - **Props**: `{ tab: 'deck' | 'selection'; text: string; ariaLabel: string; onReadOnlyAttempt(): void; onUndo(): void; onRedo(): void }`.
  - **Models**: `path` = `DECK_MODEL_PATH` or `SELECTION_MODEL_PATH` by tab, with
    `saveViewState` on, so each tab keeps its own scroll and folds.
  - **Text**:
    - On mount, and whenever the model for a path is first created, set the initial value.
    - After that, on each `text` change, compute `lineDiff(currentModelText, text)` and apply
      `toRangeEdit` with `model.applyEdits([...])`.
    - **Never** use `setValue` or the `value` prop after the first load.
  - **Options** (R3):
    - `readOnly: true`; `readOnlyMessage: { value: 'Edit on the canvas or in the inspector' }`.
    - Remove `domReadOnly`.
    - `dragAndDrop: false`, `dropIntoEditor: { enabled: false }`, `folding: true`,
      `stickyScroll: { enabled: false }`, `minimap: { enabled: false }`.
    - `renderValidationDecorations: 'on'`, `wordWrap: 'off'`, `ariaLabel`.
    - Keep the existing font and line-height options.
  - **Events**: `editor.onDidAttemptReadOnlyEdit(onReadOnlyAttempt)`.
  - **Commands**:
    - `editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyZ, onUndo)`.
    - `KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ` and `KeyMod.CtrlCmd | KeyCode.KeyY`
      → `onRedo` (R5).
    - Keep the prop callbacks in refs, so the commands always see the latest ones.
  - **Theme**: `defineSododeckThemes` in `beforeMount`. Select `sododeck-dark` or
    `sododeck-light` from `useThemeStore`, and redefine the themes when the theme changes.
  - **Test first**: write `apps/app/src/editor/json-viewer.test.tsx` (constitution VI). jsdom
    cannot run Monaco, so `vi.mock('@monaco-editor/react')` with an `Editor` double.
    - The double calls `beforeMount(fakeMonaco)` and then `onMount(fakeEditor, fakeMonaco)`, and
      renders nothing visible.
    - `fakeEditor` records `addCommand`, `onDidAttemptReadOnlyEdit` and `updateOptions`, and
      `getModel()` returns a fake model that records `applyEdits`/`setValue`. `fakeMonaco` provides
      `KeyMod`, `KeyCode` and `editor.defineTheme`.
    - Mock `./monaco-setup` so the real Monaco is never imported.
    - Assert that:
      - the options include `readOnly: true`, `readOnlyMessage`, no `domReadOnly`,
        `dragAndDrop: false` and the `ariaLabel` prop;
      - firing the recorded read-only listener calls `onReadOnlyAttempt`;
      - running the ⌘Z command calls `onUndo`, and ⇧⌘Z / Ctrl+Y call `onRedo`, and each uses the
        latest prop after a re-render;
      - re-rendering with a new `text` calls `applyEdits` once with `toRangeEdit(lineDiff(…))`,
        and **never** `setValue`; the same `text` makes no call;
      - switching `tab` passes the other model path.
    - The real editor is still covered end to end by the smoke suite and quickstart #10.

**Checkpoint**: the model helpers, prefs, store and pure functions are green; the viewer compiles
(`pnpm typecheck`).

---

## Phase 3: User Story 2 - See the whole deck file, always in sync (Priority: P1) 🎯 MVP

**Goal**: The panel opens on the Deck tab. It shows the exported file text and follows every
change within 250 ms, without slowing the canvas.

**Why first**: both US1 and US2 are P1. Deck is the default tab (clarification Q3) and is what
the smoke suite checks, so it replaces the M0 panel first.

**Independent Test**: With the Deck tab open, add, connect, move, rename, delete, undo and redo.
After each step the text equals `serializeDeck(toJSON(doc))`.

### Tests for User Story 2 ⚠️ (write first, see them fail)

- [ ] T017 [P] [US2] Write `apps/app/src/editor/use-throttled-deck-text.test.ts`, using
      `renderHook` and fake timers, against a real `fromJSON` doc:
  - The first render returns `serializeDeck` of the deck immediately (leading).
  - Five edits within 100 ms produce one more update (trailing) at ≤ 250 ms, and the text equals
    the final export.
  - With `enabled = false`, `serializeDeck` is never called (spy via `vi.mock('@sododeck/model', …)`
    partial).
  - Switching to `enabled = true` computes once, immediately.
- [ ] T018 [P] [US2] Write `apps/app/src/editor/json-panel.test.tsx` (Deck cases).
  - **Setup**: render `JsonPanel` inside 003's `EditorProvider` with a demo doc and
    `ToastProvider`; `vi.mock('./json-viewer')` with the double; fresh `localStorage`.
  - **Cases**:
    - The region "JSON" and the radiogroup "JSON view" are present; "Deck" is checked by default.
    - The status text "Read-only · synced with canvas" is visible.
    - The line count matches `countLines`.
    - After `editor.add('nodes', …)` and timers, the `pre` labelled "Deck JSON, read-only" equals
      `serializeDeck(toJSON(doc))`. The same after `editor.remove(…)`, `editor.undo()` and
      `editor.redo()`.
    - After `useUiStore.getState().select({ nodes: [id] })`, "Deck" is still checked
      (clarification Q2, US2 scenario 5).

### Implementation for User Story 2

- [ ] T019 [US2] Create `apps/app/src/editor/use-throttled-deck-text.ts`
      (`useThrottledDeckText(deck, enabled): string`):
  - Serializes with `serializeDeck` only while enabled.
  - Updates at most once every 250 ms, with a leading and a trailing update (`setTimeout`,
    cleaned up on unmount).
  - Returns the last text. T017 must be green.
- [ ] T020 [US2] Create `apps/app/src/editor/json-panel-header.tsx`, the 40 px header
      (contracts/json-panel-ui.md):
  - lucide `Braces` + "JSON".
  - `SegmentedControl` (`aria-label="JSON view"`) with a Selection item and a "Deck" item, bound
    to `jsonPanel.tab` / `setJsonTab`. For now the Selection item shows "Selection"; US1 fills the
    label.
  - lucide `Lock` (`aria-hidden`) + "Read-only · synced with canvas", in secondary ink.
  - A spacer, the line count (`lineCountLabel`, hidden when 0), and a placeholder slot for Copy
    (filled in US4).
  - The collapse button "Collapse JSON panel" with `aria-expanded`.
  - Match screens 16 and 02 in spacing and typography (tokens `text-code`, `bg-code`,
    `border-hairline`).
- [ ] T021 [US2] Rewrite `apps/app/src/editor/json-panel.tsx` (no props):
  - Get `editor` from `useEditor()`, `deck` from `useDeckSnapshot(editor.doc)`, and `jsonPanel`
    from the UI store.
  - Render `<section aria-label="JSON">` with the header and a lazy `JsonViewer` in `Suspense`
    (keep the "Loading editor…" fallback).
  - The Deck tab text comes from `useThrottledDeckText(deck, open && tab === 'deck')`.
  - Pass `ariaLabel="Deck JSON, read-only"`, `onUndo={() => editor.undo()}` and
    `onRedo={() => editor.redo()}`. For now `onReadOnlyAttempt` is a no-op (filled in US3).
  - Keep the existing collapsed behavior (36 px) until US5. T018 must be green.
- [ ] T022 [US2] Update `apps/app/src/routes/editor-page.tsx`:
  - Remove what 003 added in `EditorLayout`: the `serializeDeck` import, the
    `useDeferredValue(deck)` and the `json` `useMemo`. Keep `useDeckSnapshot`, which the top bar,
    left sidebar, inspector and dialog still use. Remove the `useDeferredValue` import if nothing
    else uses it.
  - Render `<JsonPanel />` with no props inside the existing providers.
  - Then run `pnpm build && pnpm e2e`. The smoke suite must pass **unchanged**: the region
    contains `.monaco-editor`, `https://sododeck.com/schema/v1.json` and `"web-app"`.

**Checkpoint**: US2 works on its own. The Deck tab is the exported file, live. This is the MVP.

---

## Phase 4: User Story 1 - See the selected component as JSON while editing (Priority: P1)

**Goal**: The Selection tab shows the selected component(s) and connection(s) exactly as they
appear in the file. It is labelled from the selection, with an empty state, and it never switches
tabs automatically.

**Independent Test**: On the Selection tab, select, rename, move, edit an edge, multi-select,
deselect and delete. Check the label and text after each step.

### Tests for User Story 1 ⚠️

- [ ] T023 [US1] Add Selection cases to `apps/app/src/editor/json-panel.test.tsx`:
  - Click the "Selection" radio. With nothing selected, the text "Select a component or
    connection to see its JSON." and the button "Show Deck JSON" are shown; there is no `pre` and
    no line count.
  - Select a node → the radio's accessible name is the node title, and the `pre` labelled
    "Selection JSON, read-only" equals `serializeEntry('nodes', node)`.
  - `editor.update('nodes', id, { title: 'Renamed' })` → the label and `"title"` update (US1-1).
  - `editor.update('nodes', id, { position })` → the position values update (US1-2).
  - Select an edge with no label → the name is "A → B"; after an update to its label or protocol
    the text updates (US1-3).
  - Select 3 nodes + 1 edge in click order edge-first → the name is "4 selected" and the text
    equals `serializeEntries` with the nodes first, in deck order (US1-5).
  - `editor.undo()` restores the text. Removing the selected node (then 003's prune) → empty
    state (US1-6).
  - "Show Deck JSON" checks "Deck".
  - Selecting while "Deck" is checked leaves "Deck" checked.

### Implementation for User Story 1

- [ ] T024 [US1] Wire the Selection tab in `apps/app/src/editor/json-panel.tsx`:
  - `view = useMemo(() => selectionView(deck, selection), [deck, selection])` and
    `text = selectionText(view.entries)`. Both are recomputed only while the Selection tab is
    visible and the panel is open.
  - `ariaLabel="Selection JSON, read-only"`.
  - When there are no entries, render the empty state (message + `Button` "Show Deck JSON" →
    `setJsonTab('deck')`) instead of the viewer.
- [ ] T025 [US1] Update the Selection item in `apps/app/src/editor/json-panel-header.tsx`:
  - Visible text is `view.label`, truncated with CSS (`truncate`, a max width), with
    `title={view.fullLabel}` and `aria-label={view.fullLabel}`.
  - Pass the line count for the current tab. T023 must be green.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Understand that the panel is read-only (Priority: P2)

**Goal**: Typing, pasting, cutting and dropping in the panel change nothing. The user gets a hint
at the cursor and a throttled announcement. Undo and redo inside the panel act on the deck.

**Independent Test**: Focus the panel on either tab and try to edit. The text and the deck are
unchanged, and the hint is announced at most once every 3 s.

### Tests for User Story 3 ⚠️

- [ ] T026 [US3] Add read-only cases to `apps/app/src/editor/json-panel.test.tsx`, using fake
      timers and a spy on `useUiStore.getState().announce`:
  - Trigger the double's "read-only attempt" 3 times within 1 s → `announce` is called once with
    "Read-only. Edit on the canvas or in the inspector.". After 3 s, one more attempt → it is
    called again.
  - The deck (`toJSON(doc)`) is unchanged.
  - The status shows its text next to an icon (the `svg` is `aria-hidden`, and the text is
    present).
  - The double's "undo" / "redo" buttons call `editor.undo()` / `editor.redo()`. The deck changes
    accordingly (add a node, undo via the panel → gone).

### Implementation for User Story 3

- [ ] T027 [US3] In `apps/app/src/editor/json-panel.tsx`:
  - Create a cooldown with `useMemo(() => createCooldown(3000), [])`.
  - Pass `onReadOnlyAttempt={() => { if (cooldown()) announce('Read-only. Edit on the canvas or in the inspector.'); }}`.
  - Confirm that the undo/redo wiring from T021 matches research R5. T026 must be green.
- [ ] T028 [US3] Manual check with `pnpm dev`:
  - Type, paste, cut, Backspace, and drop a text file into the Monaco viewer.
  - Confirm that Monaco's read-only message appears at the caret, that nothing changes, and that
    ⌘Z inside the panel undoes the last canvas edit.
  - Write down what you saw in the PR description (quickstart #10).

**Checkpoint**: US3 works; the read-only state is clear by icon and text.

---

## Phase 6: User Story 4 - Copy the JSON (Priority: P2)

**Goal**: Copy puts the text of the current tab on the clipboard and shows a toast. It fails
gracefully and is disabled when there is nothing to copy.

**Independent Test**: Copy on Deck, on one node, on several items and with an empty selection.
Compare the clipboard with the text shown.

### Tests for User Story 4 ⚠️

- [ ] T029 [US4] Add Copy cases to `apps/app/src/editor/json-panel.test.tsx`, stubbing
      `navigator.clipboard.writeText` with `vi.fn().mockResolvedValue(undefined)`:
  - On Deck, clicking "Copy JSON" → called with the exact Deck text, and the toast "Copied Deck
    JSON" is shown.
  - With one node selected on the Selection tab → the exact entry text, and the toast "Copied
    `<title>` JSON".
  - With 4 items selected → "Copied 4 items as JSON".
  - With an empty selection on the Selection tab → the button is disabled.
  - `writeText` rejects → a toast that starts with "Couldn't copy".
  - `navigator.clipboard` is undefined → the same failure toast, and no throw.

### Implementation for User Story 4

- [ ] T030 [US4] Add the Copy button to `apps/app/src/editor/json-panel-header.tsx`:
  - `Button` `variant="ghost"` `size="icon-sm"` `aria-label="Copy JSON"` with lucide `Copy`,
    `disabled` when the current text is `''`.
  - On click:
    - if `supportsClipboardWrite()`, `await navigator.clipboard.writeText(text)` and then
      `toast({ message: copyToastText(tab, view) })`;
    - on failure or no API, `toast({ message: "Couldn't copy — select the text and press ⌘C" })`.
      Use "Ctrl+C" when the existing `isApplePlatform()` from `apps/app/src/lib/features.ts`
      returns false.
  - Pass `text`, `tab` and `view` from `json-panel.tsx`. T029 must be green.

**Checkpoint**: US4 works; nothing leaves the browser.

---

## Phase 7: User Story 5 - Collapse and resize the panel (Priority: P3)

**Goal**: The panel collapses to a 36 px bar, resizes by pointer and keyboard within its limits,
and remembers its state after a reload.

**Independent Test**: Collapse, reload, expand, resize, reload. Check the collapsed state and the
height each time.

### Tests for User Story 5 ⚠️

- [ ] T031 [P] [US5] Write `apps/app/src/editor/json-resize-handle.test.tsx`:
  - `separator` "Resize JSON panel" with `aria-orientation="horizontal"`, and
    `aria-valuenow/min/max` set from the props.
  - ↑ → `onChange(h + 16)`; ↓ → `onChange(h − 16)`; Home → minimum; End → maximum. The values
    are clamped through `clampPanelHeight`.
  - A pointer drag (`pointerdown` at y = 500, `pointermove` to y = 450, `pointerup`) → exactly one
    `onCommit(h + 50)` on release, and no store writes during the move.
  - It is focusable (`tabIndex=0`) and shows a focus ring (the `focusRing` classes are applied;
    assert it is focusable, not the classes).
- [ ] T032 [US5] Add collapse and persistence cases to `apps/app/src/editor/json-panel.test.tsx`:
  - "Collapse JSON panel" → the viewer and header tabs are gone, the bar shows "JSON" and
    "Expand JSON panel" (`aria-expanded=false`), and `localStorage['sododeck.jsonPanel']` has
    `open: false`.
  - A new store from `loadJsonPanelPrefs()` with that value starts collapsed (simulated reload).
  - Expand → the current deck text is shown, including edits made while collapsed (US5-4).
  - A saved height of 300 → the region's inline height is 300 px. A saved height of 5000 with a
    900 px main area → clamped to 700.

### Implementation for User Story 5

- [ ] T033 [P] [US5] Create `apps/app/src/editor/json-resize-handle.tsx`:
  - Props `{ height, available, onChange, onCommit }`.
  - A 6 px strip on the top edge, `role="separator"`, `cursor-row-resize`, `focusRing`.
  - Pointer capture: during a drag, update a local height (passed up with `onChange`, which only
    sets a CSS variable) and call `onCommit` on `pointerup`.
  - Keys as in the contract; each key press commits.
  - T031 must be green.
- [ ] T034 [US5] In `apps/app/src/editor/json-panel.tsx`:
  - **Collapsed**: render the 36 px bar (`Braces` + "JSON" + "Expand JSON panel" with
    `ChevronUp`) to match screen 17.
  - **Expanded**:
    - The height is `clampPanelHeight(jsonPanel.height, available)`.
    - `available` is the parent `main` element's height. Measure it with a `ResizeObserver`
      when `supportsResizeObserver()` (T007) is true, and fall back to the `window` `resize`
      event otherwise.
    - Render the resize handle. `onChange` → a local state or CSS variable; `onCommit` →
      `setJsonPanelHeight`.
  - Header collapse → `setJsonPanelOpen(false)`. T032 must be green.

**Checkpoint**: all five stories work independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T035 Add the bench scenario (research R2, SC-003):
  - In `apps/app/src/routes/bench-page.tsx`, render `JsonPanel` under the canvas when the
    `json=deck` query parameter is set (Deck tab open), inside the same providers the editor
    uses.
  - In `apps/app/bench/perf.bench.ts`:
    - add `{ name: 'jsonDeckOpen', query: '&json=deck' }` to the pan/zoom scenario list;
    - run the existing `drag:` test twice, with `openBench(page, '')` and with
      `openBench(page, '&json=deck')`, reporting the scenarios `drag` and `drag+jsonDeck`. Loop
      over the two queries; do not copy the test body.
  - Run `pnpm bench` and `BENCH_CPU_THROTTLE=4 pnpm bench`. `jsonDeckOpen` must be within 10% of
    `default` fps, and `drag+jsonDeck` within 10% of `drag`.
- [ ] T036 [P] Accessibility pass (constitution VII, contracts/json-panel-ui.md):
  - Keyboard only: tab switch (←/→), code area (select, fold ⌥⌘[ / ⌥⌘], ⌘C, Esc then Tab to
    leave), Copy, resize handle (↑/↓/Home/End), collapse and expand.
  - Visible focus everywhere.
  - Screen reader (VoiceOver): the region "JSON", the radio names, "Deck JSON, read-only", the
    refused-edit announcement and the copy toast.
  - Fix gaps; add component tests for any bug found (write the failing test first).
- [ ] T037 [P] Visual check (SC-008):
  - Screenshot the expanded Deck tab, the Selection tab with a component selected, the empty
    selection and the collapsed bar, in light and dark.
  - Place them next to `docs/design/screens/02`, `16` and `17` in the PR description.
  - Fix differences, or list them. Allowed: the status text and lock icon, DESIGN.md tokens,
    lucide icons.
  - **Ask the founder to confirm the syntax colors (research R6).**
- [ ] T038 [P] Update the docs:
  - `apps/app/CLAUDE.md`:
    - The JSON panel reads the snapshot and gets its text from `@sododeck/model` only.
    - The `sododeck.jsonPanel` key.
    - Viewer notes: two models, minimal edits, no `setValue`, `readOnlyMessage`, undo/redo
      commands.
  - `packages/model/CLAUDE.md`: add `serializeEntry`/`serializeEntries` to the API list.
  - No ADR is needed (plan.md, constitution VIII).
- [ ] T039 Run the full definition of done:
  - `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. The smoke suite passes
    unchanged and in under 30 s.
  - Run the quickstart manual scenarios 1–15 in light and dark.
  - Check that there are no skipped or `.only` tests.
- [ ] T040 Write the final report in the PR description (AGENTS.md "Report"):
  - What changed.
  - Bench before and after (T003 vs T035), including CPU×4.
  - The syntax-color question for the founder.
  - What was skipped (editing, step JSON, group JSON: deferred, TODO(C-5)).
  - What is uncertain.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: needs 003 merged. T001 → T002; T003 can run alongside T002.
- **Foundational (Phase 2)**: needs Setup. Blocks every user story.
- **US2 (Phase 3)**: needs Foundational. This is the MVP, and it replaces the M0 panel.
- **US1 (Phase 4)**: needs US2's `json-panel.tsx` and `json-panel-header.tsx` (T020, T021),
  because it extends the same files.
- **US3 (Phase 5)**, **US4 (Phase 6)**, **US5 (Phase 7)**: each needs US2 only. They touch the
  same `json-panel.tsx`/`json-panel-header.tsx`, so run them one after another, or coordinate
  edits. US4's selection toasts use US1's `view`: if US4 runs before US1, test only the Deck
  cases, then add the selection cases after US1.
- **Polish (Phase 8)**: needs all the stories you want to ship.

### Within Phase 2

- Model: T004 → T005; T006 is independent.
- App: T007, T008, T010, T011, T012 and T014 are parallel. T008 → T009. T005 → T013.
- T010 + T014 → T015 → T016.

### Within each story

The tests (write them and see them fail) → the implementation → the story's tests green → a
commit.

## Parallel Example: Phase 2

```text
Agent A (packages/model):  T004 → T005, T006
Agent B (apps/app, pure):  T010, T011, T012, T007
Agent C (apps/app):        T008 → T009, T014
Then:                      T013 (needs T005), T015 → T016 (needs T010, T014)
```

## Parallel Example: User Story 2

```text
T017 (hook test) ∥ T018 (panel test)  →  T019 (hook) ∥ T020 (header)  →  T021 (panel)  →  T022 (page + smoke)
```

## Parallel Example: User Story 5

```text
T031 (handle test) → T033 (handle)   ∥   T032 (panel collapse/persist test)
then T034 (panel wiring)
```

## Implementation Strategy

### MVP first (User Story 2)

1. Phase 1 → Phase 2 → Phase 3 (US2).
2. **Stop and validate**: the Deck tab equals the export after each edit, the smoke suite is
   green, and the canvas stays smooth. This alone delivers "the diagram is data".

### Incremental delivery

1. - US1 (Selection tab): both P1 stories are done.
2. - US3 (read-only feedback) and US4 (Copy): P2.
3. - US5 (collapse and resize): P3.
4. Polish: bench, accessibility, visuals, docs, DoD, report.

Each story is a small, conventional commit (or a few), and each one is demoable on its own.
