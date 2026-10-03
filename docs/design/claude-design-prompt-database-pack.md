# Claude Design prompt: Database pack (tables, columns, relationships)

Discussed with the founder on 2026-10-03. The features, decisions and build order are in
[`../backlog-database.md`](../backlog-database.md) (039–049); this file has two parts: the
**requirements** for the design round, then the **prompt** to paste into the Sododeck Claude
Design project. It extends board B "Deck" (`Sododeck Cards.dc.html` + `sododeck-cards.js`, frames
117–127) and must look like it belongs on that board.

## Part 1: requirements

### Why

Users who draw architecture in Sododeck also design the databases behind it, today in a separate
tool. In Sododeck the "Orders DB" card on the architecture board opens into its schema, a flow step
that writes orders points at the `orders` table, and services, flows and tables live in one deck
and one file.

### Decisions

| #   | Topic            | Status               | Decision                                                                                                                                                                                                                                                                       |
| --- | ---------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DB1 | Where it lives   | founder, 2026-10-03  | A **Database pack** (030) inside a normal deck, not a separate deck type. A table is a card type; a deck with only tables is a "schema deck".                                                                                                                                  |
| DB2 | Text formats     | founder, 2026-10-03  | **SQL DDL** (Postgres, MySQL, SQLite) and **DBML**, both import and export. DBML is also the format of the code panel.                                                                                                                                                         |
| DB3 | Look             | founder, 2026-10-03  | Board B "Deck" only: same tokens, chips, lip, connectors, stickers, palette. No new direction.                                                                                                                                                                                 |
| DB4 | Drill-in         | founder, 2026-10-03  | A database card has its tables inside (`table.parent` = the database card). Enter opens "Inside Orders DB"; foreign keys to tables in another database show as dashed outside proxies (034).                                                                                   |
| DB5 | Relationship end | founder, 2026-10-03  | Connectors attach to a **column row**, not the card side midpoint. Ends use crow's foot notation (one, many, zero-or-one, zero-or-many).                                                                                                                                       |
| DB6 | Stable ids       | proposed (ADR later) | Columns, indexes and enums have ids; foreign keys, indexes and enum columns refer by id, so renaming a column never breaks anything.                                                                                                                                           |
| DB7 | Many-to-many     | founder, 2026-10-03  | n–n is a real cardinality; export writes the junction table, and the lint suggests one.                                                                                                                                                                                        |
| DB8 | Scope v1         | proposed             | Tables, columns, keys, indexes, checks, enums, schemas, table groups, notes, SQL / DBML / Mermaid / data-dictionary export. **Not now:** SQL views, custom types, sample rows, lineage, migrations, MariaDB / SQL Server / Oracle, version history (backlog-database "Later"). |

### Table card anatomy

Top to bottom, in board B's frame (184 default width may need to grow for tables, see the prompt):

1. **Header**, 24 tall: type tile (`table` icon), type name ("Table" or the schema name, e.g.
   `public`), badge slot (problem badge, pin).
2. **Title**: the table name, one line (table names are identifiers; a cut name gets the title
   tooltip).
3. **Note** (optional, max 2 lines).
4. **Column rows**: key marker (PK / FK / unique), name, type right-aligned, nullable marker. One
   row per column, a fixed row height so connector anchors are computable (no measuring).
5. **"+n columns"** dashed pill when the table is collapsed to keys only, or when rows are hidden.
6. **Indexes** (optional): a quiet footer line, e.g. `2 indexes`.

### Scope of this design round

The whole feature at once (editor screens and components), so it can be reviewed as one product before it is split into backlog items.

### Out of scope for this design round

SQL views and joins, custom types, sample rows, lineage, reusable column sets, migration diffs,
version history, a live database connection, AI inside the app, sharing, comments, presence, any
server feature. The implementation itself (it becomes backlog items after
the board is accepted).

## Part 2: the prompt

Paste the block below into the existing **Sododeck** Claude Design project (the one with
`Sododeck Cards.dc.html`). Attach `DESIGN.md` (section "Card system (Deck)") and screenshots
117–127 (light and dark). Do not attach screenshots of other database tools: the board must look
like Sododeck and nothing else.

