# 0049. Embeddable editor and host protocol

- **Status:** Accepted
- **Date:** 2026-10-07
- **Feature:** 067 (`specs/067-embed-host-protocol/`)
- **Amends:** nothing; builds on ADR 0047 (applying a file) and ADR 0048 (picture file references)

## Context

Editor hosts (a code editor extension, a notes-app plug-in; features 069 and 070) must show the deck
editor next to the user's files. In a host the deck is a file on disk: the host owns the bytes,
the dirty state and where pictures live. The editor must not keep its own copy (IndexedDB), must
not call out to the network, and must follow the host's light or dark scheme.

## Decision

1. **One frame, one protocol, in every host.** The editor is loaded in an `<iframe>` (or a code
   editor's webview) and talks to its parent with plain messages over `postMessage`. Versioned by
   one integer (`protocolVersion`, compared for equality at `init`). Full text:
   `packages/host-protocol/README.md`.
2. **A separate embed build.** `apps/app/embed.html` + `vite.embed.config.ts` build to
   `dist-embed/` with `base: './'` (hosts load from `vscode-webview://…` or `app://…`) and no PWA
   plugin. `scripts/check-embed-bundle.mjs` runs after the build and fails on library, offline
   cache, telemetry or browser-stored theme code. Shared editor code reaches the library only
   through `DeckServicesContext`, and the host through `EmbedHostContext` (`useOpenLink`,
   `useSaveFile`), so the embed carries neither.
3. **Whole-file messages, 100 ms window.** The first own edit of a burst arms one timer; when it
   fires the whole deck is serialised and sent (`change { seq, text }`). Each message is the
   latest complete state, so skipping intermediate states is safe and hosts stay simple (they
   store text, not Yjs updates). Measured on the 500 / 1,000 bench deck: about 108 ms from the edit
   to the message.
4. **Origin pinning.** The editor accepts messages only from its parent window. Before `init` it
   sends only `ready` (no deck content, target `*`); from the first valid `init` on it posts only
   to that message's origin.
5. **Echo ring.** An outside file is merged with `applyDeckText` under `hostOrigin`, which is not
   an own origin, so the merge never produces a `change`. A text equal to one of the last eight
   sent since the last applied outside change is ignored without parsing (a late echo must not
   revert a newer edit).
6. **Read-only on an invalid file.** A refused file puts the embed in `blocked`: the editor root
   is `inert`, a window-level capture listener ends key and paste events (the shortcuts listen on
   the document, so `inert` alone is not enough: Delete would still reach the selected card), the
   problems are listed, and nothing is sent until a valid file arrives. For an invalid first file
   there is no deck to show.
7. **Host abilities.** `capabilities { openLinks, exportFiles, pictures }` decide what is offered:
   what the host cannot do is not rendered (no dead controls). Links never navigate the frame.
   Mermaid import is paste only.
8. **No "Saved" state.** The host's file is the store. The editor shows an error only when the
   host refuses a change or does not answer within 5 s, and clears it on the next ok.
9. **Pictures: paths come from the host.** With the `pictures` ability a new picture goes to the
   host (`picture-put`); the host answers with a path relative to the deck file, which the editor
   validates (`checkPicturePath`) and writes with the new untracked model op `setPicturePath`. The
   file then names the picture by path with no data (ADR 0048). A refusal keeps the picture
   embedded and says why. A deck that names a picture by path is shown by asking the host
   (`picture-get`). The picture media type travels as `mime` (`type` is the message discriminator).
10. **The file is the store inside a host (constitution IV).** Principle IV says decks persist in
    the browser (IndexedDB). Inside a host the host's file receives every edit within 100 ms, and a
    second copy in the frame's storage would drift from it (and the frame's storage may be wiped or
    blocked). The web app keeps IndexedDB unchanged. The proposed wording is "Decks MUST persist
    in the browser in the web app; inside a host program, in the host's file." The constitution is
    not edited here.

## Consequences

- A new package, `@sododeck/host-protocol` (zod only; no React, Yjs or model), so hosts share the
  message types without importing the app. Dependency direction: `app → host-protocol`.
- A pending edit made in the last 100 ms is overwritten by an outside file that does not contain
  it: 066 has no common base (three-way merge is later), and the host's dirty handling is the
  mitigation.
- A deck file with groups that have no frame (or notes pinned before ADR 0041) is fitted on open
  like in the web app, before the embed starts sending, so the fitting is included in the first
  `change` the user causes and never marks a freshly opened file as edited.
- The `/embed-host` fake host (dev only, not in production builds) and the scripted
  `createFakeHost` (shared with component tests) are the contract's test harness.

## Alternatives considered

- An `/embed` route of the web app: drags Dexie through shared chunks, the service worker would
  control it, `base` stays `/`.
- One Vite config with two inputs: shares `base` and the PWA plugin.
- Sending Yjs updates: hosts store text; rejected.
- Debounce until idle: a long drag would send nothing for its whole length.
- A model-level read-only flag: every control would still look enabled and throw.
- A `hostOrigin` query parameter: random in code editors and spoofable.
