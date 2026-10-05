# Decision rules

Read this when the user describes a decision, policy, pricing, routing or approval logic. A rule is
a small decision table; attach it to the step or card where the decision is made. Don't draw a
decision as a diamond card when it is really a policy: a rule keeps the logic readable and
testable in the app.

## Shape

Rules live in the root `rules` object, keyed by rule id:

```json
"rules": {
  "refund-approval": {
    "title": "Refund approval",
    "description": "Who approves a refund, by amount and order age.",
    "hitPolicy": "first",
    "inputs": [
      { "id": "amount", "label": "Amount (EUR)" },
      { "id": "age", "label": "Order age (days)" }
    ],
    "outputs": [{ "id": "approver", "label": "Approver" }],
    "rows": [
      { "id": "small", "when": ["<= 50", "<= 30"], "then": ["Automatic"] },
      { "id": "recent", "when": ["<= 500", "<= 30"], "then": ["Support lead"] },
      { "id": "other", "when": ["any", "any"], "then": ["Finance"] }
    ]
  }
}
```

- `hitPolicy`: `first` (the first matching row wins, the usual choice), `unique` (exactly one row
  may match), `collect` (all matching rows apply).
- Each row has one `when` cell per input and one `then` cell per output, in column order.
- Every rule should end with a catch-all row (`any` in every `when` cell), or lint warns
  `rule-without-catch-all`.

## Cell grammar (`when` cells)

| Cell                                           | Matches                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `any` or empty                                 | anything                                                           |
| `<= 50`, `< 10`, `>= 3`, `> 2` (also `≤`, `≥`) | numbers compared                                                   |
| `gold, silver`                                 | any value in the list                                              |
| `Yes`                                          | that value exactly (case-insensitive; numbers compared as numbers) |

A cell lint cannot read is reported as `invalid-rule-cells`.

## Attaching

- To a step: `"rules": ["refund-approval"]` on the step, and optionally sample inputs to show in
  the player: `"ruleInputs": { "refund-approval": { "amount": "120", "age": "10" } }`.
- To a card: `"rules": ["refund-approval"]` on the node, when the card applies the policy
  everywhere rather than in one flow.

A step or card that names a rule id that does not exist is reported as `missing-rule`.
`examples/refund-policy.sododeck` shows a rule attached to a step.
