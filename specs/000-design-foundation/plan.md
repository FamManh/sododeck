# Implementation Plan: Design Foundation (shared visual building blocks)

**Branch**: `000-design-foundation` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/000-design-foundation/spec.md`

## Summary

Extend `packages/ui` into a complete, token-driven set of building blocks that match the Claude
Design screens in light and dark: new motion, radius and shadow tokens (with reduced-motion
support); a typed Material → lucide icon map and the six component-kind styles; 14 new or extended
components (Button `chip`/`toggle`, Input, InlineEdit, Textarea, Select, SearchField,
SegmentedControl, Switch, TagChip, TagInput, KindTile, Banner, Dialog, Toast, CoachMark); and a
dev-only `/design` gallery route in `apps/app`. All stateful controls use Radix primitives from the
existing `radix-ui` dependency, so **no new runtime or dev dependency** is added. Accessibility is
enforced by tests: a tokens-only check, a token-pair contrast check, and role/label keyboard tests
per component. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19

**Primary Dependencies**: existing only — `radix-ui` ^1.6.7 (Dialog, Select, RadioGroup, Switch,
Toast, Popover), `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, Tailwind v4
(app), `@fontsource-variable/geist*`

**Storage**: N/A (no document data; theme preference already in `apps/app/src/theme`, localStorage)

**Testing**: Vitest 5 + jsdom + Testing Library + user-event (`packages/ui/test/`); existing
Playwright smoke suite unchanged

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox, Safari (desktop web)

**Project Type**: monorepo — shared UI library (`packages/ui`) + web SPA (`apps/app`, gallery only)

**Performance Goals**: no canvas impact (bench not required); gallery chunk excluded from
production; motion values exactly as specified (250/200/1400/1700/2600 ms)

**Constraints**: tokens only (no hard-coded colors, no `dark:` overrides); WCAG 2.1 AA (text 4.5:1,
focus/non-text 3:1); reduced motion → 0 ms transitions, no loops; no network requests; no new
dependencies without founder approval

**Scale/Scope**: ~15 components, 5 lib/hook modules, ~70 icon mappings, 1 dev route, ~20 test files

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                         | Check                                                                                                                                                                                                                                                                           | Status                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| I. Single source of truth         | Components are presentational and controlled; no document data stored (TagInput/InlineEdit are controlled; caller owns data).                                                                                                                                                   | ✅                                       |
| II. Schema-owned format           | No file-format change. `ComponentKind` is a UI type with an alias mapper; schema kind names decided in 001.                                                                                                                                                                     | ✅ N/A                                   |
| III. Stable identity              | No objects/ids created.                                                                                                                                                                                                                                                         | ✅ N/A                                   |
| IV. Local-first, private          | No network; icons and fonts bundled; gallery is dev-only. Smoke "no third-party requests" test unchanged.                                                                                                                                                                       | ✅                                       |
| V. Performance off main thread    | No heavy work. No canvas change → `pnpm bench` not required.                                                                                                                                                                                                                    | ✅ N/A                                   |
| VI. Strict types, tested behavior | Strict TS; unit tests for motion/tags/icons/contrast; component tests by role/label; no new e2e (TODO(e2e)).                                                                                                                                                                    | ✅                                       |
| VII. Accessible by default        | Keyboard + visible focus on every control; non-color state cues (thumb position, `aria-pressed` + border, banner icons); tokens only (automated test); contrast test. Two design-level non-text contrast gaps (input border, switch-off track < 3:1) — see Complexity Tracking. | ⚠ deviation, founder-approved 2026-09-27 |
| VIII. Simplicity, justified deps  | Zero new dependencies (Radix via existing `radix-ui`; no sonner/cmdk/axe/Storybook). Only this milestone's scope. ADR for the icon mapping + focus-style decision.                                                                                                              | ✅                                       |

Result: **PASS with 2 justified deviations** (Complexity Tracking), approved by the founder on 2026-09-27.

**Post-design re-check (after Phase 1):** contracts add only presentational exports and one dev
route; data-model confirms no persisted/document state; no dependency added; toggle-pressed and invalid-input states carry non-color cues (icon/weight). **PASS** with the same 2 approved deviations.

## Project Structure

### Documentation (this feature)

