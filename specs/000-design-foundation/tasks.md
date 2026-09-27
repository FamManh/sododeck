---
description: 'Task list for 000-design-foundation'
---

# Tasks: Design Foundation (shared visual building blocks)

**Input**: Design documents from `specs/000-design-foundation/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/components.md](contracts/components.md),
[quickstart.md](quickstart.md)

**Tests**: Required. Spec FR-027 and constitution VI demand behavior tests (Testing Library, by
role/label) for every component and unit tests for every pure function. Write each story's tests
first and see them fail. **No new Playwright e2e specs** (constitution VI, TODO(e2e)).

**Organization**: Tasks are grouped by user story (spec.md US1–US6) so each can be implemented and
reviewed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US6 from spec.md
- Paths are repo-relative. `ui/` below always means `packages/ui/`; it is written out in full in
  each task.

## Rules that apply to every task

- Follow `packages/ui/CLAUDE.md`: one component per kebab-case file, named exports, `data-slot`,
  `cva` + `cn`, props extend the native element / Radix primitive, **tokens only** (no hex/rgb,
  no Tailwind palette colors, no arbitrary color values, no `dark:`).
- Radix primitives come from the existing `radix-ui` package (`import { Dialog } from 'radix-ui'`).
  **Do not add any dependency.**
- Every interactive element uses the shared focus style `focusRing` from
  `packages/ui/src/lib/focus.ts` (T006).
- Tests live in `packages/ui/test/`, import from `../src/...`, query by role/label, drive the
  keyboard with `@testing-library/user-event`.
- Commit after each task or logical group with Conventional Commits (`feat(ui): …`,
  `test(ui): …`, `feat(app): …`, `docs: …`). No AI attribution trailers.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: branch, package export and test environment.

- [x] T001 Create and switch to branch `000-design-foundation` from `main` (`git switch -c 000-design-foundation`); run `pnpm install && pnpm --filter @sododeck/ui test` to confirm a green baseline
- [x] T002 Add `"./hooks/*": "./src/hooks/*.ts"` to `exports` in `packages/ui/package.json` (the `hooks` alias already exists in `packages/ui/components.json`)
- [x] T003 Extend `packages/ui/test/setup.ts` with jsdom stubs needed by Radix Select/Popover/Toast: `Element.prototype.hasPointerCapture` (returns false), `setPointerCapture`/`releasePointerCapture` (no-op), `Element.prototype.scrollIntoView` (no-op), and a `window.matchMedia` stub returning `{ matches: false, addEventListener, removeEventListener, … }` unless a test overrides it; keep the existing `ResizeObserver` stub and `afterEach(cleanup)`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tokens, shared helpers, enforcement tests and the gallery shell. Every story depends
on this phase.

**⚠️ CRITICAL**: no story work until this phase is done.

- [x] T004 Add new tokens to `packages/ui/src/styles/tokens.css` per data-model.md: on `:root` `--sd-dur-dim: 250ms`, `--sd-dur-ring: 200ms`, `--sd-flow-token-loop: 1400ms`, `--sd-flow-step: 1700ms`, `--sd-toast: 2600ms`, `--sd-ease: ease`, `--sd-shadow-tour: rgba(0, 0, 0, 0.25)`; on `.dark` `--sd-shadow-tour: rgba(0, 0, 0, 0.6)`; then an `@media (prefers-reduced-motion: reduce) { :root { --sd-dur-dim: 0ms; --sd-dur-ring: 0ms; --sd-flow-token-loop: 0ms; } }` block (leave `--sd-flow-step` and `--sd-toast` unchanged, with a comment explaining they are reading time)
- [x] T005 Add to the `@theme inline` block in `packages/ui/src/styles/theme.css`: `--radius-segment: 7px`, `--radius-row: 8px`, `--radius-banner: 14px`, `--shadow-hover: 0 4px 16px var(--sd-shadow)`, `--shadow-tour: 0 12px 32px var(--sd-shadow-tour)`; and register `segment`, `row`, `banner` under `radius` and `hover`, `tour` under `shadow` in the tailwind-merge config in `packages/ui/src/lib/utils.ts`; add a `cn` test case in `packages/ui/test/components.test.tsx` (`cn('rounded-row', 'rounded-banner')` → `'rounded-banner'`, `cn('shadow-rest', 'shadow-tour')` → `'shadow-tour'`)
- [x] T006 [P] Create `packages/ui/src/lib/focus.ts` exporting `focusRing = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'` with a comment citing research.md R5 (primary vs surface = 3.14:1; the soft halo fails 3:1 so it is selection-only)
- [x] T007 [P] Write `packages/ui/test/motion.test.ts` (fails first): `MOTION` equals `{ dimMs: 250, ringMs: 200, tokenLoopMs: 1400, stepMs: 1700, toastMs: 2600 }`; `resolveMotion(true)` returns 0 for dim/ring/tokenLoop and keeps stepMs 1700 and toastMs 2600; and parse `packages/ui/src/styles/tokens.css` (via `node:fs` + regex) to assert the CSS default and reduced-motion values equal the TS values
- [x] T008 [P] Create `packages/ui/src/lib/motion.ts`: `interface Motion`, `MOTION` (readonly, `as const satisfies Motion`) and pure `resolveMotion(reduced: boolean): Motion`; make T007 pass
- [x] T009 [P] Write `packages/ui/test/use-reduced-motion.test.tsx`: with a controllable `matchMedia` mock, the hook returns `false`, then `true` after firing a `change` event (inside `act`); unsubscribes on unmount; returns `false` when `window.matchMedia` is undefined
- [x] T010 [P] Create `packages/ui/src/hooks/use-reduced-motion.ts` (`useReducedMotion`) using `useSyncExternalStore` over `matchMedia('(prefers-reduced-motion: reduce)')` with a `false` server snapshot and a guard for missing `matchMedia`; make T009 pass
- [x] T011 [P] Write `packages/ui/test/tokens-only.test.ts`: read every `*.tsx` in `packages/ui/src/components/` and fail (naming file + match) on `#[0-9a-fA-F]{3,8}\b`, `\b(rgb|rgba|hsl|hsla|oklch)\(`, Tailwind palette colors `\b(bg|text|border|ring|fill|stroke|outline|from|to|via|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-\d{2,3})?\b`, arbitrary colors `-\[(#|rgb|hsl)`, arbitrary radii `rounded-\[`, and the `dark:` variant; it must pass against today's files once T012 lands
- [x] T012 Replace `rounded-[7px]` with `rounded-segment` in the `icon-sm` size of `packages/ui/src/components/button.tsx` so T011 passes
- [x] T013 [P] Write `packages/ui/test/contrast.test.ts` for the pure function only: `contrastRatio('#ffffff', '#000000')` ≈ 21, `('#f2661c', '#ffffff')` ≈ 3.14 (±0.01), symmetric in its arguments, accepts 3- and 6-digit hex, throws on invalid input
- [x] T014 [P] Create `packages/ui/src/lib/contrast.ts` exporting pure `contrastRatio(a: string, b: string): number` (WCAG 2.1 relative luminance); make T013 pass
- [x] T015 Create the dev-only gallery shell: add to `apps/app/src/app/router.tsx` a route `{ path: '/design', lazy: async () => ({ Component: (await import('../routes/design-gallery-page')).DesignGalleryPage }) }` spread into the array **only when `import.meta.env.DEV`** (before the `*` route, with a comment: dev-only, FR-026); create `apps/app/src/routes/design-gallery-page.tsx` with an `<h1>Design gallery</h1>`, a light/dark toggle using `useThemeStore` from `apps/app/src/theme/theme-store.ts`, and an empty `<main>` where sections are appended by later tasks (each section: `<section aria-labelledby>` with an `h2`)
- [x] T016 Run `pnpm --filter @sododeck/ui test && pnpm --filter @sododeck/ui typecheck && pnpm --filter @sododeck/app typecheck && pnpm lint` — all green before starting stories

