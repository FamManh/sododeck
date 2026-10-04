/**
 * Validation of the parsed text against the deck (046 FR-008, data-model "Validation rules"). Two
 * stages around the planner: `validateText` needs only the text and the deck's names (duplicates,
 * missing reference ends, enum defaults, warnings for blocks that are not inputs); `validatePlan`
 * needs the plan (locked tables, an enum still in use). Any error means nothing is applied. Pure.
 */
import { isDbTable, isLocked } from '@sododeck/model';
import type { Id, Node, SododeckFile } from '@sododeck/schema';

import type { RawNonInput, RawSchema, RawTableRef } from '../import/types';
import { schemaName } from './normalise';
import type { ProblemCode, SchemaPlan, SyncScope, TextProblem } from './types';

/** Past any real line; the editor clamps a marker's end to the line. */
const LINE_END = 1000;

/** A problem over a whole line (the parser gives lines, not ranges, for these objects). */
export function lineProblem(
  line: number,
  code: ProblemCode,
  message: string,
  severity: TextProblem['severity'] = 'error',
  suggestion?: string,
): TextProblem {
  return {
    line,
    column: 1,
    endLine: line,
    endColumn: LINE_END,
    severity,
    message,
    code,
    ...(suggestion === undefined ? {} : { suggestion }),
  };
}

const NON_INPUT_MESSAGE: Record<RawNonInput['kind'], string> = {
  'table-group': 'Table groups are edited on the canvas; this block is ignored',
  note: 'Notes are edited on the canvas; this block is ignored',
  'header-color': 'Header colours are edited on the canvas; this setting is ignored',
  project: 'The deck dialect is set in Deck settings; this block is ignored',
  'ref-color': 'Relationship colours are edited on the canvas; this setting is ignored',
  records: 'Sample data is not stored; this block is ignored',
};

/**
 * Warnings for the blocks the text may hold but the panel does not read (R15). The writer's own
 * `Project` block (the deck dialect, nothing else) is the panel's text, so it is not a warning.
 */
export function nonInputProblems(raw: RawSchema, deckDialect?: string): TextProblem[] {
  const writersProject =
    raw.dialect !== undefined && raw.dialect === deckDialect && raw.projectNote === undefined;
  return (raw.inputs ?? [])
    .filter((input) => !(input.kind === 'project' && writersProject))
    .map((input) => ({
      line: input.line,
      column: input.column ?? 1,
      endLine: input.endLine ?? input.line,
      endColumn: input.endColumn ?? LINE_END,
      severity: 'warning' as const,
      code: 'not-an-input' as const,
      message: NON_INPUT_MESSAGE[input.kind],
    }));
}

const key = (ref: RawTableRef): string =>
  `${(schemaName(ref.schema) ?? '').toLowerCase()}\u0000${ref.name.toLowerCase()}`;

const label = (ref: RawTableRef): string =>
  ref.schema === undefined ? ref.name : `${ref.schema}.${ref.name}`;

export interface TextScope {
  scope: SyncScope;
}

/** Names that must not clash: the deck's tables that sit outside the text's scope. */
export function outsideTables(deck: SododeckFile, scope: SyncScope): Node[] {
  if (scope.kind === 'schema') return [];
  const inside = new Set(scope.baseline);
  return deck.nodes.filter((n) => isDbTable(n) && !inside.has(n.id));
}

/**
 * Errors that need only the text and the deck's table names: duplicate tables, columns, enums and
 * indexes; a relationship end that names no table or no column.
 */
