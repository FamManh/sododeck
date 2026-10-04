# Research: Design Sync, Database Pack (039)

All findings come from a read-only survey of the Claude Design project "Sododeck"
(`8e9232a3-578d-4728-9f55-b53d02281efe`) on 2026-10-04, compared with the repo copies in
`docs/design/claude-design/`. No file in the project or the repo was changed by the survey.

## R1. Is the board ready to import?

- **Decision:** Yes. Import `Sododeck Database.dc.html` (7,637 B) and `sododeck-db.js` (140,260 B)
  as they are now in the project.
- **Rationale:** The board draws every item the prompt asks for (Part A A1–A11, context menus,
  Names · Keys · All, ≡ menu, Deck settings, dialect change; Part B rows 1–14). The Part 3 / Part 4
  corrections that change structure are applied: no settings modal, no "Schema settings" popover, no
  new tools-island button, a read-only dialect chip on database cards. What is left are look
  deviations the founder said not to fix in the design (backlog §039); they become §g entries (R6).
- **Alternatives considered:** Ask for another fix round in Claude Design. Rejected: the founder
  decided on 2026-10-03 that the app wins and deviations are fixed while implementing.

## R2. Which other prototype files change?

- **Decision:** Replace `sododeck-canvas.js` with the project's current version (78,280 → 78,636 B).
  Re-check `sododeck-cards.js`, `sododeck-states.js`, `sododeck-data.js` and `support.js`
  byte-for-byte at import, and replace them only if they differ, with a README note.
- **Rationale:** `sododeck-db.js` waits for `window.SODO_CV.lib`, and the repo copy of
  `sododeck-canvas.js` exports only `{build, LIST, CARDS, CUSTOM}`. The project version adds a
  `lib` export of chrome primitives (`base`, `chrome`, `drawer`, `dHead`, `flyout`, `menu`, `tbar`,
  `inp`, `PRIM`, `SEC`, …) and an optional `el` / `pre` field on menu rows. The change is additive,
  and states 86–116 render the same, but this has to be confirmed by re-rendering two of those frames
  (R7). `sododeck-cards.js` has the same size and modified date as the repo copy (the 128–133
  import). The Landing board already loads `sododeck-db.js`, so this import also completes that copy
  (README note "not copied here yet").
- **Alternatives considered:** Keep the old canvas file and add a shim. Rejected: the folder must
  hold byte-for-byte originals.

## R3. Frame numbering and order

- **Decision:** 35 frames, 70 images. Part A first, in the order of `SDDB.SCREENS` (21 screens),
  ids **134–154**; then Part B in the order of `SDDB.ROWS` (14 rows), ids **155–168**. The full
  list is in [data-model.md](data-model.md).
- **Rationale:** This continues after the connector rows 128–133 and keeps the board's own order,
  as 117–127 did. The board splits A5, A7 and A11 into sub-screens (A5a/b, A7a/b/c, A11a/b) and adds
  S4 "After conversion". Each sub-screen gets its own frame, so links point at one state.
- **Alternatives considered:** One frame per prompt item, with sub-screens stitched together.
  Rejected: stitched images are harder to compare pixel-close and break the one-state-per-frame
  rule of 86–133.

## R4. Capture method

- **Decision:** Use single-plate mode: `Sododeck Database.dc.html#only=<key>|<theme>`, one fresh
  navigation per plate, Playwright Chromium, `deviceScaleFactor: 2`, viewport 1440×900. Wait until
  `window.SDDB` and `window.lucide` exist, one `#scr-<key>` or `#row-<key>` element is present and
  `document.fonts.ready` resolves, then about 1.5 s more; no `[data-i]` icon placeholder may stay
  empty. Take an element screenshot of the plate that follows the label div.
- **Sizes:**
  - Part A: 1440×900. A10 is 900×900, the board's "Narrow window · 900 px".
  - Part B: 1180 wide, at natural height.
- **Rationale:** Single-plate mode is built into the board and avoids locating plates by label text
  on a page with 70 plates. The same Playwright and scale as 86–133 keep the frames comparable.
- **Network:** capture needs unpkg (React through `support.js`, lucide 0.469.0) and Google Fonts
  (Geist, Geist Mono). This applies only to the capture, never to the app (constitution IV).
- **Where the script lives:** a throwaway script in the session scratchpad, not committed, as for
  117–133. The README documents the recipe instead.
- **Alternatives considered:**
  - Full-board page, located by label. Kept as a fallback in the README.
  - A committed capture script. Rejected for this feature: no tooling for docs (YAGNI), the same
    choice as 021 and 028.

## R5. Tokens for DESIGN.md "Database pack"

