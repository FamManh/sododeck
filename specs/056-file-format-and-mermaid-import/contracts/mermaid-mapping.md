# Contract: accepted Mermaid grammar and mapping

Input is plain text. Before parsing: strip a BOM, normalise line endings, remove a surrounding
Markdown fence (` ```mermaid … ``` `; if the text holds several diagrams the first supported one
is used and the rest are reported as `extra-diagram`), remove front matter (`--- … ---`; its
`title:` is kept), and drop `%%` comment lines. The diagram type is the first remaining line's
keyword.

| Keyword                            | Result                              |
| ---------------------------------- | ----------------------------------- |
| `flowchart`, `graph` (+ direction) | flowchart import                    |
| `sequenceDiagram`                  | sequence import                     |
| anything else (`erDiagram`, …)     | `unsupported-type`; nothing created |
| no keyword found                   | `nothing-readable`                  |

## Flowchart

**Direction**: `TB`, `TD`, `BT`, `LR`, `RL`; none means `TB`.

**Nodes** (`id` then optional shape text; label may be quoted; `<br/>` → newline; entities decoded):

| Mermaid                    | Type id                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `id` (bare)                | `rectangle`, title = id                                              |
| `id[text]`                 | `rectangle`                                                          |
| `id(text)`                 | `rounded-rectangle`                                                  |
| `id([text])`               | `pill`                                                               |
| `id[[text]]`               | `rectangle`                                                          |
| `id[(text)]`               | `cylinder`                                                           |
| `id((text))`               | `ellipse`                                                            |
| `id(((text)))`             | `ellipse`                                                            |
| `id>text]`                 | `document-shape`                                                     |
| `id{text}`                 | `diamond`                                                            |
| `id{{text}}`               | `hexagon`                                                            |
| `id[/text/]`, `id[\text\]` | `parallelogram`                                                      |
| `id[/text\]`, `id[\text/]` | `rectangle`                                                          |
| `id@{ shape: … }`          | not supported: node kept as `rectangle`, line reported `unsupported` |

A node mentioned again with a new label keeps its first label; a node seen only in links takes its
id as title.

**Links**: `-->`, `---`, `-.->`, `-.-`, `==>`, `===`, `<-->`, `--o`, `--x` (the last two as
`normal`), with label forms `-->|text|`, `-- text -->`, `-. text .->`, `== text ==>`. Chains
(`A --> B --> C`) and groups (`A & B --> C & D`) expand to one connection per pair.

| Mermaid              | Edge                                      |
| -------------------- | ----------------------------------------- |
| `-->`, `==>`, `-.->` | `direction` omitted (forward)             |
| `---`, `-.-`, `===`  | `direction: 'none'`                       |
| `<-->`               | `direction: 'both'`                       |
| dotted / thick       | `style.dash: 'dotted'` / `style.width: 3` |
| label                | `label`                                   |
| `A --> A`            | self-connection kept                      |

**Subgraphs**: `subgraph id [title]` … `end`, nesting allowed; title falls back to the id.
Nodes declared inside belong to the innermost subgraph (a node first seen outside and later inside
keeps its first group). A link to or from a subgraph id becomes a connection to the group frame.
`direction` inside a subgraph is skipped (`unsupported`).

**Skipped with a reason**: `style`, `classDef`, `class`, `linkStyle` (`appearance`); `click`,
`callback`, `link` (`interaction`); `accTitle`, `accDescr`, `:::class` suffixes (`appearance`);
`@{ … }` metadata and `~~~` invisible links (`unsupported`); any other unreadable line
(`unreadable`).

## Sequence diagram

**Title**: `title text` → flow title and deck name.

**Participants**: `participant A`, `participant A as Display name`, `actor A [as Name]`. Undeclared
participants are created at first use. `actor` → type `actor`; others → type `component`. `box`,
`create`, `destroy` are skipped (`unsupported`).

**Messages**: `A->>B: text`, `A-->>B: text`, `A->B: text`, `A-->B: text`, `A-)B: text`,
`A--)B: text`, `A-xB: text`, `A--xB: text`, optional `+`/`-` activation markers (ignored).
Dashed forms (`-->>`, `-->`, `--)`, `--x`) are `dashed`. Missing text → empty label; the step
title then falls back to `<from> → <to>`.

**Flattened (kept as reading-order steps, reported `flattened`)**: `alt/else/end`, `opt`, `loop`,
`par/and`, `critical/option`, `break`, `rect … end`. The block label is added to the first covered
step's `notes`.

**Skipped**: `Note over/left of/right of`, `activate`, `deactivate`, `autonumber`, `links`,
`link`, `rect` colour, `participant` metadata (`appearance` or `flattened`).

## Output

| Item             | Rule                                                                              |
| ---------------- | --------------------------------------------------------------------------------- |
| Node size        | `defaultSize` of its type                                                         |
| Flowchart layout | ELK layered, direction from the diagram, groups as compounds, nodes never overlap |
| Group frame      | bounding box of its members (and child groups) plus the layout's group padding    |
| Sequence layout  | row, order of appearance, gap 80 px, y = 0                                        |
| Name             | diagram title, else `Imported diagram`                                            |
| Limits           | 512 KB text, 2,000 nodes/participants, 4,000 links/messages → `too-large`         |
