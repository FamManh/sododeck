# Quickstart: validate 068 (pictures that point at a file)

The contracts are in [contracts/contracts.md](contracts/contracts.md) and the rules in [data-model.md](data-model.md).

## Prerequisites

```bash
cd ../sododeck-068          # branch 068-picture-file-refs
pnpm install
pnpm schema:generate        # after the v1.json edit; generated files are committed
```

## Run

```bash
pnpm --filter @sododeck/schema test     # parity, fixtures, coverage, I8/I9
pnpm --filter @sododeck/model test      # round trip, attach/read, fileRefs, picture facts
pnpm --filter @sododeck/skill test      # picture command, validate parity
pnpm --filter @sododeck/app test        # image node + inspector + import list
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

## Scenarios and expected outcomes

| #   | Scenario (spec ref)                                                                                          | Expected                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Valid deck with a `path` picture, no `data` (US1 AS1)                                                        | Valid in Ajv, Zod + rules, and skill `validate`                                                                                                                                        |
| 2   | Entry with both / neither (US1 AS2–AS3)                                                                      | One `image-asset-source` problem at `/assets/<id>`, saying which case                                                                                                                  |
| 3   | Paths `/x.png`, `C:\x.png`, `a\b.png`, `http://x/y.png`, `''`, `a//b.png`, `./x.png`, `a/../x.png` (US1 AS4) | One `image-asset-path` problem each, with the matching sentence                                                                                                                        |
| 4   | Paths `assets/x.png`, `../../Attachments/x.png`, `Ảnh chụp 1.png` (clarification 1)                          | Valid                                                                                                                                                                                  |
| 5   | Every existing example and fixture (US1 AS5, SC-001)                                                         | Still valid. Load → save is byte-identical                                                                                                                                             |
| 6   | Import the deck from scenario 1 in the app (US2)                                                             | Opens. The image shows "Picture missing / Saved as a separate file / assets/login.png". The inspector shows the "Picture file" row. The import list has one `picture-file-ref` warning |
| 7   | Open → move a card → export (US3 AS1, SC-003)                                                                | The exported entry is identical (facts + `path`, no `data`)                                                                                                                            |
| 8   | Copy and paste the image in the same deck, export (US3 AS2)                                                  | Two images, one entry with `path`                                                                                                                                                      |
| 9   | Mixed deck: one embedded, one pointed-at, export (US3 AS3)                                                   | Each keeps its form                                                                                                                                                                    |
| 10  | Delete the last image using the pointed-at picture, export (US3 AS4)                                         | Entry dropped                                                                                                                                                                          |
| 11  | `node picture.mjs fixtures/login.png --deck docs/arch.sododeck` for each allowed type (US4, SC-007)          | Entry with the right id, bytes, width, height, name and relative path; a deck using it validates                                                                                       |
| 12  | `picture` on a 6 MB file, a `.bmp`, a path that leaves with `a/../` (US4 AS2)                                | Exit 1, one line saying why, nothing on stdout                                                                                                                                         |
| 13  | Add a picture in the app, export (US5)                                                                       | Embedded `data`, no `path`                                                                                                                                                             |
| 14  | Deck with one 200 KB screenshot: embedded vs pointed-at file size (SC-005)                                   | The pointed-at file is ≥ 90 % smaller                                                                                                                                                  |
| 15  | Open scenario 1 in the app with the network inspector (SC-006)                                               | No request, no file prompt (the e2e no-third-party check stays green)                                                                                                                  |
