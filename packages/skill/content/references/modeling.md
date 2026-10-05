# Modeling a deck

Read this for any new deck and for update requests that add cards, connectors or groups.

## Contents

1. The file skeleton
2. Cards
3. Card types
4. Connectors
5. Groups and levels
6. Ids
7. Positions, sizes and style
8. Features and views
9. Notes, tags and links
10. Complete examples

## 1. The file skeleton

Every deck has these root keys, even when empty, in this order:

```json
{
  "$schema": "https://sododeck.com/schema/v1.json",
  "version": {{formatVersion}},
  "name": "Checkout",
  "description": "Optional, one or two sentences (markdown).",
  "nodes": [],
  "groups": [],
  "edges": [],
  "views": [],
  "features": [],
  "flows": [],
  "rules": {},
  "stickies": []
}
```

`nodes` are cards, `edges` are connectors, `stickies` are sticky notes. `rules` is an object keyed
by rule id (see `rules.md`), everything else is a list. For more than one feature, add views as in §8; otherwise leave `views`
empty and the app shows its standard views. Unknown keys are refused, so don't invent fields.

## 2. Cards

```json
{
  "id": "orders",
  "type": "service",
  "title": "Order Service",
  "description": "Creates orders and asks the payment provider to charge.",
  "tech": "Node.js",
  "owner": "Checkout team",
  "tags": ["core"]
}
```

Required: `id`, `type`, `title`. Useful: `description` (markdown, the place for details),
`tech`, `host`, `owner`, `tags`, `links` (`[{ "url": "…", "label": "…" }]`), `group`, `parent`,
`level` (`landscape`, `system`, `container`, `component`: the zoom level the card belongs to).

The title is what people read on the card: 1–4 words, under 40 characters. Everything else goes in
`description` or fields.

## 3. Card types

`type` decides the icon and default fields. Use the most specific type that is true. Types outside
the Architecture pack need their pack listed in the root `packs` list (for example
`"packs": ["architecture", "process"]`); without `packs` a deck shows Architecture only.

{{cardTypes}}

An unknown type id is kept and drawn as a generic card, with a warning. Prefer a built-in one.

People and their devices (a customer, a support agent, a courier app) are `client` cards. Outside
companies' systems (a payment provider, an email service) are `external` cards. Shapes are for
plain sketches; prefer cards in an architecture deck.

## 4. Connectors

```json
{
  "id": "orders-payments",
  "from": "orders",
  "to": "payments",
  "protocol": "http",
  "label": "charge card"
}
```

Required: `id`, `from`, `to`. `from` and `to` are card ids (a group id also works, for "talks to
the whole group"). `protocol` is one of `http` (REST, GraphQL, HTTPS), `grpc`, `event` (Kafka,
queues, pub/sub), `sql`, `websocket`, `other`; put the specific technology in the label
("OrderPaid · Kafka"). `direction` is `forward` (default), `both` or `none`.

The label says **what** travels (`POST /checkout`, `OrderPaid`, `charge card`), under 32 characters.
Draw a connector in the direction the call or message goes. Request and reply are two connectors
only when a flow needs to walk back (see `flows.md`); otherwise one connector is enough.

## 5. Groups and levels

**Groups** put related cards in one frame on the same screen: `{ "id": "core", "title": "Core
services" }`, then `"group": "core"` on each card. Use them for teams, bounded contexts, network
zones, "data stores". A group can sit inside another (`"parent": "outer"` on the group), but one
level of groups is usually enough.

**Levels** let a reader drill in: a card with `"parent": "platform"` lives one level below the
`platform` card and appears when the user opens it. Use levels when one screen would hold more
cards than the detail dial allows: the top level shows the big blocks, each block opens to its
services. Set `level` to say what kind of zoom it is (`system` on top, `container` or `component`
below). Connectors at the top level stay between top-level cards; detailed connectors stay inside
the level.

## 6. Ids

- Ids are opaque and permanent: 1–64 characters of letters, digits, `-`, `_`, `.`, `:`. Use short
  lower-case slugs, at most 32 characters (`orders`, `orders-db`, `e-pay`, `s3`).
- Unique within their collection; a card and a group should never share an id.
- Never derived from the title in a way that would change with it: `order-service-v2-new` for
  "Order Service v2 (new)" is the pattern lint warns about.
- Steps, branches, rule columns and rows have ids too; short ones are fine (`s1`, `submit`).
- References are always by id: `group`, `parent`, `from`, `to`, `edge`, `rules`.

## 7. Positions, sizes and style

Leave `position` and `size` out. The app lays out every card without a position when the deck is
imported, and keeps cards that have one exactly where they are. A deck with some cards placed and
others not is fine only in update mode.

`style` (`{ "fill": "blue" }`, named colours `red orange amber yellow lime green teal cyan blue
indigo violet pink slate` or `#rrggbb`) is for at most one or two focal cards; colour carries
meaning only when it is rare.

## 8. Features and views

A big system stays readable through features and views, not through fewer cards.

- `features`: one per business capability, `[{ "id": "pricing", "title": "Pricing" }]`. Every
  flow names its feature (`"feature": "pricing"`).
- `views`: saved views the user switches between. The **first view is the base view** and shows
  every card; write `{ "id": "overview", "type": "system", "title": "Overview" }` first. Then one
  view per feature, in one of two shapes:

```json
{ "id": "view-pricing", "type": "feature", "title": "Pricing", "feature": "pricing" }
```

A **feature view** shows exactly the cards the feature's flows walk through (both ends of every
step's connector). Prefer it: it stays right when flows change. Don't add `includes` to it: the
view shows only cards that are in both, so a listed card off the flows stays hidden.

```json
{
  "id": "view-pricing",
  "type": "custom",
  "title": "Pricing",
  "includes": ["worker", "pricing-engine", "agreements-db", "candidates-db"]
}
```

A **listed view** shows the cards you list. Use it when the feature's picture needs cards its
flows don't walk through: a store a step writes (mentioned in its `notes`), a listener, a config
table.

Leave `positions` out of every view: on import the app lays each view out on its own, so it opens
as a compact diagram of that feature. Cards shared by several features (a queue, a worker) appear
in each view that needs them. A feature with no flows yet shows nothing in a feature view: give it
a listed view. When the deck has no `views` at all, the app shows its standard Overview and Flows
views.

## 9. Notes, tags and links

- Explanations belong in `description` (cards, flows, rules) and step `notes`: they show in the
  inspector and never cover the diagram. Gaps, caveats and "documented vs implemented" go there.
- `stickies`: a handful of short warnings that must be visible on the canvas,
  `{ "id": "note-pii", "text": "Owns PII.", "color": "amber", "anchor": "orders-db" }` (colours
  `amber blue green clay grey`). Keep each to one short sentence; the app slots a note under its
  card on import, and a long note makes that card's slot tall.
- `tags`: short labels shared across the deck (`"tags": ["pci"]`), for filtering views.
- `links`: documentation, dashboards, source files. In codebase mode every card and connector
  carries its source link (see `from-codebase.md`).

## 10. Complete examples

- `examples/checkout.sododeck`: seven cards and one flow, every part together.
- `examples/order-features.sododeck`: three features sharing one set of services, an Overview
  and one view per feature, a rule on a step. Copy its shape for any system with several features.
- `examples/platform.sododeck`: groups and two levels.
