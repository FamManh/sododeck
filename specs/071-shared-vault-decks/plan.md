# Implementation Plan: Shared Vault Decks

**Branch**: `071-shared-vault-decks` | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/071-shared-vault-decks/spec.md`

## Summary

Two parts. (1) Docs and one small command per host so a folder of `.sododeck` files is the documented cross-tool form, and a `.sododeck.json` can be copied to `.sododeck`. (2) The VS Code extension (069) opens `*.sododeck.md` notes as the canvas: a **file codec** (plain ↔ Markdown through `@sododeck/model`'s `fromMarkdown` / `toMarkdown`) sits between the file text and the deck text the canvas speaks, the same split the Obsidian plugin already has (`apps/obsidian/src/file-codec.ts`). No format change, no change to `packages/model`, `packages/schema` or the embedded editor; no new dependency. Decisions in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript strict, Node ≥ 24 (repo standard)

**Primary Dependencies**: existing only: `@sododeck/model` (`fromMarkdown`, `toMarkdown`, `isDeckMarkdown`, `inspectDeckText`), `@sododeck/host-protocol`, `@types/vscode`, `obsidian` typings (dev)

**Storage**: files in the workspace / vault (no browser storage)

**Testing**: Vitest with the existing fakes (`apps/vscode/test/fakes.ts`, `fake-editor.ts`; `apps/obsidian/test/fake-vault.ts`); model round-trip fixtures shared by both hosts; real-app checks via `quickstart.md`

**Target Platform**: VS Code ≥ 1.90 (desktop, web, remote), Obsidian desktop and mobile

**Project Type**: two host apps in a monorepo (`apps/vscode`, `apps/obsidian`) plus docs

**Performance Goals**: edit in one tool visible in the other ≤ 1 s after the file is written (SC-001); no extra work on the canvas hot path

**Constraints**: nothing outside the workspace read or written; no network; unreadable note never rewritten; user text outside the generated region kept byte for byte

**Scale/Scope**: ~10 changed or new source files in `apps/vscode`, 2 in `apps/obsidian`, 5 docs

## Constitution Check

| Principle                                    | Result                                                                                                                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | Pass. The Yjs doc stays in the embedded editor; hosts hold file text only. The codec holds no second copy of the deck.                                                                                                                  |
| II. Schema-owned format, lossless round-trip | Pass. All Markdown conversion goes through `@sododeck/model`; no format change. Round-trip across hosts is tested on shared fixtures (FR-017).                                                                                          |
| III. Stable identity                         | Pass. Nothing derives ids from titles; picture links stay keyed by asset id.                                                                                                                                                            |
| IV. Local-first, private                     | Pass. No network; picture reads stay inside the workspace (`workspace-guard`); the bundle check keeps failing the build on network APIs.                                                                                                |
| V. Performance off main thread               | Pass (n/a). No canvas change; no `pnpm bench` needed.                                                                                                                                                                                   |
| VI. Strict types, tested                     | Pass. Unit tests for the codec, document, disk sync, commands, link resolution; no new e2e (smoke suite must stay green).                                                                                                               |
| VII. Accessible                              | Pass. Commands are palette-reachable; messages are plain text.                                                                                                                                                                          |
| VIII. Simplicity, dependencies               | Pass. No new dependency. One new ADR (0053). The Markdown codec is copied in shape from the Obsidian host rather than shared, because hosts may not import each other (spec 0050/0052 boundaries); the 20-line duplication is accepted. |

Re-check after design: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/071-shared-vault-decks/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── vscode-note-host.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
apps/vscode/
├── package.json                  # rename "New Sododeck"; commands newNote, copyAsSododeck; editor for *.sododeck.md (priority option); menus
├── README.md  CHANGELOG.md  CLAUDE.md
├── src/
│   ├── file-codec.ts             # NEW  plain ↔ Markdown (kindOf, decode, encode)
│   ├── deck-document.ts          # kind + fileText; text stays the deck text
│   ├── document-ops.ts           # open/save/revert/backup through the codec
│   ├── disk-sync.ts              # decode the read; refresh fileText when only user text changed
│   ├── save-as.ts                # encode for the destination's kind
│   ├── host-session.ts           # init/external text unchanged (deck text)
│   ├── note-swap.ts              # NEW  pure: should an opened .sododeck.md become a canvas
│   ├── picture-host.ts           # note links: relative, then unique path-ending match
│   ├── commands.ts               # newDeck (kind), newNote, copyAsSododeck
│   ├── ports.ts                  # FilePort.findByPathEnd (workspace search), UiPort tweaks
│   ├── vscode-ports.ts           # findFiles impl; open-with swap glue
│   ├── deck-editor-provider.ts   # unreadable note page; swap registration
│   └── extension.ts
└── test/                         # file-codec, note-swap, document/disk-sync/save-as for notes, commands, picture links

apps/obsidian/
├── src/commands.ts               # copyAsSododeck (pure)
├── src/main.ts                   # palette command + picker (glue)
├── README.md  CLAUDE.md
└── test/commands.test.ts

docs/
├── shared-folder.md              # NEW  one folder, two tools
├── decisions/0053-shared-vault-decks.md
├── backlog-3.md                  # 071 status; "Later" note updated
└── (spec.md / file-format pointers as needed)

apps/app/src/                     # export help text mentions the shared form (one string; file confirmed in tasks)
```

**Structure Decision**: extend the two existing host apps; no new package. Dependency direction unchanged: hosts → model → schema, hosts → host-protocol.

## Complexity Tracking

No constitution deviations.
