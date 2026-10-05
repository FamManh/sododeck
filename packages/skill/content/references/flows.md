# Flows

Read this when the user describes a sequence: a request path, a user journey, a job, "what happens
when …". A flow is played step by step in the app: each step lights up one connector.

## The one rule

**Each step names a connector, and each step starts where the previous step ended.** Step 2's
connector must leave the card that step 1's connector arrived at. Lint reports `broken-chain` when
this fails and `step-without-connection` when a step names a connector that does not exist.

So a flow is a walk along the arrows. Two consequences:

- **Replies need their own connector.** "Order Service charges the card, then publishes
  OrderPaid" is `orders → payments` (charge) then `payments → orders` (charge result) then
  `orders → events`. Without the connector back, step 3 would start at `orders` while step 2 ended
  at `payments`.
- **A side effect that does not continue the story is not a step.** If Order Service also writes
  to its database and the flow moves on from Order Service, keep the database connector in the
  deck but leave it out of the flow, or mention it in the step's `description`. Use a branch when
  it is a real alternative path.

## Shape

```json
{
  "id": "checkout",
  "title": "Checkout",
  "feature": "checkout",
  "trigger": "Customer presses Pay",
  "outcome": "Order is paid and confirmed",
  "steps": [
    { "id": "submit", "edge": "web-gateway", "title": "Submit cart", "sla": "< 300 ms" },
    { "id": "create", "edge": "gateway-orders", "title": "Create order" },
    {
      "id": "charge",
      "edge": "orders-payments",
      "title": "Charge card",
      "payload": "{ \"orderId\": \"o_123\", \"amount\": 4990 }"
    }
  ]
}
```

Step fields: `id` and `edge` are required. `title` (what happens, a few words), `condition` (when
the step runs), `sla`, `description` (markdown), `payload` (a real example message or request:
it explains a step better than prose), `notes`, `owner`, `tags`, `links`, `rules` and
`ruleInputs` (see `rules.md`), `touches` (database tables the step reads or writes, see
`database.md`).

Flow fields: `id`, `title`, `steps` required; `feature`, `description`, `trigger`, `outcome`,
`owner`, `tags`, `links`, `branches` optional.

## Branches

When the path splits ("if payment fails …"), declare branches on the flow and mark the steps that
belong to each:

```json
"branches": [
  { "id": "paid", "label": "payment ok", "condition": "status == authorized" },
  { "id": "declined", "label": "payment failed", "condition": "status == declined", "errorPath": true }
],
"steps": [
  { "id": "s1", "edge": "web-api" },
  { "id": "s2", "edge": "api-payments" },
  { "id": "s3a", "edge": "payments-orders", "branch": "paid" },
  { "id": "s3b", "edge": "payments-web", "branch": "declined" }
]
```

Steps without `branch` are the main path. Every branch starts where the last main step ended, and
its own steps chain like the main path. Each branch needs a non-empty `label` and `condition`;
mark failure paths with `errorPath: true`. Conditions of two branches should not overlap.

## Good flows

- One flow per user-visible journey ("Checkout", "Refund", "Courier assignment"), 3–10 steps.
  Longer flows usually hide two journeys.
- Step titles are verbs: "Charge card", not "Payment".
- Add every connector a flow needs to the deck first, then write the steps.
- Put a real `payload` on the one or two steps where the data matters most.
