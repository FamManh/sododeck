# Implementation Plan: Inspectors and Rules

**Branch**: `008-inspector-rules` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-inspector-rules/spec.md` (clarified 2026-09-27, 4 answers)

**Dependency**: 006 (flow authoring) is merged on `main` (`96bd929`). Its names were re-checked after the merge (research header): `analyzeFlow`, `PathStep`, `ActiveFlow`, `setActiveFlow` / `setActiveStep`, `requestRemoval`, `removeTarget`, `useSortableList`, `lib/menu-kit.ts` all match. 006 also added pieces 008 builds on instead of duplicating: the `FlowInspector` router, `InspectorFrame`, `TextareaEdit` and an `owners(deck)` helper. 007 is not needed.

## Summary

Turn the inspector column into the knowledge layer (K-1), add bulk edit of components (C-6), and add a shared decision-table rule editor with a test panel (K-2, §g-6). All of it goes through the existing model, and there is no file-format change.

- **Model** (`packages/model`):
  - Pure `parseCell`, `matchCell`, `evaluateRule`, `ruleChecks` and `ruleUsage`. The cell grammar and Unique semantics are recorded in ADR 0009.
  - New ops `attachRule` / `detachRule` (detaching from a step drops its sample inputs in the same transaction) and `setRuleInputs`.
  - `RemovalTarget` gains a `rules` scope.
- **UI kit** (`packages/ui`), all with no new dependency:
  - `Combobox` (free-text and pick modes) on Radix Popover.
  - An in-house `parseMarkdown` and `MarkdownView` (paragraphs, bullets, inline code; React elements only, never HTML).
  - `TagInput` suggestions and a partial `TagChip` variant.
- **App** (`apps/app`):
  - Shared field components in `editor/fields/`:
    - a live `FieldEdit`: saves while typing, one undo step per focus session (R4)
    - `MarkdownField`, `OwnerField`, `TagsField`, `LinksField`, `AttachedRules`
  - Per-type inspectors in `editor/inspector/`: component (with Kind and Group), connection, deck and bulk, reusing 006's `InspectorFrame`. 006's flow and step inspectors are extended with the new fields and the step's rule card.
  - A nested route `/deck/:deckId/rules/:ruleId?`. The rule editor lives in `editor/rules/`: decision-table list, ARIA grid table, test panel, used-in list, checks.
  - The top bar gets a Rules entry.
  - `showUndoToast` is extracted for rows, columns and detach.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed:

- `yjs` 13.6
- `react-router` ^8.4 (nested child routes)
- `zustand` 5
- `@xyflow/react` 12.12 (viewport restore only)
- `radix-ui` (Popover, for `Combobox`)
- `lucide-react`: `Table2`, `Link2`, `ExternalLink`, `Tag`, `Plus`, `X`, `Check`, `CircleAlert`, `TriangleAlert`, `GripVertical`, `MoreHorizontal`, `ArrowLeft`, `Paperclip`, `Unlink`
- `@sododeck/ui`: `Input`, `Textarea`, `Select`, `SegmentedControl`, `Switch`, `TagChip`, `TagInput`, `Popover`, `Dialog`, `DropdownMenu`, `SearchField`, `PanelSection`, `Tooltip`, `useToast`, `MOTION`, `focusRing`

No markdown library (research R3) and no combobox library (R5).

**Storage**: none new. Document data goes through `@sododeck/model` into the Yjs deck. Autosave and tab sync come from 005 unchanged. UI-only state goes in `useUiStore`: `ruleTest`, `canvasViewport` and `descriptionMode`.

**Testing**:

- **Vitest (`packages/model`)**:
  - `rules-evaluate`, `rule-links`, `rule-usage` (new)
  - round-trip, preview and undo additions
- **Vitest (`packages/ui`)**:
  - `markdown` (parser)
  - `markdown-view` (no HTML injection)
  - `combobox` (keyboard, ARIA, free/pick)
  - `tag-input` suggestions, partial `tag-chip`
  - the existing contrast and keyboard a11y suites
- **Vitest (`apps/app`)**, pure functions:
  - `parseLinkInput`
  - `derive.ts` (owners, tags, usage, summary, stats, `bulkView`)
  - `useLiveField` gesture lifecycle
  - `showUndoToast`
- **Testing Library**, by role and label, per the [UI contract](contracts/inspector-rules-ui.md):
  - each inspector
  - bulk Mixed and partial tags
  - attach popover and step rule card
  - rule editor grid keys, test panel, used in, checks
  - delete-rule dialog
  - route and back navigation
- **E2E**: the existing smoke suite only (constitution VI).
- **Bench**: `pnpm bench` before and after. Bulk edit and reattach change canvas data.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox and Safari; desktop 1440×900 reference; offline.

**Project Type**: Web SPA (`apps/app`) plus internal packages (pnpm/Turborepo monorepo).

**Performance Goals**:

- A field edit reaches the canvas, outline and JSON panel in < 100 ms at 500 components / 1,000 connections (SC-001).
- Evaluation updates within 100 ms for a 50-row rule (SC-003).
- A bulk edit of 20 components is one transaction.
- Pan and zoom stay at 60 fps, within 5 % of `main`.

**Constraints**:

- No duplicated document state. Test inputs are UI-only by spec.
- No network. Links open only on user activation.
- Markdown never rendered as HTML.
- Keyboard-operable, and no state by color alone.
- Tokens only.
- Canvas keys stay in `use-canvas-shortcuts.ts`.
- `packages/ui` stays presentational.

**Scale/Scope**:

- Up to ~50 rules per deck, ~10 columns and ~50 rows per rule, 500 components.
- About 30 new app files, 5 new model files and 4 new UI files.
- One ADR (0009).

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes, with no justified exceptions._

| Principle                        | Status | How                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Single source of truth        | ✅     | Every field writes through `DeckEditor` while typing (R4). No drafts or copies are kept outside a focused input's text. The UI store holds only UI state: the rule editor's test values (UI-only by spec), viewport and Write/Preview choice. Suggestions, usage, evaluation and Mixed are derived from the snapshot.          |
| II. Schema-owned format          | ✅     | No schema change (R1). The model stays the only Yjs ↔ JSON code. The new ops and pure functions get tests, and a round-trip case covers rules on nodes and steps, `ruleInputs`, tags and links.                                                                                                                                |
| III. Stable identity             | ✅     | Rules, columns and rows keep their generated ids. Attachments and sample inputs reference ids. Renaming a rule or a column is tested not to break usage or sample inputs. Step numbers are derived.                                                                                                                            |
| IV. Local-first, private         | ✅     | No network and no new assets. Markdown is rendered in-house with no HTML. Links are limited to http, https and relative paths, and open only on click. The smoke no-third-party check is unchanged.                                                                                                                            |
| V. Performance                   | ✅     | Evaluation is O(rows × columns), memoized per rule object. Bulk edit is one `batch`. The inspector is off the canvas render path. No heavy work, so no worker. Bench runs before and after.                                                                                                                                    |
| VI. Strict types, tested         | ✅     | Pure modules are unit-tested (grammar table, hit policies). Component tests go by role and label per the UI contract. Model op, undo and preview tests are included. No new e2e.                                                                                                                                               |
| VII. Accessible                  | ✅     | ARIA grid for the table (arrows, Enter/F2, Esc, ⌥↑↓, ⌫). The combobox follows the WAI-ARIA pattern. Matched row is marked by icon, bold number and `aria-selected`. Mixed uses italic plus an accessible description. Partial tags are dashed with "k/n". Invalid cells have an icon and text. Results are announced politely. |
| VIII. Simplicity, justified deps | ✅     | No new dependency: markdown, combobox and grid are in-house and small. No new model op where `batch`/`update` suffice (bulk edit). The three new ops exist to enforce the `ruleInputs` invariant in one place. ADR 0009 records the evaluation semantics.                                                                      |

## Project Structure

### Documentation (this feature)

```text
specs/008-inspector-rules/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R12
├── data-model.md        # Phase 1: fields edited, derived rule types, UI state
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── model-additions.md       # @sododeck/model additions
│   └── inspector-rules-ui.md    # user-visible contract (roles, labels, text)
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/model/
├── src/rules/cells.ts                 # NEW parseCell, matchCell
├── src/rules/evaluate.ts              # NEW evaluateRule, ruleChecks
├── src/rules/usage.ts                 # NEW ruleUsage (uses 006 analyzeFlow)
├── src/ops/rule-links.ts              # NEW attachRule, detachRule, setRuleInputs
├── src/preview.ts                     # RemovalTarget 'rules' (+ removeTarget)
├── src/editor.ts, src/index.ts        # wire + export
└── test/{rules-evaluate,rule-links,rule-usage}.test.ts  # NEW
    test/{round-trip,preview,undo}.test.ts               # + cases

