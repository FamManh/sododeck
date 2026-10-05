# Quickstart: validate File format and Mermaid import

Prerequisites: `pnpm install`; Node ≥ 24.

## Automated

```bash
pnpm --filter @sododeck/app test      # parsers, builders, hook, dialog, file naming
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

Expected: all green; the smoke suite still shows no third-party request.

## Manual: file extension (US1)

1. `pnpm dev`, open the app on :5173, create or open a deck named "Payments".
2. Library card menu → **Export .sododeck**: the downloaded file is `Payments.sododeck`.
3. Library → **Import**, choose that file: a deck "Payments" appears, identical to the source.
4. Rename the file to `Payments.sododeck.json` and then `Payments.json`; import each: same result.
5. Import a text file that is not a deck: the "not a valid .sododeck file" message, no deck added.

## Manual: flowchart (US2, US4)

Library → **Import Mermaid**, paste:

```text
flowchart LR
  subgraph Client
    W[Web app] -->|login| A(API)
  end
  A --> D{Valid?}
  D -- yes --> DB[(Users)]
  D -- no --> W
  style W fill:#fff
```

Expected: a new deck with 4 components (rectangle, rounded rectangle, diamond, cylinder), 4
connections (labels `login`, `yes`, `no`), 1 group "Client" holding Web app and API, left-to-right
layout without overlap; the report lists `style W …` as skipped (appearance).

## Manual: sequence diagram (US3)

```text
sequenceDiagram
  title Login
  actor User
  User->>Web: open
  Web->>API: POST /login
  API-->>Web: token
```

Expected: deck "Login", components User (actor), Web, API in a row, one flow "Login" with three
steps in order; the player runs it first to last.

## Manual: errors (US5)

- Empty text → "Nothing to import", no deck.
- `erDiagram` text → "ER diagrams are not supported yet. Supported: flowchart, sequence diagram."
- 500-node generated flowchart → imports, UI stays responsive.
- DevTools Network: no request during any import.
