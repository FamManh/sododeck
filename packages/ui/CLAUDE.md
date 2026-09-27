# @sododeck/ui

**Responsibility:** the design system — tokens, the Tailwind v4 theme, and shared React components (shadcn/ui on Radix, icons from `lucide-react`). The source of design truth is `/DESIGN.md`.

- `src/styles/tokens.css` — raw CSS variables (`--sd-*`), light on `:root`, dark on `.dark`.
- `src/styles/theme.css` — Tailwind `@theme inline` mapping (the shared "preset"). DESIGN.md names (`bg-primary-soft`, `text-ink-muted`, `rounded-node`, `text-micro`, `shadow-rest`) plus shadcn aliases (`bg-background`, `text-muted-foreground`, …).
- `src/styles/styles.css` — what apps import (fonts + tokens + theme + base styles).
- `src/components/*` — one component per file, shadcn conventions (`data-slot`, `cva`, `cn`, function components, no barrel).
- `src/lib/utils.ts` — `cn()`; its tailwind-merge config must list every custom `text-*`, `rounded-*` and `shadow-*` key from theme.css.
- `src/lib/focus.ts` — `focusRing`, the one keyboard focus style (2px orange outline, 2px gap). Every interactive element uses it.
- `src/lib/motion.ts` — `MOTION` + `resolveMotion(reduced)`, the JS mirror of the motion tokens (a test keeps CSS and TS equal).
- `src/lib/icons.ts` — `ICON_STROKE_WIDTH` (1.5), `ComponentKind`, `KIND_STYLE`, `toComponentKind()` (accepts prototype `edge`/`data`), `MATERIAL_TO_LUCIDE` for every prototype glyph. Human-readable copy: `docs/design/icon-mapping.md` (kept in sync by a test).
- `src/lib/menu.ts` — the shared classes of `DropdownMenu` and `ContextMenu`.
- `src/lib/tags.ts` — `normalizeTag` / `addTag` / `removeTag` (trim, lower-case, de-duplicate).
- `src/lib/contrast.ts` — `contrastRatio(hexA, hexB)` (WCAG 2.1).
- `src/lib/markdown.ts` — `parseMarkdown(text)` → `Block[]` (008): paragraphs, one level of `-`/`*`/`+` bullets, inline `` `code` ``; everything else stays literal text.
- `src/hooks/use-reduced-motion.ts` — `useReducedMotion()`, live `prefers-reduced-motion`.

## Components

