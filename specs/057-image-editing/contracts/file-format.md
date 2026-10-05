# Contract: file format additions (057)

Additive to v1 and to 055's `Image`; `version` stays 1; `additionalProperties: false` stays.

## Image

```jsonc
{
  "id": "img-k3m9",
  "asset": "9f86d0…(64 hex)",
  "position": { "x": 120, "y": 80 },
  "size": { "width": 240, "height": 150 }, // box of the visible part
  "z": 4,
  "locked": true,
  "crop": { "x": 0.25, "y": 0.1, "width": 0.5, "height": 0.5 }, // new, optional
  "flipX": true, // new, optional
  "flipY": true, // new, optional
}
```

## Schema (`packages/schema/schema/v1.json`)

- New def `Crop`: object, `additionalProperties: false`, required `x`, `y`, `width`, `height`;
  `x`, `y`: number, `minimum: 0`, `exclusiveMaximum: 1`; `width`, `height`: number,
  `exclusiveMinimum: 0`, `maximum: 1`. Description: fractions of the picture's natural size, in the
  picture's unflipped coordinates; absent means the whole picture.
- `Image.properties.crop`: `$ref: #/$defs/Crop`.
- `Image.properties.flipX`, `flipY`: `const: true`, described like `locked` ("absent means not
  flipped; `false` is not valid, so unflipping removes the key").
- Regenerate types and Zod (`pnpm schema:generate`); Ajv / Zod parity test covers the new fields.
- `examples/full.sododeck.json` uses `crop`, `flipX` and `flipY` (coverage test).

## Semantics

| Rule | What                                                                                                               | Where             | On failure                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------- |
| C1   | Shape and per-field ranges of `crop`, `flipX`, `flipY`.                                                            | JSON Schema       | file invalid, reported with path (062)                           |
| C2   | `crop.x + crop.width ≤ 1` and `crop.y + crop.height ≤ 1` (tolerance 1e-6).                                         | model load checks | trimmed to the picture; problem `crop-trimmed`; dropped if empty |
| C3   | A crop equal to the whole picture is not written; a writer never emits `flipX: false` (schema already refuses it). | model write       | n/a                                                              |

C2 is not in `semantic-rules.ts` because it must not refuse the file (spec FR-016).

## Round-trip

document → file → document is lossless for `crop`, `flipX`, `flipY`; a 055 file (no new keys)
re-saves byte-identically; picture bytes in `assets` are the original stored bytes, never an
edited copy.

## Export (not part of the file format, listed for completeness)

SVG: unedited image unchanged (`<image preserveAspectRatio="xMidYMid meet">`). Edited image (the
example above with `flipX` only, picture 1280 × 800):

```xml
<g data-export="image" data-id="img-k3m9">
  <svg x="120" y="80" width="240" height="150"
       viewBox="320 80 640 400" preserveAspectRatio="xMidYMid meet">
    <image href="data:image/png;base64,…" width="1280" height="800"
           transform="translate(1280 0) scale(-1 1)"/>
  </svg>
  <!-- caption as today -->
</g>
```

The mirror transform is around the whole picture, so the `viewBox` is the crop region mirrored with
it: `x = W − (crop.x + crop.width) × W` when `flipX` (here 1280 − 960 = 320), likewise `y` with `H`
when `flipY`. The same part of the picture therefore stays visible, mirrored (spec US2-6).
`pictureLayout` gives both numbers, so canvas and export cannot drift. PNG rasterises the same SVG.
