# Icon mapping: Material Symbols → lucide

The Claude Design prototype (`docs/design/claude-design/`) uses Material Symbols. Sododeck uses
[lucide](https://lucide.dev) (`lucide-react`), per `AGENTS.md` and the constitution: bundled, no
font download, consistent stroke style. Draw icons with `strokeWidth={ICON_STROKE_WIDTH}` (1.5),
which visually matches the prototype's Material weight 300.

The typed source of truth is `packages/ui/src/lib/icons.ts` (`KIND_STYLE`,
`MATERIAL_TO_LUCIDE`). A test (`packages/ui/test/icons.test.ts`) fails if this page and the code
list different glyphs. Where the prototype and `DESIGN.md` disagree, `DESIGN.md` and lucide win.

## Kinds

| Kind     | Prototype name | Material        | lucide              | Tile tokens (soft / ink)       |
| -------- | -------------- | --------------- | ------------------- | ------------------------------ |
| client   | client         | `devices`       | `MonitorSmartphone` | `surface-2` / `ink-secondary`  |
| gateway  | edge           | `router`        | `Router`            | `inverse` / `on-inverse`       |
| service  | service        | `deployed_code` | `Box`               | `primary-soft` / `primary-ink` |
| queue    | queue          | `swap_horiz`    | `ArrowLeftRight`    | `amber-soft` / `amber-ink`     |
| database | data           | `database`      | `Database`          | `blue-soft` / `blue-ink`       |
| external | external       | `cloud`         | `Cloud`             | `clay-soft` / `clay-ink`       |
| unknown  | —              | —               | `Shapes`            | `surface-2` / `ink-secondary`  |

## Glyphs

| Material              | lucide              | Note                                                                 |
| --------------------- | ------------------- | -------------------------------------------------------------------- |
| `account_tree`        | `Network`           |                                                                      |
| `add`                 | `Plus`              |                                                                      |
| `arrow_back`          | `ArrowLeft`         |                                                                      |
| `arrow_forward`       | `ArrowRight`        |                                                                      |
| `arrow_outward`       | `ArrowUpRight`      |                                                                      |
| `arrow_right_alt`     | `MoveRight`         |                                                                      |
| `auto_awesome`        | `Sparkles`          |                                                                      |
| `backup`              | `HardDriveDownload` | Substitute: lucide has no "backup" glyph; used for the backup banner |
| `bolt`                | `Zap`               |                                                                      |
| `call_received`       | `ArrowDownLeft`     |                                                                      |
| `center_focus_strong` | `Focus`             |                                                                      |
| `center_focus_weak`   | `ScanLine`          | Substitute: no weak/strong pair in lucide                            |
| `check`               | `Check`             |                                                                      |
| `check_circle`        | `CircleCheck`       |                                                                      |
| `chevron_right`       | `ChevronRight`      |                                                                      |
| `close`               | `X`                 |                                                                      |
| `cloud`               | `Cloud`             |                                                                      |
| `cloud_done`          | `CloudCheck`        |                                                                      |
| `content_copy`        | `Copy`              |                                                                      |
| `conversion_path`     | `Route`             | Substitute: flow icon; lucide has no conversion-path glyph           |
| `create_new_folder`   | `FolderPlus`        |                                                                      |
| `credit_card`         | `CreditCard`        |                                                                      |
| `dark_mode`           | `Moon`              |                                                                      |
| `dashboard`           | `LayoutDashboard`   |                                                                      |
| `data_object`         | `Braces`            |                                                                      |
| `database`            | `Database`          |                                                                      |
| `delete`              | `Trash2`            |                                                                      |
| `deployed_code`       | `Box`               | Substitute: package cube for "service"                               |
| `description`         | `FileText`          |                                                                      |
| `devices`             | `MonitorSmartphone` |                                                                      |
| `download`            | `Download`          |                                                                      |
| `error`               | `CircleAlert`       |                                                                      |
| `expand_less`         | `ChevronUp`         |                                                                      |
| `expand_more`         | `ChevronDown`       |                                                                      |
| `fit_screen`          | `Maximize`          |                                                                      |
| `folder`              | `Folder`            |                                                                      |
| `folder_open`         | `FolderOpen`        |                                                                      |
| `grid_view`           | `LayoutGrid`        |                                                                      |
| `hub`                 | `Waypoints`         | Substitute: no hub glyph in lucide                                   |
| `image`               | `Image`             |                                                                      |
| `ios_share`           | `Share`             |                                                                      |
| `key`                 | `KeyRound`          |                                                                      |
| `label`               | `Tag`               |                                                                      |
| `layers`              | `Layers`            |                                                                      |
| `light_mode`          | `Sun`               |                                                                      |
| `link`                | `Link`              |                                                                      |
| `local_shipping`      | `Truck`             |                                                                      |
| `map`                 | `Map`               |                                                                      |
| `my_location`         | `LocateFixed`       |                                                                      |
| `notifications`       | `Bell`              |                                                                      |
| `open_in_new`         | `ExternalLink`      |                                                                      |
| `pause`               | `Pause`             |                                                                      |
| `payments`            | `Banknote`          |                                                                      |
| `photo_camera`        | `Camera`            |                                                                      |
| `picture_as_pdf`      | `FileType`          | Substitute: lucide has no PDF file glyph                             |
| `play_arrow`          | `Play`              |                                                                      |
| `polyline`            | `Spline`            | Substitute: wordmark glyph; lucide has no polyline                   |
| `receipt_long`        | `ReceiptText`       |                                                                      |
| `remove`              | `Minus`             |                                                                      |
| `route`               | `Route`             |                                                                      |
| `router`              | `Router`            |                                                                      |
| `school`              | `GraduationCap`     |                                                                      |
| `search`              | `Search`            |                                                                      |
| `select`              | `SquareDashed`      | Substitute: selection frame                                          |
| `sell`                | `Tag`               |                                                                      |
| `shape_line`          | `PenTool`           | Substitute: vector format icon                                       |
| `skip_next`           | `SkipForward`       |                                                                      |
| `skip_previous`       | `SkipBack`          |                                                                      |
| `smartphone`          | `Smartphone`        |                                                                      |
| `sms`                 | `MessageSquareText` |                                                                      |
| `south`               | `ArrowDown`         |                                                                      |
| `sticky_note_2`       | `StickyNote`        |                                                                      |
| `storage`             | `HardDrive`         |                                                                      |
| `swap_horiz`          | `ArrowLeftRight`    |                                                                      |
| `sync`                | `RefreshCw`         |                                                                      |
| `table_chart`         | `Table`             |                                                                      |
| `timeline`            | `ChartNoAxesGantt`  | Substitute: no timeline glyph in lucide                              |
| `upload_file`         | `FileUp`            |                                                                      |
| `view_list`           | `List`              |                                                                      |
| `warning`             | `TriangleAlert`     |                                                                      |
