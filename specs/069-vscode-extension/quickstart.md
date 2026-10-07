# Quickstart: validating Sododeck in VS Code

Prerequisites: 067 merged and `apps/app` builds `dist-embed/` (until then only the unit tests and the spikes against a local 067 branch can run). Node ≥ 24, pnpm, VS Code (stable and the previous release for SC-010).

## Build and test

```bash
pnpm install
pnpm --filter @sododeck/vscode build        # builds app embed, bundles the extension, runs the bundle guard
pnpm --filter @sododeck/vscode test         # host logic against the scripted fake editor
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm --filter @sododeck/vscode package      # dist/sododeck-<version>.vsix
```

## Run in a real editor

1. Open `apps/vscode` in VS Code and press F5 (Extension Development Host), or install the `.vsix` in a clean profile: `code --profile sododeck-test --install-extension apps/vscode/dist/sododeck-*.vsix`.
2. Open a folder containing `docs/arch.sododeck` (copy a sample from `apps/app/src/samples/`).

## Scenarios (map to the spec)

| #   | Do                                                                          | Expect                                                                                                                                                             |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Open `docs/arch.sododeck`                                                   | Canvas in a tab, no library or "open deck" controls (US1, FR-002)                                                                                                  |
| 2   | Move a node                                                                 | Tab shows the changed mark within 0.5 s; file on disk unchanged (FR-005)                                                                                           |
| 3   | Save                                                                        | File is valid, pretty-printed; `git diff` shows only the move; mark clears (US1, FR-008)                                                                           |
| 4   | Open and save without edits                                                 | `git diff` empty (SC-003)                                                                                                                                          |
| 5   | Edit, then Save As `copy.sododeck`                                          | New file has the edit; old file unchanged (US2)                                                                                                                    |
| 6   | Edit, Revert                                                                | Canvas shows the saved file; mark clears                                                                                                                           |
| 7   | Edit, quit VS Code with hot exit, reopen                                    | Edit is back, tab still marked (US2)                                                                                                                               |
| 8   | Edit, `git checkout` another version of the file                            | Canvas shows it in place; selection and viewport kept; mark clears; one-line "unsaved edits were replaced" notice; undo does not bring the edit back (US3, FR-013) |
| 9   | Run `echo '{broken' > docs/arch.sododeck`                                   | Canvas keeps the last deck, shows problems, read-only; nothing written; notice offers "Open as text" (FR-014)                                                      |
| 10  | Switch VS Code theme light ↔ dark                                           | Canvas follows within 1 s, no reload (US5)                                                                                                                         |
| 11  | Setting `sododeck.pictures.storage` = `file`, paste a picture               | File appears in `docs/arch.assets/`; deck holds only the path and facts (US4)                                                                                      |
| 12  | Edit a deck's picture path to `../../../outside.png`                        | Picture shows missing, "outside the workspace"; nothing read (FR-019)                                                                                              |
| 13  | Save As into another folder with `file` pictures                            | Pictures copied to `<new>.assets/`, paths rewritten; old files untouched (FR-017a)                                                                                 |
| 14  | Open an untrusted folder (Restricted Mode)                                  | Deck edits and saves; a notice says picture files are limited (FR-026)                                                                                             |
| 15  | Command palette: "New Sododeck deck" in a folder                            | Valid empty deck opens; existing name never overwritten (US6)                                                                                                      |
| 16  | Watch network (for example `lsof -i` or the OS firewall prompt) during 1–15 | No requests (SC-006)                                                                                                                                               |
| 17  | 500-node bench deck (`pnpm bench` fixture)                                  | Opens ≤ 2 s; drag stays smooth (SC-001, SC-008)                                                                                                                    |

## Spikes (do first, before building on them)

- **S1**: dirty tab + outside change; try `workbench.action.files.revert` for the document and see if the mark clears with no prompt.
- **S2**: webview with the CSP in the plan, the shim and the 067 embed build: deck shows, layout worker runs, fonts load, a 5 MiB picture crosses the message channel.
- **S3**: Ctrl/Cmd+Z, Ctrl+Y, Ctrl+S inside the webview.
