# @sododeck/ui

**Responsibility:** the design system — tokens, the Tailwind v4 theme, and shared React components (shadcn/ui on Radix, icons from `lucide-react`). The source of design truth is `/DESIGN.md`.

- `src/styles/tokens.css` — raw CSS variables (`--sd-*`), light on `:root`, dark on `.dark`.
- `src/styles/theme.css` — Tailwind `@theme inline` mapping (the shared "preset"). DESIGN.md names (`bg-primary-soft`, `text-ink-muted`, `rounded-node`, `text-micro`, `shadow-rest`) plus shadcn aliases (`bg-background`, `text-muted-foreground`, …).
- `src/styles/styles.css` — what apps import (fonts + tokens + theme + base styles).
- `src/components/*` — one component per file, shadcn conventions (`data-slot`, `cva`, `cn`, function components, no barrel).
- `src/lib/utils.ts` — `cn()`; its tailwind-merge config must list every custom `text-*`, `rounded-*` and `shadow-*` key from theme.css.

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

## Boundaries

- Presentational only: no document model, no Yjs, no app state, no routing.
- No hard-coded colors in components — tokens only. No `dark:` color overrides; tokens switch themselves.
- No network requests (fonts are self-hosted via @fontsource).
