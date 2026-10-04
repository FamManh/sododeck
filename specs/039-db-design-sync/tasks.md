---
description: 'Task list for 039-db-design-sync'
---

# Tasks: Design Sync, Database Pack

**Input:** design documents in `specs/039-db-design-sync/`.

**Prerequisites:** [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/docs-contract.md](contracts/docs-contract.md) and
[quickstart.md](quickstart.md).

**Tests:** this feature is documentation only, so there are no unit or e2e tests. The validation
steps in [quickstart.md](quickstart.md) are its tests; they run in the Polish phase and at each
story checkpoint.

**Organization:** tasks are grouped by user story (spec.md US1–US4).

## Format: `[ID] [P?] [Story] Description`

- **[P]:** can run in parallel (different files, no dependency on unfinished tasks).
- **[Story]:** the user story the task serves (US1–US4).

## Shared reference values (used by many tasks)

| What                                     | Value                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Design project                    | "Sododeck", `8e9232a3-578d-4728-9f55-b53d02281efe`                                                                                                                                                                                                                         |
| Read tool                                | `mcp__claude_design__read_file`. Bodies are HTML-entity-escaped (`&amp;` `&lt;` `&gt;`); decode them. Files over 256 KiB need offset / limit windows. Strip any `<style data-omelette-injected>` / `<script data-omelette-injected>` block plus the two newlines after it. |
| Etags at plan time                       | `sododeck-db.js` `1791042343545993`; `Sododeck Database.dc.html` `1791020133943498`; `sododeck-canvas.js` `1791019510944584`                                                                                                                                               |
| Scratchpad                               | `/private/tmp/claude-501/-Users-admin-Desktop-100days-sododeck/<session>/scratchpad/` (any session scratchpad; never commit capture scripts)                                                                                                                               |
| Frame list (id, key, title, slug, owner) | [data-model.md](data-model.md) "Frame catalogue" (134–168)                                                                                                                                                                                                                 |
| Tokens                                   | [research.md](research.md) R5                                                                                                                                                                                                                                              |
| §g defaults                              | [research.md](research.md) R6 (§g-83 to §g-89)                                                                                                                                                                                                                             |
| Naming rule                              | Never write another diagram or database tool's name in repo docs. The board's export list names one; refer to it only as "another tool" (§g-88).                                                                                                                           |

---

## Phase 1: Setup

**Purpose:** an isolated workspace that does not disturb the 038 work in the main checkout.

- [ ] T001 Create branch `039-db-design-sync` from `main` in a separate git worktree. Another session owns `.specify/feature.json`, which points at `specs/038-card-icons`; do not edit that file in the main checkout. In the worktree, set `.specify/feature.json` to `{"feature_directory": "specs/039-db-design-sync"}` only if a spec-kit script is needed there.
- [ ] T002 Carry `specs/039-db-design-sync/` (spec, plan, research, data-model, contracts, quickstart, checklists, this file) into the worktree. Commit it as `docs(spec): database design sync spec, plan and tasks (039)`.
- [ ] T003 [P] Check the capture tooling: Playwright Chromium is installed (`pnpm --filter @sododeck/app exec playwright --version`) and `python3 -m http.server` is available. Install nothing new.

---

## Phase 2: Foundational (blocks every story)

**Purpose:** the prototype files are in the repo and still render earlier frames unchanged.

- [ ] T004 Use `mcp__claude_design__list_files` to compare current etags with the plan-time etags above. If any differ, note it and use the new version; list the change in the final report.
- [ ] T005 Fetch `Sododeck Database.dc.html` and save it byte-for-byte (decoded, injected block stripped) as `docs/design/claude-design/Sododeck Database.dc.html`. Check that the byte size is 7,637, or matches the size reported by `list_files`.
- [ ] T006 Fetch `sododeck-db.js` (140,260 B; read it in line windows if one read is capped) and save it byte-for-byte as `docs/design/claude-design/sododeck-db.js`. Check the size against `list_files`.
- [ ] T007 Fetch `sododeck-canvas.js` and replace `docs/design/claude-design/sododeck-canvas.js` with it (78,636 B). Check with `grep -c "SODO_CV={build,LIST,CARDS,CUSTOM,lib:"` that it returns 1.
- [ ] T008 Byte-compare `sododeck-cards.js`, `sododeck-states.js`, `sododeck-data.js` and `support.js` in the project against `docs/design/claude-design/`. Replace only those that differ, and record each replaced file for T012. Expected: none differ (research R2).
- [ ] T009 Write a throwaway capture script in the scratchpad, `capture-db.mjs`, using Playwright Chromium:
  - Copy `docs/design/claude-design/` to a temp folder and serve it with `python3 -m http.server`.
  - For each `(key, theme)`, open `Sododeck%20Database.dc.html#only=<key>|<theme>` as a fresh page, with `deviceScaleFactor: 2` and a 1440×900 viewport.
  - Wait until all of these hold: `window.SDDB` and `window.lucide` exist; one `#scr-<key>` or `#row-<key>` exists; `document.fonts.ready` has resolved. Then wait 1.5 s.
  - Assert that no `[data-i]` element is empty.
  - Take an element screenshot of the element right after the label div inside `#scr-<key>` / `#row-<key>`.
  - Save it as `<id>-<slug>-<theme>.png`, using the id and slug from data-model.md.
  - Also support the 86–116 recipe from `docs/design/README.md` ("States 86–116") for T010.
