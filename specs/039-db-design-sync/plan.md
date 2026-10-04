# Implementation Plan: Design Sync, Database Pack

**Branch**: `039-db-design-sync` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/039-db-design-sync/spec.md`

## Summary

Bring the Database pack board from the Claude Design project "Sododeck" into the repo as the
reference for 040–049, in the same way 021 and 028 did for earlier boards.

**What gets imported**

- `Sododeck Database.dc.html` and `sododeck-db.js`, byte-for-byte.
- A refreshed `sododeck-canvas.js`: the board needs its new `SODO_CV.lib` export.

**What gets captured**

- 35 frames (21 Part A screens as 134–154, 14 Part B rows as 155–168) in light and dark: 70 PNGs.
- Each plate is captured in the board's single-plate mode.

**What gets documented**

- design-analysis.md:
  - inventory rows that map each frame to its owning feature;
  - the new components and the chrome reused unchanged;
  - mismatches as §g-83 onward, including the four deviations the founder already decided.
- DESIGN.md: a "Database pack" section with the board's tokens, including the row limit, 12.

No code changes.

## Technical Context

- **Language/Version:** Markdown docs. Prototype files are copied, not run in the app.
- **Primary Dependencies:** none added.
  - Capture uses the repo's existing Playwright (Chromium) from a throwaway scratchpad script.
  - The prototype loads React and lucide 0.469.0 from unpkg and Geist from Google Fonts, during
    capture only.
- **Storage:** files in `docs/design/` and `DESIGN.md`.
- **Testing:**
  - The quickstart checks: file counts, sizes, link resolution, prettier, `git diff` guards.
  - The definition-of-done commands pass unchanged.
- **Target Platform:** repo documentation, read by agents and the founder.
- **Project Type:** documentation for the monorepo (no app or package change).
- **Performance Goals:** N/A.
- **Constraints:**
  - byte-for-byte prototype files;
  - no edits to frames 02–133;
  - no other tool names in repo docs;
  - prettier-clean Markdown.
- **Scale/Scope:**
  - 35 frames, 70 images;
  - about 25 component specs;
  - about 15 tokens;
  - at least 7 §g entries;
  - about 1 day.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                | Applies? | Status                                                                                                                                                                                                                                      |
| ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth (Yjs)          | No code  | ✅ Pass. DESIGN.md records that a table is a node (DB7) and adds no other store.                                                                                                                                                            |
| II. Schema-owned format, lossless        | No code  | ✅ Pass. No schema change; 040 owns it.                                                                                                                                                                                                     |
| III. Stable identity                     | No code  | ✅ Pass. The docs describe ports by column id (DB8), never by name.                                                                                                                                                                         |
| IV. Local-first, private                 | Capture  | ✅ Pass. Capture fetches CDNs from a throwaway local page, never from the app, and carries no user content. The prototype stays a reference only: its CDN, Google Fonts and hard-coded colours are never copied into `apps/` (README rule). |
| V. Performance off the main thread       | No code  | ✅ Pass. Risks for dense schemas are recorded for 041 and 048.                                                                                                                                                                              |
| VI. Strict types, tested behaviour       | Docs     | ✅ Pass. The quickstart checks are the tests for this feature. No new e2e tests.                                                                                                                                                            |
| VII. Accessible by default               | Docs     | ✅ Pass. FR-013 records contrast for every new text pair. R / W markers and key glyphs are readable without colour (shape and letter).                                                                                                      |
| VIII. Simplicity, justified dependencies | Yes      | ✅ Pass. No dependency, no committed tooling. `sododeck-canvas.js` changes only because the board needs it (research R2).                                                                                                                   |

**Post-design re-check:** still passes. The design adds files under `docs/` only, and the contract
§7 invariants enforce that.

## Project Structure

### Documentation (this feature)

```text
specs/039-db-design-sync/
├── plan.md              # This file
├── research.md          # Phase 0: board survey, capture method, tokens, §g defaults
├── data-model.md        # Phase 1: frame catalogue 134–168 and record formats
├── quickstart.md        # Phase 1: validation commands
├── contracts/
│   └── docs-contract.md # Phase 1: file names, sections, anchors other features rely on
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Files changed in the repo

```text
docs/design/claude-design/
├── Sododeck Database.dc.html   # new, byte-for-byte
├── sododeck-db.js              # new, byte-for-byte
└── sododeck-canvas.js          # replaced (adds SODO_CV.lib), see research R2
docs/design/screens/
└── 134-db-…-{light,dark}.png … 168-db-…-{light,dark}.png   # 70 new
docs/design/README.md           # file list, capture recipe for 134–168, Landing note
docs/design/design-analysis.md  # §a, §b, §c, §g additions
DESIGN.md                       # "Database pack" section, Known Gaps
docs/backlog-database.md        # DB9 / §048 pointer, 039 status at merge
```

**Structure Decision:** documentation-only. Nothing under `apps/` or `packages/` changes, so no
package `CLAUDE.md` changes either.

## Phases (for /speckit-tasks)

1. **Import.**
   - Fetch both new files and `sododeck-canvas.js` from the project. Decode entities and strip any
     injected block.
   - Byte-compare the other shared files and replace only those that differ.
   - Update the README file list and the Landing note.
2. **Capture.**
   - Scratchpad Playwright script, single-plate mode, 70 PNGs.
   - Re-render 86 and 105 to confirm the canvas update changes nothing (R7).
3. **Inventory.** design-analysis.md §a table for 134–168, following data-model.md.
4. **Components.**
   - §b component specs and the reused-chrome list.
   - §c pointer.
5. **Tokens.**
   - DESIGN.md "Database pack" section from research R5.
   - Contrast pairs.
   - Row limit 12.
6. **Decisions.**
   - §g-83 onward: R6, plus anything found in 3–5.
   - Report all new §g entries to the founder.
7. **Backlog and checks.**
   - Backlog DB9 / §048 pointers.
   - Run the quickstart and the definition-of-done commands.

## Risks

- **The board changes in Claude Design during the import.**
  - Mitigation: record the etags at fetch time (db.js `1791042343545993`, dc.html
    `1791020133943498`, canvas.js `1791019510944584`) in the README.
  - Re-fetch if they change before merge.
- **CDN fonts or icons fail during capture.** The wait conditions plus the empty-icon check catch
  it. Re-run before committing.
- **The canvas update shifts earlier frames.** The R7 check catches it. If it does, stop and report
  instead of re-capturing 86–116.
- **Concurrent 038 work in the same checkout.** Another session is planning 038 and owns
  `.specify/feature.json`. Work 039 on its own branch or worktree and do not change that pointer.

## Complexity Tracking

No constitution violations to justify.
