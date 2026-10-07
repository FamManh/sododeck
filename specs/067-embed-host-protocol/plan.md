# Implementation Plan: Embed the editor in a host program

**Branch**: `067-embed-host-protocol` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/067-embed-host-protocol/spec.md`

## Summary

Ship the deck editor as a second, storage-free build (`apps/app/dist-embed/`) that a host loads in a frame, and one versioned message protocol (`@sododeck/host-protocol`) between them. The host sends the file text, theme and abilities; the editor sends the whole canonical file back ≤ 100 ms after the first edit of a burst, merges outside changes with 066's `applyDeckText` (not an undo step, never echoed), goes read-only on an invalid file, routes links, exports and pictures through the host when the host can do them, and shows no "Saved" state. Shared editor code stops importing storage through a `DeckServicesContext`. A dev-only fake host page and a scripted fake host (shared with component tests) prove the contract. Pictures stored by the host are written into the file as 068 paths via a new untracked model op `setPicturePath`.

## Technical Context

**Language/Version**: TypeScript 5 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: existing only — Vite, React Router (memory router), Zustand, Yjs via `@sododeck/model`, Zod (new package depends on it; already in the repo via `@sododeck/schema`). No new dependency.

**Storage**: none in the embed (the host's file is the store); the web app unchanged (IndexedDB)

**Testing**: Vitest (protocol package unit tests; model op round-trip; app component tests with an in-memory transport + scripted fake host; no-network stub test); bundle check script after the embed build; no new e2e (Principle VI)

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox, Safari, inside an iframe or a code editor's webview

**Project Type**: monorepo web app + new library package

**Performance Goals**: `change` delivered ≤ 200 ms after an edit on a 500/1,000 deck (SC-002); deck shown ≤ 1 s after `init` (SC-001); merge within 066's bounds

**Constraints**: zero network requests, no browser storage, no service worker, no telemetry in the embed (SC-005, SC-006); messages only to/from the parent frame, content only to the `init` origin; web app behaviour unchanged (FR-022)

**Scale/Scope**: 1 new package (~400 lines + tests), ~12 new app modules, refactor of `editor-page.tsx` and 4 storage-importing editor modules, 1 model op, 1 dev page, docs + ADR

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                    | Status       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth (Yjs)              | ✅           | The embed reads and writes the Yjs doc only; the outgoing file is serialised from it; outside files enter through 066's merge. Embed state (phase, problems, host error) is UI-only Zustand.                                                                                                                                                                                                                                                                                                                                                 |
| II. Schema-owned format, lossless round-trip | ✅           | No format change (068 owns `path`). `setPicturePath` gets a round-trip case. Files sent are `serializeDeck` output (canonical).                                                                                                                                                                                                                                                                                                                                                                                                              |
| III. Stable identity                         | ✅           | Merge by id (066); picture ids are content hashes; no derived ids.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| IV. Local-first and private                  | ⚠️ justified | No network, no telemetry, bundled assets: ✅ (R14, bundle check). "Decks MUST persist in the browser (IndexedDB)" does not hold **inside a host**: the host's file is the store and receives every edit within 100 ms. The web app keeps IndexedDB unchanged. Recorded in ADR 0049 and Complexity Tracking; a constitution wording amendment ("in the web app; in a host, the host's file") is proposed, not done here. Feature detection: host abilities follow the `features.ts` pattern; `supportsWorkers` hardened for sandboxed frames. |
| V. Performance off the main thread           | ✅           | Serialising the whole deck runs on the main thread (≈ 10–30 ms at 500/1,000, inside the 200 ms bound); 066's merge is likewise main-thread by design (the doc lives there; `prepareDeck` can move validation to a worker later, `TODO(067)` noted in 066). No canvas change → `pnpm bench` not required; SC-002 is measured by a timing test on the bench deck.                                                                                                                                                                              |
| VI. Strict types, tested behaviour           | ✅           | Unit tests for schemas, transports, persistence timing/echo, picture store; component tests per user story via roles/labels; no new e2e; smoke suite unchanged.                                                                                                                                                                                                                                                                                                                                                                              |
| VII. Accessible by default                   | ✅           | Notices (waiting, fatal, problems, host error) are `role="status"`/`alert` with text; read-only uses `inert` plus visible text, never colour alone; hidden controls are not rendered (no dead focus stops).                                                                                                                                                                                                                                                                                                                                  |
| VIII. Simplicity, dependencies               | ✅           | No new dependency. New package justified: hosts (069, 070) must share the message types without importing app code. ADR 0049 records the decisions.                                                                                                                                                                                                                                                                                                                                                                                          |

**Post-design re-check (after Phase 1):** unchanged; the IV deviation is the only one and is scoped to the host build.

## Project Structure

### Documentation (this feature)

```text
specs/067-embed-host-protocol/
├── plan.md
├── research.md          # R1–R15
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── host-protocol.md # normative protocol v1 (→ package README)
│   └── app-embed.md     # package, model and app module contracts
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/host-protocol/                 # NEW @sododeck/host-protocol
├── CLAUDE.md
├── README.md                            # = contracts/host-protocol.md
├── package.json, tsconfig.json, eslint.config.js, vitest.config.ts
├── src/
│   ├── index.ts
│   ├── messages.ts                      # types + Zod schemas, PROTOCOL_VERSION
│   ├── transports.ts                    # parentWindowTransport, frameTransport, memoryTransportPair
│   └── fake-host.ts                     # createFakeHost
└── test/

