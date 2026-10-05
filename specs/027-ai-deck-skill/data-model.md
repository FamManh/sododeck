# Data model: AI deck skill (027)

No change to the `.sododeck` file format. The entities below are the skill's own outputs and the
build's inputs.

## Skill package (build output)

`packages/skill/dist/sododeck-deck/`

| Path                                               | Source                                   | Notes                                                                              |
| -------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `SKILL.md`                                         | `content/SKILL.md` + placeholders        | frontmatter `name`, `description`; router                                          |
| `VERSION.json`                                     | build                                    | `{ skill, formatVersion, fingerprint, schema }`                                    |
| `references/*.md`                                  | `content/references/*.md` + placeholders | modeling, flows, rules, database, taste, from-codebase, from-text-formats, scripts |
| `schema/v1.json`                                   | `@sododeck/schema/v1.json`               | byte copy                                                                          |
| `examples/*.sododeck`                              | `examples/`                              | pass validate + lint with zero entries                                             |
| `scripts/sododeck.mjs`                             | `src/cli/` bundled                       | the only code file of substance                                                    |
| `scripts/{validate,lint,summary,diff,deliver}.mjs` | build                                    | three-line entry files                                                             |

`VERSION.json`:

```json
{
  "skill": "1.0.0+3f9a1c0b2d4e",
  "formatVersion": 1,
  "fingerprint": "3f9a1c0b2d4e",
  "schema": "https://sododeck.com/schema/v1.json"
}
```

## Problem entry / problem report

Reused unchanged from 062 (`ProblemEntry`, `ProblemReport` in `@sododeck/model/report-json`).
Skill specifics: `app` = `"sododeck-deck-skill 1.0.0+<fingerprint>"`; `source.kind` = `"file"`.

## Authoring check (new catalogue family)

`CodeFamily` gains `'authoring'`. Entries (severity `warning`): `id-style`, `positions-mixed`,
`orphan-card`, `duplicate-title`, `label-too-long`, `level-over-budget`,
`connector-without-source`. Rules and thresholds: research R5. Each check is a pure function
`(file, options) → ProblemEntry[]` with `path` pointing at the offending value and `subject` the
object id.

Options:

| Option   | Values                                               | Default    |
| -------- | ---------------------------------------------------- | ---------- |
| `detail` | `faithful` (24) · `balanced` (12) · `simplified` (7) | `balanced` |
| `mode`   | `new` · `update` · `codebase` · `text`               | `new`      |

`mode` only switches checks: `update` skips `positions-mixed`; `codebase` adds
`connector-without-source`.

## Deck diff

```ts
interface DeckDiff {
  report: 'sododeck-diff';
  reportVersion: 1;
  old: string; // file name
  new: string;
  counts: { added: number; changed: number; removed: number };
  meta: string[]; // changed root keys other than the collections, sorted
  changes: DiffChange[];
}
interface DiffChange {
  collection:
    'nodes' | 'groups' | 'edges' | 'views' | 'features' | 'flows' | 'rules' | 'stickies' | 'images';
  id: string;
  change: 'added' | 'changed' | 'removed';
  title?: string; // new title, else old
  fields?: string[]; // changed keys (changed only), sorted
  steps?: { id: string; change: 'added' | 'changed' | 'removed'; fields?: string[] }[]; // flows only
}
```

Order: collections in file order, then `added`, `changed`, `removed`, then id. Matching is by id
only. Values compare by canonical JSON (key order ignored). `assets` are compared by key in the
`images` entry (a picture swap is a change on the image that uses it).

## Deck summary

```ts
interface DeckSummary {
  report: 'sododeck-summary';
  reportVersion: 1;
  name: string;
  totals: {
    cards: number;
    groups: number;
    connectors: number;
    flows: number;
    rules: number;
    views: number;
    notes: number;
  };
  levels: { parent: string | null; cards: number }[];
  groups: { id: string; title: string; cards: string[] }[]; // ungrouped cards under id ""
  connectors: { id: string; from: string; to: string; label?: string }[];
  flows: {
    id: string;
    title: string;
    steps: { id: string; from: string; to: string; branch?: string; rules?: string[] }[];
  }[];
  rules: { id: string; title: string; usedBy: string[] }[];
  problems: { error: number; warning: number }; // from lint, for the one-line pointer
}
```

Text form: one screen for ~30 cards (groups with card titles inline, flows as `1. web → api`).

## Import placement (app)

`ImportedDeck` (library worker result) gains `unplaced?: SododeckFile`: present only when at
least one card has no `position`. Nothing is stored in that case until the placed text has been
imported (R10).
