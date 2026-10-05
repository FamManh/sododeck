# Contract: file format additions (055)

Additive to v1; `version` stays 1; strict `additionalProperties: false` stays.

## Root

```jsonc
{
  "images": [
    {
      "id": "img_k3m9",
      "asset": "9f86d0…(64 hex)",
      "position": { "x": 120, "y": 80 },
      "size": { "w": 320, "h": 200 },
      "z": 4,
      "group": "grp_a1",
      "alt": "Checkout wireframe",
      "caption": "v2 draft",
      "locked": true,
    },
  ],
  "assets": {
    "9f86d0…": {
      "type": "image/png",
      "bytes": 48213,
      "width": 1280,
      "height": 800,
      "name": "checkout.png",
      "data": "iVBORw0KGgo…",
    },
  },
}
```

`images` and `assets` are written only when non-empty. A file without them opens and saves unchanged.

## Semantic rules (new, `semantic-rules.ts`)

| Rule             | Meaning                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| I1               | Every `images[].asset` has an `assets` entry.                                                                             |
| I2               | `assets` entry whose id is not used by any image is allowed (kept for undo-free round trip) and dropped on the next save. |
| I3               | `images[].group` names an existing group; `edges.from/to` may name an image.                                              |
| I4               | `type` is in the allow-list; `bytes` ≤ 5 242 880; decoded `data` length equals `bytes`.                                   |
| I5               | Image id does not clash with a node, group or sticky id.                                                                  |
| I6               | `size.w`, `size.h` ≥ 32; `width`, `height` ≥ 1.                                                                           |
| I7 (import only) | SHA-256 of decoded `data` equals the key (checked at import; mismatch → picture treated as missing).                      |

## Errors surfaced to the user (import)

| Case                                                     | Result                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| Bad base64, size/type mismatch, hash mismatch, over 5 MB | That picture is missing (placeholder); deck opens; one notice. |
| SVG fails sanitising                                     | That picture is missing; notice.                               |
| Any I1/I3/I5/I6 violation                                | `invalid-deck` as for any schema error.                        |

## Round trip

JSON → doc (+ byte map) → JSON must be byte-identical, including `assets`. A fixture with one image
of each of the six types is in `examples/full.sododeck.json` (tiny valid files, a few hundred bytes).
