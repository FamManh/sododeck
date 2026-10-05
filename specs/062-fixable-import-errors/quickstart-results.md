# Quickstart results (062)

Run 2026-10-05 against the production build (`vite preview`, Chromium through Playwright,
1440 × 900), light and dark. Screenshots in [`screenshots/`](screenshots/).

## Automated

| Command                                                 | Result                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm --filter @sododeck/schema test`                   | 426 passed                                                                                       |
| `pnpm --filter @sododeck/model test`                    | 1,261 passed                                                                                     |
| `pnpm --filter @sododeck/app test`                      | 5,124 passed (one timing test, see below)                                                        |
| `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm e2e` | pass; smoke suite 4/4 incl. no third-party requests                                              |
| Catalogue doc                                           | `docs/file-format/problem-codes.md` unchanged by `pnpm test` (file snapshot)                     |
| Bench                                                   | `bench-after.md`: no change to `checkDeck` or `fromJSON` against the base, measured side by side |

Timing tests under load: the machine ran at a load average of about 30 (other sessions). Under
`pnpm test` (all packages in parallel) a few unrelated time-budget tests failed once
(`layout`, `search`, `tags` in the model; `scene.perf` in the app); each passes when its package
runs alone, and none of them touches code 062 changed.

## Manual steps

| #   | Step                                                   | Result                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Refused file (`missing-title-and-duplicate-id`)        | ✅ Dialog `Couldn't open "…"`, 2 problems (`/nodes/2/title`, `/nodes/3/id`) with fixes; Copy problems → contract JSON (below); library unchanged. `refused-dialog-*.png`, `refused-dialog-copied-*.png`                                                                                                                                                  |
| 2   | Not JSON                                               | ✅ One `invalid-json` entry, `line 9, column 7`. `not-json-dialog-*.png`                                                                                                                                                                                                                                                                                 |
| 3   | Newer version                                          | ✅ `unsupported-version` ("written for format version 2; this app reads version 1"); covered by `import-button.test.tsx` and `import-check.test.ts`                                                                                                                                                                                                      |
| 4   | Determinism                                            | ✅ `import-check.test.ts` copies the same file twice: identical text (SC-003)                                                                                                                                                                                                                                                                            |
| 5   | Opened with problems (`dangling-step-and-bad-picture`) | ✅ Toast `Imported "Checkout" with 2 problems` + Show → `step-without-connection` and `picture-damaged`; Open deck opens it; the panel lists the step problem. `opened-toast-*.png`, `opened-dialog-*.png`                                                                                                                                               |
| 6   | Panel copy                                             | ✅ `status: "opened"`, entry at `/flows/0/steps/2`. `problems-panel-copy-*.png`                                                                                                                                                                                                                                                                          |
| 7   | Clipboard denied                                       | ✅ by component tests (dialog, panel, report views): read-only text area labelled "Problems as JSON" / "Report as JSON", focused and selected. Not repeated by hand.                                                                                                                                                                                     |
| 8   | Fidelity (`flowchart-fidelity.mmd`, SQL with a view)   | ✅ Mermaid: Merged (node `api` declared twice, subgraph `platform` declared twice), Left out (style, click). SQL: Merged (`orders` twice → `orders_copy`), Left out (view, data rows). Clean text: "Everything was imported." `mermaid-report-*.png`, `db-import-report-*.png`. A nested subgraph is not reported: it stays a nested group (one-to-one). |
| 9   | AI loop (SC-002)                                       | ⏸ Not run: needs a person pasting each report into an AI assistant. Every refused fixture's report carries code, pointer path, subject, evidence where useful, and a one-sentence fix.                                                                                                                                                                   |
| 10  | Keyboard / screen reader (SC-006)                      | ◐ Keyboard and roles covered by tests (focus on the primary action, Esc closes, Copy reachable by Tab, toasts in the polite live region). VoiceOver not run. Esc after a Copy first dismisses the toast (Radix's top layer), a second Esc closes the dialog.                                                                                             |
| 11  | Large file (10,000 duplicate ids)                      | ✅ Dialog visible 82–122 ms after picking the file (read + worker + render), 500 rows and "and 9,500 more"; the copy holds 5,000 entries, `omitted: 5000`, `counts.error: 10000`. `large-file-dialog-light.png`                                                                                                                                          |
| 12  | Privacy                                                | ✅ e2e "makes no third-party network requests" passes; copying only writes to the clipboard.                                                                                                                                                                                                                                                             |

## Copied report from step 1

```json
{
  "report": "sododeck-problems",
  "reportVersion": 1,
  "source": { "kind": "file", "name": "missing-title-and-duplicate-id.sododeck" },
  "status": "refused",
  "schema": "https://sododeck.com/schema/v1.json",
  "formatVersion": 1,
  "app": "0.0.0",
  "counts": { "error": 2, "warning": 0, "info": 0 },
  "problems": [
    {
      "code": "schema-required",
      "severity": "error",
      "path": "/nodes/2/title",
      "subject": "payments",
      "message": "\"title\" is missing.",
      "fix": "Add \"title\" (a string) to node \"payments\"."
    },
    {
      "code": "duplicate-id",
      "severity": "error",
      "path": "/nodes/3/id",
      "subject": "api",
      "message": "Id \"api\" is used more than once (/nodes/1/id, /nodes/3/id).",
      "evidence": "\"api\"",
      "fix": "Give one of these objects a new, unique id and update references to it."
    }
  ],
  "omitted": 0
}
```

(The app copies it with every object expanded over several lines; shown compacted here.)