**Checkpoint**: tokens, `focusRing`, motion constants, `useReducedMotion`, enforcement tests and `/design` shell exist.

---

## Phase 3: User Story 1 - Consistent core controls in both themes (Priority: P1) 🎯 MVP

**Goal**: buttons (all six variants), text input, inline edit, textarea, select, search field,
segmented control and switch, matching the design in light and dark.

**Independent Test**: open `/design` in light then dark and compare with
`docs/design/screens/02-editor-node-selected-light.png`, `14-editor-palette-tab-light.png`,
`06-export-json-light.png`; component tests for US1 pass.

### Tests for User Story 1 (write first, confirm they fail)

- [x] T017 [P] [US1] Extend `packages/ui/test/components.test.tsx` Button cases: `variant="chip"` renders with `data-variant="chip"`; `variant="toggle" pressed` exposes `aria-pressed="true"` and `pressed={false}` → `"false"`; a pressed toggle renders an `svg` check icon and an unpressed one renders none; non-toggle variants have no `aria-pressed`; disabled button ignores click and Enter; Space and Enter activate a focused button
- [x] T018 [P] [US1] Write `packages/ui/test/input.test.tsx`: `getByRole('textbox', { name })` via `<label>`; typing updates value; `invalid` sets `aria-invalid="true"` and renders an error icon, a valid input renders none; disabled input cannot be typed into
- [x] T019 [P] [US1] Write `packages/ui/test/inline-edit.test.tsx`: textbox with accessible name from `label`; type + Enter calls `onCommit` with the new value; type + Esc restores the original value and does not call `onCommit`; blur commits
- [x] T020 [P] [US1] Write `packages/ui/test/textarea.test.tsx`: textbox (multiline) by label; typing updates value
- [x] T021 [P] [US1] Write `packages/ui/test/select.test.tsx`: `getByRole('combobox', { name })`; keyboard open (Enter/Space/ArrowDown), ArrowDown + Enter selects the next option and calls `onValueChange`; Esc closes without change; disabled trigger does not open
- [x] T022 [P] [US1] Write `packages/ui/test/search-field.test.tsx`: `getByRole('searchbox', { name })`; `shortcut="⌘K"` is visible text and `aria-hidden`; Esc calls `onClear` when provided
- [x] T023 [P] [US1] Write `packages/ui/test/segmented-control.test.tsx`: group of radio-like items (Radix ToggleGroup single: `role="group"` with buttons having `aria-pressed`, or `role="radio"` per Radix version — assert by accessible name); ArrowRight moves focus and Space/Enter selects; clicking the active item does **not** clear the value (never empty)
- [x] T024 [P] [US1] Write `packages/ui/test/switch.test.tsx`: `getByRole('switch', { name })`; Space toggles `aria-checked` and calls `onCheckedChange`; disabled switch does not toggle

