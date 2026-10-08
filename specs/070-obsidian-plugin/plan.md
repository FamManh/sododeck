# Implementation Plan: Sododeck in Obsidian

**Branch**: `070-obsidian-plugin` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/070-obsidian-plugin/spec.md`

## Summary

Two deliverables, built in this order and each testable alone:

**A. The Markdown form of a deck** (`packages/model` + the web app). A pure, Yjs-free text converter, `toMarkdown(deckText, previous?)` and `fromMarkdown(markdown)`, turns the canonical deck JSON into a `.sododeck.md` note (front matter marker, readable part with a stable-id marker on every title and note, picture link list, and the complete deck as a fenced JSON block hidden in a comment) and back. Reading applies title and notes edits found in the readable part, matched by id, then hands ordinary deck JSON to the existing load path. The embedded editor, the host protocol, the schema and the plain `.sododeck` do not change. The web app gets "Export .sododeck.md" and imports the form.

**B. The Obsidian plugin** (`apps/obsidian`). One `TextFileView` subclass is registered for the extension `sododeck` and, by a view swap keyed on the front matter marker, for `.sododeck.md` notes. The view hosts the embed build in an isolated `srcdoc` iframe (the release is only `main.js`, `manifest.json`, `styles.css`, so the single-file embed is inlined into `main.js`) and does the host's half of 067: `init`, `change` → write, `flush`, `external-change` from the vault's file events, `theme` from the app's theme class, and pictures stored through the app's own attachment settings and answered as links the app tracks. For `.sododeck.md` the file text goes through A in both directions; for `.sododeck` it passes through unchanged. All host logic is pure and port-driven (same pattern as 069) and tested on 067's in-memory transport with a fake vault; the Obsidian glue is thin and covered by a manual quickstart and a release checklist.

**Planning results that change the spec** (applied in `spec.md`): the 067 contract has `change-result`, not a `status` message (FR-016 reworded). Two facts from research shape the design and are recorded, not spec changes: the community release carries only three files, so the embed has to travel inside `main.js` (R3); and the app's own save debounce is 2 s, longer than the spec's 1 s, so the view writes on its own schedule (R4).

## Technical Context

**Language/Version**: TypeScript 6 strict (`noUncheckedIndexedAccess`), Node ≥ 24 for tooling; the plugin bundle is one ES2022 CommonJS `main.js` for Obsidian's Electron and mobile webviews (`isDesktopOnly: false`, `minAppVersion` settled at task time against the API used: `getAvailablePathForAttachment` needs 1.5.7)

**Primary Dependencies**: runtime: `@sododeck/host-protocol` (067 messages and Zod schemas), `@sododeck/model` (the Markdown form, `checkPicturePath` through `@sododeck/schema`). New **dev-only** dependency: `obsidian` (type declarations only, not shipped); `esbuild` already used by `packages/skill`. **No new runtime dependency** (Principle VIII). The converter uses no Markdown library: the form is a small, line-based grammar we own (R6).

**Storage**: the deck file and picture files through Obsidian's vault API (`vault`, `fileManager`); the plugin's one setting through `loadData`/`saveData`. No other storage, no browser storage in the frame (067).

**Testing**: Vitest. `packages/model/test`: Markdown form round-trip corpus (every sample deck, Markdown-special text, user text outside the owned region, hand edits by id), property that `fromMarkdown(toMarkdown(x))` equals `x`. `apps/app`: import/export of the form. `apps/obsidian`: pure host modules against a scripted fake editor on `memoryTransportPair` with a fake vault (open, autosave, flush, outside change, echo, two panes, text edit read back, invalid file, version mismatch, picture store/serve, move, outside-vault refusal, late picture); the `obsidian` module faked only for the thin glue; a bundle guard (no network APIs, no remote URLs, size budget). No new e2e (Principle VI). Real-app behaviour (desktop and phone): `quickstart.md` plus the release checklist; `TODO(070)`: automated app-level test later.

**Target Platform**: Obsidian desktop (Electron) and mobile (iOS, Android), current stable release and the one before

**Project Type**: monorepo app (plugin) + additions to one library package and the web app; consumes one build artefact of `apps/app`

**Performance Goals**: deck visible ≤ 2 s on desktop (500/1,000) and ≤ 5 s on a mid-range phone (100 nodes) (SC-001); edit on disk ≤ 1 s (SC-002); outside change visible ≤ 1 s (SC-006); theme switch ≤ 1 s; ≤ 1 write per 200 ms during a drag (SC-013, from 067's batching); Markdown conversion of a 500-node deck ≤ 50 ms each way (budget, measured in tests)

**Constraints**: no network from the plugin or the canvas (SC-008); only bundled files in the frame (FR-034); picture paths judged inside the vault (FR-027); no vault scan (FR-036); release assets are exactly `main.js`, `manifest.json`, `styles.css`; mobile background time is short, so no write may wait on a long timer (R4)

**Scale/Scope**: model: 1 new module (~400 lines + tests, no Yjs import). app: import/export wiring (~5 files). obsidian: 1 new app (~12 modules, ~1,100 lines + tests), 1 command + 1 menu entry, 1 setting, 1 view. Edits to `AGENTS.md`, `turbo.json`, root docs, `docs/backlog-3.md`; 2 ADRs (0051 Markdown form, 0052 Obsidian host). No change to `packages/schema`, the host protocol or the embed's code (gaps G1–G3 go to 067, see research)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                    | Status       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Single source of truth (Yjs)              | ✅           | The canvas owns the document. The plugin keeps only the latest file **text** (needed to write, to compare echoes and to keep the user's text outside the owned region), never a second model; it changes the deck only by sending `external-change` text. The Markdown form works on text, never on Yjs.                                                                                                                                                           |
| II. Schema-owned format, lossless round-trip | ⚠️ justified | The deck schema and `.sododeck` do not change. The Markdown form is a **second container** of the same deck JSON, in `packages/model` (the only converter; no app serialises on its own). Lossless is tested by a round-trip corpus (SC-005). The constitution's "strict JSON file format" line is about the schema; the form embeds that JSON unchanged and only reads title/notes edits back by id (Complexity Tracking). No version bump, no schema URL change. |
| III. Stable identity                         | ✅           | Every readable line carries the object's id; edits match by id, never by position or wording; picture files are named from the content id, not titles. Renaming objects or moving files never breaks a reference (test).                                                                                                                                                                                                                                           |
| IV. Local-first and private                  | ✅           | The vault is the store. No network, no telemetry, no CDN; the frame loads only inlined plugin code; the bundle guard fails on network APIs and remote URLs. Nothing reads outside the vault (FR-027, FR-036).                                                                                                                                                                                                                                                      |
| V. Performance off the main thread           | ✅           | The canvas keeps its workers (inlined, R3). The plugin does no heavy work: one string conversion per change (budgeted) and one picture hash (≤ 5 MiB). No canvas change, so `pnpm bench` is not required; SC-001 and SC-013 are measured in the quickstart with the bench deck.                                                                                                                                                                                    |
| VI. Strict types, tested behaviour           | ✅           | Typed ports; protocol messages checked with 067's Zod schemas on both sides (FR-035); converter tested by corpus and property. No new e2e; smoke suite untouched (the web import path it covers is not changed in behaviour).                                                                                                                                                                                                                                      |
| VII. Accessible by default                   | ✅           | The canvas keeps its keyboard support. Plugin notices use Obsidian's own `Notice`; the command and menu entry have plain titles. The readable part makes deck text available to screen readers and search as a bonus.                                                                                                                                                                                                                                              |
| VIII. Simplicity, dependencies               | ✅           | One dev dependency (`obsidian` typings, the only official source of the API types). No Markdown parser (R6). New app justified: a plugin is a separate artefact. ADRs 0051 and 0052 record the decisions.                                                                                                                                                                                                                                                          |

**Post-design re-check (after Phase 1):** unchanged. Exposure remains the spikes (S1 view swap, S2 sandboxed frame + workers + size, S3 save/echo behaviour of `TextFileView`); each has a stated fallback that changes wording or a small mechanism, not the design. If S2 fails with no fallback (the frame cannot run the canvas on mobile), stop and report: the feature's mobile promise would have to be dropped.

## Project Structure

### Documentation (this feature)

```text
specs/070-obsidian-plugin/
├── plan.md
├── research.md          # R1–R14, gaps G1–G3, spikes S1–S5
├── data-model.md        # the file's regions, the readable part, entities, state
├── quickstart.md
├── contracts/
│   ├── markdown-form.md   # the `.sododeck.md` grammar, escaping, read-back rules, API
│   └── obsidian-host.md   # manifest, view, host ↔ canvas mapping, picture rules, commands
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/model/
├── src/markdown-form.ts                   # NEW: toMarkdown, fromMarkdown, isDeckMarkdown, constants (no Yjs)
├── src/index.ts                           # + exports
├── test/markdown-form.test.ts             # NEW: corpus, hand edits, special text, user text kept
└── CLAUDE.md                              # + 070 section

