# Data Model: Card Style (020)

Decisions and alternatives are in [research.md](research.md). This file lists the shapes, rules and state.

## File format (schema v1, additive, no version bump)

### New `$defs`

| Def         | Shape                                                                                              | Notes                                                           |
| ----------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `CardColor` | `enum`: `red, orange, amber, yellow, lime, green, teal, cyan, blue, indigo, violet, pink, slate`   | Named palette; theme-aware in the app.                          |
| `HexColor`  | `string`, `pattern ^#[0-9a-f]{6}$`                                                                 | Lowercase with `#`, so one spelling per colour.                 |
| `ColorRef`  | `anyOf [CardColor, HexColor]`                                                                      | Generated TS type: `CardColor \| string`.                       |
| `Style`     | `object { fill?: ColorRef, stroke?: ColorRef }`, `additionalProperties: false`, `minProperties: 1` | An empty style is invalid; "no colour" means `style` is absent. |

### New optional properties

| Where               | Property   | Type                        | Position in key order        |
| ------------------- | ---------- | --------------------------- | ---------------------------- |
| Root `SododeckFile` | `swatches` | `HexColor[]`, `uniqueItems` | after `tags`, before `nodes` |
| `Node`              | `style`    | `Style`                     | after `position`             |
| `Group`             | `style`    | `Style`                     | after `size`                 |

The format itself does not limit the list: `maxItems` is deliberately absent (§g-52, FR-004). `MAX_SWATCHES = 12` is enforced only by `addSwatch`.

### Examples

```json
{
  "id": "checkout-api",
  "type": "service",
  "title": "Checkout API",
  "style": { "fill": "green", "stroke": "#7a3cff" }
}
```

```json
"swatches": ["#7a3cff", "#1f2a44"]
```

### Validation rules

| Rule                                     | Enforced by                                           | Test                                                           |
| ---------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| Fill / stroke is a name or lowercase hex | Ajv + generated Zod                                   | invalid fixtures: `"Green"`, `"#7A3CFF"`, `"#abc"`, `"purple"` |
| `style` has at least one key             | Ajv `minProperties`; semantic rule S6 if Zod drops it | invalid fixture `style: {}`                                    |
| No duplicate swatches                    | Ajv `uniqueItems` (Zod keeps it as a refine)          | invalid fixture with a repeated hex                            |
| Unknown key inside `style`               | `additionalProperties: false`                         | invalid fixture `style.opacity`                                |
| At most 12 swatches                      | model op `addSwatch` only                             | model test: 13th add throws, file with 14 loads                |

## Yjs layout (packages/model)

| Data                        | Yjs shape                                                 | Written by                                                   |
| --------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| `node.style`, `group.style` | nested `Y.Map { fill?, stroke? }` on the object's `Y.Map` | `setStyle`, or generic `add` / `update` / paste / `fromJSON` |
| `swatches`                  | `meta` → `Y.Array<string>`                                | `addSwatch`, `removeSwatch`, `fromJSON`                      |

### Model API (added by 020)

```ts
type StyleChannel = 'fill' | 'stroke';
interface StyleTargets { nodes: readonly Id[]; groups: readonly Id[] }

DeckEditor.setStyle(targets: StyleTargets, channel: StyleChannel, value: ColorRef | null): void;
DeckEditor.addSwatch(hex: string): void;     // normalizes; no-op if present; throws DeckEditError('invalid') at ≥ 12
DeckEditor.removeSwatch(hex: string): void;  // no-op if absent; never touches nodes or groups
export const MAX_SWATCHES = 12;
```

What `setStyle` does:

1. It validates `value` against the generated `ColorRef` schema, throwing before any write.
2. It runs one transaction across all targets. For each target it sets or deletes the `channel` key in the object's `style` map (creating the map if needed), then deletes `style` if the map is now empty.
3. It skips unknown ids silently, the same as other bulk ops. If `targets` is empty, it does nothing.

### Round-trip cases (`packages/model/test/round-trip.test.ts`)

- A node with a named fill, a node with a hex stroke, and a node with both.
- A group with a fill and a stroke.
- A deck with `swatches`, where the order is preserved.
- A deck with 14 swatches, which loads and round-trips.
- An older deck without any of these fields, which comes back with no `style` and no `swatches` keys.
- Key order: `style` follows `position` / `size`, and `swatches` follows `tags`.

## Named colour tokens

