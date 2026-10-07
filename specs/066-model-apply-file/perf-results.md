# 066 performance results (SC-003)

Measured with `pnpm --filter @sododeck/model test -- perf` (`test/perf.test.ts`, "applying a
changed file to the large deck"): median CPU time of 5 runs after one warm-up, on `largeDeck()`
(500 nodes, 1,000 edges, 20 flows × 10 steps, 10 rules). Validation (`prepareDeck`) is included.

| Case                                       | Budget  | Measured (2026-10-07, Apple M5, Node 26) |
| ------------------------------------------ | ------- | ---------------------------------------- |
| One changed node title                     | < 50 ms | 23.8 ms                                  |
| Every node title, edge label and step text | < 1 s   | 27.8 ms                                  |
| Equal file (echo, no transaction)          | —       | 19.0 ms                                  |

Most of the time is the fixed cost of preparing the file, building the throwaway target document
and reading both documents with `toJSON`; the diff itself is small. If a host needs the main
thread back, it can run `prepareDeck` in a worker (TODO(067)).
