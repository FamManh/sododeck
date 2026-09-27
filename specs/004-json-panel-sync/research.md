# Research: Read-only JSON Panel (004)

Decisions for the plan. 003 (canvas-basic) is not merged yet. Everything here is written against
the 003 spec, plan and contracts, and was checked on 2026-09-27 against the in-progress 003
worktree (`createDeckSnapshot`, `previewRemoval`, `Popover` and the new UI store already exist
there with the names used below). Monaco facts were checked in the installed
`monaco-editor` 0.57 typings (`monaco.d.ts`).

## R1. Where the panel's text comes from

- **Decision**:
  - **Deck tab**: `serializeDeck(snapshot)` from `@sododeck/model`, where `snapshot` is the value
    returned by `useDeckSnapshot(doc)` (backed by 003's `createDeckSnapshot`). This is the exact
    function the export uses, so the text is the file.
  - **Selection tab**: two new additive model exports.
    - `serializeEntry(collection, value)` returns
      `JSON.stringify(canonicalizeEntry(collection, value), null, 2)`, the same canonical key order
      and indentation as `serializeDeck`.
    - `serializeEntries(entries)` does the same for a plain JSON array of entries (several
      selected items).
    - Contract: [contracts/model-additions.md](contracts/model-additions.md).
- **Rationale**: FR-005/FR-008 say "exactly as in the file". Keeping both text functions in the
  model means one owner for the file text (constitution II). The helper is two lines on top of
  the existing `canonicalizeEntry`. It adds no conversion logic, and a test proves that each
  entry's text equals its slice of `serializeDeck` output (after removing the 4-space nesting).
- **Alternatives considered**:
  - `JSON.stringify` in the app: works today because the 003 snapshot entries are already
    canonical, but the app would then depend on a detail it does not own.
  - Cutting the selection out of the Deck text by line ranges: fragile, and it needs the whole
    file even when only the Selection tab is visible.

## R2. Keeping the canvas smooth on large decks

- **Measured (2026-09-27, `main`, Vitest in Node, bench deck 500 nodes / 1,000 edges)**:
  `toJSON` 1.0 ms, `serializeDeck` 0.4 ms, 7,515 lines, 115 KB. A deck with descriptions and tags
  is estimated at 5× that, still under 5 ms.
- **Decision**:
  - **No Web Worker.** Serializing is far below the 16 ms budget. A perf test in
    `packages/model/test` asserts that `serializeDeck` on a rich 500/1,000 deck stays under 16 ms.
    If it ever fails, move serializing to a worker (`TODO(perf)` recorded in the plan). Constitution
    V asks for heavy work off the main thread; this work is not heavy.
  - **Lazy**: no text is computed for a tab that is not visible, or while the panel is collapsed.
  - **Deck tab throttle**: at most one text update every 250 ms, with a leading and a trailing
    update. A drag at 60 fps produces about 4 panel updates per second, and the final state lands
    ≤ 250 ms after the last change (FR-011 allows 0.5 s).
  - **Selection tab**: recomputed on every snapshot or selection change, in the same render
    (the text is tiny). This meets FR-012.
  - **Minimal edits into Monaco**: the panel never calls `setValue` after the first load. A pure
    `lineDiff(oldText, newText)` finds the common leading and trailing lines and returns a single
    replace edit for the middle. It is applied with `model.applyEdits`. Cost is O(lines). Folded
    regions and the scroll position outside the changed range stay as they were (FR-013).
- **Rationale**: the measured cost is small, so the plan avoids the complexity of a worker and a
  message protocol. The expensive part is Monaco re-tokenizing and re-folding, and minimal edits
  keep that proportional to what changed.
- **Alternatives considered**:
  - Worker serialization: not needed at the measured cost (constitution VIII, simplicity).
  - `requestIdleCallback`: not available in Safari.
  - Full `setValue`: resets folding and scroll on every update.
- **Verification**: `pnpm bench` adds a "drag with JSON Deck tab open" scenario. Its frame rate
  must be within 10% of the same drag with the panel collapsed (SC-003).

## R3. The code viewer

- **Decision**: keep the Monaco editor already bundled by M0 (`apps/app/src/editor/monaco-setup.ts`,
  lazy-loaded, no CDN). Changes:
  - **Two Monaco models, one per tab**:
    - `sododeck://deck/current.sododeck.json` for the Deck tab: schema validation and folding, as
      today.
    - `sododeck://selection/current.json` for the Selection tab: this path does not match the
      schema's `fileMatch`, so partial objects never show schema errors.
    - Switching tabs switches the model and restores each tab's scroll and folding
      (`@monaco-editor/react` multi-model `path` + `saveViewState`).
  - **Editor options**:
    - `readOnly: true` and `readOnlyMessage: { value: 'Edit on the canvas or in the inspector' }`
      (the `readOnlyMessage` contribution is imported in `monaco-setup.ts`).
    - `domReadOnly` is **removed**. With it, keystrokes never reach Monaco, so
      `onDidAttemptReadOnlyEdit` cannot fire and the hint cannot appear.
    - `dragAndDrop: false`, `dropIntoEditor: { enabled: false }`.
    - `renderValidationDecorations: 'on'`, since the deck is always valid.
    - `ariaLabel`: `"Deck JSON, read-only"` or `"Selection JSON, read-only"`.
    - `stickyScroll` off, `folding: true`, no minimap.
- **Rationale**: this is the backlog's stated trade-off: folding and virtual rendering for big
  files now, and a cheap switch to editing with C-5 later. It adds no new dependency.
- **Alternatives considered**: a highlighted `<pre>` (would need hand-written folding and
  virtualization); CodeMirror (a new dependency).

## R4. Read-only feedback

- **Decision**: `editor.onDidAttemptReadOnlyEdit` does two things:
  1. Monaco shows its read-only message at the cursor.
  2. The app calls 003's `announce('Read-only. Edit on the canvas or in the inspector.')`, at
     most once every 3 s (pure `createCooldown(ms)`).

  The header always shows a lucide `Lock` icon and the text "Read-only · synced with canvas"
  (FR-020). Paste, cut and drop are covered by `readOnly` and the drag options above.

- **Rationale**: FR-018/FR-019. The throttle keeps screen readers from being flooded.

## R5. Undo and redo while the panel has focus

- **Decision**: register Monaco commands for ⌘/Ctrl+Z → `editor.undo()`, and ⇧⌘Z / Ctrl+Y →
  `editor.redo()`, using 003's `useEditor()` `DeckEditor`. Monaco's own undo stack is always
  empty in read-only mode, so there is nothing to shadow.
- **Rationale**: a spec edge case says undo acts on the deck history. Without these commands,
  Monaco swallows the keys and 003's shortcut handler sees a text field and ignores them.

## R6. Syntax colors

- **Decision**: two Monaco themes, `sododeck-light` and `sododeck-dark`, built at runtime from the
  existing CSS tokens with `getComputedStyle` (Monaco needs hex values). No new token.

  | Monaco scope                                  | Token                                 |
  | --------------------------------------------- | ------------------------------------- |
  | background, gutter                            | `--sd-code`                           |
  | foreground, property keys (`string.key.json`) | `--sd-ink`                            |
  | string values (`string.value.json`)           | `--sd-blue-ink`                       |
  | numbers                                       | `--sd-primary-ink`                    |
  | `true` / `false` / `null`                     | `--sd-amber-ink`                      |
  | punctuation, line numbers                     | `--sd-muted`                          |
  | selection, current line                       | `--sd-primary-soft`, `--sd-surface-2` |

  Themes are redefined when the theme store changes. A unit test checks that each foreground has
  at least 4.5:1 contrast on `--sd-code` in both themes, using the existing
  `@sododeck/ui/lib/contrast`.

- **Rationale**: FR-014 requires highlighting with tokens only. The design frames show near-mono
  code, so the palette uses the muted "ink" family and not the saturated brand colors.
  **Founder visual check requested** in the PR (open point, not blocking).
- **Alternatives considered**: Monaco's built-in `light`/`vs-dark` themes, which is what M0 does
  today (these hard-code colors, against the tokens-only rule); new `--sd-syntax-*` tokens (more
  surface for no gain).

## R7. Panel preferences and resizing

- **Decision**:
  - **UI store**: `jsonPanel: { open, height, tab }` in the Zustand UI store. It replaces
    `jsonPanelOpen` and is persisted in `localStorage` under `sododeck.jsonPanel` as validated JSON
    (try/catch; invalid or missing → `{ open: true, height: 212, tab: 'deck' }`). This follows the
    `sododeck.labels` pattern from 003.
  - **Height rules**: pure `clampPanelHeight(requested, available)`. The minimum is 96 px (40 px
    header plus 3 lines at 19 px). The maximum is `available − 200` px, so the canvas keeps at
    least 200 px. The height is re-clamped when the window resizes.
  - **Resize handle**: a 6 px strip on the panel's top edge with `role="separator"`,
    `aria-orientation="horizontal"`, `aria-valuenow/min/max` and the label "Resize JSON panel".
    - Pointer: drag with pointer capture.
    - Keyboard: ↑/↓ change the height by 16 px, Home = minimum, End = maximum.
    - The height is written to the store on release (or on each key press), not on every
      pointer move. During a drag a local CSS variable follows the pointer.
- **Rationale**: FR-024–FR-026. Pure functions are unit-testable. Using a separator is the WAI-ARIA
  window-splitter pattern.

## R8. Copy

- **Decision**:
  - The Copy button calls `navigator.clipboard.writeText(currentText)`. A new
    `supportsClipboardWrite()` in `apps/app/src/lib/features.ts` checks the API (architecture rule 6).
  - Success toast: "Copied Deck JSON", "Copied Order Service JSON" or "Copied 4 items as JSON".
  - Failure or no API: toast "Couldn't copy — select the text and press ⌘C". On other platforms
    the toast shows Ctrl+C.
  - The button is disabled when the tab has no code.
  - The standard copy shortcut inside Monaco copies the selected text (the clipboard contribution
    is already imported).
- **Rationale**: FR-021–FR-023. Nothing leaves the browser; the clipboard is local.

## R9. Selection tab label and content

- **Decision**: pure `selectionView(deck, selection)` returns `{ label, fullLabel, entries }`.
  - `entries` are the selected nodes in deck order, then the selected edges in deck order
    (clarification Q1). Ids that are missing from the snapshot are skipped; 003 prunes them anyway.
  - `label`:
    - one node → its title;
    - one edge → its label, or "Source → Target" titles when it has no label;
    - two or more → "`n` selected";
    - none → "Selection".
  - The label is truncated with CSS and the full text is in `title` and `aria-label`.
- **Rationale**: FR-003, FR-005–FR-007. The function is pure, so each rule gets a unit test.

## R10. Shell integration and 003 hooks

- **Decision**:
  - `JsonPanel` gets the editor from `useEditor()` (the `DeckEditor` carries `.doc`), the
    snapshot from `useDeckSnapshot(editor.doc)`, and the selection from the UI store.
  - `EditorPage` stops serializing the deck itself. Since 003 it re-serializes the whole deck on
    every change, deferred by one frame (`useDeferredValue(deck)` + `useMemo(serializeDeck)`),
    and passes the text to `JsonPanel` as `json`. That code is removed. The panel reads the
    snapshot directly, so serializing happens only when the Deck tab is visible, throttled (R2).
  - The region stays `aria-label="JSON"` with `.monaco-editor` inside, and the default tab is
    Deck (clarification Q3). So the smoke checks for `https://sododeck.com/schema/v1.json` and
    `"web-app"` keep passing without edits.
- **Checked against `main` after 003 merged (`7b845bc`, 2026-09-27)**:

  | Name                                                                        | Where                                                         | Status                                                               |
  | --------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
  | `EditorProvider({ doc })`                                                   | `apps/app/src/model/editor-context.tsx`                       | ✅                                                                   |
  | `useEditor(): DeckEditor` (with `.doc`), `useHistory()`                     | `apps/app/src/model/use-editor.ts`                            | ✅ (in `use-editor.ts`, not `editor-context.tsx`)                    |
  | `useDeckSnapshot(doc)`, `readDeck(doc)`                                     | `apps/app/src/model/use-deck-snapshot.ts`                     | ✅                                                                   |
  | `selection`, `select`, `announce(text)`, `jsonPanelOpen`, `toggleJsonPanel` | `apps/app/src/state/ui-store.ts`                              | ✅                                                                   |
  | `canonicalizeEntry(field, value)`                                           | `packages/model/src/key-order.ts`                             | ✅ (not exported from the package index; used inside the model only) |
  | `ToastProvider`, `Toaster`, `useToast()` → `{ toast, dismiss }`             | `@sododeck/ui/components/toast`; mounted in `editor-page.tsx` | ✅                                                                   |
  | `isApplePlatform()`                                                         | `apps/app/src/lib/features.ts`                                | ✅ already exists (reuse it for the ⌘C / Ctrl+C toast)               |
  | `drag:` bench test (`openBench(page, query)`)                               | `apps/app/bench/perf.bench.ts`                                | ✅ separate test next to the pan/zoom scenarios                      |
  | `@sododeck/ui/tokens.css`                                                   | `packages/ui/package.json` exports                            | ✅ importable with `?raw` in tests                                   |
