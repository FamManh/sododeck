# Quickstart: Shared Vault Decks

Prerequisites: `pnpm install`; `pnpm --filter sododeck build` and `pnpm --filter @sododeck/obsidian build`; Obsidian and VS Code installed.

## Automated

```bash
pnpm --filter sododeck test
pnpm --filter @sododeck/obsidian test
pnpm --filter @sododeck/model test      # shared note fixtures round-trip
pnpm lint && pnpm typecheck && pnpm build && pnpm e2e
```

Expected: all green; no skipped tests.

## Manual (real apps; no automated app-level test exists, TODO(071))

1. **Shared plain file (US1)**: make a folder; open it as a vault and a workspace; create `a.sododeck`; open in both; edit in Obsidian → VS Code updates ≤ 1 s; edit in VS Code, save → Obsidian updates.
2. **Copy `.sododeck.json` (US2)**: place `old.sododeck.json`; run *Copy as .sododeck* in VS Code (explorer menu) and in Obsidian (palette) → `old.sododeck` appears and opens; original unchanged; run again → `old 1.sododeck`, nothing overwritten; try on a text file renamed to `.sododeck.json` → "not a Sododeck deck".
3. **Note opens (US3)**: create a note in Obsidian (*New Sododeck* with the Markdown form via web export, or `docs`-given fixture), open in VS Code → canvas. Open `plain.md` (no marker) → text. *Open as text* works. S1: note any flicker.
4. **Round trip (US4)**: in VS Code type a paragraph after the generated region (as text), reopen as canvas, move a node, save → paragraph still there; open in Obsidian → deck. Edit a card title in the text → canvas updates in place.
5. **Pictures (US5)**: with `sododeck.pictures.storage = file` add a picture to a note in VS Code → `<name>.assets/` created, link under *Pictures* in the note; open in Obsidian → shows. Add a picture in Obsidian (attachment folder, short link) → opens in VS Code showing the picture. S2: move the picture in Obsidian, reopen in VS Code.
6. **Untrusted workspace**: note opens and saves, pictures stay embedded.

## Contracts / data

[contracts/vscode-note-host.md](contracts/vscode-note-host.md), [data-model.md](data-model.md).