Light and dark values are hex, converted from DESIGN.md's OKLCH values with sRGB gamut clipping. They go in `packages/ui/src/styles/tokens.css` as `--sd-card-<name>-fill` / `--sd-card-<name>-stroke`.

| Name   | Light fill | Light stroke | Dark fill | Dark stroke |
| ------ | ---------- | ------------ | --------- | ----------- |
| red    | `#ffe4de`  | `#d15c53`    | `#482521` | `#eb8278`   |
| orange | `#ffe7d2`  | `#c9690c`    | `#452813` | `#e28d4f`   |
| amber  | `#ffeccd`  | `#b47900`    | `#3f2d0a` | `#cf9a35`   |
| yellow | `#f4f0ce`  | `#998800`    | `#36310b` | `#b5a737`   |
| lime   | `#e5f5d6`  | `#679725`    | `#273617` | `#89b559`   |
| green  | `#d9f8e0`  | `#259f56`    | `#183822` | `#5ebc7b`   |
| teal   | `#cff9f1`  | `#00a28d`    | `#013932` | `#00beab`   |
| cyan   | `#cdf7ff`  | `#009bbe`    | `#003742` | `#00b8d7`   |
| blue   | `#dbf1ff`  | `#4087de`    | `#1c314c` | `#6aa7f4`   |
| indigo | `#e7ecff`  | `#737ade`    | `#2a2d4c` | `#929bf5`   |
| violet | `#f4e8ff`  | `#986dd0`    | `#352947` | `#b490e8`   |
| pink   | `#ffe3f3`  | `#c65b93`    | `#452434` | `#e181b0`   |
| slate  | `#e6ecf3`  | `#667383`    | `#292e35` | `#8693a5`   |

There are two more tokens, with the same value in both themes: `--sd-card-text-dark: #1c1c1a` and `--sd-card-text-light: #ffffff`.

New contrast-test pairs:

- `ink` on each fill, at 4.5:1.
- `text-secondary` on each fill, at 4.5:1.
- Each stroke on `surface`, at 3:1 (non-text).

Measured: light ink ≥ 14.1, light secondary ≥ 6.2, dark ink ≥ 11.0, dark secondary ≥ 6.4, and strokes ≥ 3.2.

## App-side derived data (no document copies)

```ts
/** Resolved look of one card or group; derived in deck-to-flow, cached per object. */
interface CardLook {
  fill?: string; // 'var(--sd-card-green-fill)' | '#7a3cff'
  stroke?: string; // same forms
  text: 'default' | 'dark' | 'light'; // 'default' = theme ink; dark / light only on a custom fill
  namedFill: boolean; // subtitle switches muted → secondary
}
```

- `resolveLook(style: Style | undefined, preview?: StylePreview): CardLook | undefined` is pure. It returns `undefined` when there is no colour, so plain cards keep their existing data.
- `readableText(hex)` (`packages/ui/src/lib/contrast.ts`) returns `{ text: 'dark' | 'light'; ratio; readable }`.

## UI state (Zustand, UI-only)

| Field            | Type                                                       | Lifecycle                                                                                          |
| ---------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `toolbarField`   | adds `'style'` to `ToolbarFieldId`                         | opened by the toolbar button or the menu's "Colour…"; cleared by `setCanvasGesture`, Esc, or close |
| `stylePickerTab` | `'fill' \| 'stroke'`                                       | set on open (the drawer row preselects its tab); kept while the picker is open                     |
| `stylePreview`   | `{ channel: 'fill' \| 'stroke'; value: ColorRef } \| null` | set while the custom input is open and valid; cleared on Add, Cancel, close or selection change    |

### Picker states

```text
closed ──open──▶ palette ──"+"──▶ adding ──Add (valid)──▶ palette   [one undo step: addSwatch + setStyle]
                   │  ▲             │ Cancel / Esc ──────▶ palette   [preview cleared, no undo entry]
                   │  └─────────────┘
                   ├─ pick swatch / No colour  [one undo step: setStyle] (picker stays open)
                   ├─ remove custom swatch     [one undo step: removeSwatch]
                   └─ Esc / outside click ──▶ closed (focus to opener)
```

- The "+" button is not rendered when `swatches.length >= 12`.
- Add is disabled while `normalizeHex(input) === null`.
- The warning "Text may be hard to read on this colour" shows while `readableText(hex).readable === false` (FR-026).
