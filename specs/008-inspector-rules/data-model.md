# Data Model: Inspectors and Rules (008)

Document data lives in the Yjs deck and changes only through `@sododeck/model` (constitution I).
UI state lives in `useUiStore`. Derived data is computed and never stored (FR-035).

## 1. Document data (`.sododeck.json`, schema v1, unchanged)

No format change is needed (research R1). Here are the fields this feature edits, with the rules the UI applies on top of the schema.

| Object | Field                                   | Schema                                    | UI rule                                                                                                     |
| ------ | --------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Deck   | `name`                                  | `string`                                  | Non-empty (trimmed); an empty value reverts.                                                                |
| Deck   | `description`                           | `string?`                                 | Markdown; an empty value clears the field (`null`).                                                         |
| Deck   | `tags`                                  | `Tags?`                                   | Normalized (trim, lower-case), unique; an empty list clears the field.                                      |
| Node   | `title`                                 | `Text`                                    | Non-empty.                                                                                                  |
| Node   | `description`, `owner`, `tech`, `host`  | `string?`                                 | Empty clears the field.                                                                                     |
| Node   | `tags`, `links`                         | `Tags?`, `Links?`                         | As for the deck; links go through `parseLinkInput` (R6).                                                    |
| Node   | `type`, `group`                         | enum, `Id?`                               | Picked from existing kinds and groups ("No group" clears `group`), per component and in bulk.               |
| Node   | `rules`                                 | `IdList?`                                 | Only through `attachRule` / `detachRule`; an id can't appear twice.                                         |
| Edge   | `label`                                 | `string?`                                 | Empty clears the field.                                                                                     |
| Edge   | `from`, `to`                            | `Id`                                      | A reattach must pass `connectionCheck(deck, from, to, edgeId)` (no self, no duplicate in either direction). |
| Edge   | `protocol`, `direction`                 | enum?                                     | Same choices as the connection popover (`PROTOCOLS`, `DIRECTIONS`, moved into a shared module).             |
| Edge   | `description`, `owner`, `tags`, `links` | —                                         | As for nodes.                                                                                               |
| Flow   | `description`, `owner`, `tags`, `links` | —                                         | As for nodes (006 already edits `title`, `feature`, `description`, `owner`).                                |
| Step   | `owner`, `tags`, `links`                | —                                         | As for nodes (006 already edits `title`, `description`, `condition`, `sla`).                                |
| Step   | `rules`                                 | `IdList?`                                 | Only through `attachRule` / `detachRule`.                                                                   |
| Step   | `ruleInputs`                            | `{ [ruleId]: { [inputColId]: string } }?` | Only through `setRuleInputs`; keys must be attached rules and their input columns (model refs).             |
| Rule   | `title`                                 | `Text`                                    | Non-empty. A new rule gets "Untitled rule".                                                                 |
| Rule   | `description`                           | `string?`                                 | Markdown.                                                                                                   |
| Rule   | `hitPolicy`                             | `first` \| `unique` \| `collect`          | Shown as First match / Unique / Collect.                                                                    |
| Rule   | `inputs`, `outputs`                     | `RuleColumn[]`                            | `label` non-empty; a new column gets "Condition n" / "Action n", focused for rename.                        |
| Rule   | `rows[].when`, `rows[].then`            | `string[]`                                | One cell per column (model S1). New condition cells are `''`, shown as "Any".                               |

Rules live in the `rules` map keyed by id (`rule-…`). Columns and rows have `col-…` and `row-…` ids, unique across the deck (002).

### Invariants the model enforces (existing and new)

1. `step.ruleInputs` keys ⊆ `step.rules`; inner keys ⊆ the rule's input column ids (existing refs check).
2. `detachRule` on a step removes `ruleInputs[ruleId]` in the same transaction (new).
3. `attachRule` refuses a rule that doesn't exist (`missing-reference`) or is already attached (`invalid`) (new).
4. `removeRule` detaches the rule everywhere and drops the matching `ruleInputs` (existing, 002 FR-013).
5. `removeRuleColumn` on an input column drops the matching `ruleInputs` values (existing, 002 FR-018).
6. Adding a column adds a `''` cell to every row, and removing one removes its cells (existing).

## 2. Derived data (never stored)

### `packages/model/src/rules/` (pure, ADR 0009)

```ts
type CompareOp = '<' | '<=' | '>' | '>=';
type Cell =
  | { kind: 'any' }
  | { kind: 'compare'; op: CompareOp; value: number }
  | { kind: 'exact'; value: string }
  | { kind: 'list'; values: readonly string[] }
  | { kind: 'invalid' };

type Evaluation =
  | { status: 'match'; rows: readonly Id[] } // first/unique: 1 row; collect: ≥ 1 rows in order
  | { status: 'ambiguous'; rows: readonly Id[] } // unique only, ≥ 2 rows
  | { status: 'none' };

interface RuleChecks {
  catchAll: boolean; // some row has every input cell 'any'
  invalidCells: readonly { rowId: Id; columnId: Id }[];
}

interface RuleUsage {
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
```

