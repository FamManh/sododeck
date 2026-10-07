# Implementation Plan: Sododeck in VS Code

**Branch**: `069-vscode-extension` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/069-vscode-extension/spec.md`

## Summary

A new workspace app `apps/vscode` ships a VS Code extension that registers a **custom editor** (`CustomEditorProvider`, own document model) for `*.sododeck` and `*.sododeck.json`. Each tab is a webview that loads 067's storage-free embed build from the extension's own files, under a strict content policy, and talks to it with 067's host protocol. The extension is the host: it sends `init` with the file text, theme and abilities, turns each `change` into a "changed" mark on the tab (content-change events, so the canvas keeps its own undo), answers VS Code's save / save as / revert / backup with `flush` and plain file writes, watches the file and sends `external-change` (never for its own write), stores and serves pictures as 068 path pictures in `<deck>.assets/` when the setting says so (refusing anything outside the workspace), follows the colour theme, and adds two commands. All host logic lives in VS Code-free modules driven through a small port interface, so Vitest runs it against a scripted fake editor over 067's in-memory transport; the VS Code glue is thin and checked by a manual quickstart and a release checklist.

**Planning result that changes the spec** (done in `spec.md`): the backlog's "one undo brings the unsaved moves back" contradicts 066 (ADR 0047: an outside change is never an undo step; undo never restores what it overwrote) and 067 (FR-012). Spec 069 now says: the file wins, the tab clears, a one-line notice says the unsaved edits were replaced.

## Technical Context

**Language/Version**: TypeScript 6 strict (`noUncheckedIndexedAccess`), Node ≥ 24 for tooling; the extension bundle targets the extension host's Node (CommonJS, ES2022); VS Code engine `^1.90` (settled at task time against the stable release and its predecessor, SC-010)

**Primary Dependencies**: runtime: `@sododeck/host-protocol` (067, message types and Zod schemas), `@sododeck/model` (picture path rule `checkPicturePath`, parse and canonical serialise for Save As and the empty deck), `@sododeck/schema` through the model. New **dev-only** dependencies: `@types/vscode` (API typings) and `@vscode/vsce` (packaging); `esbuild` already used by `packages/skill`. No new runtime dependency (Principle VIII); the extension ships one bundled `extension.js` plus the app's embed build.

**Storage**: the deck file through `vscode.workspace.fs` (works for local, remote and virtual workspaces); picture files next to the deck; hot-exit backups in the editor-provided backup location. No other storage, no global state.

**Testing**: Vitest in `apps/vscode`: pure host modules against a scripted fake editor on 067's `memoryTransportPair` (open, edit, save, flush, outside change, own-write echo, invalid file, version mismatch, picture store and containment, Save As copy, theme, capability change); the `vscode` module faked only for the thin glue; a bundle guard (no network modules, CSP string, no remote URLs). No new e2e (Principle VI). Real-editor behaviour: `quickstart.md` plus the release checklist; `TODO(069)`: `@vscode/test-electron` run in CI later.

**Target Platform**: VS Code desktop and remote (SSH, containers, WSL) on the stable release and the one before; web extension host (vscode.dev) is out of scope

**Project Type**: monorepo app (extension), consumes one library package and one build artefact of `apps/app`

**Performance Goals**: deck visible ≤ 2 s after the tab opens (SC-001, 500/1,000 deck); tab shows "changed" ≤ 500 ms after an edit (FR-005); outside change visible ≤ 1 s (SC-004); theme switch ≤ 1 s; ≤ 1 pending state per 200 ms during a drag (SC-008, comes from 067's batching)

**Constraints**: no network from the extension or the canvas (SC-006); only bundled files in the webview (FR-024); picture paths judged by real location, inside the workspace (FR-019); workspace trust limits picture files only (FR-026); no deck content to anything but the canvas

**Scale/Scope**: 1 new app (~10 modules, ~900 lines + tests), 2 commands, 1 setting, 1 custom editor; edits to `AGENTS.md`, `turbo.json`, root docs, `docs/backlog-3.md`; 1 ADR. No change to `apps/app`, `packages/model` or `packages/schema` (gaps G1–G3 go to 067, see research)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Status | Notes |
| --- | --- | --- |
| I. Single source of truth (Yjs) | ✅ | The canvas owns the document. The extension keeps only the latest file **text** that the canvas sent (needed for save, backup, picture lookup), never a second model; it never edits the deck except by sending `external-change` text. |
| II. Schema-owned format, lossless round-trip | ✅ | No format change. The extension never reformats `change.text` (067 rule 1). Save As path rewriting and the empty deck go through `@sododeck/model` parse and `serializeDeck`, the only converter; a test asserts a rewritten deck keeps every other byte of the canonical form. |
| III. Stable identity | ✅ | Pictures are addressed by id (content hash); only their `path` changes on Save As. File names derive from the id, not from titles. |
| IV. Local-first and private | ✅ | The file is the store, in the user's workspace. No network, no telemetry, no CDN; all webview resources are the extension's own files (FR-024). "Open in Sododeck web" only opens the user's browser and reveals the file; it uploads nothing. Webview CSP forbids remote sources; a bundle guard test enforces it. |
| V. Performance off the main thread | ✅ | The canvas keeps its workers (inlined, R5). The extension host does no heavy work except hashing a picture (≤ 5 MiB) and one parse on Save As or open (validation of the opened text uses the model, ≈ tens of ms at 500/1,000, inside 066's bounds). No canvas change, so `pnpm bench` is not required; SC-001 and SC-008 are measured in the quickstart with the bench deck. |
| VI. Strict types, tested behaviour | ✅ | Host logic is typed against ports and tested; protocol messages are checked with 067's Zod schemas on both sides (FR-025). No new e2e; smoke suite untouched. |
| VII. Accessible by default | ✅ | The canvas keeps its keyboard support (067 embeds it unchanged). Extension notices use VS Code's own notification and status bar (accessible by default); commands are in the command palette with plain titles. |
| VIII. Simplicity, dependencies | ✅ | Two dev dependencies with stated reasons (typings; the only supported packager). Custom editor type chosen with reasons in R1. New app justified: an extension is a separate artefact. ADR 0050 records the decisions. |

**Post-design re-check (after Phase 1):** unchanged. The only exposure is R3 (clearing the tab's changed mark after an outside change) which depends on a VS Code behaviour to be confirmed by spike S1 (task 1); its fallback is stated and would change FR-013's wording, not the design.

## Project Structure

### Documentation (this feature)

```text
specs/069-vscode-extension/
├── plan.md
├── research.md          # R1–R12, gaps G1–G3, spikes S1–S3
├── data-model.md
├── quickstart.md
├── contracts/
│   └── extension-host.md   # manifest contributions, host ↔ canvas mapping, picture rules, commands
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
apps/vscode/                              # NEW @sododeck/vscode
├── CLAUDE.md                              # responsibility, boundaries, how to run
├── README.md                              # marketplace README (what it does and does not do)
├── CHANGELOG.md
├── package.json                           # extension manifest + scripts (engines.vscode, contributes)
├── tsconfig.json, eslint.config.js, vitest.config.ts
├── icon.png                               # 128×128
├── scripts/
│   ├── build.ts                           # esbuild bundle + copy app dist-embed → media/embed
│   ├── make-webview-html.ts               # shared by build check and runtime (CSP + asset rewrite)
│   └── check-bundle.ts                    # guard: no network modules, CSP, no remote URLs
├── src/
│   ├── extension.ts                       # activate: register editor + commands (glue)
│   ├── deck-editor-provider.ts            # CustomEditorProvider glue (open, save, saveAs, revert, backup)
│   ├── deck-document.ts                   # CustomDocument: text, saved text, dirty flag (pure)
│   ├── host-session.ts                    # one canvas ↔ one document: protocol logic (pure, ports)
│   ├── ports.ts                           # FilePort, WatchPort, ThemePort, SettingsPort, UiPort, TrustPort
│   ├── vscode-ports.ts                    # ports over `vscode` (glue)
│   ├── disk-sync.ts                       # watcher events → compare → external-change / echo ignore (pure)
│   ├── picture-host.ts                    # picture-put / picture-get, naming, hash check (pure)
│   ├── workspace-guard.ts                 # containment of resolved paths (pure + injected realpath)
│   ├── save-as.ts                         # copy picture files, rewrite paths (pure + ports)
│   ├── webview-html.ts                    # builds the webview page (CSP, nonce, asset URIs, transport shim)
│   ├── webview-shim.js                    # tiny bridge: webview postMessage ↔ the embed's transport (R4)
│   ├── commands.ts                        # New Sododeck deck, Open in Sododeck web
│   └── theme.ts                           # ColorThemeKind → 'light' | 'dark'
├── test/
│   ├── fake-editor.ts                     # scripted editor side on memoryTransportPair
│   ├── fake-vscode.ts                     # minimal `vscode` stub for glue tests
│   └── *.test.ts
├── media/embed/                           # built, git-ignored: copy of apps/app/dist-embed
└── .vscodeignore