### Implementation for User Story 1

- [x] T025 [US1] Extend `packages/ui/src/components/button.tsx`: add `chip` variant (24–26 px pill: `rounded-full bg-surface-2 text-ink-secondary hover:bg-surface-3 hover:text-ink`, size `chip` = `h-6.5 px-2.5 text-body-sm`), `toggle` variant (`secondary` look; when `pressed` → `bg-primary-soft border-primary text-primary-ink`, per DESIGN.md `button-toggle-active`; pressed also renders a leading lucide `Check` icon (size 14, stroke 1.5, `aria-hidden`) and uses `font-semibold`, so the state is not shown by color alone, FR-024), optional `pressed?: boolean` prop rendered as `aria-pressed` only for `variant="toggle"`, and replace the `focus-visible:ring-*` classes with `focusRing` (T006); make T017 pass
- [x] T026 [P] [US1] Create `packages/ui/src/components/input.tsx` (`Input`): 36 px (`h-9`), `rounded-input`, `border border-border bg-surface px-[11px] text-body text-ink placeholder:text-ink-muted`, focus `border-primary` + `focusRing`, `invalid` → `aria-invalid="true"` + `border-clay-ink` + a trailing lucide `CircleAlert` in `text-clay-ink` (`aria-hidden`) inside a relative wrapper with `pr-8` (non-color cue, FR-024), disabled styles; make T018 pass
- [x] T027 [P] [US1] Create `packages/ui/src/components/inline-edit.tsx` (`InlineEdit`): transparent input, `border border-transparent hover:border-border focus:border-primary`, `focusRing`, local draft state only for the in-progress edit (committed value is owned by caller), required `label` → `aria-label`, Enter/blur → `onCommit(draft)`, Esc → reset draft and blur; make T019 pass
- [x] T028 [P] [US1] Create `packages/ui/src/components/textarea.tsx` (`Textarea`): `font-mono text-code-md` — add `--text-code-md: 12.5px` and `--text-code-md--line-height: 1.55` to `packages/ui/src/styles/theme.css` and `code-md` to the `text` list of the merge config in `packages/ui/src/lib/utils.ts`, `rounded-input border border-border bg-surface resize-y`, focus like Input; make T020 pass
- [x] T029 [P] [US1] Create `packages/ui/src/components/select.tsx` (`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`) on Radix Select: 36 px trigger styled like Input with a lucide `ChevronDown`, content `rounded-card bg-surface shadow-float border border-border`, item `rounded-row` with `data-[highlighted]:bg-surface-2` and a `Check` indicator for the selected item; make T021 pass
- [x] T030 [P] [US1] Create `packages/ui/src/components/search-field.tsx` (`SearchField`): wrapper `rounded-input bg-surface-2` with leading lucide `Search` (stroke 1.5), borderless `input type="search"` with `aria-label={label}`, placeholder `text-ink-secondary` (research R5: muted fails 4.5:1 on surface-2), optional trailing `<kbd aria-hidden>` with `shortcut` in `text-ink-secondary`, focus outline on the wrapper via `focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary` (the input itself gets `outline-none`), Esc → `onClear?.()`; make T022 pass
- [x] T031 [P] [US1] Create `packages/ui/src/components/segmented-control.tsx` (`SegmentedControl`, `SegmentedControlItem`) on Radix ToggleGroup `type="single"`: track `rounded-button bg-surface-2 p-0.5`, item `rounded-segment text-ink-secondary`, active `bg-surface text-ink shadow-rest font-medium` (weight is the non-color cue), `focusRing` on each item, ignore empty `onValueChange('')` so a value is always selected; make T023 pass
- [x] T032 [P] [US1] Create `packages/ui/src/components/switch.tsx` (`Switch`) on Radix Switch: 32×18 track `rounded-full bg-surface-3 data-[state=checked]:bg-primary`, 14 px thumb `bg-surface shadow-rest` translating on checked with `transition-transform duration-[var(--sd-dur-ring)]`, `focusRing`; make T024 pass
- [x] T033 [US1] Add `apps/app/src/design-gallery/buttons-section.tsx` (every Button variant × size × state: rest, disabled, toggle pressed/unpressed, icon-only with `aria-label`) and `apps/app/src/design-gallery/fields-section.tsx` (Input rest/invalid/disabled, InlineEdit, Textarea, Select, SearchField with and without `⌘K`, SegmentedControl 2 and 3 items, Switch on/off/disabled, each with a visible label); both sections include a "States" row per control with static hover and focus samples (render the hover/focus classes on an element marked `data-demo-state`, never by faking events); mount both in `apps/app/src/routes/design-gallery-page.tsx`
- [x] T034 [US1] Run `pnpm --filter @sododeck/ui test` and `pnpm dev`; screenshot `/design` at 1440×900 light and dark and compare with the three reference screenshots; fix size/radius/type/color drift (allowed differences: DESIGN.md token overrides, lucide icons, focus outline, `ink-secondary` on surface-2)

