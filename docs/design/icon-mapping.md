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

## lucide glyphs in states 41–85

`Sododeck State.dc.html` (states 41–85) already draws lucide icons (lucide 0.469 from unpkg,
stroke 1.5), so there is no Material name to map. These are the glyphs it uses that the Material
table below does not already produce; each name was checked against the installed `lucide-react`
(1.48.0). This list is for reference and is **not** read by `packages/ui/test/icons.test.ts`.
Where the design picked a different glyph for something already mapped below (`Receipt`, `Wallet`,
`MessageSquare`, `Activity`, `Network`, `Scan`, `Workflow`), the table below and
`packages/ui/src/lib/icons.ts` win (design-analysis §g-31).

| lucide              | Used for                                            | States         |
| ------------------- | --------------------------------------------------- | -------------- |
| `Ban`               | invalid edge click, invalid drop target             | 43, 55         |
| `Boxes`             | multi-selection / group header tile                 | 58, 69–71      |
| `ChevronsDownUp`    | collapse group                                      | 68             |
| `ChevronsUpDown`    | expand group, merged edges                          | 69–71          |
| `CircleDashed`      | persistent storage "Off" status                     | 72–80          |
| `CircleDot`         | recording chip                                      | 41–43          |
| `Clock`             | Recent decks rows                                   | 72–81          |
| `Component`         | component-level nodes                               | 67             |
| `CornerDownRight`   | "Next: click an edge leaving …" hint                | 42, 43         |
| `Ellipsis`          | deck / flow ⋯ menu                                  | 50, 51, 76, 77 |
| `FolderInput`       | Move to folder                                      | 76, 77         |
| `FolderOutput`      | Export folder                                       | 74             |
| `FolderX`           | Delete folder                                       | 75             |
| `GitBranch`         | add branch, branch rows                             | 43, 45, 46     |
| `Globe`             | free sticky note / external anchor                  | 62             |
| `GripVertical`      | step row drag handle                                | 42, 43         |
| `Handshake`         | partner kind tile                                   | 61             |
| `ListFilter`        | flow list filter                                    | 47, 48         |
| `LoaderCircle`      | autosave "Saving…"                                  | 83             |
| `Lock`              | JSON panel "Read-only", read-only fields and status | 41–85          |
| `MousePointer2`     | pointer while dragging an edge                      | 53–55          |
| `MousePointerClick` | "click an edge" / drill hints                       | 41, 45, 65, 66 |
| `Pencil`            | Rename                                              | 74, 76, 77     |
| `Pin`               | pinned sticky note                                  | 62, 63         |
| `RotateCw`          | Retry save                                          | 85             |
| `SearchX`           | flow filter with no results                         | 48             |
| `ShieldCheck`       | persistent storage "On", Request persistent storage | 72–81          |
| `Undo2`             | Undo last step                                      | 41–43          |
| `Unlink`            | Problems: orphan node                               | 60             |
| `Unplug`            | Problems: step without edge                         | 60             |
| `Upload`            | Import .sododeck.json                               | 72–81          |
| `Users`             | owner on component cards                            | 67             |
| `ZoomIn`            | semantic zoom hint                                  | 64             |

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
