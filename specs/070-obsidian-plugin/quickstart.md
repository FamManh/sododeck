# Quickstart: validate Sododeck in Obsidian

Runnable checks that prove the feature end to end. Contracts: [markdown-form.md](contracts/markdown-form.md), [obsidian-host.md](contracts/obsidian-host.md). Data: [data-model.md](data-model.md).

## Prerequisites

- Repo set up (`pnpm install`, Node ≥ 24). The branch builds the embed (`pnpm --filter @sododeck/app build`).
- Obsidian desktop (stable) and a phone or tablet with Obsidian; a throwaway vault on each. Turn on the vault's "Automatically update internal links".
- The bench deck (500 nodes / 1,000 edges) from `apps/app/bench/`; a few sample decks from `apps/app/src/samples/`.

## A. Markdown form (no Obsidian needed)

```bash
pnpm --filter @sododeck/model test -- markdown-form      # round-trip corpus, hand edits by id, escaping, user text kept
pnpm --filter @sododeck/app test -- import export         # web import/export of .sododeck.md
```

Expected: all green. By hand in the web app (`pnpm dev`): export a sample deck as `.sododeck.md`, open the file in a text editor (it reads as a note; the deck block is JSON), change a card title in the readable part, import it back: the card shows the new title, nothing else changed.

## B. Plugin build and guard

```bash
pnpm --filter @sododeck/obsidian build     # builds the embed, inlines it, bundles main.js, runs the bundle guard
pnpm --filter @sododeck/obsidian test      # host session against the fake editor and fake vault
```

Expected: `main.js`, `manifest.json`, `styles.css` in the package folder; guard passes (no network APIs or remote URLs, size under budget); tests green.

## C. Install in a clean vault (desktop, then phone)

Copy the three files to `<vault>/.obsidian/plugins/sododeck/` and enable the plugin (on a phone: through the vault's file sync or a file manager).

1. **Open and autosave (US1).** Run "New Sododeck" (a plain `.sododeck` file named `Sodo deck <time>`). The canvas opens on an empty deck. Add two cards. Wait one second; open the file in another editor: it is the plain deck JSON. Close the pane right after another edit: reopen, the edit is there.
2. **Plain file (US1.5).** Put a `.sododeck` sample in the vault: it appears in the file list, opens as the canvas, edits are saved as plain JSON.
3. **Search and text edit (US2).** Search the vault for a card title: the deck note is listed. Switch the deck to Markdown ("Open this deck as Markdown"), edit that title, go back: the canvas shows it. Type a paragraph of your own after the owned region, edit on the canvas: your paragraph is still there.
4. **Outside changes (US3).** With a deck open, change the file from a terminal (or sync from another device): the canvas updates in place, selection kept. Make an edit and, within a second, overwrite the file from a terminal: the canvas shows the file's content and a notice says the edits were replaced. Write a broken deck block: the canvas keeps the last good deck, read-only, with problems; fix it: it resumes. Open the same deck in two panes and edit in one: the other follows, no loop (watch the file's modified time).
5. **Pictures (US4).** Paste a picture: a file appears in the vault's attachment location and a `[[…]]` link in the deck's picture list. Move the picture to another folder in the app: the deck still shows it; look at the note: the link was updated. Move the deck: still shows. Switch the plugin setting to "Inside the deck file": the next picture is embedded. Put a deck with a link to a missing file: "missing" with the name; create the file: it appears without reopening. Edit a link to `../../outside.png`: refused with "outside the vault".
6. **Theme (US5).** Switch the app between light and dark: the canvas follows within a second, selection kept.
7. **Network and trust (US7).** With the app's network inspector (desktop developer tools) or a proxy, repeat steps 1–6: zero requests. Disable the plugin: every deck is still a readable note, every picture still a file.
8. **Large deck (SC-001, SC-013).** Open the 500-node bench deck as `.sododeck.md`: time to canvas ≤ 2 s on desktop; dragging a node stays smooth; on the phone use a 100-node deck: ≤ 5 s.

## D. Spikes (first task group, before building the rest)

Record each result in `research.md` under its id: S1 (view swap without flash, restored workspace), S2 (frame, workers, size and load time on desktop, iOS, Android), S3 (`TextFileView` save and echo), S4 (link rewrite on move for the picture list; how the outline and search display `%%` markers), S5 (marker detection right after a create and a sync delivery). If any fails with no stated fallback: stop and report.

## E. Release dry run (FR-039)

Follow `docs/release/obsidian-plugin.md` up to, but not including, creating the public release and the list submission.

## Definition of done

`pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` pass; steps A–C (desktop and phone) done and recorded in the final report; ADRs 0051 and 0052, `docs/backlog-3.md`, `AGENTS.md`, `packages/model/CLAUDE.md`, `apps/obsidian/CLAUDE.md` updated.
