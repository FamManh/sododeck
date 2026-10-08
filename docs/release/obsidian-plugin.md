# Releasing the Obsidian plugin

Building never publishes. Publishing is a manual step with this checklist (spec FR-039).

1. Bump `version` in `apps/obsidian/manifest.json` and `apps/obsidian/package.json` and add the same version with its `minAppVersion` to `apps/obsidian/versions.json`; copy `manifest.json` and `versions.json` to the repository root. (`pnpm --filter @sododeck/obsidian test` fails when the two disagree or the id is not allowed.)
2. `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green; the bundle guard ran as part of `pnpm --filter @sododeck/obsidian build`.
3. `apps/obsidian/release/` holds exactly `main.js`, `manifest.json`, `styles.css`. These three files are the release assets; check `main.js` is under the size budget in `scripts/check-bundle.ts`.
4. Install the three files in a **clean vault** on desktop and on a phone (`<vault>/.obsidian/plugins/sododeck/`), turn on "Automatically update internal links", and run `specs/070-obsidian-plugin/quickstart.md` section C.
5. Network watch: open, edit, add a picture, change the file outside, switch theme, on desktop with the developer tools network panel and on the phone through a proxy; zero requests (SC-008). Disable the plugin and check every deck is still a readable note and every picture a file (SC-012).
6. The community list reads `manifest.json` at the root of the repository, so the repository root carries copies of `apps/obsidian/manifest.json` and `versions.json` (a test fails when they differ): copy them after every version bump. Once the version bump is merged to `main`, create a GitHub release **in this repository** whose tag is exactly the version in `manifest.json` (no `v` prefix; the VS Code extension uses `vscode-v<version>`) and attach **only** `main.js`, `manifest.json` and `styles.css` from `apps/obsidian/release/`.
7. First release only: open a pull request to the community plugin list repository (`obsidian-releases`) adding the entry (`id` `sododeck`, `name`, `author`, `description`, `repo`: `FamManh/sododeck`) to `community-plugins.json`. Check the wording against the list's current guidelines (the id must not contain "obsidian"; the description must not start with "This is a plugin"). Later releases need no list change.
8. Rollback: publish a patch release; the note format is unchanged and every deck stays readable with the plugin removed.
