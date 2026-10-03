# 0020. File format compatibility: a format revision and a read-only guard

- **Status:** Deferred (founder, 2026-10-03, design-analysis §g-81): no users yet, so the format
  changes freely during development and older files are not handled. Re-confirm before the first
  public release; implemented by backlog 025.
- **Date:** 2026-09-30
- **Amends:** 0002 §6 (versioning)

## Context

ADR 0002 says additive optional fields do not bump `version`. That keeps new files valid for
new builds, but not for **old** ones: every object in `v1.json` has
`additionalProperties: false`, and every edit in `@sododeck/model` validates the whole candidate
object with the generated Zod (`validate.ts`). 017, 020, 022 and 024 all add optional fields, so
the gap is about to matter.

Today an old build meets a newer deck in four ways:

1. **A stale tab.** A tab opened before a deploy stays on the old bundle. Through live multi-tab
   sync (ADR 0007) it receives Yjs updates written by a new tab. `fromY` copies unknown keys, so
   the old tab shows them, but any edit to an object that carries one fails validation and is
   rejected. The user sees a broken editor with no explanation.
2. **A rollback.** If a deploy is rolled back, decks already stored in IndexedDB by the newer
   build have the same problem as in case 1, in every tab.
3. **A shared file.** A `.sododeck.json` exported by a newer build and imported into an older
   one fails with the generic "The file is not a valid deck".
4. **Other writers.** The planned CLI / MCP server and the AI deck skill (backlog 027) write
   files against a schema that may be ahead of or behind the app.

No user data is lost today, because the strict validation refuses the edit rather than
dropping the field. But the failure is confusing, and one careless change (e.g. an op that
rebuilds an object from known keys only) would silently delete newer data.

## Decision

1. **A format revision.** `packages/schema` exports `FORMAT_REVISION`, an integer that is bumped
   in the same commit as any additive schema change. `version` stays the major number (breaking
   changes, ADR 0002 §6). The root of the file gets an optional `"revision"` (absent = 0).
   Export writes the app's `FORMAT_REVISION`. The field is writer metadata: a round-trip keeps
   every other byte, and `revision` is the maximum of the file's and the app's.
2. **Stored decks record the highest revision that wrote them.** The library record in Dexie
   (`decks`) gets `formatRevision`, raised by the persistence provider on each flush. It is a
   cache field like `name` and counts (ADR 0007), not part of the Yjs document, so opening a deck
   never creates an edit.
3. **Older reader → read-only, never a failed edit.** When a build opens a deck (from the
   library, an import, or a peer tab) whose revision is higher than its own `FORMAT_REVISION`:
   - the deck opens **read-only**: canvas, JSON panel, flows playback and export work; editing
     and autosave are off;
   - a banner says "This deck was saved by a newer version of Sododeck. Reload to edit it.",
     with a Reload button;
   - import still accepts the file (if the major `version` matches) and stores it unchanged.
4. **Peer tabs announce their revision.** The `hello` message on the deck channel carries the
   sender's `FORMAT_REVISION`. A tab that sees a higher one goes read-only with the same banner.
   This is the only read-only tab state, and it is an exception to §g-35 ("no read-only tab"),
   which is about two tabs of the same build.
5. **The schema stays strict.** `additionalProperties: false` stays everywhere. Strictness is what
   catches typos in hand-written and AI-written files, and those are a main input path.
6. **Model ops never rebuild an object from known keys only.** Updates patch the existing Yjs map,
   so unknown keys survive. A model test loads an object with an extra key, edits another field
   through the op, and asserts the extra key is still there.

## Alternatives considered

- **Tolerant reader (`additionalProperties: true`, keep unknown fields).** Old builds could edit
  newer decks, but typos in hand- and AI-written files would pass silently, and old builds would
  still mishandle fields whose meaning they do not know (e.g. drawing a routed edge without its
  route). Rejected.
- **Bump `version` for every additive change.** Makes every file "newer" after each feature and
  forces a migration per release. Too heavy for optional fields.
- **Store the revision inside the Yjs document.** Opening an old deck in a new build would write
  to the document and show in the JSON panel, which breaks the "absent fields stay absent"
  acceptance criteria of 017, 020 and 022.
- **Do nothing.** Acceptable while there are no users, but it becomes much harder to add once
  files from several builds are in the wild.

## Consequences

- One schema field, one library-record field, one channel field, one banner, and a read-only mode
  that the editor already needs (flows playback, future shared links).
- Every PR that changes `v1.json` must bump `FORMAT_REVISION`. A test compares a hash of
  `v1.json` with the one recorded next to the constant, so forgetting fails CI.
- Rolling back a release that changed the schema makes decks touched by that release read-only
  until it is re-deployed. Roll forward instead; rollbacks of releases without schema changes are
  unaffected.
- The builds deployed before this ADR is implemented reject a root `revision` field. That window
  is one release, and the app is always served at its latest version.