apps/app/src/
├── storage/download.ts                    # + `.sododeck.md` name helpers
├── library/use-import-files.ts            # kindOfText: + 'deck-md'
├── storage/library-ops.ts                 # importFile / exportDeck: Markdown form
├── editor/use-export-deck.ts, editor/export/…   # + "Export .sododeck.md"
└── (menus: library/deck-menu.tsx, editor/save-status.tsx, editor/deck-inspector-storage.tsx)

apps/obsidian/                              # NEW @sododeck/obsidian
├── CLAUDE.md                              # responsibility, boundaries, how to run
├── README.md                              # community-list README (what it does and does not do)
├── manifest.json, versions.json, styles.css
├── package.json, tsconfig.json, eslint.config.js, vitest.config.ts
├── scripts/
│   ├── build.ts                           # esbuild main.js; inline the single-file embed as a string
│   ├── inline-embed.ts                    # app dist-embed → one HTML (JS, CSS, fonts, workers as blobs) (G1)
│   └── check-bundle.ts                    # guard: no network APIs, no remote URLs, size budget
├── src/
│   ├── main.ts                            # Plugin: register view, extensions, swap, commands, settings (glue)
│   ├── deck-view.ts                       # TextFileView subclass (glue over the session)
│   ├── host-session.ts                    # one canvas ↔ one file: protocol logic (pure, ports)
│   ├── ports.ts                           # FilePort, VaultEventsPort, ThemePort, SettingsPort, UiPort
│   ├── obsidian-ports.ts                  # ports over `obsidian` (glue)
│   ├── file-codec.ts                      # `.sododeck` passthrough | `.sododeck.md` via model (pure)
│   ├── disk-sync.ts                       # change events → compare → external-change / echo ignore (pure)
│   ├── picture-host.ts                    # picture-put / picture-get, naming, hash check, link text (pure)
│   ├── vault-guard.ts                     # path normalisation + containment inside the vault (pure)
│   ├── md-swap.ts                         # marker detection + leaf swap, "Open as Markdown" escape (glue)
│   ├── frame.ts                           # builds the sandboxed iframe (srcdoc, CSP, transport) (glue)
│   ├── commands.ts                        # New Sododeck deck (palette + folder menu)
│   └── settings.ts                        # the one setting + its tab
├── test/
│   ├── fake-editor.ts                     # scripted editor side on memoryTransportPair
│   ├── fake-vault.ts                      # in-memory files, events, link resolution, attachment path
│   ├── fake-obsidian.ts                   # minimal `obsidian` stub for glue tests
│   └── *.test.ts
└── .gitignore                              # main.js, embed single-file build