---

Design the **Database pack** for Sododeck, in direction **B · Deck**, as a new board that sits
next to the card system board and reuses it.

**Files.** Create `Sododeck Database.dc.html` and `sododeck-db.js`. Build `sododeck-db.js` on top
of `sododeck-cards.js`: same token function (`TK('B', theme)`), the same `PAL` (13 colours with
fill / stroke / chip / ink / dot, light and dark), the same helpers (`card`, `chip`, `tagsBlock`,
`probBadge`, `stepBadge`, `handles`, `stack`, `frame`, `proxy`, edge styles, arrow, start knob,
count badge, token, step player, `plate`, `pnl`, `inp`). Do not redefine or fork a token: if a
table needs a new one, add it next to B's tokens and list it in the notes. Expose rows the same way
(`window.SDDB = { ROWS, NOTES, plate(React, row, theme) }`). Part B rows are 1180-wide plates at
their natural height and Part A screens are full windows (1440 × 900), all in **light and dark**. Only direction B; no A or C.

Everything must still be describable as data (a Canvas 2D renderer will draw it later): no
backdrop blur, gradients or filters. Readable without colour (WCAG 2.2 AA), lucide icons,
Geist / Geist Mono, English UI, no avatars, sharing, comments, presence or AI buttons.

### What a table is

A **table card** is a B information card whose body is a list of **column rows**:

- Header: 24px type tile with the lucide `table` icon, type name (`Table`, or the schema name such
  as `public`), badge slot on the right (problem badge, pin).
- Title: the table name, **one line** (Geist 14 / 600). Long names cut with the title tooltip.
- Optional note: up to 2 lines, body style.
- **Column rows**, one per column, **fixed height** (propose it, around 24): key marker on the
  left (primary key, foreign key, unique; propose glyphs that read without colour, e.g. lucide
  `key-round` for PK and `link-2` or an arrow for FK), the column name (Geist 12 / 500, PK in
  600), and the type right-aligned in Geist Mono (Muted). Nullable shows as a quiet `?` or
  `null` after the type; a default shows in the drawer only. Rows are separated by hairlines or
  spacing (pick what stays calm on a 40-table board).
- An enum column shows the enum name as its type, with a small chip in the enum's colour.
- Footer (optional): `2 indexes` in Muted, and the "n inside ⏎"-style pill is not used on tables.
- The card keeps B's 14px radius, 1.5px border, 3px lip, colour fill / stroke from the palette.
- **Width:** 184 is narrow for `created_at  timestamptz`. Propose a table default width (e.g. 240)
  and show how long names and types truncate. Height is computed from rows, never measured.

**Table collapsed to keys:** only PK and FK rows, plus a dashed "+n columns" pill (B's "+n fields"
pill). Toggle from the header and the context menu.

### Relationships (the most important row)

Connectors go **from a column row to a column row**, leaving the card on the left or right side
at the row's vertical centre (whichever side faces the other table). Use B's connector: 2px,
curved by default, elbow and straight available (DESIGN.md "Connectors"). Replace the arrow and
start knob with **crow's foot ends** drawn in the same 2px stroke with round joins:

- exactly one (`|`), zero or one (`o|`), one or many (crow's foot with `|`), zero or many (crow's
  foot with `o`).
