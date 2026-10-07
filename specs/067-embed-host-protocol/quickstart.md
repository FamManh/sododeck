# Quickstart: validate 067 (embed + host protocol)

Run from the 067 worktree. Contracts: [host-protocol.md](contracts/host-protocol.md), [app-embed.md](contracts/app-embed.md).

## Prerequisites

- `pnpm install`; 066 merged; for the picture checks (step 6), 068 merged.

## Automated

```sh
pnpm --filter @sododeck/host-protocol test   # schemas, transports, fake host
pnpm --filter @sododeck/model test           # setPicturePath + round-trip
pnpm --filter @sododeck/app test             # embed flows against the fake host (FR-025), no-network test (SC-005)
pnpm --filter @sododeck/app build            # both builds; check-embed-bundle passes (SC-006)
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

Expected: all green; `apps/app/dist-embed/embed.html` exists; `apps/app/dist/` has no `embed-host` chunk (FR-024).

## Manual, with the fake host (`pnpm dev`, open `http://localhost:5173/embed-host`)

1. **Load** (US1): pick a sample. The canvas shows it; the log has `ready` then `init`. No library, home, new/open/import-file controls. Toggle the scheme to dark: the editor switches without reloading.
2. **Edit** (US2): move a card. One `change` within 200 ms (the log shows the delay); its text validates (paste it into the web app's import). Type a title quickly: one message per ~100 ms, not one per key. No "Saved" label in the editor. Turn on "refuse next change" and edit: an error with the reason appears; the next edit clears it.
3. **Outside change** (US3): select a card, press "simulate outside change". The renamed title appears; selection and viewport stay; no `change` follows in the log. Press undo: only your own last edit is undone.
4. **Invalid file**: paste an invalid file and send it as an outside change. The problems notice appears, the canvas cannot be clicked or typed into, no `change` is sent. Send a valid file: editing works again.
5. **Flush**: press "flush" right after an edit: `change` then `flushed`.
6. **Pictures** (US4, needs 068): with "pictures" on, paste an image: `picture-put`, the fake host answers `picture-stored` with `assets/<name>`, the next `change` has `path` and no `data`. Reload the deck: `picture-get` → shown. Answer "missing": the missing look with the reason. With "pictures" off: the `change` embeds `data`.
7. **Abilities and version** (US5): turn off "open links": a card link shows no open action; on: opening sends `open-link` and the frame does not navigate. Turn off "export files": download actions are gone. Set protocol version 2: "This editor needs an update", no deck.
8. **No network** (SC-005): with the browser's network panel open on the iframe, repeat 1–7: no requests beyond the embed's own files.
9. **Mermaid** (FR-020): open the Mermaid import: paste works into the open deck; there is no file chooser.
