# 0003. UI foundation: Radix-only primitives, visible focus outline, lucide icon vocabulary

- **Status:** Accepted
- **Date:** 2026-09-27
- **Feature:** `specs/000-design-foundation`

## Context

Feature screens are built by different agents over many weeks. They need shared building blocks
(`packages/ui`) that match the Claude Design screens in light and dark, are keyboard operable and
meet WCAG 2.1 AA (constitution VII), without new dependencies (constitution VIII). The prototype
uses Material Symbols, a soft orange focus halo and some colors that fail contrast.

## Decision

1. **Primitives:** every stateful control uses Radix from the existing `radix-ui` dependency:
   Dialog, Select, RadioGroup (segmented control), Switch, Toast, Popover (coach mark). No
   `sonner`, `cmdk` or other new packages. The segmented control uses RadioGroup rather than the
   planned ToggleGroup because RadioGroup moves the selection with the arrow keys and can never
   be cleared, which is what the spec asks for.
2. **Focus:** one shared style, `focusRing` in `packages/ui/src/lib/focus.ts`: a 2px Deck Orange
   outline with a 2px gap (3.14:1 light, 6.44:1 dark against the surface). The design's soft halo
   (≈1.1:1) remains the _selection_ look only. In Tailwind v4 the style must include
   `focus-visible:outline-solid`, because `outline-none` sets `--tw-outline-style: none`, which
   would otherwise make the outline invisible (a test guards this).
3. **Icons:** lucide at stroke 1.5. `packages/ui/src/lib/icons.ts` holds the typed Material →
   lucide mapping for all 80 prototype glyphs (substitutes carry a note) and the six component
   kinds (`client`, `gateway`, `service`, `queue`, `database`, `external`), accepting the
   prototype names `edge` and `data` as aliases. `docs/design/icon-mapping.md` mirrors it; a test
   keeps both in sync.
4. **Contrast** (founder decisions, 2026-09-27): text on surface-2 uses ink-secondary (muted is
   4.40:1 in light); input borders and the switch-off track stay below 3:1 as designed, mitigated
   by visible labels, the focus outline and the switch thumb position (plan.md Complexity
   Tracking). A token-pair test (`packages/ui/test/contrast.test.ts`) enforces the rest.
5. **Motion:** duration tokens in `tokens.css` (`--sd-dur-hover`, `--sd-dur-dim`, `--sd-dur-ring`,
   `--sd-flow-token-loop`) drop to 0 under `prefers-reduced-motion`; `--sd-flow-step` and
   `--sd-toast` do not, because they are reading time. Tailwind's default transition duration is
   the hover token, so plain `transition-*` utilities obey the setting too. `lib/motion.ts` and
   `hooks/use-reduced-motion.ts` expose the same values to JS.
6. **Enforcement by tests, not new tooling:** a Vitest check rejects hex/rgb/palette colors,
   arbitrary radii and `dark:` in components, and muted text on surface-2.

## Consequences

- No bundle growth from new packages; Radix handles focus traps, roving focus, Escape layering
  and live regions.
- Anyone adding a control must use `focusRing` and tokens; the tests fail otherwise.
- Matching the design "pixel-close" has documented, intentional differences
  (`specs/000-design-foundation/screens/README.md`).
- The contrast exceptions can be revisited as a DESIGN.md token change without code changes.
- `matchMedia` is used directly in `packages/ui` (it is standard in all supported browsers, and
  `packages/ui` cannot import `apps/app/src/lib/features.ts`); the hook still guards its absence.