packages/model/
├── src/ops/images.ts                    # + setPicturePath (068's AssetMeta.path)
└── test/                                # + round-trip case

apps/app/
├── embed.html                           # NEW embed entry
├── vite.embed.config.ts                 # NEW → dist-embed/ (base './', no PWA)
├── scripts/check-embed-bundle.mjs       # NEW guard (R2)
├── package.json                         # build: both builds + check
└── src/
    ├── embed/                           # NEW
    │   ├── main.tsx, embed-app.tsx, embed-store.ts
    │   ├── host-persistence.ts, host-picture-store.ts, host-origin.ts
    │   ├── embed-notices.tsx            # waiting / slow / fatal / problems / host error
    │   └── *.test.ts(x)
    ├── editor/
    │   ├── editor-shell.tsx             # MOVED from routes/editor-page.tsx, storage-free
    │   ├── deck-services.ts             # NEW context
    │   ├── embed-host-context.ts        # NEW useOpenLink / useSaveFile
    │   ├── save-context.ts              # + 'host'
    │   ├── shell/deck-menu.tsx          # via DeckServicesContext / useSaveFile
    │   ├── import/import-dialog.tsx, mermaid-import-dialog.tsx  # via DeckServicesContext; Mermaid file chooser hidden in host mode
    │   ├── export/export-dialog.tsx     # via useSaveFile
    │   ├── card-fields-block.tsx, fields/links-field.tsx      # via useOpenLink
    │   └── top-bar / shell chrome       # no save indicator, no theme toggle in host mode
    ├── routes/editor-page.tsx           # web wiring only (stored / memory / demo)
    ├── routes/embed-host-page.tsx       # NEW dev-only /embed-host
    ├── app/router.tsx                   # + dev-only /embed-host
    ├── storage/origins.ts               # isOwnUpdate excludes hostOrigin
    ├── theme/theme-store.ts             # + setThemeFromHost
    └── lib/features.ts, lib/links.ts    # supportsWorkers hardening; openLink via context

docs/decisions/0049-embeddable-editor-host-protocol.md   # NEW ADR
AGENTS.md                                # repo map + dependency direction
apps/app/CLAUDE.md, packages/model/CLAUDE.md               # updated
docs/backlog-3.md                        # 067 status
turbo.json                               # build outputs + dist-embed/**
```

**Structure Decision**: one new package for the shared contract (hosts must not import app code); the embed is a second entry of `apps/app` so it reuses the editor without forking, with storage kept out by context injection and verified by a bundle check.

## Delivery order (for /speckit-tasks)

1. `@sododeck/host-protocol` (messages, transports, fake host) — no app dependency.
2. App refactor with no behaviour change: `EditorShell` extraction, `DeckServicesContext`, `useOpenLink` / `useSaveFile`, `SaveMode 'host'`, `setThemeFromHost`, `isOwnUpdate` — web tests stay green.
3. Embed entry + build + bundle check; handshake, version, waiting (US1).
4. Host persistence: send, batch, flush, change results (US2).
5. Outside changes, echo, invalid → blocked (US3).
6. Abilities: links, export, Mermaid paste only (US5).
7. Fake host dev page (US6).
8. Pictures + `setPicturePath` (US4) — **after 068 is merged**.
9. Docs, ADR 0049, AGENTS.md, backlog status; full DoD run.

## Complexity Tracking

| Violation                                                        | Why Needed                                                                                                                                                                           | Simpler Alternative Rejected Because                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Principle IV "decks persist in IndexedDB" not true inside a host | In a host the file on disk is the store (spec Context); a second copy in the frame's IndexedDB would drift from the file and the frame's storage may be wiped or blocked by the host | Keeping IndexedDB in the embed: two sources of truth for one deck, and FR-020 forbids browser storage |
| New package `@sododeck/host-protocol`                            | 069/070 hosts need the message types and schemas without importing `apps/app` (dependency direction)                                                                                 | Types inside `apps/app`: hosts would import app code; duplicating types per host: drift               |