- [ ] T010 Re-render frames 86 and 105 (light and dark) from the updated `sododeck-canvas.js` with the 86–116 recipe into the scratchpad. Compare them with `docs/design/screens/86-*` and `105-*` (pixel diff or visual check). If anything differs beyond antialiasing, stop and report to the founder instead of continuing (plan Risks).
- [ ] T011 Commit as `docs(design): import database board and refresh canvas prototype (039)`. The commit contains only the files from T005–T008.

**Checkpoint:** the board files are in the repo and earlier frames are unchanged. Stories can start.

---

## Phase 3: User Story 1 — See every Database screen and row in the repo (P1) 🎯 MVP

**Goal:** 70 screenshots, 134–168 in light and dark, plus the capture recipe in the README.

**Independent test:** [quickstart.md](quickstart.md) §1–§3. The listing finds 70 files and each id
has a light and a dark image. A1 measures 2880×1800 px, A10 1800×1800 px and Part B rows 2360 px
wide. No existing screenshot is modified.

- [ ] T012 [US1] Update `docs/design/README.md`:
  - In the `claude-design/` table row, append the Database board import (2026-10-04, Part A 134–154, Part B 155–168), the `sododeck-canvas.js` refresh (adds `SODO_CV.lib`) and any file replaced in T008.
  - In the `screens/` row, add the sizes for 134–168.
  - In the Landing section, remove "`sododeck-db.js` is not copied here yet (feature 039 imports the Database board)".
- [ ] T013 [US1] Add `### Database board 134–168 (Sododeck Database.dc.html)` to `docs/design/README.md`, following [contracts/docs-contract.md](contracts/docs-contract.md) §3. It covers:
  - the `part` (`all | A | B`) and `themes` props;
  - single-plate mode `#only=<key>|<theme>`;
  - the script load order;
  - the key → id → slug list;
  - the wait conditions and sizes;
  - the full-board fallback: 21 `[id^="scr-"]` + 14 `[id^="row-"]` + `#note`, located by the label text `"<key> · <theme> · 1440 × 900"` or `"B · <theme>"`;
  - the etags captured in T004.
- [ ] T014 [P] [US1] Capture the Part A screens 134–154 (21 keys: A1, A2, A3, A4, A5a, A5b, A6, A7a, A7b, A7c, A8, A9, A10, A11a, A11b, M, S1, S2, S2b, S3, S4) in light and dark with the T009 script into `docs/design/screens/`. That is 42 PNGs at 1440×900 @2x; A10 is 900×900. Before saving, check each slug against the board title; when a title gives a better slug than data-model.md, use it and update the data-model.md catalogue and the T013 list.
- [ ] T015 [P] [US1] Capture the Part B rows 155–168 (14 keys: sig, anat, set, large, rel, auth, states, zoom, groups, drawer, enums, code, prob, palette) in light and dark into `docs/design/screens/`. That is 28 PNGs, 1180 wide @2x at natural height. Record the tallest heights in the T013 section.
- [ ] T016 [US1] Open one light and one dark image from each part and check that it shows the named screen, with icons drawn and Geist loaded. Re-capture any image with an empty icon or a fallback font.
- [ ] T017 [US1] Run [quickstart.md](quickstart.md) §1–§3, then commit as `docs(design): database board screenshots 134-168 (039)`.

**Checkpoint:** US1 is complete and can be shown on its own.

