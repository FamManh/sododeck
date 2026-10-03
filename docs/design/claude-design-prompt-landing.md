# Claude Design prompt: landing page (sododeck.com)

Discussed with the founder on 2026-10-03. This file has two parts: the **requirements** for the
design round, then the **prompt** to paste into the Sododeck Claude Design project. The page
replaces the placeholder `apps/site/src/pages/index.astro`; it is built later in `apps/site`
(Astro + `@sododeck/ui` tokens).

## Part 1: requirements

### Why

The site still shows a placeholder. The landing page must explain in one scroll what Sododeck is:
your AI drafts the system, Sododeck turns it into a living map you can click, trace, edit and
annotate, with the databases behind it on the same canvas, kept in one local file.

### Decisions

| #   | Topic           | Status              | Decision                                                                                                                                                                                                   |
| --- | --------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Story           | founder, 2026-10-03 | **One deck, one story**: the whole page uses one sample deck ("Checkout") and each section is one step a user takes: generate → explore → flows → knowledge → database → code → edit → own your file.      |
| L2  | Hero            | founder, 2026-10-03 | **Prompt → living map**: an agent writes a `.sododeck.json` from a prompt or a codebase (skill 027), the deck opens and the Checkout flow plays. The AI runs on the user's side.                           |
| L3  | Database        | founder, 2026-10-03 | Shown **as a shipped feature**, in its own large section. The landing page ships only after the Database pack (039–049), the AI skill (027) and the editable code panel (026, which 046 needs) are merged. |
| L4  | Not on the page | founder, 2026-10-03 | No pricing (not decided), no customer logos or testimonials (none yet), no performance numbers until 037 has a baseline, no names of other diagram or database tools.                                      |
| L5  | Look            | founder, 2026-10-03 | DESIGN.md tokens; every product visual uses card system **B · Deck** (frames 117–133) and the Database board. New marketing type sizes are proposed as `marketing-*` tokens and added to DESIGN.md later.  |
| L6  | Delivery        | founder, 2026-10-03 | The founder pastes the prompt into Claude Design; the result is imported like the other boards.                                                                                                            |

### Features the page must show

Shipped (or merged before launch, L3), grouped by section:

- **Generate:** AI deck skill (027): from a description, a codebase or Mermaid text; validate loop;
  import with auto-layout.
- **Explore:** semantic zoom levels, collapsible groups, focus mode, connection focus and drill-in
  (034), saved views, auto-layout with pinning, global search.
- **Flows:** flows over edges, branches, playback that deals the deck (035), step player.
- **Knowledge:** inspector, rules as decision tables attached to steps, stickies, notes.
- **Database:** table cards with column rows and key markers, crow's foot relationships attached to
  the column row, database card → tables drill-in, flow steps that light up the tables they touch,
  enums, indexes, schemas, SQL (Postgres, MySQL, SQLite) and DBML import and export, one dialect
  per deck.
- **Canvas + code:** canvas and code panel (JSON, DBML) are one document, always in sync.
- **Edit by hand:** card quick edit, card and tag colours, copy / paste, align, snapping, resize,
  connector routing.
- **Local-first:** no account, decks in the browser, works offline, export JSON / PNG / SVG / SQL /
  DBML, nothing sent anywhere.

### Out of scope for this design round

Docs, blog, privacy and terms pages; pricing; sign-up, accounts, sharing, comments, presence; an
in-page prompt box that calls a hosted AI (would send content, needs its own decision).

## Part 2: the prompt

Paste the block below into the existing **Sododeck** Claude Design project (the one with
`Sododeck Cards.dc.html` and `Sododeck Database.dc.html`). Attach `DESIGN.md`, screenshots
117–133 (light and dark) and the Database board frames.

---

Design the **landing page for sododeck.com**, in direction **B · Deck**, as a new board that
reuses the card system and the Database board.

**Files.** Create `Sododeck Landing.dc.html` and `sododeck-landing.js`. Build the product visuals
from `sododeck-cards.js` and `sododeck-db.js` (same `TK('B', theme)` tokens, `PAL`, `card`,
`chip`, edge styles, token, step player, table card): the visuals on the page are small, real
renders of the app's cards, never blurry screenshots or invented UI. Do not fork a token; list any
new one in the notes. Take a `theme` prop (`light | dark`) and a `width` prop (`1440 | 768 | 390`).

