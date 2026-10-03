# Data Model: Scale Bench

No product data changes. These are the shapes the bench produces and reads.

## Size ladder

`SizeStep = { nodes: 500 | 2000 | 5000 | 10000; edges: 2 × nodes; seed: 42 }`. Decks come from `generateBenchDeck(nodes, edges, seed, options)`. Valid and deterministic: same input → byte-identical `SododeckFile`.

## Areas

`Area` = one of `canvas-fps` · `flow-highlight` · `load` · `snapshot` · `derivation` · `autosave` · `compaction` · `update-log` · `multi-tab` · `json-panel` · `export` · `layout` · `memory`.

## MeasurementRow

| Field        | Type                                                     | Meaning                                                          |
| ------------ | -------------------------------------------------------- | ---------------------------------------------------------------- |
| `area`       | `Area`                                                   | what is measured                                                 |
| `metric`     | string                                                   | sub-metric (e.g. `drag frame`, `200-paste`, `PNG`, `after load`) |
| `size`       | number                                                   | components in the deck                                           |
| `culling`    | `'on' \| 'off' \| 'n/a'`                                 | `onlyRenderVisibleElements`; `n/a` for renderer-independent rows |
| `unit`       | `'ms' \| 'fps' \| 'bytes' \| 'MB'`                       |                                                                  |
| `value`      | number \| null                                           | median (or the single value); null when not finished             |
| `runs`       | number                                                   | measured runs after warm-up                                      |
| `min`, `max` | number \| null                                           | spread                                                           |
| `target`     | number \| null                                           | proposed target (R9)                                             |
| `direction`  | `'lower-is-better' \| 'higher-is-better'`                | how to compare with target                                       |
| `status`     | `'met' \| 'missed' \| 'report-only' \| 'did-not-finish'` | verdict                                                          |
| `reason`     | string \| undefined                                      | required when `did-not-finish`                                   |

State rules: `status = report-only` if `target` is null; `did-not-finish` ⇒ `value = null` and `reason` set; otherwise `met` / `missed` by `direction`.

## BenchReport

`{ meta, rows[] }` where `meta = { date, commit, machine { cpu, cores, ramGb }, chromium, cpuThrottle, sizes[], warmupRuns, measuredRuns, seed, fast }`. File name `report-<ISO stamp>.json` plus `.md`.

## Relationships

`BenchReport 1 — n MeasurementRow`; each row points to one `SizeStep` and one `Area`. The recorded baseline in `docs/performance.md` §2 is a hand-copied `BenchReport` rendered as a table (rows × sizes), with a link to the report file's name and commit.