```text
specs/000-design-foundation/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R10 + founder decisions
├── data-model.md        # Phase 1: tokens, kinds, icon map, tags, toast, coach-mark rules
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── components.md    # Phase 1: public API of @sododeck/ui additions
├── checklists/
│   └── requirements.md  # spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/ui/
├── package.json                     # + "./hooks/*" export
├── CLAUDE.md                        # update: new tokens, components, icon map, focus rule
├── src/
│   ├── styles/
│   │   ├── tokens.css               # + motion tokens, --sd-shadow-tour, reduced-motion block
│   │   └── theme.css                # + radius segment/row/banner, shadow hover/tour, durations
│   ├── lib/
│   │   ├── utils.ts                 # tailwind-merge: new radius/shadow keys
│   │   ├── motion.ts                # MOTION, resolveMotion
│   │   ├── icons.ts                 # ComponentKind, KIND_STYLE, toComponentKind, MATERIAL_TO_LUCIDE
│   │   ├── tags.ts                  # normalizeTag, addTag, removeTag
│   │   └── contrast.ts              # contrastRatio
│   ├── hooks/
│   │   └── use-reduced-motion.ts
│   └── components/
│       ├── button.tsx               # + chip, toggle variants; shared focus style; rounded-segment
│       ├── input.tsx  inline-edit.tsx  textarea.tsx  select.tsx  search-field.tsx
│       ├── segmented-control.tsx  switch.tsx  tag-chip.tsx  tag-input.tsx  kind-tile.tsx
│       ├── banner.tsx  dialog.tsx  toast.tsx  coach-mark.tsx
│       ├── panel.tsx  tooltip.tsx   # unchanged except focus/radius tokens if needed
└── test/
    ├── setup.ts                     # + jsdom stubs for Radix (pointer capture, scrollIntoView, ResizeObserver, matchMedia)
    ├── tokens-only.test.ts  contrast.test.ts  motion.test.ts  icons.test.ts  tags.test.ts
    └── <component>.test.tsx         # one per component (components.test.tsx keeps existing cases)

apps/app/src/
├── app/router.tsx                   # + /design route inside import.meta.env.DEV
├── routes/design-gallery-page.tsx   # gallery page (theme toggle, reduced-motion readout)
└── design-gallery/                  # one section per block group
    ├── buttons-section.tsx  fields-section.tsx  choice-section.tsx
    ├── tags-kinds-section.tsx  feedback-section.tsx  overlays-section.tsx  motion-section.tsx

docs/
├── design/icon-mapping.md           # human-readable Material → lucide table (kept in sync by test)
└── decisions/0003-ui-foundation.md  # ADR: Radix-only primitives, focus style, icon mapping, contrast exceptions
```

**Structure Decision**: Everything reusable goes in `packages/ui` (presentational only, per its
CLAUDE.md). `apps/app` only gets the dev-only gallery route and its section files. Dependency
direction `app → ui` is preserved; `packages/ui` does not import `@sododeck/schema`.

## Implementation order (for /speckit-tasks)

1. Tokens (motion, radius, shadow, reduced-motion) + `utils.ts` merge keys + `motion.ts` +
   `use-reduced-motion` + tests (tokens-only, contrast, motion). → unblocks every component.
2. P1 controls: Button variants + shared focus style, Input, InlineEdit, Textarea, Select,
   SearchField, SegmentedControl, Switch + tests.
3. P2: `icons.ts` + icon-mapping doc + KindTile; `tags.ts` + TagChip/TagInput; Banner, Dialog,
   Toast, CoachMark + tests.
4. P3: `/design` gallery (sections per group) + production-exclusion check.
5. Docs: `packages/ui/CLAUDE.md`, ADR, screenshots in PR; full DoD command set.

## Risks

- Radix Select/Popover/Toast need jsdom stubs; mitigated in `test/setup.ts`.
- Visual drift Geist Variable vs static Geist (accepted in spec).
- Contrast decisions were approved by the founder (research "Founder decisions"); revisiting them later is a token-only change.

## Complexity Tracking

Deviations from constitution VII ("target is WCAG 2.1 AA"), approved by the founder on 2026-09-27
(research.md "Founder decisions"):

| Violation                                                                                   | Why Needed                                                                                                                    | Simpler Alternative Rejected Because                                                                                           |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Input border (`border` vs `surface`) is 1.35:1 light / 1.45:1 dark, below WCAG 1.4.11's 3:1 | Matches the approved design; every input has a visible label; focus adds an orange border plus a 2px outline (3.14:1)         | A stronger line changes DESIGN.md colors (out of scope) and deviates from the design screens; founder chose to keep the design |
| Switch-off track (`surface-3` vs `surface`) is 1.18:1 light / 1.26:1 dark                   | Matches the approved design; every switch has a visible label; state is also shown by thumb position; thumb has `shadow-rest` | Same as above                                                                                                                  |
