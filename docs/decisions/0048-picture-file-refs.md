# 0048. Pictures that point at a file next to the deck

- **Status:** Accepted (founder decision H2 and clarifications 1–3 of the spec, 2026-10-07)
- **Date:** 2026-10-07
- **Feature:** `specs/068-picture-file-refs` (research R1–R8)
- **Builds on:** 0002 (file format), 0037 (image support), constitution II, IV

## Context

A deck in a repository or a notes vault keeps its pictures best as files beside it: the deck stays
small and diffable. Until now every picture was base64 in `assets[id].data`. Editor hosts (069, 070) need a way to refer to a file.

## Decision

- **`Asset.data` becomes optional and `Asset.path` is new** (declared right after `data`). An entry
  has exactly one of the two. The picture id (SHA-256 of the bytes) is unchanged; for a `path` it is
  the hash of the file as stored on disk.
- **Rules in `semantic-rules.ts`, not `oneOf`.** The generators strip presence rules and `oneOf`,
  so I8 (`image-asset-source`: both or neither) and I9 (`image-asset-path`) are format rules with
  their own codes and one clear message per entry. A single `pattern` would give one opaque message
  for ten different mistakes.
- **The path rule is one pure function**, `checkPicturePath` in `@sododeck/schema`, shared by I9,
  the model and the skill: relative to the deck's folder, `/` only, no `:` (drive letters and
  schemes), no empty or `.` segment, `..` only as a leading run, a file name last, no control
  characters, at most 1,024 characters.
- **Containment is the host's job (FR-014).** A host resolves `path` against the deck's folder and
  refuses a result outside its workspace or vault; the format cannot check this. Recorded in the
  069 and 070 backlog entries.
- **No version bump.** The change is additive, as in 0037. A build without it refuses such a file
  (`data` was required there); the web app is always the latest build.
- **The web app never reads or fetches the file.** The image shows as missing with "Saved as a
  separate file" and the path; the inspector shows a read-only "Picture file" row; opening the deck
  lists one `picture-file-ref` warning per picture. Export, save, copy as a file and paste keep
  `path` and never turn it into `data`, even when bytes are at hand.
- **A skill command, `picture`**, prints the complete entry for an image file so an agent need not
  compute the id or size. To share the checks, `sniffType` moved from the app into
  `@sododeck/model` next to the new `pictureSize` (header parsing for the six types) and
  `pictureFileEntry`. No new dependency.

## Consequences

- Existing files are byte-identical on round trip.
- Hosts can keep pictures as sibling files; the web app degrades to a clear placeholder.
- An SVG's id is the hash of the file on disk, not of the sanitised copy the app makes on ingest.