export function validateText(deck: SododeckFile, raw: RawSchema, scope: SyncScope): TextProblem[] {
  const problems: TextProblem[] = [];

  const seenTables = new Map<string, number>();
  for (const table of raw.tables) {
    const k = key(table);
    if (seenTables.has(k)) {
      problems.push(
        lineProblem(table.line, 'duplicate-table', `Table ${label(table)} is already defined`),
      );
    } else seenTables.set(k, table.line);
    const columns = new Set<string>();
    for (const column of table.columns) {
      const c = column.name.toLowerCase();
      if (columns.has(c)) {
        problems.push(
          lineProblem(
            column.line,
            'duplicate-column',
            `Column ${column.name} is already defined in ${table.name}`,
          ),
        );
      } else columns.add(c);
    }
    const indexes = new Set<string>();
    for (const index of table.indexes) {
      if (index.name === undefined || index.name === '') continue;
      const n = index.name.toLowerCase();
      if (indexes.has(n)) {
        problems.push(
          lineProblem(
            index.line,
            'duplicate-index',
            `Index ${index.name} is already defined in ${table.name}`,
          ),
        );
      } else indexes.add(n);
    }
  }

  const seenEnums = new Set<string>();
  for (const e of raw.enums) {
    const k = key(e);
    if (seenEnums.has(k)) {
      problems.push(lineProblem(e.line, 'duplicate-enum', `Enum ${label(e)} is already defined`));
    } else seenEnums.add(k);
  }

  // A table typed into a Selection text may not take the name of one the text does not cover.
  for (const node of outsideTables(deck, scope)) {
    const clash = raw.tables.find(
      (t) => key(t) === key({ name: node.title.trim(), ...schemaOf(node.schema) }),
    );
    if (clash !== undefined) {
      problems.push(
        lineProblem(
          clash.line,
          'duplicate-table',
          `A table named ${label(clash)} already exists outside the selection`,
        ),
      );
    }
  }

  // Relationship ends: tables of the text, and (Selection) tables of the deck.
  const known = new Map<string, Set<string>>();
  for (const table of raw.tables) {
    known.set(key(table), new Set(table.columns.map((c) => c.name.toLowerCase())));
  }
  if (scope.kind === 'selection') {
    for (const node of outsideTables(deck, scope)) {
      known.set(
        key({ name: node.title.trim(), ...schemaOf(node.schema) }),
        new Set((node.columns ?? []).map((c) => c.name.toLowerCase())),
      );
    }
  }
  for (const ref of raw.refs) {
    for (const end of [ref.from, ref.to]) {
      const columns = known.get(key(end));
      if (columns === undefined) {
        problems.push(
          lineProblem(
            ref.line,
            'missing-ref-table',
            scope.kind === 'selection'
              ? `Table ${label(end)} is not in the selection or the deck`
              : `Table ${label(end)} is not defined`,
          ),
        );
        continue;
      }
      const missing = end.columns.find((c) => !columns.has(c.toLowerCase()));
      if (missing !== undefined) {
        problems.push(
          lineProblem(
            ref.line,
            'missing-ref-column',
            `Column ${missing} does not exist in ${label(end)}`,
          ),
        );
      }
    }
  }
  return problems;
}

function schemaOf(schema: string | undefined): { schema?: string } {
  const value = schemaName(schema);
  return value === undefined ? {} : { schema: value };
}

/** A column default that is not one of its enum's values (`enum-default`). */
export function validateEnumDefaults(
  raw: RawSchema,
  enumValues: ReadonlyMap<string, readonly string[]>,
  columnEnum: (tableIndex: number, columnIndex: number) => string | undefined,
): TextProblem[] {
  const problems: TextProblem[] = [];
  raw.tables.forEach((table, t) => {
    table.columns.forEach((column, c) => {
      const enumKey = columnEnum(t, c);
      if (enumKey === undefined || column.default?.kind !== 'value') return;
      const values = enumValues.get(enumKey);
      const value = String(column.default.value);
      if (values !== undefined && !values.includes(value)) {
        problems.push(
          lineProblem(
            column.line,
            'enum-default',
            `Default '${value}' is not a value of the enum ${column.type}`,
            'error',
            values[0],
          ),
        );
      }
    });
  });
  return problems;
}

export interface PlanCheck {
  /** Where a table of the deck is in the text (deck id → line); absent for a removed table. */
  tableLine: ReadonlyMap<Id, number>;
  /** Enums the plan removes, with what still uses each (columns outside the text's scope). */
  enumUsers: readonly { id: Id; name: string; users: number }[];
}

/**
 * Errors that need the plan: a locked table the plan would change or remove, and an enum the plan
 * removes while a column outside the text still names it.
 */
export function validatePlan(
  deck: SododeckFile,
  plan: SchemaPlan,
  check: PlanCheck,
): TextProblem[] {
  const problems: TextProblem[] = [];
  const nodes = new Map(deck.nodes.map((n) => [n.id, n]));
  const touched = new Set<Id>([
    ...plan.updateTables.map((u) => u.id),
    ...plan.tableOps.map((o) => o.tableId),
    ...plan.removeTables.map((r) => r.id),
  ]);
  for (const id of touched) {
    const node = nodes.get(id);
    if (node === undefined || !isLocked(node)) continue;
    const removed = plan.removeTables.some((r) => r.id === id);
    problems.push(
      lineProblem(
        check.tableLine.get(id) ?? 1,
        'locked',
        removed
          ? `${node.title} is locked and cannot be removed; unlock it on the canvas first`
          : `${node.title} is locked and cannot be changed; unlock it on the canvas first`,
      ),
    );
  }
  for (const e of check.enumUsers) {
    if (e.users === 0) continue;
    problems.push(
      lineProblem(
        1,
        'enum-in-use',
        `Enum ${e.name} cannot be removed: ${String(e.users)} column${e.users === 1 ? '' : 's'} outside this text still use it`,
      ),
    );
  }
  return problems;
}
