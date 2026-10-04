# Docs contract: Database pack design sync (039)

040–049 rely on these files and formats. Later features link to them by path and anchor, so names
must not change after merge.

## 1. Prototype files (`docs/design/claude-design/`)

| File                        | Change                                                   |
| --------------------------- | -------------------------------------------------------- |
| `Sododeck Database.dc.html` | added, byte-for-byte                                     |
| `sododeck-db.js`            | added, byte-for-byte                                     |
| `sododeck-canvas.js`        | replaced with the project version (adds `SODO_CV.lib`)   |
| any other existing file     | unchanged, unless byte-different in the project (README) |

Bytes are the project's originals, with entity escaping decoded and any injected
`data-omelette-injected` block stripped.

## 2. Screenshots (`docs/design/screens/`)

```text
<id>-db-<slug>-light.png
<id>-db-<slug>-dark.png
```

- **id:** 134–168, as in [data-model.md](../data-model.md).
- **Scale:** 2×.
- **Size:**
  - Part A: 1440×900. A10 is 900×900.
  - Part B: 1180 wide, at natural height.

## 3. README (`docs/design/README.md`)

- **`claude-design/` table row:** append "`Sododeck Database.dc.html` and `sododeck-db.js`
  (Database pack, Part A 134–154, Part B 155–168) added 2026-10-04; `sododeck-canvas.js` updated
  the same day (adds `SODO_CV.lib`)".
- **`screens/` row:** add the sizes for 134–168.
- **Landing section:** remove "not copied here yet".
- **New section:** `### Database board 134–168 (Sododeck Database.dc.html)`, with:
  - props (`part`, `themes`) and single-plate mode `#only=<key>|<theme>`;
  - the key → id → slug list;
  - wait conditions;
  - sizes;
  - the fallback full-board method.

## 4. design-analysis.md

- **§a:** a new subsection `### Database board 134–168 (Sododeck Database.dc.html, added
2026-10-04)`.
  - **Intro:** one paragraph.
  - **Table:** columns `# | Screen / Row | Screenshots | Feature | Notes`, the same shape as
    117–127. `Feature` lists the primary feature first.
  - **Links:** `[light](screens/<id>-db-<slug>-light.png) · [dark](…)`.
- **§b:** two new subsections.
  - `### Components added by the Database pack (134–168)`: one bullet per component spec.
  - `### Chrome reused unchanged (Database board)`: the reused list.
- **§c:** `### Tokens introduced by the Database pack (134–168)`, pointing to DESIGN.md.
- **§g:** a new subsection `### Mismatches found in the Database board (2026-10-04)`.
  - **Numbering:** continues from 83.
  - **Item format:** `NN. **Topic** ([id](screens/<id>-db-<slug>-light.png)): conflict. **Default:** … .`
    For the four backlog deviations, use **Decision (founder, 2026-10-03):** instead of
    **Default:**.

## 5. DESIGN.md

- **New section:** `### Database pack`, placed under Components after "Card system (Deck)". Anchor
  `#database-pack`.
- **Intro:** states that a table is a Deck card (DB3), and links "Card system (Deck)" for the
  frame, lip, palette, states and zoom thresholds.
- **Tables:**
  - tokens: name, value, maps to, frame;
  - glyphs;
  - crow's foot geometry;
  - zoom behaviour for tables;
  - contrast pairs.
- **Row limit:** stated as "**Row limit: 12** (DB9, frame 158)".
- **Known Gaps:** updated if the board opens or closes any gap.

## 6. Backlog (`docs/backlog-database.md`)

- **039:** marked done, status only, once merged.
- **DB9 and §048:** point at DESIGN.md `#database-pack` for the row limit.
- **Any §040–§049 value the board changes:** corrected, with a pointer to its §g entry.

## 7. Invariants

- `git diff --stat main` lists only paths under `docs/` and `specs/039-db-design-sync/`.
- `pnpm exec prettier --check docs specs/039-db-design-sync` passes.
- Changed docs contain no other diagram or database tool names.
