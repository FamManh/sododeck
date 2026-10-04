# Feature Specification: Card Icons

**Feature Branch**: `038-card-icons`

**Created**: 2026-10-03 · **Updated**: 2026-10-04 (refreshed after 029, 030, 031, 032, 034 and 036 merged)

**Status**: Draft

**Input**: User description: "038-card-icons — Users can pick a custom icon for a card (lucide only for now; the system must accept more icon packs later, e.g. Simple Icons, without a format change). See docs/backlog.md §038."

**Sources**: `docs/backlog.md` §038 (scope, founder decisions, split, acceptance criteria, risks), §029 (card header with the type icon in a 24px tile; Landscape shows the type icon on the colour fill), §030 (card type registry: each type has its own icon; the deck turns card-type **packs** on and off), §031 (a node can draw as a card or a shape), §034 (drill-in proxies show the type icon), §036 (model writes, merged); `packages/schema/schema/v1.json` (`node.icon` already exists: "Icon key from the app's icon set. When absent, the icon of the node kind is used."); ADR 0003 (lucide icon vocabulary, stroke 1.5), ADR 0016 (export copies lucide geometry), ADR 0018 (card style), ADR 0020 (file format compatibility), ADR 0025 (card type registry; type icons live in the UI package's type styles), ADR 0026 (shapes), `specs/020-card-style/spec.md` (picker placement: selection toolbar, context menu; for icons the drawer entry is the header tile, clarify 2026-10-04), constitution v1.0.0 (principles I, II, III, IV, VI, VII, VIII).

**Founder decisions (2026-10-03)**: lucide is the only icon set for now; the format and the app MUST accept more icon sets later (Simple Icons is the first expected one) without a file format change or a migration; a custom icon replaces the icon in the card's type tile and **the type name stays**.

**Dependency note (2026-10-04)**: every dependency has merged: 036 (model writes), 029 (header tile, Landscape plate), 030 (type registry and card-type packs), 031 (card or shape display), 032 (typed fields) and 034 (drill-in proxies). Nothing blocks this feature. Today the file format already has an optional `icon` text on each component, but the app neither writes nor reads it; every surface draws the type icon straight from the type.

**Terminology (2026-10-04)**: 030 made "pack" a user-facing word for a set of card types (the deck's Packs panel). To avoid two meanings, this spec calls a collection of icons an **icon set**. The stored reference still reads `set:icon` (e.g. `lucide:server`).

## Scope

**In scope**

- **Custom icon on components**: an optional icon reference per component; absent means today's look (the type icon).
- **Icon reference format** that names an icon set and an icon, so icons from different sets never collide and new sets need no format change; a reference without a set means lucide.
- **Icon picker**: search, groups, "Used in this deck", "Reset to type icon"; reached from the selection toolbar, the context menu and by clicking the icon tile in the detail drawer's header; works on a multi-selection in one undo step.
- **Consistent rendering** of the chosen icon wherever the card's type icon shows today: card tile, Landscape zoom plate, collapsed group members, drill-in proxies (034), outline, drawer header, search results, PNG / SVG export.
- **Icon sets as data**: each icon set has an id, a display name, a licence and a drawing style (line or solid); lucide is the only set shipped.
- **Graceful unknowns**: a reference to an icon set or icon the app does not have shows the type icon and is kept unchanged on save.
- **Licence notices** for the bundled icon sets, shipped with the app's third-party notices (in-app placement deferred, see Clarifications).

**Out of scope**

- Simple Icons or any icon set other than lucide (later; the design must allow it).
- Lucide icons outside the curated set (added later as data when needed).
- Uploading or drawing custom icons.
- An icon colour separate from the card's colours (020); icon size choices.
- Icons on groups, stickies, connectors or flows.
- Changing the type name, or the icons of the Add palette (types keep their own icons; 030).

## Clarifications

### Session 2026-10-03

- Q: Offer the whole lucide set (about 2,100 icons) or a curated set suited to diagrams? → A: A curated set of about 300 icons, grouped by category; more icons are added as data later (FR-011).

### Session 2026-10-04

- Q: How should the app treat `icon` text it cannot read (e.g. `"Server"`, `"mdi:database"`)? → A: Still valid: the card shows its type icon and the value is saved unchanged, like an unknown icon set; no validation error and no deck problem (FR-003, FR-024). (Empty `icon` was already invalid before this feature and stays so.)
- Q: Does a node drawn as a shape (031) show its custom icon? → A: No. The icon is kept and shows again when the node is switched back to a card; the picker only changes selected components drawn as cards (FR-030, FR-036).
- Q: Where in the detail drawer does the user change the icon? → A: By clicking the icon tile in the drawer header (founder, 2026-10-04); no Icon row in the Appearance section. Several cards are changed from the toolbar or the context menu (FR-030).
- Q: Where does the icon licence notice show (no About / Licences page exists today)? → A: Deferred by the founder: the project may go open source soon, which changes where and how notices are shown. For 038 the notice ships with the app's third-party notices; an in-app licences surface is decided together with the open-source move (FR-015).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Pick an icon for a card (Priority: P1)

An architect has three "Service" cards that are really a search engine, a mail sender and a cron job. They select "Search API", open the icon button in the selection toolbar, type "search" and pick the magnifier. The card's tile now shows a magnifier; the tile still says "Service" next to it. The JSON panel shows `"icon": "lucide:search"`. One ⌘Z brings back the service icon.

**Why this priority**: telling similar cards apart at a glance is the whole point; one card with one icon is already useful.

**Independent Test**: on a loaded deck, select one card, pick an icon through search, check the tile, the type name, the JSON panel and undo.

**Acceptance Scenarios**:

1. **Given** a selected card of type Service, **When** the user picks "Search" in the icon picker, **Then** the card's tile shows the search icon, the type name "Service" is unchanged, the JSON shows `"icon": "lucide:search"`, and one ⌘Z removes it.
2. **Given** the picker is open, **When** the user types "db", **Then** icons whose name or keywords match (e.g. database, server, hard drive) are listed, best matches first, within a moment of typing.
3. **Given** a search with no match, **When** the list is empty, **Then** the picker says "No icons match" and offers to clear the search.
4. **Given** a card with a custom icon, **When** the user opens the picker, **Then** that icon is marked as selected with a ring and a check mark and is announced as selected.
5. **Given** a card with a custom icon, **When** the user chooses "Reset to type icon", **Then** the tile shows the type icon again and the JSON no longer has an `icon` for that card.
6. **Given** an icon in the picker, **When** the user hovers or focuses it, **Then** a tooltip and its accessible name give the icon's name (e.g. "Search").
7. **Given** the detail drawer open on a card, **When** the user clicks the icon tile in the drawer header (or focuses it and presses Enter), **Then** the same picker opens next to the tile; a change there shows on the tile and the card immediately.

---

### User Story 2 - Set the icon of several cards at once (Priority: P1)

The architect selects the five database cards that are really caches and gives them all the "Zap" icon in one go. One ⌘Z reverts all five.

**Why this priority**: icons, like colours, are usually applied to a family of cards; one at a time would be tedious.

**Independent Test**: select several cards with different icons, check the picker shows "Mixed", apply an icon and "Reset to type icon", and confirm each is one undo step for all cards.

**Acceptance Scenarios**:

1. **Given** five selected cards, **When** the user picks "Zap", **Then** all five show it and one ⌘Z restores each card's previous icon (custom or type).
2. **Given** selected cards whose icons differ, **When** the picker opens, **Then** no icon shows a check mark and the picker says "Mixed".
3. **Given** a selection of cards, stickies and connectors, **When** an icon is picked, **Then** only the cards change, and the picker says how many cards it will change.

---

### User Story 3 - Icons stay right everywhere (Priority: P1)

The architect zooms out to Landscape: each card shows its custom icon on its colour fill. They open the outline and search: the rows show the same icons. They export the deck to SVG and PNG: the icons are there too. They switch to the dark theme: the icons stay readable.

**Why this priority**: an icon that shows on the card but not in the outline, the far zoom or the export would be confusing and break trust in the export.

**Independent Test**: give several cards custom icons, then check the card tile at every zoom level, the outline, search results, drawer header, PNG and SVG export, in both themes.

**Acceptance Scenarios**:

1. **Given** cards with custom icons, **When** the canvas is at each semantic zoom level, **Then** wherever the type icon would show, the custom icon shows instead.
2. **Given** cards with custom icons, **When** the outline, search results or drawer header list them, **Then** each row shows the card's custom icon and still names its type.
3. **Given** a deck with custom icons, **When** exported to PNG or SVG, **Then** every card shows its custom icon, drawn the same way as on the canvas.
4. **Given** a coloured card (020) with a custom icon, **When** rendered in either theme, **Then** the icon uses the same colour rules as the type icon would, and stays readable.

---

### User Story 4 - Files from newer versions and other icon sets stay safe (Priority: P2)

A teammate's deck was made with a later Sododeck that has a brand-logo icon set; a card has `"icon": "simple:kafka"`. The architect opens it in today's app. The card shows its type icon (Queue), nothing breaks, and after editing the title and saving, the file still says `"simple:kafka"`. A deck saved before this feature with `"icon": "server"` shows the server icon.

**Why this priority**: the founder's condition for this feature is that adding icon sets later must not break anything; this story proves it. It matters less on day one than picking icons, hence P2.

**Independent Test**: open files with an unknown icon set, an unknown icon in a known icon set, and a reference without a set; check display, problems, editing and saving.

**Acceptance Scenarios**:

1. **Given** a file with `"icon": "simple:kafka"` and no such icon set in the app, **When** opened, **Then** the card shows its type icon, the drawer's icon tile tooltip says "Icon not available in this version", and saving keeps `"simple:kafka"` unchanged.
2. **Given** a file with `"icon": "lucide:no-such-icon"`, **When** opened, **Then** the card shows its type icon and the reference is kept on save.
3. **Given** a file with `"icon": "server"` (no set), **When** opened, **Then** the card shows lucide's server icon, and the value is saved unchanged.
4. **Given** a card with an unavailable icon, **When** the user picks a new icon, **Then** the new reference replaces the old one as with any other change.
5. **Given** any valid file with or without icons, **When** imported and exported, **Then** the icon values are byte-identical.

---

### User Story 5 - Find the icons the deck already uses (Priority: P3)

The architect has used "Shield" on four security cards. When they open the picker on a fifth, "Used in this deck" at the top lists Shield first, so they do not have to search again.

**Why this priority**: a convenience for consistency; search already covers the need.

**Independent Test**: give several cards icons, open the picker on another card and check the "Used in this deck" section, its order and that it is per deck.

**Acceptance Scenarios**:

1. **Given** cards in the deck use custom icons, **When** the picker opens, **Then** a "Used in this deck" section lists those icons, most used first, before the full list.
2. **Given** another deck, **When** its picker opens, **Then** it lists only icons used in that deck.
3. **Given** no card uses a custom icon, **When** the picker opens, **Then** the section is not shown.

---

### Edge Cases

- **Card types (030)**: "type icon" means the icon the card's type defines; the custom icon still wins. A card of a type this version does not know shows the generic fallback, or its custom icon if it has one.
- **Card drawn as a shape (031)**: a node shown as a shape has no type tile, so no icon is drawn; any stored icon is kept and shows again when the node is switched back to a card. The picker counts and changes only the selected components drawn as cards.
- **Typed field status icons (032)**: the small fixed set of status icons on field chips is a separate thing and is not changed by this feature.
- **Unknown icon set or icon** (newer file, hand-edited file, icon renamed by an icon set update): the type icon shows; the reference is kept on save; the drawer's icon tile says the icon is not available. It is not reported as a deck problem (the deck is not broken).
- **An icon renamed between icon set versions**: the old name keeps resolving to the same icon through an alias, so existing decks do not lose icons when the icon set is updated.
- **Reference the app cannot read** (spaces, more than one separator, or any other free text a hand-made or generated file put in the existing `icon` field): treated like an unknown icon (type icon shows, value kept on save). It is never a validation error, because `icon` already accepts any text and tightening it would reject files that are valid today (ADR 0020). An empty `icon` stays invalid, as it already is today (non-empty text).
- **Letter case**: the picker always writes lowercase; a reference written in another case (`Server`, `Lucide:Server`) is matched ignoring case and saved as written.
- **Solid icon sets later**: an icon set whose icons are solid shapes must draw as solid shapes, not as outlines or a filled blob.
- **Copy / paste between decks** (016): pasted cards keep their icon reference.
- **Two tabs set different icons on the same card at once**: the usual last-write-wins for a short field; both tabs end up showing the same icon.
- **Tiny tiles** (narrow cards, outline rows): the icon scales down with the tile and stays recognisable at the smallest tile size used today.
- **Flow mode, flow recording, view-only editor (< 1024 px)**: the picker is not offered; custom icons still render.
- **Reduced motion**: the picker opens without animation.
- **Very fast typing in search**: the list keeps up without visible lag on a mid-range laptop.

## Requirements _(mandatory)_

### Functional Requirements

**Icon data**

- **FR-001**: A component MUST support an optional icon reference; absent means the type icon (today's look).
- **FR-002**: An icon reference MUST name an icon set and an icon within it (written `set:icon`; the picker writes lowercase letters, digits and hyphens only); a reference without a set MUST mean lucide.
- **FR-003**: The file format MUST accept a reference to any icon set, including sets the current app does not have, so that adding an icon set later needs no format change and no migration. The format MUST keep accepting any text in `icon`, as it does today, so no file that is valid now becomes invalid.
- **FR-004**: Removing a custom icon MUST remove the icon reference entirely, so reset cards write no icon to the file.
- **FR-005**: Files with or without icon references MUST round-trip without loss; a reference the app cannot display MUST be saved back unchanged.

**Icon sets**

- **FR-010**: The app MUST describe each icon set by an id, a display name, a licence and a drawing style (line or solid), and each icon by a name, a display label and search keywords.
- **FR-011**: Lucide MUST be the only icon set shipped by this feature, as a curated set of about 300 icons suited to diagrams, each in one category (e.g. Compute, Data, Network, Security, People, Devices, Messaging, Files, Status). Adding an icon to the set MUST be a data change only.
- **FR-012**: An icon set MUST be able to declare aliases (old icon name → current name) so a renamed icon still resolves.
- **FR-013**: Adding a second icon set MUST require no change to the file format, the stored decks, the card, the outline or the export; only the new set's data and its registration. This MUST be demonstrated by a test-only icon set with solid icons.
- **FR-014**: All icon data MUST be bundled with the app; no icon is ever fetched over the network (constitution IV).
- **FR-015**: The licence notice of every bundled icon set MUST ship with the app's third-party notices. Where notices show inside the app is deferred until the open-source decision (see Clarifications 2026-10-04).

**Resolving the icon**

- **FR-020**: Every surface MUST decide what icon to show for a card in the same way: the custom icon if available, otherwise the card's type icon, otherwise the generic fallback icon.
- **FR-021**: The custom icon MUST replace the icon inside the type tile on the card and on the Landscape plate; the type name MUST stay unchanged.
- **FR-022**: The custom icon MUST also show in the outline, search results, the drawer header, collapsed group member icons, drill-in proxies and PNG / SVG export, next to the type name where one is shown today.
- **FR-023**: The custom icon MUST follow the same size, stroke weight and colour rules as the type icon in each place, including on coloured cards (020) in both themes.
- **FR-024**: A card whose reference cannot be resolved MUST show the type icon and the drawer header tile's tooltip and the picker MUST say "Icon not available in this version"; this MUST NOT be a deck problem. The same applies to `icon` text the app cannot read as a reference.

**Picker**

- **FR-030**: The icon picker MUST be reachable from the selection toolbar for one or more components, the context menu of components, and the icon tile in the detail drawer's header (single card; no separate Appearance row); all three MUST use the same picker and the shared action list (019). It MUST be offered only when the selection has at least one component drawn as a card.
- **FR-031**: The picker MUST offer a search field (matching names and keywords, ignoring case), the icons grouped by category, a "Used in this deck" section when the deck uses custom icons, and "Reset to type icon".
- **FR-032**: When more than one icon set is available, the picker MUST let the user filter by set; with one set the filter MUST NOT show.
- **FR-033**: The current icon of the selection MUST be marked with a ring and a check mark (not colour alone); a selection with differing icons MUST show no check and the word "Mixed".
- **FR-034**: Every icon MUST have a tooltip and an accessible name; the picker footer MUST show the name of the hovered or selected icon.
- **FR-035**: The picker MUST be fully operable by keyboard: typing goes to search, arrow keys move in the grid, Enter / Space applies, Tab moves between search, sections and "Reset"; Esc closes it and returns focus to its opener.
- **FR-036**: Picking an icon or "Reset to type icon" MUST apply to every selected component drawn as a card in one undo step, and appear at once on the canvas, outline, drawer and JSON panel.

**Availability**

- **FR-040**: The picker MUST NOT be offered in flow mode, during flow recording or in the view-only editor; custom icons still render there.
- **FR-041**: Icon changes MUST sync between open tabs of the same deck like any other edit.

### Key Entities _(include if feature involves data)_

- **Icon reference**: the optional value on a component naming one icon as icon set + icon name. Stored as written; never rewritten by the app except when the user picks another icon or resets.
- **Icon set**: a named, licensed collection of icons with one drawing style (line or solid), a list of icons and optional aliases. Lucide is the only one for now.
- **Icon**: an entry of an icon set with a stable name, a display label, search keywords, a category and its drawing.
- **Type icon**: the icon a card shows when it has no custom icon (from its card type, 030; generic fallback for an unknown type).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can give a selected card a specific icon in 3 interactions or fewer when they know its name (open picker, type, pick), and the same for 20 selected cards.
- **SC-002**: Search results update within 100 ms of each keystroke on a mid-range laptop.
- **SC-003**: 100 % of decks saved before this feature open, display and save unchanged; 100 % of decks with icon references (known or unknown icon sets) round-trip with byte-identical icon values.
- **SC-004**: A test-only second icon set (solid icons) can be added and its icons picked, shown on cards and exported without changing any code outside the set's own data and its registration.
- **SC-005**: On a 500-component / 1,000-connection deck where every card has a custom icon, pan and zoom stay within 5 % of the same deck without custom icons, and opening the editor is not slower by more than 5 %.
- **SC-006**: Every custom icon shown on the canvas also appears in PNG and SVG export (verified for every icon used in a sample deck).

## Assumptions

- The custom icon applies to components only; groups, stickies and connectors keep their current look.
- The icon takes the colours the type icon would take; there is no separate icon colour.
- "Used in this deck" is derived from the deck itself, so nothing new is stored in the browser or in the file.
- The stored reference is written with its set (`lucide:search`); references without a set from older files are read as lucide and saved as they were.
- 036, 029, 030, 031, 032 and 034 have merged (2026-10-04); this feature changes their surfaces (card tile, Landscape plate, collapsed groups, drill-in proxies, export) to draw the resolved icon instead of the type icon.
- 029 will draw its header tile and Landscape plate from this feature's resolver; if 029 merges first, this feature updates those two places.
- Lucide's licence (ISC) allows bundling in a closed-source or open-source product as long as its notice is included (FR-015); the founder is considering open-sourcing the project, so the in-app notice surface is not built here.
- Decisions taken in the 2026-10-04 refresh (not founder decisions; revisit in `$speckit-clarify` if wrong): the word **icon set** instead of "pack" (030 owns "pack"); collapsed group members and drill-in proxies show the custom icon.
