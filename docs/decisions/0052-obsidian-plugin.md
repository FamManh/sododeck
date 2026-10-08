# 0052. The Obsidian plugin

- **Status:** Accepted (desktop Chromium measured; real Obsidian on desktop and phone not yet checked, see "Open")
- **Date:** 2026-10-07
- **Feature:** 070 (`specs/070-obsidian-plugin/`)
- **Amends:** nothing; builds on ADR 0049 (host protocol), ADR 0048 (picture file references), ADR 0050 (the VS Code host) and ADR 0051 (the note form)

## Context

A second host for the embedded editor, in a notes app: decks live in the user's vault, next to
notes, and the app's own features (search, backlinks, link rewriting on move, sync) should work with
them. Community plugins ship exactly `main.js`, `manifest.json` and `styles.css`.

## Decision

1. **One view, two kinds of file.** `DeckView` is a `TextFileView`, registered for the extension
   `sododeck`; `.sododeck.md` notes are ordinary Markdown to the app, so a Markdown view whose front
   matter carries the marker is swapped for the deck view (`md-swap.ts`). A leaf with state
   `sododeckSource: true` stays Markdown ("Open this deck as Markdown"); removing the marker returns
   the view to Markdown.
2. **A sandboxed `srcdoc` frame.** The editor runs in `iframe srcdoc` with `sandbox="allow-scripts"`
   (opaque origin: no access to the app's DOM, storage or cookies) and a Content-Security-Policy that
   forbids the network (`default-src 'none'; … connect-src blob: data:`). Messages are accepted only
   from that frame's window and only when they parse (`frame.ts`).
3. **The embed is inlined into `main.js`.** `scripts/inline-embed.ts` re-bundles the embed build with
   esbuild into one classic script (dynamic imports included), inlines stylesheets, fonts and images
   as data URLs, turns every worker file into a source string started from a blob (`worker-loader.ts`),
   and removes the build tool's preload list (everything is already in the page). Nothing is fetched at
   run time. Cost: `main.js` is about 13 MiB (budget 16 MiB).
4. **Workers are always classic.** Measured in a sandboxed frame on desktop Chromium: classic blob
   workers start; `type: 'module'` blob workers do not. The loader drops `type`; the bundled worker
   sources are classic scripts, so nothing else changes.
5. **Own save schedule.** Not `requestSave` (debounced 2 s). Each `change` is encoded, compared with
   the file, and written at once, one write in flight, the newest text queued; `change-result` follows
   the write. A failed write keeps the text pending and says so; it is retried on the next change and
   on flush. Close, hide and quit send `flush`, wait 1.5 s at most, and write what arrived.
6. **Compare by content.** The deck text of a changed file is compared with the text the canvas holds,
   the last finished write and the write in flight; equal sends nothing. This covers our own echo, an
   older echo arriving while a newer text is queued, two panes on one deck, and edits outside the
   owned region. Edits not yet written lose to the file, with one notice. An unreadable note blocks
   writes until it can be read.
7. **Pictures are vault files the app tracks.** For a note with the setting "attachment folder" (default):
   the name comes from the picture id; the path from `getAvailablePathForAttachment`; an identical file
   is reused, a different one never overwritten; the link text is `fileToLinktext`, checked with
   `checkPicturePath`. Serving resolves the note's link with the app's own resolver and verifies size
   and hash; every path is judged inside the vault first (`vault-guard.ts`). A missing picture is
   remembered and sent when a vault event makes it resolvable. The plugin has no link-rewriting code:
   the app rewrites the visible `[[link]]`, and reading takes it.
8. **Plain `.sododeck` is kept** (passthrough, embedded pictures only; an existing 068 relative path is
   served from the deck's folder). `.sododeck.json` is not supported here.
9. **Ports.** Host logic is pure over `ports.ts`; only `main.ts`, `deck-view.ts`, `obsidian-ports.ts`,
   `md-swap.ts` and `settings-tab.ts` import `obsidian`. Tests drive the session with a scripted fake
   editor on the protocol's in-memory transport and a fake vault (link resolution, attachment path,
   events, "update links on rename").
10. **A bundle guard** fails the build on a network API or remote URL in the plugin's own code, on
    anything the inlined page could load, on a policy that allows the network, on a release folder
    with other files than the three, and over the size budget. The page's third-party libraries
    mention `fetch(` and `WebSocket` in paths this page never runs; the policy, not text matching,
    contains them.
11. **Dependencies.** One new dev dependency: the `obsidian` typings (the only official source of the
    API types; they declare `@codemirror/state` and `@codemirror/view` as peers, added as dev
    dependencies at the pinned versions) and `jsdom` for the frame and glue tests (already used by
    the app). No new runtime dependency.

## Open

- Spikes S1 (view swap without a flash), S3 (`TextFileView` save and reload) and S4 (link rewriting
  in the picture list) need the real app, and S2/S5 need it on a phone; `research.md` records what was
  measured (a headless Chromium) and what was not. Each has a stated fallback that changes a small
  mechanism, not this design.
- `main.js` is parsed at every app start (about 13 MiB, mostly one string). If load time on a phone is
  a problem, the page can be stored compressed and expanded when the first deck opens.
