# Quickstart results: Database Scale

## T035: collapse and expand a 50-table schema (SC-006, budget 1 s)

Measured by `apps/app/src/editor/schema-collapse.perf.test.ts` (Vitest, jsdom, Node on the
developer machine, median of 5 runs): the 150-table bench deck (`generateBenchDeck(150, 250, 42,
{ tables: 150, rel: true, schemas: 3 })`, three schemas of 50 tables, `groupingMode: 'schema'`).
One run is the Yjs write (`setCollapsed` on `schema:schema_0`) plus everything the canvas derives
from it: `viewStateOf`, `visibleGraph`, `toFlowNodes`, `toFlowEdges`.

| Action                  | Median | Budget |
| ----------------------- | ------ | ------ |
| Collapse 50-table group | ~58 ms | 1 s    |
| Expand 50-table group   | ~58 ms | 1 s    |

Not measured: React Flow render and browser paint (jsdom has no layout). The browser cost of
mounting the 50 expanded cards on expand is what the 150-table bench scenario (T044/T045)
covers; this figure is the document and derivation part only.