**Product in one line.** Sododeck is an architecture workspace where the diagram is a living
model: services, flows, rules and the database tables behind them in one map you can click,
trace, edit and annotate. Local-first: no account, decks stay in the browser, open JSON format.

**Audience.** Technical and solution architects in flow-heavy domains, then backend engineers and
analysts. Calm, precise, confident tone; no hype words ("revolutionary", "supercharge"), no
emoji. English only.

**Sample deck (use everywhere).** "Checkout": groups **Edge** (Web app, API Gateway), **Orders**
(Order Service, Orders DB), **Payments** (Payment Service, Payment Provider, external),
**Messaging** (Kafka topic `order.placed`), **Fulfilment** (Shipping Service). Orders DB contains
tables `orders`, `order_items`, `payments`, `customers` with real-looking columns (`id uuid PK`,
`customer_id uuid FK`, `status order_status`, `total_cents int`, `created_at timestamptz`).
Flow **Checkout**: Web app → API Gateway → Order Service → writes `orders` → Payment Service →
Payment Provider → `payment.succeeded` → Kafka → Shipping Service. Branch: payment failed → retry
×3 → cancel order. Rule **R-12 Payment retry** (decision table: attempt, error, action).

### Page sections (top to bottom)

1. **Nav** (sticky, quiet): logo, Features, Database, Docs, Blog, theme toggle, button "Open app".
2. **Hero: prompt → living map.** Left: headline (propose 3 options, e.g. "Describe your system.
   Get a living map."), one-sentence subline, primary CTA "Start drawing — no sign-up", secondary
   CTA "Get the AI skill". Under the CTAs, a small line: "Runs with your own AI. Nothing leaves
   your browser." Right: a three-beat visual that loops (about 8–10 s):
   - Beat 1: an agent terminal pane types the prompt "Map our checkout: web, gateway, order
     service with Postgres, payments, Kafka, shipping. Include the checkout flow."
   - Beat 2: a `.sododeck.json` snippet streams in a code pane (Geist Mono) with a green
     "valid" check.
   - Beat 3: the canvas builds: groups appear, cards deal in, connectors draw, Orders DB shows its
     tables, then the Checkout flow plays with the orange token and step badges.
     Draw the three beats as a storyboard as well as the final composed hero.
3. **Proof strip:** four short promises with lucide icons: "No account", "Works offline",
   "Open JSON format", "Nothing sent anywhere".
4. **Explore** ("See the whole system, then just the part you need"): the same deck at three
   semantic zoom levels side by side, plus connection focus on Order Service and drill-in into a
   group. Mention saved views, auto-layout and search in short captions.
5. **Flows** ("Watch a flow run end to end"): the Checkout flow playing with the step player,
   and the payment-failed branch in the second colour. Caption: flows are objects with steps,
   conditions and rules, not coloured lines.
6. **Knowledge** ("Rules live where they apply"): rule R-12 as a decision table attached to the
   Payment Service → Payment Provider step, the inspector open on that step, and a sticky
   "Ask finance about partial refunds".
7. **Database** (large section on a contrasting band: `surface-2` in light, `inverse` in dark):
   headline like "The tables behind the map, on the same canvas". Show, as one composition:
   the Orders DB card on the architecture board → drill-in "Inside Orders DB" with table cards,
   crow's foot connectors attached to the column rows, a dashed proxy for `customers` in another
   database; the Checkout flow lighting up `orders` and `payments`; a code pane with the DBML /
   SQL tab and a dialect chip (Postgres). Three short points: draw or import SQL / DBML; flows
   show which tables each step touches; export runnable SQL.
8. **Canvas + code** ("One document, two views"): canvas and code panel side by side, one card
   selected and its JSON lines highlighted.
9. **Edit by hand** ("AI drafts it. You own it."): quick edit on a card, the colour palette,
   tag colours, alignment guides and a re-routed connector.
10. **Local-first and formats:** the deck library, a row of export formats (JSON, PNG, SVG, SQL,
    DBML) as chips, and a line on no lock-in.
11. **Final CTA:** headline, "Start drawing — no sign-up", "Get the AI skill".
12. **Footer:** product, docs, blog, privacy, terms, © Sododeck.

### Visual rules

- Tokens from DESIGN.md only; orange `primary` is rare: CTAs, the flow token, the active step.
  Text on primary uses `on-primary` (dark), not white.
- Geist for text, Geist Mono for code and edge labels. Propose marketing sizes as new tokens
  (`marketing-hero` about 56–64, `marketing-h2` about 32–40, `marketing-body` about 17, with line
  heights and tracking), listed in the notes.
- Generous whitespace, 1200 content width at 1440, 12-column grid; each section is a heading +
  short paragraph + one product visual, alternating sides.
- No gradients, glows, glassmorphism, stock photos, 3D or illustrations of people. The product
  visuals are the illustrations.
- Readable without colour (WCAG 2.2 AA), visible focus rings, lucide icons only.
- Light and dark for every section.

### Motion

- Only the hero loops. Flows and Database play once when scrolled into view, with a replay
  button.
- Everything must be buildable with CSS and SVG (no video, no canvas libraries).
- `prefers-reduced-motion`: show the final frame of every animation, static.

### Responsive

- Frames at 1440, 768 and 390.
- At 390: the hero stacks (text, then visual); product visuals are **cropped** to a readable
  region, not scaled down until unreadable; nav collapses to logo + "Open app" + menu.

### Constraints

- No third-party fonts, images or scripts at runtime (the site bundles Geist and lucide).
- Do not name or reference other diagram or database tools anywhere, including comparisons.
- No pricing, customer logos, testimonials or performance numbers.

### Deliver

1. The full page at 1440 in light and in dark.
2. The full page at 390 (light), and the hero + Database section at 768.
3. The hero storyboard (three beats) and the reduced-motion frame.
4. CTA states: default, hover, focus, pressed.
5. Copy for every section: headline, subline, captions (three headline options for the hero).
6. Notes: new tokens, components reused from the card and Database boards, anything that could
   not follow these rules and why.

## Part 3: fix prompt (2026-10-03, review of the first board)

Founder decisions from the review: hero headline **A**; `customers` stays a **proxy in Accounts
DB**; the code-panel copy stays (true at launch, L3 now includes 026). Paste the block below into
the same project.

---

Thanks, the board follows the brief closely. Please fix these on `Sododeck Landing.dc.html` and
`sododeck-landing.js`; keep everything else as it is.

1. **Real file format.** The JSON in the hero (beat 2) and in "One document, two views" uses keys
   that do not exist (`deck`, `cards`, `flows[].name`). Use the real format v1 shape:
   `$schema` (`https://sododeck.com/schema/v1.json`), `version: 1`, `name: "Checkout"`,
   `nodes` (each `id`, `type`, `title`, optional `group`, `description`), `groups` (`id`,
   `title`), `edges` (`id`, `from`, `to`, `label`), `flows` (`id`, `title`, `steps` with `id`
   and `edge`). Use readable ids (`order-svc`, `orders-db`, `e-writes-orders`), never ids like
   `SVC-014`. A database node keeps `"type": "database"`; drop `dialect` from the node (the
   dialect is a deck setting). Keep the snippets short (the hero can still end with `…`); the
   selected-card highlight in the Code section stays on the `order-svc` node.
2. **Database band.** Use `surface-2` in both themes (light `#f4f4f1`, dark `#212120`), so the
   dark page stays dark and the visuals use dark tokens. Remove the `dbBand` tweak and the
   matching note.
3. **No cut type labels.** The Orders DB card shows "Datab…" next to the Postgres chip in every
   section. Nothing on a marketing page may be cut: drop the dialect chip from the database card
   header (the dialect already shows in the code pane), or widen the card so "Database" fits.
   Check every card and chip on the page at 1440, 768 and 390 for cut text.
4. **Clean crops.** In "Watch a flow run end to end" and "One document, two views" a connector
   enters from outside the frame with a cut label (`orders`, `OST /orders`). Either show the
   source card or use a dashed outside proxy ("API Gateway · Outside") as in the Explore
   drill-in; no connector or label may be cut by the frame edge.
5. **Explore, "Components 100%".** The chip of the card below shows behind the zoom label;
   crop above it or move the label so nothing overlaps.
6. **Notes.** Remove the "DESIGN.md drift" note: DESIGN.md already uses dark on-primary text and
   lucide. Remove "Pick one" from the `customers` note and record the decision (proxy in
   Accounts DB, Orders DB has 3 tables). Mark headline A as chosen in the copy list.
7. **Final frames.** Make the 1440 full pages render Flows and Database at their final frame
   when `motion = off`, so a still capture shows the flow lighting up `orders` and `payments`
   (the W badges and the "4 writes orders · 5 writes payments" bar, as at 768).

Deliver the same frames as before (1440 light and dark, 390, 768 hero + Database, storyboard, CTA
states, copy, notes) and list what changed in the notes.