packages/ui/
├── src/lib/markdown.ts                # NEW parseMarkdown (pure)
├── src/components/markdown-view.tsx   # NEW React-element renderer
├── src/components/combobox.tsx        # NEW free / pick combobox on Radix Popover
├── src/components/tag-input.tsx       # + suggestions prop
├── src/components/tag-chip.tsx        # + partial variant (dashed, "k/n")
└── test/…                             # tests for each + contrast/keyboard suites

apps/app/src/
├── app/router.tsx                     # /deck/:deckId children: index (canvas), rules/:ruleId?
├── routes/editor-page.tsx             # EditorShell wraps <Outlet/>; dialog, announcer, shortcuts at shell level
├── state/ui-store.ts                  # + ruleTest, canvasViewport, descriptionMode
├── lib/links.ts                       # NEW parseLinkInput
├── editor/undo-toast.ts               # NEW showUndoToast (extracted from confirm-delete-dialog)
├── editor/fields/                     # NEW shared fields
│   ├── use-live-field.ts              # gesture-per-focus live writes (R4)
│   ├── textarea-edit.tsx              # moved from editor/flows (006), live writes
│   ├── markdown-field.tsx, owner-field.tsx, tags-field.tsx, links-field.tsx
│   ├── attached-rules.tsx             # node list + step rule cards, attach popover
│   ├── rule-card.tsx, attach-rule-popover.tsx
│   └── edge-choices.ts                # PROTOCOLS, DIRECTIONS (moved from edge-popover.tsx)
├── editor/field-edit.tsx              # uses useLiveField (006 fields benefit too)
├── editor/inspector.tsx               # keeps 006's FlowInspector branch; CanvasInspector routes node / edge / bulk / deck
├── editor/inspector/                  # NEW
│   ├── inspector-frame.tsx            # moved from editor/flows (006)
│   ├── node-inspector.tsx, edge-inspector.tsx, deck-inspector.tsx, bulk-inspector.tsx
│   └── derive.ts                      # ownerSuggestions, tagSuggestions, edgeUsage, flowSummary,
│                                      #   nodeConnections, deckStats, bulkView
├── editor/flows/inspector-flow.tsx    # (006) + tags, links, markdown, OwnerField (replaces datalist + owners()), summary
├── editor/flows/inspector-step.tsx    # (006) + owner, edge, tags, links, markdown, AttachedRules
├── editor/rules/                      # NEW rule editor screen
│   ├── rules-page.tsx                 # three-column layout, empty state
│   ├── rule-list.tsx, rule-header.tsx
│   ├── decision-table.tsx, use-grid-keys.ts, cell-editor.tsx, column-menu.tsx
│   ├── test-panel.tsx, used-in.tsx, rule-checks.tsx
│   └── use-rule-sync.ts               # fall back when the rule is removed (any origin)
├── editor/top-bar.tsx                 # Rules link / Back to canvas
├── editor/edge-popover.tsx            # import shared edge choices
├── editor/confirm-delete-dialog.tsx, describe-removal.ts  # rules scope text; use showUndoToast
├── editor/use-canvas-shortcuts.ts     # canvas-only keys scoped to the canvas screen
└── editor/canvas.tsx                  # save/restore viewport in ui-store

