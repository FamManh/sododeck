# apps/obsidian — Sododeck for Obsidian (070)

The plugin is a **host** for the embedded editor (067): it opens `.sododeck` files and `.sododeck.md` notes as the canvas inside a sandboxed `iframe srcdoc`, speaks `@sododeck/host-protocol`, and turns the vault's file lifecycle (open, write, outside change, rename, delete, theme, pictures) into protocol messages. Spec: `specs/070-obsidian-plugin/`. Decisions: `docs/decisions/0051-deck-markdown-form.md`, `docs/decisions/0052-obsidian-plugin.md`.

## Boundaries

- **Only these files import `obsidian`**: `src/main.ts`, `src/deck-view.ts`, `src/obsidian-ports.ts`, `src/md-swap.ts`, `src/settings-tab.ts` (`main.ts` also holds the small picker for the copy command). Everything else is pure, takes the interfaces of `src/ports.ts`, and is tested with the fakes in `test/` (`fake-vault.ts`, `fake-editor.ts`; `fake-obsidian.ts` only for the glue tests).
- Never import `apps/app`. The build **inlines** `apps/app/dist-embed/` into one HTML string (`scripts/inline-embed.ts`) that `main.js` carries; nothing is fetched at run time.
- Never reformat `change.text`; a `.sododeck` is written byte for byte. A `.sododeck.md` note goes through `@sododeck/model`'s `toMarkdown` / `fromMarkdown` only (`src/file-codec.ts`); the canvas never sees Markdown.
- The deck file is written only after a `change` (or a flush) from the canvas, never for an equal file, an unreadable note or a deleted deck, and never recreated.
- Compare by content, never by timestamp (`src/disk-sync.ts`): own writes, outside edits that leave the deck text equal, and echoes all send nothing.
- Pictures: every path goes through `src/vault-guard.ts` first (nothing outside the vault is read or written); a picture is served only if its bytes hash to its id.
- No network: `scripts/check-bundle.ts` fails the build on a network API or remote URL in the plugin's own code, on anything the inlined page could load, and on a policy that allows the network. The frame is `sandbox="allow-scripts"` with a `connect-src blob: data:` policy.
- Adding a dependency needs the founder's approval. The only dev-only additions are the `obsidian` typings (+ its CodeMirror peer types) and `jsdom` for the frame/glue tests.

## Run

- `pnpm --filter @sododeck/obsidian build` (needs `pnpm --filter @sododeck/app build` first; turbo does it) writes `main.js`, `embed.single.html` and the `release/` folder (exactly `main.js`, `manifest.json`, `styles.css`).
- To try it: copy the three files of `release/` to `<vault>/.obsidian/plugins/sododeck/` and enable the plugin. Real-app behaviour is checked with `specs/070-obsidian-plugin/quickstart.md` on desktop and phone; there is no automated app-level test (`TODO(070)`).
- `pnpm --filter @sododeck/obsidian test` runs the unit tests (host session on the fake editor and fake vault, bundle guard, inliner).

## Read first

`specs/067-embed-host-protocol/contracts/host-protocol.md`, `specs/070-obsidian-plugin/contracts/obsidian-host.md` and `contracts/markdown-form.md`.
