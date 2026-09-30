# 0018. Card colour is a named or hex `ColorRef`, written key by key, with text chosen by contrast

- **Status:** Accepted
- **Date:** 2026-09-30
- **Feature:** `specs/020-card-style` (spec, research R1–R15, contracts)

## Context

020 lets users colour a card or group's fill and stroke: 13 named colours (design 105–107), or a
custom hex colour added to the deck's own swatches. This is the first time the file format
carries a colour that is user data rather than a fixed token, and the first optional nested object
on `Node` and `Group` other than `position` since 016's frames.

The change must stay additive (principle II, ADR 0002: no version bump), every write must go
through `DeckEditor` as exactly one undo step (principle I), export renders in one theme only
(light), and card colour must never be confused with state (selection, flow, error), which already
own their own frame, border and badge.

## Decision

1. **`ColorRef` as a named enum plus lowercase hex (R1).** Schema v1 gains `$defs/CardColor` (the
   13 names), `$defs/HexColor` (`^#[0-9a-f]{6}$`, lowercase only), `$defs/ColorRef`
   (`anyOf: [CardColor, HexColor]`), and `$defs/Style` (`{ fill?, stroke? }`,
   `additionalProperties: false`, `minProperties: 1`, so `"style": {}` is invalid — "no colour" is
   an absent `style`, not an empty one). `Node.style` (after `position`) and `Group.style` (after
   `size`) are optional. Root `swatches` is an optional `HexColor[]` with `uniqueItems: true` and
   **no `maxItems`** (§g-52): the 12-colour cap is an editor rule, not a schema one, so a file from
   another tool with more swatches still loads. The change is additive, so there is no version
   bump (ADR 0002). `json-schema-to-zod` drops `minProperties`, so "a style has a fill, a stroke,
   or both" is semantic rule **S6** in `packages/schema/src/semantic-rules.ts`; `uniqueItems`
   survives as a generated `.refine`, so no S7 was needed.
2. **`setStyle` writes key by key (R2).** `packages/model/src/ops/style.ts`'s
   `setStyle(ctx, targets, channel, value)` sets or deletes one key (`fill` or `stroke`) in a
   node's or group's nested `style` `Y.Map`, the same pattern `writeFields` already uses for other
   nested fields, so a fill change in one tab and a stroke change in another merge instead of one
   clobbering the other. It deletes the `style` map entirely once both keys are gone. One call
   covers a mixed selection of nodes and groups in a single undo step (FR-015).
3. **Swatches as a `meta` `Y.Array`, capped in the model only (R3, §g-52).** `swatches` lives in
   `meta` exactly like `tags`. `addSwatch`/`removeSwatch` (`packages/model/src/ops/swatches.ts`)
   push to or splice the `Y.Array` rather than replacing it wholesale, so concurrent adds in two
   tabs both survive; `MAX_SWATCHES = 12` is enforced in `addSwatch`, not in the schema, and is
   exported so the UI hides "+" at the cap instead of duplicating the constant.
4. **Hex tokens clipped from OKLCH (R4).** `packages/ui/src/styles/tokens.css` ships hex values for
   all 13 named colours' fill/stroke pairs in both themes, converted from DESIGN.md's OKLCH source
   with an sRGB gamut clip, because 10 of 13 pairs fall slightly outside sRGB and browsers would
   clip them anyway; doing it once in a tested table keeps canvas, minimap and export identical,
   and lets the existing hex-only contrast tests cover the new pairs with no new OKLCH parser.
   `--sd-card-text-dark` / `--sd-card-text-light` are the two candidates for text on a custom fill.
5. **Higher-contrast text, with a warning band (R6).** `readableText(hex)`
   (`packages/ui/src/lib/contrast.ts`) picks whichever of dark or light text gets the higher WCAG
   ratio against a custom fill, rather than a fixed luminance threshold. The switch lands near
   relative luminance ≈ 0.204; between ≈ 0.183 and ≈ 0.227 neither choice reaches 4.5:1 — the
   clarified spec (FR-026) still allows the colour there and the picker shows a warning
   (`style-picker.tsx`'s `warn`) instead of blocking it. DESIGN.md's old "below 0.18 flips to
   white" line is replaced by this rule and the warning band.
6. **The live preview is UI-only (R9).** `stylePreview` lives in the UI store, not Yjs: it is read
   by `card-style.ts`'s `resolveLook` for selected ids only, so hovering a custom colour shows it
   on the card without writing, creating an undo entry, or reaching autosave / other tabs. Commit
   (Add) writes through `setStyle`/`addSwatch` inside one `oneStep`, then clears the preview;
   Cancel or close only clears it.

## Alternatives considered

- **One string `pattern` for both names and hex** (R1): rejected — loses the enum as a documented,
  discoverable type for the schema, CLI and any future tooling.
- **`{ name } | { hex }` objects** (R1): rejected — more verbose JSON than the required
  `"fill": "green"` shape.
- **Extending `writePatch` to merge `style` like `position`** (R2): rejected — "clear only the
  fill" would need a nested `null` inside the shared `Patch` type for one field.
- **Replacing `swatches` wholesale via `updateMeta`** (R3): rejected — last write wins, losing one
  of two concurrent adds.
- **OKLCH kept as the runtime source, parsed at render time** (R4): rejected — needs a new OKLCH
  parser in the contrast tests, and export would still need hex in the end.
- **A fixed 0.18 relative-luminance threshold** (R6): rejected — chooses dark text for part of the
  0.18–0.204 range where light text is strictly more readable; also theme-dependent ink was
  rejected because a custom fill's colour does not change with the theme, so its text should not
  either.
- **Each `DeckNode` subscribing to the preview in the store** (R9): rejected — 500 selector calls
  on every store change; mapping the preview in at the same point as selection (`deck-to-flow.ts`)
  keeps the cache logic in one place.
- **`react-colorful`** (R8, picker UI): rejected per constitution VIII — the saturation/value box
  and hue slider are ~150 lines on the platform and Radix, with no new runtime dependency.

## Consequences

- Card colour round-trips losslessly (`packages/model/test`), with cases for an absent `style`, a
  named colour, a custom hex, and an old deck with neither `style` nor `swatches`.
- `apps/app/src/editor/export/export-palette.ts` resolves the same named colours to literal light
  hex (export is always light-mode), structurally parallel to but intentionally not sharing code
  with `card-style.ts`'s CSS-var resolution.
- A later feature that needs a different kind of per-object colour (e.g. connectors, 022) can reuse
  `ColorRef`/`Style` rather than inventing a new shape.
