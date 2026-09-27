# Research: Design Foundation (000)

Phase 0 output for [plan.md](plan.md). Every open point from Technical Context is resolved here.
Sources: `DESIGN.md`, `docs/design/design-analysis.md` (§b, §c, §g), `docs/design/claude-design/*`
(read-only), `packages/ui` today (Button, Panel, Tooltip; tokens.css, theme.css, utils.ts),
`.specify/memory/constitution.md`.

## R1. Primitives: which library for each overlay/control?

- **Decision:** Use the Radix primitives already shipped by the existing `radix-ui` dependency for
  every stateful control: `Dialog` (Dialog), `Select` (Select), `RadioGroup`
  (SegmentedControl; implemented instead of the first-planned ToggleGroup because RadioGroup
  moves the selection with the arrow keys and can never be cleared, as the spec requires), `Switch` (Switch), `Toast` (Toast), `Popover` with `Popover.Anchor`
  (CoachMark). Plain elements for Input, InlineEdit, Textarea, SearchField, TagChip/TagInput,
  KindTile, Banner.
- **Rationale:** `radix-ui@^1.6.7` is already a runtime dependency of `@sododeck/ui`; all six
  primitives are present in the lockfile (`@radix-ui/react-{dialog,select,toggle-group,switch,toast,popover}`).
  They give focus trapping, roving tab index, arrow keys, Esc handling, `aria-*` state and
  `aria-live` for free, which covers FR-012/014/015/019/020/021/022. **Zero new runtime
  dependencies** (constitution VIII).
- **Alternatives considered:** `sonner` for Toast (new dep, needs founder approval; Radix Toast is
  enough for one inverse pill with an optional action); `cmdk` (Command palette is out of scope,
  feature 009); hand-rolled focus traps (error-prone, re-implements Radix).

## R2. Motion tokens and reduced motion

- **Decision:** Add CSS custom properties to `tokens.css` — `--sd-dur-dim: 250ms`,
  `--sd-dur-ring: 200ms`, `--sd-flow-token-loop: 1400ms`, `--sd-flow-step: 1700ms`,
  `--sd-toast: 2600ms`, `--sd-ease: ease` — and a `@media (prefers-reduced-motion: reduce)` block
  that sets the transition durations and the token loop to `0ms`. `--sd-toast` is **not** reduced
  (readability, FR-002). Expose them in `theme.css` as Tailwind `--animate-*`/duration keys only
  where a utility is useful (`duration-dim`, `duration-ring`). Mirror them as TS constants in
  `src/lib/motion.ts` (`MOTION.dimMs`, …) plus `resolveMotion(reduced: boolean)` (pure, tested) and
  a `useReducedMotion()` hook (`src/hooks/use-reduced-motion.ts`, `matchMedia` +
  `change` listener, SSR-safe default `false`).
- **Rationale:** CSS consumers (transitions) get reduced motion automatically; JS consumers
  (flow autoplay timers in 007, toast duration) read the same numbers from one TS module. Live
  preference change is handled by the `change` listener (spec edge case).
- **Alternatives considered:** JS-only constants (CSS transitions would not honour the setting);
  a global `* { transition: none }` override (too blunt, breaks Radix presence animations' end
  events inconsistently).
- **Note:** `matchMedia` is a standard API available in all supported browsers; it is not one of
  the optional browser APIs that must go through `apps/app/src/lib/features.ts` (rule 6 covers
  File System Access, `storage.persist`, BroadcastChannel…). The hook still guards
  `typeof window.matchMedia === 'function'` for jsdom.

## R3. Extra radii and shadows

- **Decision:** Named tokens in `theme.css`: `--radius-segment: 7px`, `--radius-row: 8px`,
  `--radius-banner: 14px`; `--shadow-hover: 0 4px 16px var(--sd-shadow)`,
  `--shadow-tour: 0 12px 32px var(--sd-shadow-tour)` with a new `--sd-shadow-tour` token
  (`rgba(0,0,0,.25)` light, `rgba(0,0,0,.6)` dark). Register `segment`, `row`, `banner`, `hover`,
  `tour` in the tailwind-merge config in `utils.ts`. Replace the existing `rounded-[7px]` in
  Button `icon-sm` with `rounded-segment`.
- **Rationale:** Named tokens keep "tokens only" enforceable (arbitrary values like `rounded-[7px]`
  would slip past the hard-coded-value check) and make intent readable.