AGENTS.md                                   # repo map + dependency direction (obsidian → host-protocol, model)
turbo.json                                  # + obsidian build outputs
docs/decisions/0051-deck-markdown-form.md   # NEW ADR
docs/decisions/0052-obsidian-plugin.md      # NEW ADR
docs/backlog-3.md                           # 070 rewritten; H3 amended; Later item moved
docs/release/obsidian-plugin.md             # NEW release checklist (FR-039)
```

**Structure Decision**: the converter lives in `packages/model` as pure text functions so the web app, the plugin and (later) the skill and 069 share one implementation and one test corpus; it imports only schema-level helpers (key order, `inspectDeckText`) and never Yjs, so the plugin bundle stays small (checked by the bundle guard). Host logic is pure and port-driven so the whole contract is tested without Obsidian; the glue (`main.ts`, `deck-view.ts`, `obsidian-ports.ts`, `md-swap.ts`, `frame.ts`) is the only code that imports `obsidian`. The embed build is converted into one inlined string at build time, never imported, so `apps/obsidian` depends on `@sododeck/host-protocol` and `@sododeck/model` only (`app` is a build-order dev dependency for Turborepo). Dependency direction stays acyclic: `obsidian → host-protocol`, `obsidian → model → schema`, `app → model`, copy of `app`'s embed output.

## Delivery order (for /speckit-tasks)

0. **Spikes first** (S1–S5 in research): real Obsidian, desktop and phone: view swap without a flash; sandboxed `srcdoc` frame with inlined workers and the 067 embed (typed arrays, size and load time); `TextFileView` save, reload and echo behaviour; link rewriting on move for links in the picture list; a link written as `[[…]]` list item outside a comment. Results decide R2, R3, R4, R7 fallbacks before the rest is built.
1. **A. Markdown form** in the model: grammar, escaping, round-trip corpus, hand-edit read-back (US2 core, FR-001–FR-005, SC-005, SC-006 partly).
2. **A. Web app**: import and export of the form (FR-006, US6.3–6.4).
3. Plugin scaffold, manifest, build with inlined embed, bundle guard.
4. Frame + `HostSession` init / `change` / write / `flush` for `.sododeck`: **US1** (open, edit, autosave).
5. `.sododeck.md`: marker detection, view swap, codec, text edit read back: **US1, US2**.
6. Disk sync, echo, invalid file, rename and delete, two panes: **US3**.
7. Pictures: store, serve, links, late arrival, containment, setting: **US4**.
8. Theme, commands, new deck, settings: **US5, US6**.
9. README, release checklist, ADRs, docs, packaging: **US7**.

Steps 1–2 can be merged and released on their own (the web app gains the form even without the plugin); if the schedule slips, that is the split point the spec's Assumptions mention.

## Complexity Tracking

| Violation                                                                                                           | Why needed                                                                                                                                                                                                                                                  | Simpler alternative rejected because                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A second container for the deck (`.sododeck.md`) beside the strict-JSON file (Principle II, technology constraints) | The notes app understands links, tags and text only in Markdown notes: search, backlinks and link rewriting on move all need the deck to be a note. The founder chose this (spec Clarifications) after seeing that the plain file's pictures break on move. | Keeping only `.sododeck` leaves pictures that silently break and a deck invisible to search; a sidecar index file would still need the plugin to rewrite links by itself (code we want to avoid). The deck JSON inside is unchanged, so schema, skill and 069 are untouched. |
| Inlining the whole embed into `main.js` (R3)                                                                        | Community plugin releases carry only `main.js`, `manifest.json`, `styles.css`; there is no folder for extra files                                                                                                                                           | Fetching the embed at runtime breaks "no network" (Principle IV) and offline use; asking users to copy files breaks one-click install                                                                                                                                        |
| Own save schedule in the view instead of `requestSave` (R4)                                                         | `requestSave` is debounced by 2 s; the spec promises 1 s and a phone may be backgrounded in between                                                                                                                                                         | Using `requestSave` as is would break SC-002 and risk losing the last edit on mobile                                                                                                                                                                                         |
| Line-based grammar written by us instead of a Markdown parser (R6)                                                  | The form needs exact, byte-stable round trips and user text kept verbatim outside owned regions; a parser re-serialises text                                                                                                                                | A Markdown parser would add a runtime dependency (ask-first rule) and normalise the user's text                                                                                                                                                                              |

## Implementation notes (2026-10-07)

What changed while building, none of it a change to the design:

- **No-Yjs rule (Principle I, plan "Structure Decision").** `markdown-form.ts` reaches no Yjs at runtime: `isRecord` moved to its own `is-record.ts` (so `key-order.ts` needs no `convert.ts`), the four problem texts live in `markdown-problems.ts`, the marker check in `markdown-marker.ts`. A test follows the import graph. The plugin still imports `@sododeck/model` (the whole index) for `assetId`, `sniffType` and the form, so Yjs is in the bundle until the model package is marked side-effect free; it is under 1 MB of a 13 MiB file, so this was not pursued.
- **Reading compares against what the writer would have written** (ADR 0051 §4), which replaced the contract's "trim blank lines" wording as the reason a formatting-only difference is not an edit.
- **The region's opening hint no longer contains `%%`** (it would have ended the comment early). Contract updated.
- **Workers in the frame are always classic** (`type: 'module'` blob workers do not start in a sandboxed frame; measured). `research.md` S2.
- **The bundle guard** is applied per part (see the contract), and the release folder is `release/`.
- **Dev-only dependencies added:** `obsidian` (types), its peer types `@codemirror/state` and `@codemirror/view`, and `jsdom` (frame and glue tests). No runtime dependency. Both need the founder's nod, as the plan said for `obsidian`.
- **069's scripted editor was not moved** into `packages/host-protocol` (task T012 asks the founder first); `apps/obsidian/test/fake-editor.ts` is a second copy.
- **Constitution check:** unchanged; nothing built contradicts a row. Principle II's justified violation is recorded in ADR 0051.
