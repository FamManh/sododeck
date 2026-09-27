# Quickstart / validation guide: Design Foundation (000)

How to prove the feature works. Details of APIs are in [contracts/components.md](contracts/components.md);
entity rules in [data-model.md](data-model.md).

## Prerequisites

- Node ≥ 24 (`.nvmrc`), pnpm via `packageManager`. `pnpm install` at repo root.

## 1. Automated checks (definition of done)

```bash
pnpm --filter @sododeck/ui test        # component + pure-function tests
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

Expected in `@sododeck/ui` tests:

| Test file                   | Proves                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `test/tokens-only.test.ts`  | SC-003: 0 hex/rgb/hsl/palette colors or `dark:` in `src/components/`                                                                    |
| `test/contrast.test.ts`     | SC-004: all text pairs ≥ 4.5:1, focus indicator ≥ 3:1, light + dark (founder-approved exceptions listed; muted on surface-2 never used) |
| `test/motion.test.ts`       | US5: default values; reduced → 0 for dim/ring/loop, toast stays 2600; CSS and TS agree                                                  |
| `test/icons.test.ts`        | SC-007: every prototype glyph mapped; six kinds + aliases + fallback                                                                    |
| `test/tags.test.ts`         | "PII", Enter, Enter → `['pii']`; trim/case/dedupe                                                                                       |
| `test/<component>.test.tsx` | US1/US2/US4: role/label queries, keyboard (Tab, Space, Enter, arrows, Esc), states                                                      |

`pnpm e2e` (existing smoke suite incl. "no third-party requests") must pass unchanged.

## 2. Gallery review (dev only)

```bash
pnpm dev            # app on http://localhost:5173
open http://localhost:5173/design
```

Check:

1. Every block in the contract table is present with all variants and states (SC-001).
2. Toggle light/dark: everything re-themes without reload, no light-colored leftovers (US1-2).
3. Keyboard only: Tab through the whole page; each control shows the orange 2px focus outline
   and operates with Space/Enter/arrows; dialog traps focus and Esc returns focus to the trigger
   (SC-005).
4. TagInput: type `PII`, Enter, Enter → one chip `pii`.
5. Toast: trigger → disappears after ~2.6 s; with a screen reader it is announced.
6. Coach mark: 3 steps, Back disabled on 1, Next on 3 reads "Done", Esc skips.
7. Reduced motion: enable OS "Reduce motion" (macOS: System Settings → Accessibility → Display),
   reload not required → gallery shows `reduced: true`, the looping demo stops (SC-006).
8. Screenshots at 1440×900, light and dark, next to `docs/design/screens/02-editor-node-selected`,
   `14-editor-palette-tab`, `06-export-json`, `05-empty-deck-tour-1`, `01-library`,
   `22-editor-custom-view-toast`; list every difference (allowed: DESIGN.md overrides, lucide icons,
   focus outline, `ink-secondary` on surface-2) (SC-002).
9. Optional: Lighthouse accessibility audit on `/design` in both themes.

## 3. Production exclusion (FR-026)

```bash
pnpm --filter @sododeck/app build
grep -rl "design-gallery" apps/app/dist && echo "LEAK" || echo "ok: gallery not shipped"
pnpm --filter @sododeck/app preview   # http://localhost:4173/design → Not found page
```
