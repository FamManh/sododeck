# Data Model: Design Foundation (000)

This feature holds **no document data** (constitution I) and nothing is persisted. The "entities"
are static, typed design-system definitions in `packages/ui`. Theme preference stays where it is
today (`apps/app/src/theme/theme-store.ts`, localStorage, UI-only).

## Design token

| Field       | Type                                                       | Rules                                                                                                                                              |
| ----------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| name        | CSS custom property `--sd-*` (raw) / Tailwind key (mapped) | Declared once in `tokens.css`; mapped in `theme.css`; custom `text-*`, `rounded-*`, `shadow-*` keys registered in `utils.ts` tailwind-merge config |
| light value | CSS value                                                  | on `:root`                                                                                                                                         |
| dark value  | CSS value                                                  | on `.dark`; required for colors and shadow tints, inherited otherwise                                                                              |

New tokens in this feature:

| Group  | Tokens                                                                                                                                                          |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Motion | `--sd-dur-dim` 250ms · `--sd-dur-ring` 200ms · `--sd-flow-token-loop` 1400ms · `--sd-flow-step` 1700ms · `--sd-toast` 2600ms · `--sd-ease` ease                 |
| Radius | `--radius-segment` 7px · `--radius-row` 8px · `--radius-banner` 14px                                                                                            |
| Shadow | `--shadow-hover` `0 4px 16px var(--sd-shadow)` · `--shadow-tour` `0 12px 32px var(--sd-shadow-tour)` · `--sd-shadow-tour` rgba(0,0,0,.25) / dark rgba(0,0,0,.6) |

**State rule (reduced motion):** under `prefers-reduced-motion: reduce`, `--sd-dur-dim`,
`--sd-dur-ring`, `--sd-flow-token-loop` → `0ms`; `--sd-flow-step` and `--sd-toast` unchanged
(they are reading time, not animation). The TS mirror `resolveMotion(reduced)` returns the same
values; a test asserts CSS and TS agree.

## Motion (TS mirror)

```ts
interface Motion {
  dimMs: number; // 250 | 0
  ringMs: number; // 200 | 0
  tokenLoopMs: number; // 1400 | 0 (0 = do not loop; show static marker)
  stepMs: number; // 1700 (÷ speed by the caller)
  toastMs: number; // 2600 (never reduced)
}
```

## Component kind

| Field | Type                                                                        | Rules                                                                                                                             |
| ----- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| kind  | `'client' \| 'gateway' \| 'service' \| 'queue' \| 'database' \| 'external'` | `toComponentKind(s)` is case-insensitive, trims, maps prototype aliases `edge`→gateway, `data`→database; returns `null` otherwise |
| label | string                                                                      | "Client", "Gateway", …                                                                                                            |
| icon  | `LucideIcon`                                                                | see research R4                                                                                                                   |
| tone  | `{ bg: soft token class; fg: ink token class }`                             | from DESIGN.md "Kind & Semantic Tints"                                                                                            |

Fallback (unknown/`null` kind): icon `Shapes`, tone surface-2 / ink-muted (never an error or empty).

## Kind tile size

`22 | 28 | 30 | 40` px. Radius = `round(0.3 × size)` → 7, 8, 9, 12 px. Icon size ≈ 0.6 × size
(13, 17, 18, 24 px). Default size 30 (canvas node).

## Icon mapping entry

| Field | Type                                                                        | Rules                                                            |
| ----- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| glyph | `MaterialGlyph` (string-literal union of every glyph used in the prototype) | extracted once from `docs/design/claude-design/`                 |
| icon  | `LucideIcon`                                                                | required                                                         |
| note  | `string?`                                                                   | required when the icon is a substitute rather than an equivalent |

Invariant (tested): every `MaterialGlyph` has an entry.

## Tag

A tag is a string value owned by the caller (later: node tags in the Yjs doc via `@sododeck/model`;
the UI component is controlled and never stores tags itself).

| Operation              | Rule                                                                              |
| ---------------------- | --------------------------------------------------------------------------------- |
| `normalizeTag(raw)`    | trim; lower-case; collapse inner whitespace to one space; `''` → `null`           |
| `addTag(tags, raw)`    | returns `tags` unchanged if normalized is `null` or already present; else appends |
| `removeTag(tags, tag)` | removes the exact tag; order of the rest preserved                                |

Example: `addTag(addTag([], 'PII'), '')` → `['pii']`; `addTag(['pii'], ' PII ')` → `['pii']`.

## Coach-mark step (UI-only props)

| Field       | Type                                       | Rules                                                     |
| ----------- | ------------------------------------------ | --------------------------------------------------------- |
| step        | number, 1-based                            | `1 ≤ step ≤ total`                                        |
| total       | number                                     | ≥ 1                                                       |
| title, body | ReactNode                                  |                                                           |
| anchor      | element ref / Radix `Popover.Anchor` child | if missing/off-screen, content collision-avoids into view |

Transitions: `Back` disabled at step 1; `Next` at `step === total` reads "Done" and calls
`onFinish`; `Skip` and Esc call `onSkip`. The owning feature (013) holds the step state.

## Toast

| Field    | Type                                   | Rules                                                       |
| -------- | -------------------------------------- | ----------------------------------------------------------- |
| message  | string                                 | announced via polite live region                            |
| action   | `{ label: string; onAction(): void }?` | e.g. "Undo"                                                 |
| duration | ms                                     | default `--sd-toast` 2600; not reduced under reduced motion |

Queue: toasts are shown in order (Radix viewport), each announced.
