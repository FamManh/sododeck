# Contract: file format additions (v1, additive)

Applies to `packages/schema/schema/v1.json`. After editing run `pnpm schema:generate`; the Ajv/Zod
parity test, the full-example coverage test and the key-order test must stay green.

```jsonc
// Sticky — appended after "showInFlows", in this order
"size":     { "$ref": "#/$defs/Size", "description": "Note box in canvas units. Absent means 200 × 200. Ignored while collapsed." },
"fontSize": { "type": "integer", "enum": [12, 14, 16, 20, 24, 32], "description": "Fixed text size in px. Absent means Auto: the size follows the note's size and text." },
"align":    { "type": "string", "enum": ["left", "center", "right"], "description": "Text alignment. Absent means centre." },
"tags":     { "$ref": "#/$defs/Tags" },
"locked":   { "const": true, "description": "True when the note cannot be moved, resized or deleted. Absent means unlocked." }

// Edge — appended after the last property
"locked":   { "const": true, "description": "True when the connector cannot be reshaped, reconnected or deleted. Absent means unlocked." }

// Edge.from / Edge.to — description only: "Id of a node, group or sticky."
```

## Examples

```json
{ "id": "st1", "text": "Why two queues?", "color": "blue", "position": {"x": 40, "y": -120},
  "size": {"w": 220, "h": 160}, "fontSize": 16, "align": "left", "tags": ["Question"], "locked": true }
{ "id": "e9", "from": "st1", "to": "n4" }
```

## Invalid fixtures (must be rejected)

`fontSize: 13`, `fontSize: "16"`, `align: "justify"`, `locked: false`, `size: {w: 0, h: 10}`, `tags: "a"`,
`Edge.locked: "yes"`.

## Compatibility

- Every existing file stays valid with the same meaning (stickies show at the default size, Auto text,
  centred, no tags, unlocked).
- Older builds keep unknown optional fields (ADR 0020). A connector ending on a sticky shows as a
  broken reference there (accepted, as ADR 0031).
- JSON → Yjs → JSON is lossless for every new field (round-trip test per field).