**Checkpoint**: US1 controls usable by the next features; tests green.

---

## Phase 4: User Story 2 - Keyboard and assistive-technology access (Priority: P1)

**Goal**: every interactive block reachable and operable by keyboard with a visible focus indicator,
accessible names everywhere, WCAG 2.1 AA text contrast in both themes.

**Independent Test**: keyboard-only pass through `/design` in both themes; `contrast.test.ts` and
the keyboard tests below pass.

**Depends on**: US1 (applies to its controls). Blocks added in US3/US4 carry the same checks in
their own tests.

### Tests for User Story 2

- [x] T035 [P] [US2] Extend `packages/ui/test/contrast.test.ts` with a token-pair table: parse the `:root` and `.dark` blocks of `packages/ui/src/styles/tokens.css` into maps and assert, in both themes, ≥ 4.5 for ink/surface, ink-secondary/surface, ink-secondary/surface-2, ink-muted/surface, on-primary/primary, on-inverse/inverse (coach mark, toast), primary-ink/primary-soft, amber-ink/amber-soft, blue-ink/blue-soft, clay-ink/clay-soft, success-ink/success-soft, on-inverse/inverse; ≥ 3 for primary/surface (focus outline), on-inverse/inverse (focus outline on the coach mark) and primary/inverse (Next button on the coach mark); list input border/surface and surface-3/surface (switch track) as **founder-approved exceptions** (2026-09-27, plan.md Complexity Tracking) in a named array with a comment linking research.md R5; ink-muted/surface-2 is **not** an exception (text on surface-2 uses ink-secondary, founder decision); enforce it in `packages/ui/test/tokens-only.test.ts` by failing when one `className`/`cva` string contains `bg-surface-2` together with `text-ink-muted` or `placeholder:text-ink-muted`
- [x] T036 [P] [US2] Write `packages/ui/test/keyboard-a11y.test.tsx`: render one of every US1 control with labels in a list; `user.tab()` visits each in DOM order and `document.activeElement` is the expected element; each focusable control's class list includes the `focusRing` classes (import `focusRing` and assert with `toHaveClass(...focusRing.split(' '))`; for SearchField assert the `focus-within:outline-*` classes on its `data-slot="search-field"` wrapper instead); every element with `role` button/switch/combobox/textbox/searchbox has a non-empty accessible name (`toHaveAccessibleName()`)
- [x] T037 [P] [US2] Add to `packages/ui/test/components.test.tsx`: an icon-only `Button size="icon"` without `aria-label`/`aria-labelledby`/text triggers a `console.error` dev warning (spy on `console.error`), and with `aria-label` is found by `getByRole('button', { name })`

### Implementation for User Story 2