- Show 1–1, 1–n, n–1 and n–n, optional and mandatory sides, a **self-reference** (parent_id →
  id on the same table), a **composite** foreign key (two columns to two columns, drawn as one
  connector with both rows marked), and two foreign keys between the same pair of tables (bundle
  with B's ×n count, or two lines: pick and explain).
- Label: B's 20px pill, optional, e.g. `ON DELETE CASCADE` in Mono, shown on hover or selection
  only.
- **Highlight:** hovering a column row highlights the row, its connector and the matching row on
  the other table (Ink 2.75px like B's highlighted connector); everything else dims to 22 %.
- **Colour:** a relationship can take a palette colour (stroke only, never carrying meaning).
- **Creating one:** each column row has a handle on both sides (B's 12px knob, shown on hover);
  dragging to a row on another table makes the connection target state (orange border on the
  table, the target **row** highlighted, the handle active with its 4px halo). Dropping on a row
  with a different type shows a Clay warning chip "int → uuid".

### Large tables and large schemas

Real schemas are big: a `users` table with 60 columns, a deck with 150 tables. Drawing everything
at full detail does not work. Design how Sododeck stays usable:

- **Long table (60 columns).** The card shows at most a set number of rows (propose it, around 12) in a fixed order: PK first, then FK, then the rest. At the bottom of the card a dashed
  **"Show all 60 columns"** button expands the card in place; once open it becomes **"Show
  fewer"**. The choice is per table and saved in the deck, so a user can keep some tables fully
  open and others short (show both on the same board). **Rows that carry a connector always stay
  visible**, even when the table is cut, so every connector has a real anchor. When a hidden
  column's connector must still be drawn (e.g. the other end is hovered), it anchors on the
  "+n columns" pill. No scrolling inside a card: a scroll area on a zoomable canvas fights the
  wheel and pinch.
- **Find a column.** In a selected table, typing filters its rows (a small search field in the
  header, or ⌘F scoped to the table); matching rows are highlighted and the rest fold into the
  "+n" pill.
- **Large schema (150 tables).** Show the tools that keep it readable: table groups (by domain or
  by schema `public` / `billing` / `auth`), collapsed groups as fanned hands with merged ×n
  connectors, focus on a table (its neighbours one hop away stay, the rest dims or hides), Jump to
  (⌘K) by table or column name, the minimap, auto-layout (Tidy) by groups, and Landscape / System
  zoom. Connectors between groups merge so a 150-table board does not turn into a hairball.
- **Wide types and names** (`character varying(255)`, `subscription_renewal_attempts`): truncate
  with a tooltip, never wrap a column row.

### Groups

Groups use B's group system (DESIGN.md "Groups") and are the main tool for large schemas:

- **Expanded:** B's frame with its label pill on the top edge (name + table count), colour from the
  palette; a group can be a Postgres **schema** (`billing`), and its tables show `billing` as
  their type name.
- **Collapsed:** B's fanned hand, member tiles are table icons, count in the Ink disc;
  connectors from outside merge per neighbour with ×n; hovering a merged connector lists the
  foreign keys it carries.
- **Nested groups** (a domain inside a schema), dragging a table in and out of a group, and
  "Group selection" from the selection toolbar.

### Part A · Editor screens (full window, 1440 × 900, light and dark)

Draw these first, as whole-window frames in the canvas-first shell (frames 86–116: five floating
islands, left rail with flyouts, drawer on demand, JSON overlay), so the whole feature reads as one
product. Use the "Shop" sample.

- **A1 · New schema deck, empty.** The empty-canvas card offers: Add table (T), Import SQL / DBML,
  Start from a sample ("Shop", "SaaS auth", "Blog" as small previews). The deck's dialect is
  set in Deck settings (one per deck, Generic by default).
- **A2 · Schema deck, working.** About 12 tables and 2 groups at 100 %; one table selected with
  its **selection toolbar** (colour, collapse to keys, add column, group, more) and the drawer
  open on its Columns tab; the Outline flyout pinned, listing groups → tables → columns.
- **A3 · Relationship selected.** Connector selected with its toolbar (cardinality, line type,
  on delete, delete) and the drawer on the relationship.
- **A4 · Code view.** The JSON overlay with the **DBML** tab active, the canvas updating next to
  it, one inline error.
- **A5 · Import.** The import dialog over the canvas (paste / drop, dialect, preview, "import into
  Orders DB" or "new deck"), then the same deck after import with the import report panel, and
  the "Detect foreign keys by name" suggestions (`customer_id` → `customers.id`) the user accepts
  or dismisses one by one or all at once.
- **A6 · Large schema.** 150 tables at System zoom with collapsed and expanded groups, the minimap,
  Jump to open on "invoice" (results for tables and columns), and the views menu with saved views
  filtered by schema ("billing only") and by group.
- **A7 · Architecture + schema.** The architecture deck with the Orders DB card, then the drilled-in
  view "Inside Orders DB" with outside proxies (row B1 in full window).
- **A8 · Problems.** The problems flyout open with schema lint, one problem selected on the canvas.
- **A9 · Export.** The export menu with SQL (dialect), DBML, Mermaid ER and Data dictionary
  (Markdown) next to PNG / SVG / PDF / JSON; scope: selection, one database, whole deck; the
  preview with Copy / Download; the lint warning when the schema has errors.
- **A11 · Flow touching tables.** The flow step drawer with a "Reads / writes" field (table and
  column picker); the architecture view during playback with a "writes orders" chip on the Orders
  DB card.
- **A10 · Narrow window** (frame 116 rules): the schema deck at 900 px wide.

Also show:

- **Context menus:** table (edit, add column, detail level, colour, duplicate, copy, lock, group,
  export this table as SQL, delete), column row (edit, set as PK, not null, unique, add index,
  add relationship, move up / down, delete), relationship (cardinality, optional sides, on delete,
  line type, colour, delete), canvas (add table, add enum, paste, import SQL / DBML).
- **Detail level control** in the tools or zoom island: Names · Keys · All, for the deck or the
  current view.
- **Deck settings** (the existing ≡ menu → Deck settings, frame 34) with a **Database** section:
  dialect for the whole deck (Generic, Postgres, MySQL, SQLite), notation (crow's foot or `1` / `n` labels), show data types, show nullable, show cardinality
  ends, show relationship labels, show notes, "Block SQL export with errors".
- **Locked table:** a lock badge in the header; it cannot be moved or edited until unlocked.

### Part B · Component rows (1180-wide plates, light and dark)

1. **Signature moment · from architecture into the schema.** Left: the architecture board from
   the card system sample (Web checkout → API Gateway → Order Service → Orders DB, Kafka, Bank
   API), the Orders DB card showing `8 tables inside ⏎`. Right: the same deck after Enter,
   "Inside Orders DB" breadcrumb chip, the eight tables laid out, and dashed **outside** proxy
   cards for Order Service (reads / writes `orders`) and a `Ledger` table in another database
   (foreign key `payments.ledger_entry_id`). One flow ("Checkout") playing across the
   architecture, with the current step on Orders DB: show how a step that "writes orders" can
   highlight the `orders` table inside.
2. **Table card anatomy.** One table with every part labelled (header, title, note, PK row, FK
   row, unique row, nullable, enum column, indexes footer), plus the column-row spec (heights,
   type, glyphs).
3. **Sample set.** The tables below at full detail; a coloured table (blue, teal); a table with
   a long name and a long type; a table with 2 columns; the same table collapsed to keys.
4. **Large tables.** The 60-column table cut at the row limit with "Show all 60 columns", the
   same table fully open with "Show fewer" at the bottom, a hidden-column connector anchored on
   the button, the in-table column search, and how the three controls combine: detail level
   (names / keys / all), the per-table row limit, and semantic zoom.
5. **Relationships.** All cardinality ends, optional vs mandatory, self-reference, composite key,
   two keys between the same tables, the hover highlight, the label on selection, and the three
   line types (curved, elbow, straight) with crow's feet.
6. **Authoring on the canvas.** Add a column (the row being typed: `status order_status not
null` parsed into name, type, flags as you type, ⏎ adds the next row, Esc cancels); rename a
   column in place (must look exactly like the shown row); reorder by dragging a row (drag
   handle on hover, drop line); drag a foreign key from a row; the type mismatch warning;
   keyboard: ↑ ↓ between rows, ⏎ edit, ⌫ delete with B's Undo toast; multi-select tables;
   duplicate a table; copy / paste a table into another deck (new ids; relationships to tables
   left behind are dropped with a toast); lock a table.
7. **States.** Default, hover, selected, a column row selected, editing a row, has a problem
   (no primary key; B's dashed Clay outline and badge, the faulty row marked), current flow step
   (B's sticker and orange lip), dimmed, being dragged (B's tilt), connection target with a
   target row, collapsed to keys.
8. **Zoom levels.** Same thresholds as B: Landscape (≤ 45 %): table icon on the colour fill;
   System: name + PK/FK rows as dots, connectors table-to-table; Container: keys only; Component
   (> 150 %): every column (up to the row limit).
9. **Groups.** Expanded frame, schema as a group, nested group, collapsed fanned hand with merged
   ×n connectors and the hover list of the foreign keys they carry.
10. **Details drawer.** B's drawer for a table: name, schema, colour, note; **Columns** list (name,
    type with a searchable type picker per dialect, PK, nullable, unique, default, auto-increment,
    note, reorder); **Indexes** (name, columns as chips, unique); and the drawer for a
    relationship (from / to columns, cardinality picker drawn with the crow's feet, optional
    sides, on delete / on update selects, optional name, colour). Also the **Checks** tab (named
    expressions), index rows with an **expression** column (`lower(email)`) and a method select
    (btree, hash, gin…), and the table's owner / tags / links (Sododeck's existing fields).
11. **Enums and notes.** An enum card (`order_status`: pending, paid, shipped, cancelled) as a
    small card with coloured value chips, its editor in the drawer (values with notes, reorder,
    "used by orders.status"), the enum column linked to it; a sticky note attached near a table;
    a table note and a column note (how a note shows on the card and when it is hidden).
12. **Code panel and import / export.** The DBML tab: selection vs whole schema, inline error,
    "Applied" / "Can't apply: fix 1 error". Import dialog: paste SQL or DBML or drop a `.sql` /
    `.dbml` file, dialect (Postgres, MySQL, SQLite, or auto), preview count ("8 tables, 9
    relationships, 1 enum"), import report (mapped, skipped with line numbers and reasons, e.g.
    "CREATE VIEW skipped"), foreign-key suggestions by name. Export previews: SQL (dialect),
    DBML, Mermaid ER, Markdown data dictionary, each with Copy / Download; an n–n relationship
    shown in the SQL preview as the generated junction table.
13. **Problems.** Schema lint items: table without primary key, foreign key type mismatch,
    foreign key to a missing column, duplicate column name, n–n without a junction table, enum
    without values. Clicking a problem selects the table and the row.
14. **Type palette.** B's Add flyout (frame 127) with a **Database** tab: Table, Enum, Note, Table
    group; the Packs panel showing "Database" on; "Import SQL / DBML…" in the flyout footer.

### Sample data (use everywhere)

Postgres, schema `public`, deck "Shop":

- `customers` (id uuid PK, email text unique not null, name text, created_at timestamptz)
- `addresses` (id uuid PK, customer_id uuid FK → customers.id, line1 text, city text, country
  char(2))
- `products` (id uuid PK, sku text unique, name text, price_cents int, active bool)
- `orders` (id uuid PK, customer_id uuid FK → customers.id, shipping_address_id uuid FK →
  addresses.id, billing_address_id uuid FK → addresses.id, status order_status, total_cents int,
  created_at timestamptz). Two keys to `addresses`.
- `order_items` (order_id uuid FK → orders.id, product_id uuid FK → products.id, qty int,
  price_cents int; composite PK order_id + product_id)
- `payments` (id uuid PK, order_id uuid FK → orders.id, ledger_entry_id uuid FK → Ledger
  database, provider text, amount_cents int, status text)
- `shipments` (id uuid PK, order_id uuid FK → orders.id unique (1–1), carrier text, tracking
  text null)
- `categories` (id uuid PK, parent_id uuid null FK → categories.id (self), name text)
- enum `order_status`: pending, paid, shipped, cancelled
- group "Billing": payments (+ refunds, invoices in the group row)
- for A6 and row 4: a generated 150-table schema in groups `public`, `billing`, `auth`,
  `catalog`, `analytics`, and a `users` table with 60 columns

### Deliver

Part A (editor screens A1–A11, context menus, deck settings) and Part B (rows 1–14), all in light
and dark, in `sododeck-db.js` built on `sododeck-cards.js`. Then a one-page note: the new tokens
(table width, column row height, row limit, key glyphs, crow's foot geometry, row hairline), how
column rows and crow's feet draw in Canvas 2D, what stays identical to B, and the risks (dense
schemas, long tables, wide types, connector clutter, anchors when a table is cut, collapsed to
keys or zoomed to System).

## Part 3: update prompt (2026-10-03, after the first board)

The founder ran Part 2 before the last decisions (DB6–DB11 in `backlog-database.md`, with DB11
revised to one dialect per deck) and a review of the board found the editor chrome redrawn. Paste
the block below into the same Claude Design conversation to fix the board in one pass. It
replaces any earlier update prompt.

---

Update the **Database pack** board (`Sododeck Database.dc.html`, `sododeck-db.js`) in one pass.
Keep everything that already matches; change only what is listed. Same rules as before: board B ·
Deck for the database parts, light and dark, lucide icons, no blur, gradients or filters,
readable without colour. Fix the board notes where they say otherwise.

**1. Editor chrome: reuse, do not restyle.**
The islands, rail, toolbars, menus, flyouts, drawer, tooltips and toasts already exist in
`sododeck-canvas.js` (the canvas-first editor, frames 86–116). The board currently redraws all of
them in board B's style (pill islands with a lip, round icon buttons, 600 titles, 1.5px borders,
new tooltip variants) and the notes call that "identical", which it is not.

- Load `sododeck-canvas.js` in `Sododeck Database.dc.html` and draw every screen with **its**
  chrome components and tokens, unchanged: deck island (≡, deck name 500, save icon, the
  existing views control), tools island (Jump to, **Labels**, Focus, theme, Export as it is),
  left rail with its existing buttons (**keep Rules**; Problems is a badge on the rail as already
  decided, using the existing accent badge, not Clay), undo / redo island, zoom island, minimap,
  selection toolbar, context menus, flyouts, drawer, popovers.
- **Tooltips:** use the existing canvas tooltip for every hover hint (buttons, column notes,
  types). Truncated table names use board B's title tooltip. No other tooltip style.
- **Toasts:** use the existing Undo toast style (6 s, Undo button, ⌘Z hint).
- Only the **database parts** take a new style: table cards, column rows, crow's foot
  connectors, enum card, the "Show all / Show fewer" button, the dialect chip on database cards,
  the Names · Keys · All control (drawn with the existing segmented-control style, placed in the
  zoom island), and the database sections inside the existing panels.
- **No new tools-island button.** Remove the "Schema settings" popover (screen S) and move its
  content into the existing **≡ menu → Deck settings** (frame 34) as a **Database** section
  (see 3).

**2. Other categories stay in the same deck.**
Keep showing tables next to architecture cards, stickies and proxies, as the board already does.
The Add flyout keeps all packs (All · Architecture · Process · Logistics · Shapes · Database).

**3. One dialect per deck (replaces "deck default + database card override").**

- The dialect is chosen once per deck in **Deck settings → Database**: Generic (default; a small
  common type list, SQL export asks which dialect), Postgres, MySQL, SQLite. Show the select with
  a one-line hint per option.
- Every table and every database card in the deck uses it. A database card shows it as a **chip
  only**; remove the dialect select from the database card's toolbar and drawer, and remove the
  "Overrides the deck default" text.
- Changing the deck's dialect converts column types: show the confirm ("Convert 23 columns from
  Postgres to MySQL?" with the list) and the Undo toast ("23 types converted: uuid → char(36),
  jsonb → json… · Undo").
- The deck island shows no dialect chip and no "Architecture" chip; the existing views control
  stays.
- Import (A5): in an empty Generic deck the detected dialect becomes the deck's; in a deck with
  another dialect, ask to convert. Export (A9): SQL is in the deck's dialect; a Generic deck asks
  which one. Use "Postgres" everywhere (not "Postgres 16" in some places).
- Deck settings → Database also holds: notation (crow's foot / 1 / n), show data types, nullable
  marker, notes, index footer, cardinality ends, relationship labels (hover / always / off),
  block SQL export with errors. Do not duplicate the existing Labels toggle: relationship labels
  follow it unless set here.
- There is **no** "several databases with different dialects" screen.

**4. Long tables: "Show all" / "Show fewer" (replaces the "+n columns" pill).**
At most a set number of column rows (propose it, around 12), keys first (PK, FK, then the rest).
At the bottom of the card a dashed **"Show all 60 columns"** button expands the card in place;
once open it reads **"Show fewer"**. The choice is **per table and saved in the deck**: show one
long table open and one cut on the same board. Rows that carry a connector always stay visible;
a hidden column's connector anchors on the button. No scrolling inside a card. In row "Large
tables" show how detail level (Names · Keys · All), the per-table Show all / Show fewer and
semantic zoom combine.

**5. Relationships attach to the exact column row** at both ends: check every connector on the
board (leaves and enters at the row's vertical centre, never at the card's side midpoint);
composite keys mark every involved row.

**6. Many-to-many.** An n–n connector between `products` and `categories`; the export SQL preview
shows the **generated junction table** (`product_categories`); Problems shows "n–n between
products and categories: create a junction table?" with a "Create" action.

**7. Flow playback touching tables** (architecture flows only; no flows drawn between tables).
In the signature row, A11a and A11b:

- step 4 "Create order" writes `orders` **and** `order_items`: inside Orders DB **both** tables
  are lit as the current step (orange stroke, lip, sticker);
- the touched **column rows** are highlighted, with reads and writes distinguishable without
  colour (e.g. a small "R" / "W" marker or pencil / eye icon on the row);
- the **step player and the flow chip stay on screen** inside the database view (A7b and the
  signature "After" view), so the user keeps stepping; stepping to a step that does not touch
  this database dims all tables and shows "Step 5 is outside Orders DB · Back to architecture";
- at architecture level keep the "writes orders +1" chip on the database card.

**8. Editor details (add any that are missing).**

- **Context menus** (existing menu style): table (edit, add column, detail level, colour,
  duplicate, copy, lock, group, export this table as SQL, delete), column row (edit, set as PK,
  not null, unique, add index, add relationship, move up / down, delete), relationship
  (cardinality, optional sides, on delete, line type, colour, delete), canvas (add table, add
  enum, paste, import SQL / DBML).
- **Locked table:** lock badge in the header; cannot be moved or edited until unlocked.
- **Relationship colour** from the palette (stroke only).
- **Drawer:** Checks tab; index rows with an expression column (`lower(email)`) and a method select
  (btree, hash, gin…); owner / tags / links; enum values with notes, reorder and "used by
  orders.status". The colour picker shows all **13** palette colours (indigo is missing today).
- **Authoring:** duplicate a table; copy / paste a table into another deck (new ids; relationships
  to tables left behind are dropped with a toast); multi-select tables.
- **A1 empty state:** "Start from a sample": Shop, SaaS auth, Blog as small previews.
- **A5 import:** "Import into Orders DB" or "New deck"; foreign-key suggestions by name
  (`customer_id` → `customers.id`) to accept one by one or all; skipped statements with line
  numbers.
- **A6 large schema:** Jump to returns tables **and columns**; the views menu lists saved views
  filtered by schema ("billing only") and by group.
- **A9 export:** SQL, DBML, **Mermaid ER**, **Data dictionary (Markdown)** next to PNG / SVG / PDF /
  JSON; scope selection / one database / whole deck; lint warning before export.

**9. Small fixes.**

- The board and notes say "Database pack (030)": it is the Database pack, backlog **039–049**
  (030 is the type registry it plugs into).
- Table header: the type name reads **"Table"**; the schema name (`public`, `billing`) shows only
  when the deck has more than one schema.
- Replace hard-coded colours (code panel backgrounds, canvas dim) with existing tokens.

Then update the board notes: the final row limit, the Show all / Show fewer spec, the dialect
chip spec, the R / W row markers, every new token, and an explicit list of what is reused
unchanged from `sododeck-canvas.js`.
