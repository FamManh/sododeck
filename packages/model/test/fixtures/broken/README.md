# Broken sample decks (062)

One file per common mistake in an AI-written deck (spec SC-002). `test/import-check.test.ts`
checks what each one reports; the quickstart pastes their copied reports into an AI assistant.
All start from the same small checkout deck (3 cards, 2 connectors, 1 flow).

| File                                      | What is wrong                                         | Expected                                            |
| ----------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `missing-title-and-duplicate-id.sododeck` | `payments` has no `title`; a second card reuses `api` | refused: `schema-required`, `duplicate-id`          |
| `not-json.sododeck`                       | a comma moved to the wrong line                       | refused: `invalid-json` with line and column        |
| `version-2.sododeck`                      | `"version": 2`                                        | refused: `unsupported-version`                      |
| `wrong-type.sododeck`                     | a card title is a number                              | refused: `schema-type`                              |
| `unknown-enum.sododeck`                   | connector `protocol` is `"https"`                     | refused: `schema-enum`                              |
| `unknown-field.sododeck`                  | a card has a `kind` key                               | refused: `schema-unknown-field`                     |
| `rule-row-cells.sododeck`                 | a rule row has 1 `when` cell for 2 inputs             | refused: `rule-row-cells`                           |
| `ambiguous-end.sododeck`                  | a group and a card share the id a connector names     | refused: `ambiguous-end`                            |
| `dangling-connector.sododeck`             | a connector ends at a card that does not exist        | opens: `broken-reference`                           |
| `broken-rule-reference.sododeck`          | a card lists a rule that does not exist               | opens: `missing-rule`                               |
| `dangling-step-and-bad-picture.sododeck`  | a step uses a missing connector; a picture is damaged | opens: `step-without-connection`, `picture-damaged` |

`flowchart-fidelity.mmd` is a Mermaid flowchart for the fidelity report (quickstart step 8): a
node declared twice with a different label and a subgraph declared twice (Merged), a style line
and a click (Left out). Nested subgraphs come across as nested groups, so they are not reported.