- [x] T038 [US2] In `packages/ui/src/components/button.tsx`, add a dev-only (`import.meta.env.DEV`) `console.error` when `size` is `icon`/`icon-sm` and there is no `aria-label`, `aria-labelledby` or string child; make T037 pass
- [x] T039 [US2] Apply `focusRing` to the existing interactive parts in `packages/ui/src/components/tooltip.tsx` (trigger wrapper if styled) and `packages/ui/src/components/panel.tsx` (any buttons), and fix every US1 component until T036 passes
- [x] T040 [US2] Add a "Keyboard & contrast" note block to `apps/app/src/routes/design-gallery-page.tsx` (skip link to `main`, short text listing expected keys per control) and do the manual keyboard-only pass in light and dark per quickstart.md §2.3; also switch theme while the dialog, a toast and the coach mark are open (they stay open and re-theme) and check the gallery at 200% browser zoom (no overlap, all controls usable); fix any issue found

**Checkpoint**: US1 + US2 = accessible core controls (MVP).

---

## Phase 5: User Story 3 - Component-kind tiles and icon vocabulary (Priority: P2)

**Goal**: typed Material → lucide map for every prototype glyph, six kind styles, KindTile at
22/28/30/40 px.

**Independent Test**: `/design` kinds section vs `docs/design/screens/14-editor-palette-tab-light.png`
in both themes; `icons.test.ts` and `kind-tile.test.tsx` pass.

### Tests for User Story 3