The matching semantics are in research R2. Here is the worked example from the spec (Delivery tier, First match):

| Inputs (Distance, Weight, Priority)  | Row cells matched                          | Result                                                      |
| ------------------------------------ | ------------------------------------------ | ----------------------------------------------------------- |
| 5, 10, Express                       | row 1 `≤ 5`, `≤ 10`, `Express` all match   | `match [row1]`                                              |
| 5, (empty), Express                  | no row: every row's Weight cell is not Any | `none`: "No row matches these inputs"                       |
| 5, 10, Standard                      | row 2                                      | `match [row2]`                                              |
| Unique, inputs matching rows 1 and 3 | —                                          | `ambiguous [row1,row3]`: "2 rows match; Unique expects one" |

### App (`apps/app/src/editor/inspector/derive.ts`, memoized per snapshot)

- `ownerSuggestions(deck): string[]`: distinct non-empty owners across nodes, edges, features, flows and steps, sorted by name (case-insensitive).
- `tagSuggestions(deck): string[]`: distinct tags across the deck, nodes, edges, flows and steps.
- `nodeConnections(deck, nodeId)`: `{ edgeId, direction: 'out' | 'in', otherId, label }[]`.
- `edgeUsage(deck, edgeId)`: `{ flowId, flowTitle, stepId, number }[]` (via `analyzeFlow`).
- `flowSummary(deck, flowId)`: `{ steps, branches, components, broken }`.
- `deckStats(deck)`: `{ components, connections, flows, rules }`.
- `bulkView(nodes)`: `{ kind, owner, tech, group: Shared<…>, tags: { tag, count }[] }`, where `Shared<T> = { mixed: false; value: T } | { mixed: true }`.
- `ruleListItem(deck, ruleId)`: `{ title, rows, usedInSteps }` for DECISION TABLES and Attach.

## 3. UI state (`apps/app/src/state/ui-store.ts`, never exported)

```ts
// Added by 008
canvasViewport: { x: number; y: number; zoom: number } | null; // restored after the rules screen
ruleTest: null | {
  ruleId: Id;
  values: Record<Id, string>; // input column id → typed value (UI only)
  from: { flowId: Id; stepId: Id } | null; // set by "Edit rule" on a step → "Save as step inputs"
};
descriptionMode: Record<string, 'write' | 'preview'>; // key `${scope}:${id}`, reset on selection change
```

The following already exist and are reused: `selection` (003), `activeFlow` / `setActiveFlow` / `setActiveStep` (006), `pendingDelete` / `requestRemoval` (006), and `announce`.

### Rule editor state transitions

```text
canvas ──Rules button / Rules stat / rule row──▶ rules(ruleId?)          ruleTest = null or {ruleId, {}, null}
step card ──"Edit rule"──▶ rules(ruleId)                                 ruleTest = {ruleId, step.ruleInputs[ruleId], {flowId, stepId}}
rules ──select another rule──▶ rules(ruleId')                            ruleTest = {ruleId', {}, null}
rules ──"Save as step inputs"──▶ same                                    setRuleInputs(from…, values) (one undo step)
rules ──USED IN step──▶ canvas                                           setActiveFlow(F); setActiveStep(S)
rules ──USED IN component──▶ canvas                                      select({nodes:[id]})
rules ──Back to canvas──▶ canvas                                         viewport + selection restored
rule removed (this or another tab) ──▶ rules()                           ruleTest = null
```

## 4. Validation summary (spec → rule → where)

| Spec           | Rule                                                               | Where                                  |
| -------------- | ------------------------------------------------------------------ | -------------------------------------- |
| FR-002         | One undo step per focus session; required text never written empty | `useLiveField` (R4)                    |
| FR-005         | Tags normalized and unique                                         | `@sododeck/ui/lib/tags`                |
| FR-006, FR-038 | Only http, https and relative links                                | `parseLinkInput` (R6)                  |
| FR-009         | Reattach refuses self and duplicate connections                    | `connectionCheck`                      |
| FR-015, FR-016 | Bulk set is one `batch`                                            | bulk inspector                         |
| FR-021, FR-022 | Column and row changes keep cell counts                            | model rule ops (existing)              |
| FR-023         | Cell grammar; invalid cells never match                            | `parseCell` / `matchCell`              |
| FR-025         | Hit policies, including Unique ambiguity                           | `evaluateRule`                         |
| FR-027         | Catch-all check                                                    | `ruleChecks`                           |
| FR-029, FR-030 | No double attach; detach drops sample inputs                       | `attachRule` / `detachRule`            |
| FR-032         | Missing rule reference shown, not dropped                          | `getRule` → undefined → "Missing rule" |
