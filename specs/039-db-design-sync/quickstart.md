# Quickstart: validate 039

Run from the repo root once the import is done. Each step maps to a spec requirement. Formats are
in [contracts/docs-contract.md](contracts/docs-contract.md); the frame list is in
[data-model.md](data-model.md).

## 1. Files are in place (FR-001, FR-002)

```bash
ls "docs/design/claude-design/Sododeck Database.dc.html" docs/design/claude-design/sododeck-db.js
grep -c "SODO_CV={build,LIST,CARDS,CUSTOM,lib:" docs/design/claude-design/sododeck-canvas.js   # 1
grep -n "Database board 134–168" docs/design/README.md
grep -n "not copied here yet" docs/design/README.md   # no output
```

## 2. 70 screenshots, none changed (FR-003–FR-005, SC-001)

```bash
ls docs/design/screens | grep -E '^1(3[4-9]|[4-5][0-9]|6[0-8])-db-' | wc -l   # 70
for i in $(seq 134 168); do
  n=$(ls docs/design/screens | grep -c "^$i-db-.*-\(light\|dark\)\.png$")
  [ "$n" = 2 ] || echo "frame $i: $n images"
done                                            # no output
git diff --name-status main -- docs/design/screens | grep -v '^A'   # no output: nothing modified or deleted
```

## 3. Sizes (FR-004)

```bash
sips -g pixelWidth -g pixelHeight docs/design/screens/134-db-*-light.png   # 2880 × 1800
sips -g pixelWidth -g pixelHeight docs/design/screens/146-db-*-light.png   # 1800 × 1800 (A10)
sips -g pixelWidth docs/design/screens/156-db-*-light.png                  # 2360
```

Open one light and one dark image per part. Each should show the titled screen with icons drawn and
Geist fonts loaded.

## 4. Inventory links resolve (FR-006, SC-002, SC-006)

```bash
grep -oE 'screens/1(3[4-9]|[4-5][0-9]|6[0-8])-db-[a-z0-9-]+\.png' docs/design/design-analysis.md \
  | sort -u | while read p; do [ -f "docs/design/$p" ] || echo "missing $p"; done   # no output
```

In the §a table, every id 134–168 has a row, and each of 041–049 appears in the Feature column at
least once.

## 5. Tokens and decisions (FR-009–FR-013, SC-003, SC-004)

```bash
grep -n '### Database pack' DESIGN.md
grep -n -iE 'Row limit: 12' DESIGN.md
grep -nE '^8[3-9]\. \*\*' docs/design/design-analysis.md   # §g-83 onward, at least the 4 founder deviations
```

Check by reading:

- DESIGN.md "Database pack" names table width, column row height, row limit, key glyphs, crow's
  foot geometry and row separator, with values.
- design-analysis.md §g has entries for the ≡ menu, the dialect convert confirm, the Deck drawer
  sections and the local control copies.

## 6. Guards (FR-014–FR-016, SC-007)

```bash
git diff --stat main -- apps packages            # empty
pnpm exec prettier --check docs specs/039-db-design-sync
```

Read the added lines of `git diff main -- docs DESIGN.md` (prototype files excluded) and confirm
they name no other diagram or database tool, including the one the board's export list names
(§g-88). The name is deliberately not written here.

## 7. Earlier frames still render (R7)

Re-render frames 86 and 105 from the updated `sododeck-canvas.js` with the 86–116 recipe in the
README. Compare them with the committed PNGs. They should be identical, apart from
font-antialiasing noise.

## Definition of done

Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. All should pass
unchanged, because no code changed.