- [x] T041 [P] [US3] Write `packages/ui/test/icons.test.ts`: `COMPONENT_KINDS` equals the six kinds in order client, gateway, service, queue, database, external; each `KIND_STYLE[kind]` has an icon, label and tone; `toComponentKind` handles `'Database'`, `' queue '`, `'edge'`→gateway, `'data'`→database, `'nope'`→null; every entry of `MATERIAL_GLYPHS` has a `MATERIAL_TO_LUCIDE` entry (SC-007); every entry whose icon is a substitute has a non-empty `note`; `docs/design/icon-mapping.md` lists exactly the keys of `MATERIAL_TO_LUCIDE` (parse the table's first column)
- [x] T042 [P] [US3] Write `packages/ui/test/kind-tile.test.tsx`: for each kind, `getByRole('img', { name: label })`; `decorative` → no img role and `aria-hidden`; sizes 22/28/30/40 set `data-size` and width/height via `style` or size classes; unknown kind renders the fallback with name "Component" (no throw)

### Implementation for User Story 3

- [x] T043 [US3] Extract the prototype glyph list: collect every glyph inside `'Material Symbols Outlined'` spans in `docs/design/claude-design/Sododeck.dc.html` and every icon name in `docs/design/claude-design/sododeck-data.js` (`KICON` and the node `icon` argument of `N(...)`), excluding non-icon strings; record the sorted list as `MATERIAL_GLYPHS` (`as const`) and `type MaterialGlyph` in `packages/ui/src/lib/icons.ts` (do not copy any prototype code, only glyph names)
- [x] T044 [US3] In `packages/ui/src/lib/icons.ts`, add `ICON_STROKE_WIDTH = 1.5`, `ComponentKind`, `COMPONENT_KINDS`, `KIND_STYLE` (client `MonitorSmartphone` surface-2/ink-secondary; gateway `Router` inverse/on-inverse; service `Box` primary-soft/primary-ink; queue `ArrowLeftRight` amber-soft/amber-ink; database `Database` blue-soft/blue-ink; external `Cloud` clay-soft/clay-ink; tone as token class strings), `KIND_FALLBACK` (`Shapes`, surface-2/ink-muted, label "Component"), `toComponentKind()`, and `MATERIAL_TO_LUCIDE: Record<MaterialGlyph, { icon: LucideIcon; note?: string }>` with the closest lucide icon per glyph and a `note` for substitutes (e.g. brand glyphs like `stripe` → `CreditCard`, note "no brand icons in lucide")
- [x] T045 [US3] Write `docs/design/icon-mapping.md`: intro (source, stroke 1.5, DESIGN.md/lucide win over prototype), a "Kinds" table (kind · Material · lucide · soft/ink tokens) and a full "Glyphs" table (Material · lucide · note) matching `MATERIAL_TO_LUCIDE`; make T041 pass
- [x] T046 [US3] Create `packages/ui/src/components/kind-tile.tsx` (`KindTile`): accepts `kind: ComponentKind | string | null`, `size?: 22 | 28 | 30 | 40` (default 30), `decorative?`; resolves via `toComponentKind`; radius `round(0.3 × size)` and icon ≈ `0.6 × size` from a typed `SIZE_MAP` (22→7, 28→8, 30→9, 40→12 px radius) applied as `style={{ width, height, borderRadius }}` numeric px (T011 forbids `rounded-[…]`; inline px sizes are not colors); colors from `KIND_STYLE` token classes; `role="img"` + `aria-label` unless decorative; make T042 pass
- [x] T047 [US3] Add `apps/app/src/design-gallery/kinds-section.tsx` (six kinds × four sizes + fallback, with labels) and a compact icon-mapping grid (every `MATERIAL_TO_LUCIDE` entry: lucide icon + Material name); mount in `apps/app/src/routes/design-gallery-page.tsx`; compare with `docs/design/screens/14-editor-palette-tab-light.png` in light and dark

**Checkpoint**: canvas feature (003) can use `KindTile` and `KIND_STYLE`.

---

## Phase 6: User Story 4 - Tags, banners, dialogs, toasts and coach marks (Priority: P2)

**Goal**: TagChip/TagInput, Banner (warning/success/error), Dialog, Toast, CoachMark.

**Independent Test**: in `/design`, add/remove tags, dismiss banners, open/close dialog, trigger a
toast, step through a 3-step coach mark; compare with `01-library-light.png`,
`06-export-json-light.png`, `22-editor-custom-view-toast-light.png`, `05-empty-deck-tour-1-light.png`.

### Tests for User Story 4

- [x] T048 [P] [US4] Write `packages/ui/test/tags.test.ts`: `normalizeTag(' PII ')` → `'pii'`, `normalizeTag('  ')` → `null`, inner whitespace collapsed; `addTag(addTag([], 'PII'), '')` → `['pii']`; `addTag(['pii'], 'Pii')` returns the same array; `removeTag(['a','b','c'], 'b')` → `['a','c']`
- [x] T049 [P] [US4] Write `packages/ui/test/tag-input.test.tsx`: controlled harness; type "PII", Enter, Enter → exactly one chip "pii" and `onValueChange` called once; each chip's remove button named "Remove tag pii"; clicking it removes the tag and focus moves to the next chip or the add field; Backspace on a focused chip removes it
- [x] T050 [P] [US4] Write `packages/ui/test/banner.test.tsx`: `tone="error"` → `role="alert"`, warning/success → `role="status"`; each tone renders its icon (`data-tone` + an `svg`); "Dismiss" button calls `onDismiss`; no dismiss button when `onDismiss` is absent
- [x] T051 [P] [US4] Write `packages/ui/test/dialog.test.tsx`: trigger opens `getByRole('dialog', { name: title })`; Tab cycles within the dialog; Esc closes and focus returns to the trigger; `DialogClose` closes; with a Select open inside the dialog, the first Esc closes only the Select and the second closes the dialog
- [x] T052 [P] [US4] Write `packages/ui/test/toast.test.tsx` with `vi.useFakeTimers()`: `toast({ message: 'View saved' })` shows the text in a status/live region; after 2600 ms it is gone; with `action: { label: 'Undo', onAction }` the Undo button calls `onAction`; three `toast()` calls in a row are all rendered in call order and each is in a live region; with `matchMedia('(prefers-reduced-motion: reduce)')` stubbed to `true` it still stays 2600 ms and renders without enter animation (toast root has `data-reduced-motion="true"`)
- [x] T053 [P] [US4] Write `packages/ui/test/coach-mark.test.tsx`: open at step 1 of 3 shows "1 of 3", Back disabled, Next calls `onNext`; at step 3 the primary action is "Done" and calls `onFinish`; Skip and Esc call `onSkip`; focus moves into the card when opened; after Esc/Skip focus returns to the element that was focused before the coach mark opened; with no anchor mounted the card still renders

### Implementation for User Story 4

- [x] T054 [P] [US4] Create `packages/ui/src/lib/tags.ts` (`normalizeTag`, `addTag`, `removeTag`, pure, immutable); make T048 pass
- [x] T055 [P] [US4] Create `packages/ui/src/components/tag-chip.tsx` (`TagChip`): pill `rounded-full bg-surface-2 text-body-sm text-ink-secondary px-2 h-6`, remove button (lucide `X`, `aria-label="Remove tag {label}"`, `focusRing`), chip itself focusable when `onRemove` is set, Backspace/Delete → `onRemove`; long labels truncate with `title`
- [x] T056 [US4] Create `packages/ui/src/components/tag-input.tsx` (`TagInput`): controlled `value`/`onValueChange`, renders `TagChip`s + dashed "+ tag" field (`border border-dashed border-border rounded-full`, `aria-label={label}`), Enter → `addTag`, clears field; after removal move focus to the next chip or the field; make T049 pass
- [x] T057 [P] [US4] Create `packages/ui/src/components/banner.tsx` (`Banner`): `rounded-banner p-3 flex gap-2.5`, tones warning `bg-amber-soft text-amber-ink` + `TriangleAlert`, success `bg-success-soft text-success-ink` + `CircleCheck`, error `bg-clay-soft text-clay-ink` + `CircleAlert`; role per tone; optional `action` slot; ghost icon dismiss button `aria-label="Dismiss"`; make T050 pass
- [x] T058 [P] [US4] Create `packages/ui/src/components/dialog.tsx` (`Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`) on Radix Dialog: overlay `bg-scrim`, content centred `rounded-modal bg-surface shadow-modal border border-border`, default max width with className override (export uses 820 px), close icon button top-right (`aria-label="Close"`), fade transition using `duration-[var(--sd-dur-dim)]` (0 under reduced motion); make T051 pass
- [x] T059 [P] [US4] Create `packages/ui/src/components/toast.tsx` (`ToastProvider`, `Toaster`, `useToast`) on Radix Toast: provider holds a queue in React state (UI-only), `toast({ message, action?, duration = MOTION.toastMs })`, viewport bottom-centre, pill `rounded-full bg-inverse text-on-inverse shadow-float px-4 h-10`, action as a text button `text-on-inverse underline`, polite announcement (Radix default `type="foreground"`/`background` as appropriate), duration never reduced; read `useReducedMotion()` and set `data-reduced-motion` + drop the enter/exit animation classes when true; make T052 pass
- [x] T060 [P] [US4] Create `packages/ui/src/components/coach-mark.tsx` (`CoachMark`, `CoachMarkAnchor`) on Radix Popover: controlled `open`, content `w-[300px]` via a width class (spacing value, not a color), `rounded-banner bg-inverse text-on-inverse shadow-tour p-4`, arrow `fill-inverse`, header "n of N" text, progress dots (`aria-hidden`, current dot wider using `transition-[width] duration-[var(--sd-dur-ring)]`), footer Skip and Back (disabled on step 1) as text buttons styled for the inverse surface (`text-on-inverse opacity-80 hover:opacity-100`, `focusRing` plus an `focus-visible:outline-on-inverse` override so the outline shows on the dark card) and Next or "Done" (`primary`); never use the `ghost` variant here (its `ink-secondary` text is ≈1.3:1 on inverse); Esc → `onSkip`; `avoidCollisions` so an off-screen anchor stays visible, and if no anchor is mounted the content still renders (centred fallback) inside the viewport; make T053 pass
- [x] T061 [US4] Add `apps/app/src/design-gallery/feedback-section.tsx` (TagInput with sample tags, TagChip long label, three Banners dismissible, toast buttons incl. "Undo" action and a burst of 3) and `apps/app/src/design-gallery/overlays-section.tsx` (Dialog example 820 px with Switch + Select inside, 3-step CoachMark anchored to a button); wrap the gallery page in `ToastProvider` + `Toaster` in `apps/app/src/routes/design-gallery-page.tsx`; compare with the four reference screenshots in light and dark

**Checkpoint**: library (005), inspector (008), export (012), onboarding (013) blocks are ready.

---

## Phase 7: User Story 5 - Calm motion that respects reduced-motion (Priority: P2)

**Goal**: live reduced-motion detection, transitions at 0 ms and no loops under the preference.

**Independent Test**: `/design` motion section shows the current preference and a looping demo
that stops when OS "Reduce motion" is turned on (no reload); `use-reduced-motion.test.tsx` passes.

- [x] T062 [US5] Add `apps/app/src/design-gallery/motion-section.tsx`: table of `resolveMotion(useReducedMotion())` values, "Reduced motion: on/off" text, a looping flow-token demo dot animated with `animation-duration: var(--sd-flow-token-loop)` that is not rendered/animated when reduced (show a static marker instead), and a dim demo toggling opacity with `duration-[var(--sd-dur-dim)]`; mount in `apps/app/src/routes/design-gallery-page.tsx`
- [x] T063 [US5] Audit every `transition`/`animate` class in `packages/ui/src/components/` to use `var(--sd-dur-*)` durations (not fixed ms) and no bounce/overshoot easing; fix offenders; verify with OS reduce-motion on/off per quickstart.md §2.7

**Checkpoint**: flow playback (007) and focus mode (010) can consume `MOTION`/`useReducedMotion`.

---

## Phase 8: User Story 6 - Hidden review gallery (Priority: P3)

**Goal**: complete gallery in dev; absent from production.

**Independent Test**: quickstart.md §2 (all blocks present) and §3 (`dist/` has no gallery chunk;
`/design` on preview shows Not found).

- [x] T064 [US6] Complete `apps/app/src/routes/design-gallery-page.tsx`: table of contents linking to each section, sticky header with theme toggle, and a check that every component file in `packages/ui/src/components/` appears in at least one section (add any missing: Panel, Tooltip)
- [x] T065 [US6] Verify production exclusion: `pnpm --filter @sododeck/app build`, then `grep -rl "design-gallery\|Design gallery" apps/app/dist` returns nothing; `pnpm --filter @sododeck/app preview` and open `/design` → NotFoundPage; if a chunk leaks, restructure the conditional in `apps/app/src/app/router.tsx` so Vite can dead-code-eliminate it
- [x] T066 [US6] Take screenshots of `/design` at 1440×900 in light and dark (sections: buttons, fields, kinds, feedback, overlays) and save them under `specs/000-design-foundation/screens/` for the PR description next to the matching `docs/design/screens/*.png`; list every remaining difference; run a Lighthouse accessibility audit of `/design` in light and dark and attach both scores (SC-004)

**Checkpoint**: all stories complete.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T067 [P] Update `packages/ui/CLAUDE.md`: new tokens (motion, radius, shadow, reduced-motion rule), `focusRing` rule, the component list with one line each, `lib/icons.ts` + `docs/design/icon-mapping.md`, `hooks/` export, tokens-only and contrast tests as enforced rules
- [x] T068 [P] Write ADR `docs/decisions/0003-ui-foundation.md` (context, decision, consequences): Radix-only primitives from `radix-ui` (no sonner/cmdk), focus outline instead of soft halo, lucide mapping with stroke 1.5, `gateway`/`database` kind names with prototype aliases, founder-approved contrast exceptions (research.md "Founder decisions")
- [x] T069 [P] Update `apps/app/CLAUDE.md` map: add `/design` (dev only) route and `src/design-gallery/`
- [x] T070 Run the full definition of done at repo root: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; fix everything; confirm no `.only`/`.skip` in `packages/ui/test` and `apps/app/src`
- [x] T071 Write the final report (what changed, what was skipped, what is uncertain, founder decisions 1–3 from research.md, screenshots from T066) for the PR description

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (1)** → **Foundational (2)** → stories.
- **US1 (P1)** needs Phase 2 only.
- **US2 (P1)** needs US1 (it hardens US1's controls; later stories include their own a11y tests).
- **US3 (P2)** needs Phase 2 only — can run in parallel with US1/US2.
- **US4 (P2)** needs Phase 2; uses `Button` (existing), `MOTION` (T008) and `useReducedMotion` (T010). Independent of US1
  components except the gallery overlay demo (T061) which embeds Switch/Select from US1.
- **US5 (P2)** needs Phase 2; T063 audits components from US1/US3/US4, so run it last among
  stories.
- **US6 (P3)** needs all sections (T033, T047, T061, T062).
- **Polish (9)** after all stories.

```text
T001–T003 → T004–T016 ─┬─ US1 (T017–T034) → US2 (T035–T040) ─┐
                       ├─ US3 (T041–T047) ───────────────────┼─ US5 (T062–T063) → US6 (T064–T066) → T067–T071
                       └─ US4 (T048–T061) ───────────────────┘
```

The reduced-motion hook (T009–T010) moved into Phase 2 because the Toast (T059) needs it.

### Within each story

Tests first (must fail) → pure lib → components → gallery section → visual check.

## Parallel Opportunities

- Phase 2: T006, T007/T008, T009/T010, T011, T013/T014 in parallel after T004–T005.
- US1: tests T017–T024 all [P]; components T026–T032 all [P] (separate files); T025 touches
  `button.tsx` only.
- US3 and US4 can be worked by a second agent while US1/US2 proceed.
- US4: tests T048–T053 [P]; T054, T055, T057–T060 [P]; T056 waits for T054/T055.
- Polish: T067–T069 [P].

### Parallel example: User Story 1

```text
Agent A: T018 input.test.tsx → T026 input.tsx
Agent B: T021 select.test.tsx → T029 select.tsx
Agent C: T023 segmented-control.test.tsx → T031 segmented-control.tsx
Agent D: T024 switch.test.tsx → T032 switch.tsx
```

### Parallel example: User Story 4

```text
Agent A: T048 → T054 tags.ts → (T049) → T055 + T056 tag chip/input
Agent B: T051 → T058 dialog.tsx
Agent C: T052 → T059 toast.tsx
Agent D: T053 → T060 coach-mark.tsx
```

## Implementation Strategy

### MVP (US1 + US2)

1. Phases 1–2.
2. US1 → US2. **Stop and validate**: keyboard pass + screenshots of buttons/fields in both themes.
3. This alone unblocks the next feature builders for forms and chrome.

### Incremental delivery

- - US3 → canvas feature 003 can start (it also needs 002).
- - US4 → library 005, inspector 008, export 012, onboarding 013 have their blocks.
- - US5 → flow playback 007 has motion timing.
- - US6 → final review surface and production check.

## Notes

- Keep commits small: one component + its test per commit where possible.
- Do not change DESIGN.md colors; contrast exceptions are fixed by the founder decisions in research.md; new ones need founder approval.
- `packages/ui` must not import `@sododeck/schema`/`@sododeck/model` or app code.
- Visual check is screenshot-based; no new Playwright specs.