---

## Phase 4: User Story 2 — Build the table card from DESIGN.md alone (P1)

**Goal:** a DESIGN.md "Database pack" section with every token 041–043 need.

**Independent test:** take the token list in backlog-database §039 (table width, column row
height, row limit, key glyphs, crow's foot geometry, row separator) and the look items in
§041–§043; find each one, with its value, in DESIGN.md `#database-pack` or design-analysis.md.

- [ ] T018 [US2] In `DESIGN.md`, add `### Database pack` under `## Components`, after `### Card system (Deck)`. Start with an intro that says:
  - a table is a Deck card (DB3) and a node of type `db.table` (DB7);
  - frame, lip, palette, states and zoom thresholds come from [Card system (Deck)](#card-system-deck) and are not repeated (FR-011);
  - the reference frames are 155–168.
- [ ] T019 [US2] Add the tokens table to the `### Database pack` section in `DESIGN.md`, with columns: name, value, maps to (existing token or "new"), source frame. Include every row of research.md R5:
  - `tblW` 240;
  - card geometry: bw 1.5, pad 12, hdr 24, gap 8, ttl 18, noteL 17, pill 30, foot 24, bot 8;
  - `colH` 24, anchor y = top + 24 i + 12;
  - `colInset` 4 with radius 8;
  - `keyW` 16, or 30 with two markers;
  - type text Mono 11 Muted, at most 58 %;
  - nullable "?" in a 7px slot;
  - row separator: one hairline above the column list, rows separated by spacing only;
  - row limit;
  - the Show all / Show fewer button spec;
  - the dialect chip;
  - the header type name rule.

  Before writing each value, check it against frames 156 (anatomy) and 158 (large).

- [ ] T020 [US2] In the same `DESIGN.md` section, add a glyph table and a crow's foot table.
  - Glyphs: PK `key-round`, FK `link-2`, unique "U" square, nullable "?", R / W markers (16×16, radius 5, Mono 9.5 / 600; W Deck Orange fill, R 1.5px orange outline, row Orange Soft; playback only).
  - Crow's foot: `crowLen` 12, `crowSpread` 6, `crowBar` 16, `crowRing` 4; bar at 10 (one), 8 (zero-or-one), 16 (one-or-many); ring r4 filled with Canvas; composite key as a 6px stub per member row plus one joining segment; the toe construction p+6v → p+12u → p−6v.
  - Ports: anchor on both card sides at the row centre; a hidden column anchors at the Show all button centre.
  - Source frames: 159 and 156.
- [ ] T021 [US2] In the same `DESIGN.md` section, add zoom behaviour for tables, from frame 162:
  - Landscape ≤ 45 %: table icon on the colour fill;
  - System 45–90 %: name, PK / FK dots and the column count;
  - Container 90–150 %: keys only and "+n columns";
  - Component > 150 %: all columns up to the row limit;
  - no lip below 60 %.

  Then add the line "**Row limit: 12** (DB9, frame 158): cut order PK, FK, rest; rows with a connector always stay".

- [ ] T022 [US2] In the same `DESIGN.md` section, compute and record the contrast in light and dark for every new text pair (FR-013):
  - type text (Muted Mono 11) on Surface;
  - Orange Ink on Orange Soft (R marker, highlighted row);
  - Ink on Deck Orange (W marker);
  - Show all text (Secondary) on Surface;
  - dialect chip text on Surface 2.

  Reuse ratios already recorded in DESIGN.md. Note every pair below 4.5:1 for T029.

- [ ] T023 [US2] Update `DESIGN.md` `## Known Gaps` for anything the board closes (database / ER notation) or opens. Run `pnpm exec prettier --write DESIGN.md`, then commit as `docs(design): database pack tokens in DESIGN.md (039)`.

**Checkpoint:** US2 is complete. An agent can plan 041 and 042 from DESIGN.md.

---

## Phase 5: User Story 3 — Know where the design and the app disagree (P1)

**Goal:** design-analysis.md lists the new components, the reused chrome and every mismatch as
§g-83 onward.

**Independent test:** [quickstart.md](quickstart.md) §5. The four founder deviations each have a
§g entry with "Decision (founder, 2026-10-03)", and every other difference has a numbered entry
with a default.

- [ ] T024 [US3] In `docs/design/design-analysis.md` §b, add `### Components added by the Database pack (134–168)` after `### Components added by board B (117–127)`. Write one bullet per component spec in data-model.md: name, frames, sizes, spacing, tokens, states, owning feature. Cover:
  - table card, column row, key glyphs, nullable marker, type text, row separator, indexes footer;
  - Show all / Show fewer, in-table column search;
  - enum card and value chips;
  - crow's foot ends on curved, elbow and straight lines; ports; relationship label; type-mismatch chip;
  - Names · Keys · All control (zoom island; a dropdown on A10), dialect chip, Deck settings Database section;
  - R / W markers and the "writes" chip, outside proxies, breadcrumb island;
  - the table states from frame 161 (default, hover, selected, row selected, editing, problem, current step, dimmed, dragged, connection target, collapsed to keys, locked).
- [ ] T025 [US3] In `docs/design/design-analysis.md` §b, add `### Chrome reused unchanged (Database board)` listing what the board draws from `sododeck-canvas.js` / `sododeck-states.js` without restyling. Cover:
  - shell islands and the rail, including the Problems badge;
  - flyout, drawer + `dHead`, section label, toolbar, menu, popover, tooltip, pill;
  - PRIM / SEC buttons, input, chips;
  - toggle 32×18, segmented control 26, dialog;
  - step player, Undo toast (40 tall, ⌘Z, 6 s).

  State that 041–049 must use the app's existing components for these.

- [ ] T026 [US3] In `docs/design/design-analysis.md` §c, add `### Tokens introduced by the Database pack (134–168)`: one paragraph that links DESIGN.md `#database-pack` and names the new token families.
- [ ] T027 [US3] In `docs/design/design-analysis.md` §g, add `### Mismatches found in the Database board (2026-10-04)` after the last entry (82). Write §g-83 to §g-86 as **Decision (founder, 2026-10-03):** entries, with frame links:
  - 83: ≡ menu (frame 150): `apps/app/src/editor/shell/deck-menu.tsx` wins, with Show JSON ⌘J, Keyboard shortcuts ? and the app's icons;
  - 84: dialect convert confirm (frame 153): the `packages/ui` `dialog.tsx` confirm with one standard overlay, no second dim layer;
  - 85: Deck drawer sections (frames 151, 152): Problems, Summary and Storage stay as `apps/app/src/editor/inspector/deck-inspector.tsx` draws them; only Database is new (043);
  - 86: local control copies (`ctog` with a `#fff` knob and `rgba(0,0,0,.2)` shadow, `check`, `seg` / `SEGI`, `dlgP`, `rgba(0,0,0,.08)` window shadows; frames 138, 145, 151–153): use `packages/ui` `switch`, `checkbox`, `segmented-control` and `dialog` plus the elevation tokens.
- [ ] T028 [US3] In the same §g subsection, write §g-87 to §g-89 as **Default:** entries:
  - 87: table width 240 vs the card default 184 (§g-67); `db.table` defaults to 240 and the size stays computed;
  - 88: the board's export list (frame 145) and the DBML row subtitle (frame 166) name another tool; repo docs say "DBML" only, and the prototype file is kept byte-for-byte;
  - 89: A2 drawn at 80 % instead of 100 % (frame 135); accepted as the content reference.
- [ ] T029 [US3] Go through all 35 frames against DESIGN.md, DB1–DB11 and §g-58–§g-82. Add every further mismatch as §g-90 onward in `docs/design/design-analysis.md`, including each contrast pair below 4.5:1 from T022. Include a §g entry for any Part A or Part B item the board lacks (spec edge cases); none are expected.
- [ ] T030 [US3] Run `pnpm exec prettier --write docs/design/design-analysis.md`, then commit as `docs(design): database board components and decisions (039)`.

**Checkpoint:** US3 is complete. The founder can review §g-83 onward.

---

## Phase 6: User Story 4 — Trace each frame to the feature that builds it (P2)

**Goal:** a §a inventory that maps frames 134–168 to 040–049.

**Independent test:** [quickstart.md](quickstart.md) §4. Every inventory link resolves, every id
from 134 to 168 has a row, and each of 041–049 appears in the Feature column.

- [ ] T031 [US4] In `docs/design/design-analysis.md` §a, add `### Database board 134–168 (Sododeck Database.dc.html, added 2026-10-04)` before `### Not designed at all`. Start with one intro paragraph: the board, its Part A / Part B split, the sample "Shop", and that board B rules apply (DB3). Then add the table `# | Screen / Row | Screenshots | Feature | Notes`:
  - one row per frame 134–168, in id order;
  - `[light](screens/<id>-<slug>-light.png) · [dark](screens/<id>-<slug>-dark.png)` links;
  - the primary feature first, then the others, from the data-model.md catalogue;
  - one or two sentences on what each frame shows, written by looking at the screenshot.
- [ ] T032 [US4] In `docs/design/design-analysis.md` §a `### Not designed at all`, update any line the board now covers (for example database or ER notation, if listed).
- [ ] T033 [US4] Run [quickstart.md](quickstart.md) §4 (link check and per-feature coverage), then commit as `docs(design): database board inventory 134-168 (039)`.

**Checkpoint:** all four stories are complete.

---

## Phase 7: Polish and cross-cutting

- [ ] T034 [P] Update `docs/backlog-database.md`:
  - DB9 and §048 point at DESIGN.md `#database-pack` for the row limit (12);
  - the "Design" bullet at the top says the frames are 134–168;
  - any value in §040–§049 the board changed is corrected with a pointer to its §g entry.

  Do not mark 039 done until it is merged.

- [ ] T035 [P] Read the added lines of the full diff (`git diff main -- docs DESIGN.md`, prototype files excluded) and confirm no other diagram or database tool is named (FR-015).
- [ ] T036 Run all of [quickstart.md](quickstart.md) §1–§7. Fix anything that fails.
- [ ] T037 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` and confirm everything passes unchanged. Run `git diff --stat main -- apps packages` and confirm it is empty.
- [ ] T038 Commit the remaining changes as `docs(backlog): point database backlog at the imported board (039)`. Push the branch and open a PR to `main`. The PR body lists:
  - frames 134–168;
  - the canvas file refresh;
  - the new §g entries for founder review;
  - what was skipped or uncertain.

  Follow AGENTS.md: no AI attribution lines.

---

## Dependencies and execution order

### Phase dependencies

- **Setup (T001–T003):** no dependencies.
- **Foundational (T004–T011):** after Setup. Blocks every story, because the screenshots need the files and the T010 check.
- **US1 (T012–T017):** after Foundational.
- **US2 (T018–T023):** after Foundational. Reads screenshots 156, 158, 159 and 162 from US1 to verify values. It can start from the board in the scratchpad if US1 is still running.
- **US3 (T024–T030):** after US1 (its §g entries link to screenshot files). T029 also needs T022's contrast results.
- **US4 (T031–T033):** after US1 (links). It is independent of US2 and US3.
- **Polish (T034–T038):** after all stories.

### Story dependencies

```text
Setup → Foundational → US1 ─┬→ US2 ──┐
                            ├→ US3 ←─┘ (T029 uses T022)
                            └→ US4
                                 └→ Polish
```

### Parallel opportunities

- T003 runs alongside T001–T002.
- T014 and T015 run in parallel: separate keys and output files, one script.
- Once US1 is done, US2 (DESIGN.md), US3 (design-analysis.md §b / §c / §g) and US4 (design-analysis.md §a) can run in parallel. US3 and US4 edit different sections of the same file, so commit one before rebasing the other.
- T034 and T035 run in parallel.

## Parallel example: User Story 1

```text
Task: "T014 [US1] Capture Part A 134–154 (light + dark) into docs/design/screens/"
Task: "T015 [US1] Capture Part B 155–168 (light + dark) into docs/design/screens/"
```

## Implementation strategy

### MVP first (User Story 1)

1. Setup, then Foundational: files imported, earlier frames verified.
2. US1: 70 screenshots plus the README recipe.
3. **Stop and validate** with quickstart §1–§3. Agents can already match frames visually.

### Incremental delivery

1. US1 gives the visual reference.
2. US2 gives the DESIGN.md tokens and unblocks the 041 and 042 plans.
3. US3 gives components and §g decisions for founder review before 040 and 041 are specified.
4. US4 gives the inventory mapping for every 040–049 spec.
5. Polish: backlog pointers, guards, definition of done, PR.

## Notes

- Never edit files in `docs/design/claude-design/` by hand. They are byte-for-byte originals.
- Never change screenshots 02–133 (FR-005). If T010 shows drift, stop and report.
- No file under `apps/` or `packages/` changes (FR-014). The definition-of-done commands must pass because nothing they cover changes.
- Report every new §g entry to the founder in the final report (FR-009).
