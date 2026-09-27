/** Display text of rules and their evaluation, shared by the rule editor and the step card. */
import type { Evaluation } from '@sododeck/model';
import type { Id, Rule } from '@sododeck/schema';

export const HIT_POLICIES: readonly { value: Rule['hitPolicy']; label: string; explain: string }[] =
  [
    { value: 'first', label: 'First match', explain: 'Row order decides the winner' },
    { value: 'unique', label: 'Unique', explain: 'Only one row may match' },
    { value: 'collect', label: 'Collect', explain: 'Every matching row applies' },
  ];

export const NO_MATCH = 'No row matches these inputs';

/** 1-based display number of a row. */
export function rowNumber(rule: Rule, rowId: Id): number {
  return rule.rows.findIndex((r) => r.id === rowId) + 1;
}

/** A condition cell as shown: empty means Any. */
export function conditionText(cell: string): string {
  return cell.trim() === '' ? 'Any' : cell;
}

/** A row's action values, "Bike · 45 min · €4.00". */
export function actionsText(rule: Rule, rowId: Id): string {
  const row = rule.rows.find((r) => r.id === rowId);
  return (row?.then ?? []).filter((v) => v !== '').join(' · ');
}

function listRows(numbers: readonly number[]): string {
  if (numbers.length <= 1) return `Row ${String(numbers[0] ?? '')}`;
  return `Rows ${numbers.slice(0, -1).join(', ')} and ${String(numbers.at(-1))}`;
}

/** The ambiguity warning of a Unique rule (spec clarification: no winner). */
export function ambiguousText(rule: Rule, rows: readonly Id[]): string {
  return `${String(rows.length)} rows match; Unique expects one (${listRows(
    rows.map((r) => rowNumber(rule, r)),
  )})`;
}

/** One line for the step card: "Row 1 matches → Bike · 45 min · €4.00" (FR-031). */
export function resultLine(rule: Rule, evaluation: Evaluation): string {
  switch (evaluation.status) {
    case 'none':
      return NO_MATCH;
    case 'ambiguous':
      return ambiguousText(rule, evaluation.rows);
    case 'match': {
      const numbers = evaluation.rows.map((r) => rowNumber(rule, r));
      const verb = numbers.length === 1 ? 'matches' : 'match';
      const actions = evaluation.rows.map((r) => actionsText(rule, r)).filter((a) => a !== '');
      return `${listRows(numbers)} ${verb}${actions.length > 0 ? ` → ${actions.join('; ')}` : ''}`;
    }
  }
}
