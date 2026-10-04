# Quickstart results: Schema Code Panel (DBML)

Date: 2026-10-04. Automated: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass
(app 3,900 tests, model 981; smoke suite incl. no-third-party-requests green).

## Performance (T038)

150 tables / 1,800 columns / 250 relationships (bench deck), Node, median of 5:

| Step                                  | Time    | Budget |
| ------------------------------------- | ------- | ------ |
| `planSchemaSync`, writer text (empty) | ~7 ms   | 30 ms  |
| `planSchemaSync`, one column added    | < 30 ms | 30 ms  |
| `readDbml` (parser, main thread here) | ~64 ms  | 500 ms |

## Bundle (T039, gzip, production build)

| Chunk                                | Size                                                                                             | Loaded                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `dbml-tab` (session, planner, apply) | ~11.7 KB                                                                                         | first DBML tab open                    |
| `dbml-editor` (editor wrapper)       | ~1.2 KB                                                                                          | first DBML tab open (Monaco is shared) |
| `sql-tab` + SQL languages            | ~1.6 KB + ~3.7 KB (`sql`), ~4.4 KB (`pgsql`)                                                     | first SQL tab open                     |
| `dbml-parse` (`@dbml/parse`)         | ~108 KB                                                                                          | import worker only, on first DBML read |
| editor first load                    | unchanged: nothing from this feature is imported by the editor entry (all tabs are `React.lazy`) |                                        |

## Manual scenarios (T041)

Run in the dev build in a real Chrome (Monaco, not the jsdom double). Only what could be driven
reliably through the browser tool was checked by hand; the rest is covered by component and
session tests (`dbml-tab.test.tsx`, `dbml-session.test.ts`, `apply-schema-plan.test.ts`).

| #          | Result                                                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3          | Checked live: a misspelt setting shows a red squiggle, "Can't apply: fix 1 error" and "Canvas keeps the last valid schema"; fixing it returns to "Applied". |
| 13         | Panel opens on JSON; DBML parser chunk requested only on the first DBML read; smoke test finds no third-party requests.                                     |
| 1, 2, 4–12 | Covered by automated tests (see above); not driven by hand. Screenshots were not recorded.                                                                  |

A real-browser bug was found and fixed: keystrokes typed into Monaco's edit-context element
reached the canvas shortcuts (`isTextTarget` now treats `.monaco-editor` as a text target, with a
test).
