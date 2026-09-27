# 0009. Decision table cells and evaluation

- **Status:** Accepted
- **Date:** 2026-09-27
- **Feature:** `specs/008-inspector-rules` (spec FR-023, FR-025, FR-027, clarifications, research R2)

## Context

Feature 008 turns rules into usable decision tables (K-2, design 04, 28, 29). A rule already has
a structured shape in schema v1 (ADR 0004): input and output columns, and rows whose `when` and
`then` cells are plain strings. The file does not say what a condition cell means. The rule
editor's test panel, the step's compact table (and later 007's player card, 015's Problems panel
and a CLI) must all agree on which row matches a set of inputs, so the meaning has to be defined
once, in one tested place, and recorded here.

## Decision

1. **Evaluation lives in `@sododeck/model` (`src/rules/`) as pure functions**: `parseCell`,
   `matchCell`, `evaluateRule` and `ruleChecks`. No UI, no Yjs; they run in Node and workers.
   Cells keep the text the user typed; parsing never rewrites them.

2. **Cell grammar** (applied to the trimmed text):

   | Cell text                                                        | Meaning                                     |
   | ---------------------------------------------------------------- | ------------------------------------------- |
   | empty, `Any` (any case)                                          | matches every input, including an empty one |
   | `<`, `<=` or `≤`, `>`, `>=` or `≥`, optional spaces, then number | numeric comparison                          |
   | a comparison operator alone or followed by a non-number          | invalid                                     |
   | text containing `,`                                              | list: matches when the input equals an item |
   | a list with an empty item, or an item starting with an operator  | invalid                                     |
   | anything else                                                    | exact value                                 |

   A number is `-?\d+(\.\d+)?`. So `1,000` is the list `1`, `000`, as the syntax hint says.

3. **Matching**:
   - A comparison matches only when the trimmed input is a number in the same grammar.
   - An exact value matches when both sides are numbers and are numerically equal (`5` equals
     `5.0`), or when the trimmed, case-folded strings are equal (`express` equals `Express`).
   - A list matches when any item matches as an exact value.
   - An invalid cell never matches.
   - An empty input matches only an Any cell.
   - A row matches when every condition cell matches its input. A rule with no condition columns
     matches every row.

4. **Hit policies**:
   - **First match**: the first matching row in order.
   - **Unique**: the only matching row. When several rows match there is **no winner**: the
     result is `ambiguous` and names every matching row ("2 rows match; Unique expects one")
     (spec clarification 2026-09-27). The design's "returns the first match" is not followed.
   - **Collect**: every matching row, in order.
   - No matching row gives `none` ("No row matches these inputs").

5. **Catch-all**: a row whose condition cells are all Any (or empty). `ruleChecks` reports whether
   a rule has one (a rule with no rows has none) and lists invalid cells.

## Alternatives considered

- **A FEEL / DMN expression library**: full DMN semantics, but a new runtime dependency for a
  syntax the design limits to comparisons, lists, exact values and Any (constitution VIII).
- **Ranges (`5..10`) and negation**: not in the design, and out of scope in the spec. They can be
  added later as new grammar rows without changing existing cells' meaning.
- **Unique as first match** (the design text): hides an authoring error. A Unique table with two
  matching rows is wrong, and showing a winner would make it look right.
- **Unicode-only operators**: users type `<=` on keyboards, so both forms are accepted.

## Consequences

- One behavior for the test panel, the step card and future consumers; the grammar table is a
  unit test (`packages/model/test/rules-evaluate.test.ts`).
- Cells stay free text in the file: no schema change, and a cell that does not parse is shown as
  invalid instead of being rejected on write.
- Adding syntax later is additive as long as it does not change what an existing valid cell means;
  changing a meaning needs a new ADR.