AGENTS.md                                  # repo map + dependency direction (vscode → host-protocol, model)
turbo.json                                 # + vscode build outputs (dist/**, *.vsix)
docs/decisions/0050-vscode-extension.md    # NEW ADR
docs/backlog-3.md                          # 069 status
docs/release/vscode-extension.md           # NEW release checklist (FR-029)
```

**Structure Decision**: host logic is pure and port-driven so the whole contract is tested without VS Code; the glue (`extension.ts`, `deck-editor-provider.ts`, `vscode-ports.ts`) is the only code that imports `vscode`. The embed build is copied, never imported, so `apps/vscode` depends on `@sododeck/host-protocol` and `@sododeck/model` only (`app` is a build-order dev dependency for Turborepo). Dependency direction stays acyclic: `vscode → host-protocol`, `vscode → model → schema`, copy of `app`'s embed output.

## Delivery order (for /speckit-tasks)

0. **Spikes first** (S1–S3, R-section of research): real webview with the 067 embed build (inline workers under the CSP, the transport shim, typed-array messages), clearing the tab's mark after an outside change, undo/keyboard focus inside the webview. Results decide R3, R4, R5 fallbacks before the rest is built.
1. Package scaffold, manifest, build script, bundle guard.
2. Webview page + shim, `HostSession` open / init / `change` / dirty / `flush`: **US1** (open, edit, save).
3. Save, save as, revert, backup, hot exit: **US2**.
4. Disk sync with echo ignore, invalid file, delete / rename, background tabs: **US3**.
5. Pictures: store, serve, containment, Save As copy, setting, trust: **US4**.
6. Theme, commands, trust notice, polish: **US5, US6**.
7. README, icon, release checklist, ADR, docs, packaging: **US7**.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| Custom editor with own document model instead of the text-based editor type VS Code's guide recommends for text formats (R1) | The canvas owns undo (Principle I); the text type puts every canvas change on VS Code's text undo stack and makes Ctrl+Z ambiguous; the text type gives no Save As hook, which FR-017a needs to copy picture files | The text type is less code, but two undo stacks and no Save As hook break two requirements |
| Webview shim script (R4) | The embed speaks to `window.parent`; a webview's parent is the VS Code frame, which only understands its own channel | Waiting for 067 to expose a pluggable transport (gap G1) blocks 069; the shim is ~40 lines and is deleted if 067 adds the hook |
