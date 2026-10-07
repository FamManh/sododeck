# Releasing the VS Code extension

Building never publishes. Publishing is a manual step with this checklist.

1. Bump `version` in `apps/vscode/package.json`; add the entry to `apps/vscode/CHANGELOG.md`.
2. `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green; the bundle guard ran as part of `pnpm --filter sododeck build`.
3. `pnpm --filter sododeck package` → `apps/vscode/dist/sododeck-<version>.vsix`. Check it holds `dist/extension.cjs`, `media/embed/**`, `media/webview-shim.js`, README, CHANGELOG, icon and nothing from `src/`, `test/`, `scripts/`.
4. Install the `.vsix` in a **clean profile** on the stable VS Code and on the previous release; run `specs/069-vscode-extension/quickstart.md` scenarios 1–17.
5. Network watch: open, edit, save, add a picture, change the file outside, switch theme; zero requests (SC-006).
6. Publish (tokens stay out of the repo, in your shell only): `npx @vscode/vsce publish --packagePath <vsix>` and `npx ovsx publish <vsix> -p $OVSX_TOKEN`.
7. Tag `vscode-v<version>`.
8. Rollback: unpublish or publish a patch version; the file format is unchanged, so decks are never at risk.
