# Contract: `@sododeck/model` additions (008)

These are additive. Nothing that exists today changes meaning. There is no schema change (research R1). The cell grammar and evaluation semantics are recorded in **ADR 0009** (`docs/decisions/0009-decision-table-evaluation.md`).

## Pure functions (`src/rules/`, exported from `src/index.ts`)

```ts
export type CompareOp = '<' | '<=' | '>' | '>=';
export type Cell =
  | { kind: 'any' }
  | { kind: 'compare'; op: CompareOp; value: number }
  | { kind: 'exact'; value: string }
  | { kind: 'list'; values: readonly string[] }
  | { kind: 'invalid' };

/** Parse one condition cell. `≤`/`≥` normalize to `<=`/`>=`. The stored text is never rewritten. */
export function parseCell(text: string): Cell;

/** Does `input` satisfy `cell`? Empty input only matches `any`. `invalid` never matches. */
export function matchCell(cell: Cell, input: string): boolean;

export type Evaluation =
  | { status: 'match'; rows: readonly Id[] }
  | { status: 'ambiguous'; rows: readonly Id[] }
  | { status: 'none' };

/** Evaluate a rule. Inputs are keyed by input column id; a missing key counts as ''. */
export function evaluateRule(rule: Rule, inputs: Readonly<Record<Id, string>>): Evaluation;

export interface RuleChecks {
  catchAll: boolean;
  invalidCells: readonly { rowId: Id; columnId: Id }[];
}
export function ruleChecks(rule: Rule): RuleChecks;

export interface RuleUsage {
  steps: readonly {
    flowId: Id;
    stepId: Id;
    number: string;
    from: Id | null;
    to: Id | null;
    broken: boolean;
  }[];
  nodes: readonly Id[];
}
/** Steps (in flow order, numbered by `analyzeFlow`) and nodes that reference the rule. */
export function ruleUsage(file: SododeckFile, ruleId: Id): RuleUsage;
```

## Editor ops (`src/ops/rule-links.ts`, wired into `DeckEditor`)

```ts
export type RuleHost = { kind: 'node'; id: Id } | { kind: 'step'; flowId: Id; stepId: Id };

interface DeckEditor {
  /** Append `ruleId` to the host's `rules`. Throws `missing-reference` (no such rule/host) or `invalid` (already attached). */
  attachRule(host: RuleHost, ruleId: Id): void;
  /** Remove `ruleId` from the host's `rules` (clears the key when empty). On a step, also removes `ruleInputs[ruleId]`. No-op when not attached. */
  detachRule(host: RuleHost, ruleId: Id): void;
  /**
   * Replace the step's sample inputs for one attached rule. Empty values are dropped, and the rule key
   * is removed when nothing is left. Keyed transaction (`flows:<flowId>:<stepId>:inputs:<ruleId>`), so
   * typing merges into one undo step. Throws `missing-reference` if the rule is not attached or a column
   * is not one of its input columns.
   */
  setRuleInputs(flowId: Id, stepId: Id, ruleId: Id, values: Readonly<Record<Id, string>>): void;
}
```

The existing rule ops are used as they are: `addRule`, `updateRule`, `removeRule`, `addRuleColumn`, `renameRuleColumn`, `removeRuleColumn`, `addRuleRow`, `setRuleCell`, `moveRuleRow`, `removeRuleRow`. `moveRuleColumn` exists but has no UI in 008.

## Removal preview (`src/preview.ts`)

- `RemovalTarget` gains `{ scope: 'rules'; id: Id }`. This builds on 006's union, which adds `branches`.
- `previewRemoval(file, [{ scope: 'rules', id }])` returns the rule in `removed`, and every node and step whose `rules` / `ruleInputs` change in `updated`.
- `removeTarget(editor, doc, { scope: 'rules', id })` calls `editor.removeRule(id)`.

## Tests (`packages/model/test/`)

- `rules-evaluate.test.ts` (new) covers:
  - Every grammar branch: `''`, `Any`, `any`, `≤ 5`, `<=5`, `> 20`, `>= -3.5`, `≤`, `> abc`, `Bike, Van`, `a,,b`, `Express`.
  - Numeric vs text exact matching (`5` = `5.0`; `express` = `Express`).
  - Empty input.
  - Non-numeric input against a comparison.
  - The spec's Delivery tier table under all three hit policies, including the Unique ambiguous case.
  - A rule with no columns or no rows.
  - `ruleChecks` catch-all and invalid cells.
- `rule-links.test.ts` (new) covers:
  - Attach and detach on nodes and steps.
  - Refusing a double attach and a missing rule.
  - Detach dropping `ruleInputs` in the same transaction.
  - `setRuleInputs` dropping empty values and merging keyed typing.
  - One undo per op.
  - Remote-origin events.
- `rule-usage.test.ts` (new) covers:
  - Branch step numbers (4a).
  - Broken steps.
  - Nodes.
  - Rename safety (renaming the rule and the columns keeps usage).
- Additions to existing suites:
  - `round-trip.test.ts`: a deck with rules on nodes and steps, `ruleInputs`, tags and links on every object type.
  - `preview.test.ts`: the `rules` scope.
  - `undo.test.ts`: rule delete restores every attachment and every sample input.