- **Decision:** Take the values from the board's NOTES and `TB` geometry, and map each one to an
  existing token where there is one:

  | Token         | Value                                                                                                                                                                                               |
  | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Table width   | `tblW` 240 default. Cards stay 184.                                                                                                                                                                 |
  | Card geometry | border 1.5, padding 12, header 24, gap 8, title 18, note line 17, Show-all pill 30, index footer 24, bottom 8                                                                                       |
  | Column row    | `colH` 24, fixed. Anchor y = top + 24 i + 12.                                                                                                                                                       |
  | Row fill      | `colInset` 4, radius 8 (hover, highlight). No hairline between rows; one hairline above the column list.                                                                                            |
  | Key slot      | `keyW` 16, or 30 when any row carries two markers                                                                                                                                                   |
  | Glyphs        | PK `key-round`, FK `link-2`, unique "U" square, nullable "?" in a 7px slot after the type                                                                                                           |
  | Type text     | Mono 11, Muted, right-aligned, at most 58 % of the row                                                                                                                                              |
  | Row limit     | `colMax` 12. Cut order: PK, FK, rest. Rows with a connector always stay.                                                                                                                            |
  | Show all      | dashed 1.5 Border-strong, full width − 24, 24 tall, radius 8, 11.5 / 500 Secondary, 6 above. A hidden column's connector anchors at its centre.                                                     |
  | Crow's foot   | `crowLen` 12, `crowSpread` 6, `crowBar` 16, `crowRing` 4. Bar at 10 (one), 8 (zero-or-one), 16 (one-or-many). Ring r4 filled with Canvas. Composite key: 6px stub per row plus one joining segment. |
  | R / W markers | 16×16, radius 5, Mono 9.5 / 600. W: Deck Orange fill. R: 1.5 orange outline. The row gets Orange Soft. Playback only.                                                                               |
  | Dialect chip  | B neutral chip, 21 tall, Surface 2, database icon 12, 11.5 / 500, read-only                                                                                                                         |
  | Header type   | "Table · public" ("· schema" only when the deck has more than one schema)                                                                                                                           |
  | Zoom          | Same thresholds as Card system (Deck). System shows name + PK / FK dots + column count; Container shows keys + "+n columns"; Component shows all columns up to the row limit.                       |

  The frame, lip, palette, states and zoom thresholds are referenced from "Card system (Deck)", not
  repeated (FR-011).

- **Rationale:** These are the only values the board states for the database parts. The zoom
  thresholds already match DESIGN.md (≤ 45 / 45–90 / 90–150 / > 150 %, no lip below 60 %).
- **Row limit (DB9):** 12, from the board. Backlog DB9 and §048 point at the DESIGN.md value.
- **Contrast (FR-013):** check Mono 11 Muted on Surface, Orange Ink on Orange Soft and the chip text
  in both themes. Pairs that are already DESIGN.md tokens reuse their recorded ratio.

## R6. Known §g entries (numbered from 83)

Defaults, to be confirmed against the screenshots while documenting:

| §g  | Conflict                                                                                                                                   | Default                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 83  | S1 ≡ menu draws no shortcuts and its own icons.                                                                                            | `apps/app/src/editor/shell/deck-menu.tsx` wins: Show JSON ⌘J, Keyboard shortcuts ?, the app's icons. |
| 84  | S3 dialect change uses a local dialog (`dlgP`) with its own shadow and a second dim layer.                                                 | The app's confirm dialog (`packages/ui` `dialog.tsx`) with the single standard overlay.              |
| 85  | Deck drawer (S2) redraws Problems, Summary and Storage.                                                                                    | They stay as `deck-inspector.tsx` draws them; only the Database section is new (043).                |
| 86  | Local control copies: `ctog` (hard-coded `#fff` knob, `rgba(0,0,0,.2)` shadow), `check`, `seg` / `SEGI`, window shadows `rgba(0,0,0,.08)`. | `packages/ui` `switch`, `checkbox` and `segmented-control`, plus elevation tokens.                   |
| 87  | Table width 240 vs the card default 184 (§g-67).                                                                                           | `db.table` defaults to 240; other cards keep 184. The size is computed, so the JSON does not change. |
| 88  | The board's export list and DBML row subtitle name another tool.                                                                           | Repo docs say "DBML" only. The prototype file is still copied byte-for-byte.                         |
| 89  | A2 is drawn at 80 % while the prompt said 100 %.                                                                                           | Accept. The frame is the reference for content, not for zoom.                                        |

Any further mismatch found while documenting gets the next number.

## R7. Verifying nothing else moved

- **Decision:**
  - After replacing `sododeck-canvas.js`, re-render frames 86 and 105 locally and compare them with
    the committed screenshots. Expected: identical, or differences only from font or icon loading;
    any real difference is reported.
  - `git diff --stat` shows changes only under `docs/`.
  - `pnpm exec prettier --check` passes on the changed Markdown.
  - A grep of changed docs for other tool names returns nothing.
- **Rationale:** FR-005, FR-014 and FR-015 need proof, and the canvas file is the one shared input
  of earlier frames.