- **Alternatives considered:** Tailwind arbitrary values (unenforceable, drift-prone); reusing
  `shadow-float` for hover (visibly heavier than the design's deck-card hover).

## R4. Icons: Material Symbols → lucide

- **Decision:** `src/lib/icons.ts` exports (a) `MATERIAL_TO_LUCIDE: Record<MaterialGlyph, { icon:
LucideIcon; note?: string }>` covering every glyph used in the prototype, (b) `ComponentKind =
'client' | 'gateway' | 'service' | 'queue' | 'database' | 'external'`, (c) `KIND_STYLE:
Record<ComponentKind, { icon: LucideIcon; label: string; tone: KindTone }>` and
  (d) `toComponentKind(value: string): ComponentKind | null` (case-insensitive, accepts the
  prototype aliases `edge` → gateway, `data` → database). Default `strokeWidth` 1.5 (matches
  Material weight 300). A human-readable table is generated into
  `docs/design/icon-mapping.md` from the same map (a tiny script or kept in sync by a test).
- **Kind mapping** (prototype glyph → lucide): client `devices` → `MonitorSmartphone`; gateway
  `router` → `Router`; service `deployed_code` → `Box`; queue `swap_horiz` → `ArrowLeftRight`;
  database `database` → `Database`; external `cloud` → `Cloud`. Fallback for unknown kinds:
  `Shapes` on surface-2 / muted.
- **Kind colors** (DESIGN.md "Kind & Semantic Tints"): client surface-2 / ink-secondary; gateway
  inverse / on-inverse; service primary-soft / primary-ink; queue amber-soft / amber-ink;
  database blue-soft / blue-ink; external clay-soft / clay-ink.
- **Coverage check:** the glyph list is extracted once from `Sododeck.dc.html`
  (`'Material Symbols Outlined'` spans) and `sododeck-data.js` (`icon` fields, `KICON`) and
  committed as the `MaterialGlyph` union; a unit test asserts every glyph has a mapping (SC-007).
  Brand glyphs without a lucide equivalent (e.g. `stripe`) map to a generic icon with a `note`.
- **Rationale:** One typed source for app, palette, inspector and search (US3). Kind names follow
  design-analysis §g-4 (`gateway`/`database`), which feature 001 is expected to adopt; the alias
  function keeps the UI tolerant if the schema lands on other names.
- **Alternatives considered:** Material Symbols font (violates AGENTS.md "icons from lucide" and
  would be a large bundled font); storing lucide keys as strings only (loses type safety).

## R5. Focus indicator and contrast

Measured with the WCAG relative-luminance formula on the DESIGN.md token values:

| Pair                                                                | Light     | Dark      | Need           |
| ------------------------------------------------------------------- | --------- | --------- | -------------- |
| primary vs surface (focus ring / input focus border)                | 3.14      | 6.44      | 3:1 ✅         |
| primary vs surface-2                                                | 2.85      | 5.78      | 3:1 ⚠ light    |
| primary-soft vs surface (current `focus-visible:ring-primary-soft`) | ≈1.1      | ≈1.2      | 3:1 ❌         |
| muted vs surface                                                    | 4.84      | 5.58      | 4.5:1 ✅       |
| muted vs surface-2 (search placeholder, kbd hint)                   | **4.40**  | 5.02      | 4.5:1 ❌ light |
| text-secondary vs surface-2                                         | 6.81      | 8.08      | ✅             |
| ink/soft pairs (primary, amber, blue, clay, success)                | 4.75–6.53 | 7.42–8.43 | ✅             |
| surface-3 (switch off track) vs surface                             | 1.18      | 1.26      | 3:1 ❌         |
| border vs surface (input border)                                    | 1.35      | 1.45      | 3:1 ❌         |

- **Decision (focus):** One shared focus style for all interactive blocks:
  `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`. The
  2px offset sits on the surrounding surface, so the ring is measured against surface (3.14 ✅)
  even for surface-2 controls. The existing `ring-primary-soft` halo is kept as the design's
  _selection_ look (`shadow-selection`), not as the focus indicator. Text inputs keep the design's
  orange-border focus and add the same outline (allowed difference, recorded in the PR).
- **Decision (muted on surface-2):** Text on surface-2 (search placeholder, kbd hint, chip text)
  uses `text-ink-secondary` instead of `text-ink-muted` in light and dark. Recorded as an allowed
  difference. A token tweak (e.g. muted `#6e6e67`) is proposed to the founder but not made here,
  because changing DESIGN.md colors is out of scope.
- **Decision (borders/tracks):** Input borders and the switch-off track do not meet 1.4.11 3:1 as
  designed. Mitigation inside scope: every input and switch has a visible text label; switch state
  is also shown by thumb position (non-color, FR-024); the switch thumb carries `shadow-rest`. The
  gap is **flagged to the founder** as a DESIGN.md decision (option: `border` → `edge`-strength
  line for form fields). The automated contrast test asserts text pairs (4.5:1) and the focus
  indicator (3:1) and lists these two pairs as documented exceptions.
- **Rationale:** Meets WCAG 2.1 AA for text and focus with the fewest visual deviations; defers
  token changes to the owner of DESIGN.md.

## R6. Hard-coded color check (FR-004, SC-003)

- **Decision:** A Vitest test in `packages/ui/test/tokens-only.test.ts` reads every file in
  `src/components/` and fails on: hex colors (`#[0-9a-f]{3,8}`), `rgb(`/`rgba(`/`hsl(`/`oklch(`,
  Tailwind palette colors (`(bg|text|border|ring|fill|stroke|outline)-(red|orange|…|neutral)-\d`),
  arbitrary color values (`-\[#`), and `dark:` variants. `tokens.css` and `theme.css` are the only
  allowed places for raw values.
- **Rationale:** No new ESLint plugin (VIII); fast; runs in `pnpm test`.
- **Alternatives considered:** `eslint-plugin-tailwindcss` (new dev dep, patchy Tailwind v4
  support); manual grep in review (not enforced).

## R7. Contrast check (SC-004)

- **Decision:** `packages/ui/src/lib/contrast.ts` — pure `contrastRatio(hexA, hexB)`; test
  `packages/ui/test/contrast.test.ts` parses `tokens.css` (light `:root` and `.dark` blocks) and
  asserts the table of foreground/background pairs actually used by the components (from R5) in
  both themes. Accessibility semantics (roles, names, states) are asserted in component tests with
  Testing Library.
- **Rationale:** jsdom does not compute layout/colors, so an axe run in Vitest cannot check
  contrast reliably; a token-pair test is deterministic and needs no dependency. A browser axe
  scan of `/design` would need `@axe-core/playwright` plus a new e2e spec, which constitution VI
  defers (TODO(e2e)).
- **Alternatives considered:** `vitest-axe`/`jest-axe` (new dev dep; contrast rule disabled in
  jsdom anyway); manual Lighthouse run (kept as an optional reviewer step in quickstart).

## R8. Gallery route (FR-025/026)

- **Decision:** `apps/app/src/app/router.tsx` adds `{ path: '/design', lazy: … }` only inside an
  `import.meta.env.DEV` branch (spread into the route array). The page lives in
  `apps/app/src/routes/design-gallery-page.tsx` with one section file per block group in
  `apps/app/src/design-gallery/`. It has a theme toggle (existing `useThemeStore`), shows
  `useReducedMotion()`'s current value and a looping demo, and renders every variant/state.
  Forced states (hover/focus samples) use `data-state`-style props or static class samples,
  not document data.
- **Rationale:** Vite replaces `import.meta.env.DEV` with `false` in production and drops the
  dynamic import, so the chunk is never emitted (verified in quickstart by searching `dist/`).
  In production `/design` falls through to `*` → NotFoundPage.
- **Alternatives considered:** Storybook/Ladle (new dev deps, second build); a gallery inside
  `packages/ui` (needs its own Vite app; the app already has theme + fonts wired).

## R9. Component API conventions

- **Decision:** Follow `packages/ui/CLAUDE.md` and the existing Button: one component per file,
  kebab-case, `data-slot`, `cva` variants, `cn`, named exports, function components, props extend
  the underlying element/Radix props. Controlled + uncontrolled where Radix supports it
  (`value`/`defaultValue`/`onValueChange`). Tag logic lives in pure functions
  (`src/lib/tags.ts`: `normalizeTag`, `addTag`, `removeTag`) for unit testing.
- New package export: `"./hooks/*": "./src/hooks/*.ts"` in `packages/ui/package.json`
  (`components.json` already declares the `hooks` alias).

## R10. Testing approach

- Vitest + Testing Library (already dev deps): one test file per component in
  `packages/ui/test/`, queries by role/label, `user-event` for keyboard (Tab, Space, Enter, arrows,
  Esc). Radix Select/Popover in jsdom need `hasPointerCapture`/`scrollIntoView`/`ResizeObserver`
  stubs in `test/setup.ts`. Toast timing via `vi.useFakeTimers()`.
- Pure functions (motion, tags, icons, contrast) get unit tests.
- No new e2e spec (constitution VI); `pnpm e2e` smoke suite must stay green.
- Visual check: screenshots of `/design` at 1440×900 light + dark next to the referenced
  `docs/design/screens/*.png` in the PR.

## Founder decisions (2026-09-27)

1. Light `muted` on `surface-2` is 4.40:1 → **use `ink-secondary`** for text on surface-2; no
   DESIGN.md change.
2. Input border and switch-off track are < 3:1 (WCAG 1.4.11) → **accepted as exceptions**,
   mitigated with labels, focus outline and thumb position (plan.md Complexity Tracking).
3. Focus indicator → **2px orange outline with 2px offset** on all controls; the soft halo is the
   selection look only.
