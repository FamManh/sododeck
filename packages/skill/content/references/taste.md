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

- **Features**: one per business capability the user names ("Setup", "Pricing", "Cancellation",
  "Interface to APM"…), each flow tagged with its feature.
- **Views**: after an `Overview` view, one feature view per feature listing only the cards its
  flows use (`modeling.md` §8). Opening a view shows that part of the system laid out on its own.
- **Groups** for teams, services and data stores; **levels** (`parent`) only when a reader really
  drills into something (a service whose internals are a separate conversation).
- **Rules** carry decision logic; **notes** (`description`, step `notes`) carry explanations. Keep
  sticky notes for a few short warnings.

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
- A team, zone or bounded context is a **group**.
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
