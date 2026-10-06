# Taste

Read this once for every new deck. A valid deck can still be unreadable; these rules are what
makes a reader understand the system in a minute.

## Draw the system at the detail it has

- By default, draw what really exists at the level the user works at: every use case, consumer,
  topic, table or external system they would name. A large system makes a large deck, and that is
  fine: features, views, flows and levels keep it readable, not fewer cards.
- Merge pieces only when the user asks for an overview, a slide or `simplified` detail, and then
  say in the handover what you merged.
- One card per thing, still: three replicas of a service are one card with `host: "3 replicas"`,
  and a helper that only one card uses can live in that card's `description`.
- Before adding a card, check it isn't already there under another name: shared parts (a queue, a
  worker pool, an outbox, a job store) are drawn **once** and every flow walks through them.

## Make a big deck readable

What makes a large deck look tangled is almost never the number of cards; it is how they are
tied together. Measured on a real 56-card, 112-connector deck: 771 crossing connectors as first
drawn, 220 after removing groups of one kind, 25 after also trimming connectors to shared stores.

- **No groups on a big deck.** Over ~25 cards, leave groups out: the layout keeps a group
  together, so its members leave their flows and every connector to them crosses the canvas (even
  a group for one deployable cost 363 crossings against 220 without). Put the boundary in each
  card's `host` or `tech` ("work-order backend"). On a small deck, group only another company's
  systems or the UI; never cards that share a type (lint: `group-by-kind`).
- **Hubs get few connectors.** A store, event bus, job table or worker that everything touches
  becomes a hub whose connectors cut through the whole picture. Draw its connectors only where a
  flow walks through it, plus its one owner; list the other readers and writers in its
  `description` (lint: `hub-card`, more than 8 connectors).
- **Left to right is the story.** Entry points (users, upstream systems, topics) come first,
  outputs (external systems, notifications) last; the app lays out along connector direction, so
  draw each connector the way the request or message travels. Replies only where a flow needs them.
- **Every card is connected.** A card with no connector floats wherever space is left.
- **Explanations live in descriptions and step notes.** Sticky notes are for a handful of
  one-line warnings that must be seen on the canvas.

## Budgets

|                     | Budget                                                 | Lint code           |
| ------------------- | ------------------------------------------------------ | ------------------- |
| Card or group title | 40 characters (1–4 words is best)                      | `label-too-long`    |
| Connector label     | 32 characters                                          | `label-too-long`    |
| Cards per level     | only when asked: balanced 12 · simplified 7            | `level-over-budget` |
| Steps per flow      | 3–12 (split longer journeys)                           |                     |
| Sticky note         | a short sentence (under ~60 characters), a handful max |                     |
| Accent colours      | one colour on at most two focal cards                  |                     |

## Shape follows meaning

- A sequence is a **flow**, not a chain of numbered cards.
- A decision or policy is a **rule** on the step that applies it, not a diamond card.
- One service fanning out to many is one card with many connectors, or a **group** of the targets.
- Another company, the UI, or one deployable you draw the inside of is a **group**; a set of cards
  that merely share a type is not.
- A detail that only some readers need is a **level** below, not more cards on top.

## Words

- Titles name the thing ("Order Service", "Orders DB"), labels name what travels ("charge card",
  "OrderPaid"), step titles are verbs ("Charge card").
- Put specifics in fields: `tech`, `host`, `owner`, `protocol`; prose in `description`; a real
  example message in the step's `payload`.
- For the `executive` audience, drop protocols and tech, keep owners and outcomes; for `mixed`,
  plain titles and one-sentence descriptions.

## Honesty

- Draw only what was described or what the code shows. Likely-but-unstated connectors go in the
  handover under "Assumed", not in the deck.
- Never leave a card without connections unless it is in a group or has a level below it; lint
  reports `orphan-card`.