| File                                    | Exports                                                                                                                       | Notes                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `button.tsx`                            | `Button`, `buttonVariants`                                                                                                    | variants primary · secondary · ghost · chip · toggle (`pressed` → `aria-pressed` + check icon); sizes default · sm · icon · icon-sm · chip. Icon-only buttons need `aria-label` (dev warning).                                                                                                                                              |
| `input.tsx`                             | `Input`                                                                                                                       | 36px; `invalid` → `aria-invalid` + clay border + alert icon                                                                                                                                                                                                                                                                                 |
| `inline-edit.tsx`                       | `InlineEdit`                                                                                                                  | borderless until hover; Enter/blur commit, Esc reverts; `label` required                                                                                                                                                                                                                                                                    |
| `textarea.tsx`                          | `Textarea`                                                                                                                    | mono 12.5/1.55 (`text-code-md`), vertical resize                                                                                                                                                                                                                                                                                            |
| `select.tsx`                            | `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`                                                       | Radix Select                                                                                                                                                                                                                                                                                                                                |
| `search-field.tsx`                      | `SearchField`                                                                                                                 | surface-2, leading icon, optional `shortcut` kbd hint, Esc → `onClear`; `label` required                                                                                                                                                                                                                                                    |
| `segmented-control.tsx`                 | `SegmentedControl`, `SegmentedControlItem`                                                                                    | Radix RadioGroup: arrows move the selection, never empty                                                                                                                                                                                                                                                                                    |
| `switch.tsx`                            | `Switch`                                                                                                                      | 32×18; always pair with a visible label                                                                                                                                                                                                                                                                                                     |
| `tag-chip.tsx`, `tag-input.tsx`         | `TagChip`, `TagInput`                                                                                                         | controlled `value` / `onValueChange`; Enter adds, Backspace/Delete on a chip removes, Backspace in the empty field removes the last tag; `suggestions` (Combobox list, present tags left out); list named `listLabel` ("Tags"). `TagChip` `partial` (dashed) + `count` ("2/3"), `onActivate`/`activateLabel`, `removeLabel` (008 bulk edit) |
| `combobox.tsx`                          | `Combobox`, `ComboboxOption`                                                                                                  | WAI-ARIA combobox + listbox on Radix Popover, styled like `SelectTrigger` (008). `mode` `free` (any text) or `pick` (option values only; free text reverts on blur); contains-match, ≤ 8 options; ↑/↓, Enter, Esc; unused keys reach `onKeyDown`; `onOptionSelect`                                                                          |
| `markdown-view.tsx`                     | `MarkdownView`                                                                                                                | renders `parseMarkdown` blocks as React elements only (never HTML); empty text → "Nothing to preview."                                                                                                                                                                                                                                      |
| `kind-tile.tsx`                         | `KindTile`                                                                                                                    | six kinds at 22/28/30/40px, neutral fallback, `decorative` hides it from AT                                                                                                                                                                                                                                                                 |
| `banner.tsx`                            | `Banner`                                                                                                                      | `tone` warning · success · error (icon per tone), `action`, `onDismiss`                                                                                                                                                                                                                                                                     |
| `dialog.tsx`                            | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose` | Radix Dialog; width via className                                                                                                                                                                                                                                                                                                           |
| `toast.tsx`                             | `ToastProvider`, `Toaster`, `useToast`                                                                                        | `toast({ message, action?, duration? })` → id, `dismiss(id)`; 2.6s, polite, not shortened by reduced motion                                                                                                                                                                                                                                 |
| `popover.tsx`                           | `Popover`, `PopoverTrigger`, `PopoverAnchor`, `PopoverContent`                                                                | Radix Popover; content is a named `dialog` (pass `aria-label`), 12px radius, hover shadow; anchor to a non-trigger with `PopoverAnchor`                                                                                                                                                                                                     |
| `dropdown-menu.tsx`, `context-menu.tsx` | `DropdownMenu*`, `ContextMenu*` (Content, Item, Separator, Label, Sub/SubTrigger/SubContent, RadioGroup/RadioItem)            | Radix menus with shared classes (`lib/menu.ts`); `Item` takes `destructive` and a decorative `shortcut` hint; the checked `RadioItem` shows a check icon                                                                                                                                                                                    |
| `coach-mark.tsx`                        | `CoachMark`, `CoachMarkAnchor`                                                                                                | controlled tour step card; Esc skips; centred when there is no anchor                                                                                                                                                                                                                                                                       |
| `panel.tsx`, `tooltip.tsx`              | `Panel*`, `Tooltip*`                                                                                                          | unchanged                                                                                                                                                                                                                                                                                                                                   |

All of them are shown in the dev-only gallery at `/design` in `apps/app`.

## Usage in an app

```css
@import 'tailwindcss';
@import '@sododeck/ui/styles.css';
@source '../../../packages/ui/src';
```

```tsx
import { Button } from '@sododeck/ui/components/button';
```

## Adding components

`pnpm dlx shadcn@latest add <name>` from `packages/ui` (see `components.json`). Then restyle to DESIGN.md tokens and add a test.

## Token name mapping

DESIGN.md `text-secondary` → `ink-secondary`, `muted` → `ink-muted` (to avoid clashing with shadcn's `muted` background). Everything else keeps its DESIGN.md name.

## Tokens added by 000

- Motion: `--sd-dur-hover` 150ms (Tailwind's default transition duration), `--sd-dur-dim` 250ms, `--sd-dur-ring` 200ms, `--sd-flow-token-loop` 1400ms, `--sd-flow-step` 1700ms, `--sd-toast` 2600ms. Under `prefers-reduced-motion: reduce` the first four become 0ms; step and toast stay (reading time). Use `duration-(--sd-dur-*)`, never fixed ms.
- Radius: `rounded-segment` 7px, `rounded-row` 8px, `rounded-banner` 14px. Shadow: `shadow-hover`, `shadow-tour`. Text: `text-code-md`.

## Tokens added by 003

- Motion: `--sd-toast-undo` 6000ms (`MOTION.toastUndoMs`), the display time of a toast with an Undo action (delete, §g-19). Reading time, so not shortened under reduced motion.

## Enforced by tests (`test/`)

- `tokens-only.test.ts`: no hex/rgb/hsl, Tailwind palette colors, arbitrary colors or radii, or `dark:` in components; no `text-ink-muted` on `bg-surface-2` (4.40:1, use `text-ink-secondary`).
- `contrast.test.ts`: every text token pair ≥ 4.5:1 and focus/non-text pairs ≥ 3:1 in both themes. Input border and switch-off track are founder-approved exceptions; adding one needs founder approval.
- Component tests query by role/label and drive the keyboard; `keyboard-a11y.test.tsx` checks tab order, `focusRing` and accessible names across controls.

## Boundaries

- Presentational only: no document model, no Yjs, no app state, no routing.
- No hard-coded colors in components — tokens only. No `dark:` color overrides; tokens switch themselves.
- No new runtime dependency without founder approval: build on the Radix primitives in `radix-ui` (ADR 0003).
- No network requests (fonts are self-hosted via @fontsource).
