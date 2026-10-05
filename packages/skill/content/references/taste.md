# Taste

Read this once for every new deck. A valid deck can still be unreadable; these rules are what
makes a reader understand the system in a minute.

## Every card earns its place

- Start from what the user needs to explain, not from everything that exists. Deleting is usually
  the best edit.
- Merge minor pieces (a config service, a sidecar, a cron) into the card they serve, and mention
  them in its `description`, unless the user asked about them.
- One card per thing a reader would name in a conversation. Three replicas of a service are one
  card with `host: "3 replicas"`.

## Budgets

|                     | Budget                                   | Lint code           |
| ------------------- | ---------------------------------------- | ------------------- |
| Cards per level     | faithful 24 · balanced 12 · simplified 7 | `level-over-budget` |
| Card or group title | 40 characters (1–4 words is best)        | `label-too-long`    |
| Connector label     | 32 characters                            | `label-too-long`    |
| Steps per flow      | 3–10 (split longer journeys)             |                     |
| Accent colours      | one colour on at most two focal cards    |                     |

Over budget? Split into levels: keep the big blocks on top and open each one to its parts
(`modeling.md`, groups and levels).

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