docs/decisions/0009-decision-table-evaluation.md   # NEW ADR
apps/app/CLAUDE.md, packages/model/CLAUDE.md, packages/ui/CLAUDE.md  # boundaries/APIs
```

**Structure Decision**:

- `model` owns rule semantics and invariants.
- `ui` gains three presentational pieces.
- The app gets two new folders: `editor/inspector/` (non-flow inspectors) and `editor/rules/` (the rule editor screen). Shared fields go in `editor/fields/`.
- 006's flow and step inspectors stay in `editor/flows/` and are extended in place.
- Shared editor files are touched only at their extension points: routing, shell, top bar, inspector router, delete dialog, shortcuts and viewport.

### Merge hot spots with 006

These files are changed by both features:

- `inspector.tsx`
- `flows/inspector-flow.tsx`, `flows/inspector-step.tsx`
- `field-edit.tsx`
- `ui-store.ts`
- `confirm-delete-dialog.tsx`, `describe-removal.ts`
- `use-canvas-shortcuts.ts`
- `edge-popover.tsx`
- `top-bar.tsx`
- `routes/editor-page.tsx`
- `preview.ts`, `editor.ts`, `index.ts` (model)

006 is merged, so these are ordinary edits; branch from the latest `main`.

## Implementation order (for /speckit-tasks)

1. **Foundation (model + ui)**:
   - ADR 0009.
   - `rules/*` pure functions with the grammar table tests.
   - `rule-links` ops.
   - `RemovalTarget.rules`.
   - Round-trip, preview and undo cases.
   - `parseMarkdown` + `MarkdownView`.
   - `Combobox`.
   - `TagInput` suggestions and the partial `TagChip`.
2. **App foundation**:
   - `useLiveField` + `FieldEdit` upgrade.
   - `parseLinkInput`.
   - `derive.ts`.
   - `showUndoToast` extraction.
   - Shared fields.
   - Inspector router.
3. **Story 1 (P1)**: component and connection inspectors (reattach, used in flows, connections list), shared edge choices, bench before.
4. **Story 2 (P1)**: flow and step inspector extensions (006 files), and the deck inspector (its Rules stat stays disabled until the route exists in story 4).
5. **Story 3 (P2)**: bulk inspector.
6. **Story 4 (P2)**:
   - nested route, shell refactor, top-bar entry, viewport restore
   - rule list and header
   - decision-table grid (cells, columns, rows, keys, sortable rows)
   - delete-rule dialog
7. **Story 5 (P2)**: attach popover, node rules list, step rule card with sample inputs and evaluation, "Edit rule" → test prefill.
8. **Story 6 (P3)**: test panel (Unique ambiguity, Collect), "Save as step inputs", used in, checks, `use-rule-sync`.
9. **Wrap-up**:
   - docs (`CLAUDE.md` files)
   - visual check against frames 02, 04, 10, 18, 23, 28, 29, 49–51 and 58 (light and dark)
   - bench after
   - full definition-of-done run

## Complexity Tracking

No constitution violations. Two items are noted for review:

- The live-field gesture (R4) changes `FieldEdit` behavior for 003's and 006's fields too. Commit-on-blur becomes save-while-typing, which matches 006 FR-018a and 008 FR-002. Their existing tests must keep passing, and one test is added for the gesture lifecycle.
- The shell refactor for the nested route (R8) moves `ConfirmDeleteDialog`, `Announcer`, `useEditorShortcuts` and `useFlowSync` above the outlet; `useFlowShortcuts` stays on the canvas screen. Canvas-only keys are gated so the rule editor doesn't delete canvas selections.
