/**
 * Identity checks on load (research R7, spec FR-020). A duplicated id makes every reference to it
 * ambiguous, so such a file is refused and never auto-fixed. Scopes: each collection, the steps
 * of one flow, the branches of one flow, the columns (inputs and outputs together) of one rule, the
 * rows of one rule, and the database parts (040, research R8): every table's columns, indexes and
 * checks plus the enums and their values, together across the deck. The same id in two different
 * scopes is allowed by the format, except a node, a group and a sticky sharing an id that a
 * connector end names (050, 053). An image id that equals one of those is refused earlier, by the
 * format's rule I5.
 *
 * The checks read only string ids out of plain JSON, so they also run on a file the schema refused
 * (062 R5): a missing title and a duplicate id are reported in the same round. Anything that is
 * not a list, an object or a string id is skipped; the schema reports it.
 */
import { toPointer, type Issue } from '@sododeck/schema';

import { isRecord } from './convert';
import { COLLECTIONS } from './layout';

type Located = { id: string; path: string };
type Path = readonly (string | number)[];

const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);
const recordOf = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});
const idOf = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.id === 'string' ? value.id : undefined;

/** Every location of the id after the first is reported once, naming all of them (062). */
function checkScope(items: readonly Located[], issues: Issue[]): void {
  const paths = new Map<string, string[]>();
  for (const { id, path } of items) {
    const list = paths.get(id);
    if (list === undefined) paths.set(id, [path]);
    else list.push(path);
  }
  for (const [id, list] of paths) {
    if (list.length > 1) {
      issues.push({
        code: 'duplicate-id',
        path: list[1] ?? '',
        subject: id,
        message: `Id "${id}" is used more than once (${list.join(', ')}).`,
        evidence: JSON.stringify(id),
      });
    }
  }
}

/** The string ids of a list with the pointers to them; items without one are skipped. */
function withPaths(items: unknown, prefix: Path): Located[] {
  const located: Located[] = [];
  listOf(items).forEach((item, i) => {
    const id = idOf(item);
    if (id !== undefined) located.push({ id, path: toPointer([...prefix, i, 'id']) });
  });
  return located;
}

/** Every column, index and check of every node, then every enum and enum value, with paths. */
function databaseParts(file: Record<string, unknown>): Located[] {
  const parts: Located[] = [];
  listOf(file.nodes).forEach((node, i) => {
    const record = recordOf(node);
    parts.push(...withPaths(record.columns, ['nodes', i, 'columns']));
    parts.push(...withPaths(record.indexes, ['nodes', i, 'indexes']));
    parts.push(...withPaths(record.checks, ['nodes', i, 'checks']));
  });
  listOf(file.enums).forEach((item, i) => {
    const id = idOf(item);
    if (id !== undefined) parts.push({ id, path: toPointer(['enums', i, 'id']) });
    parts.push(...withPaths(recordOf(item).values, ['enums', i, 'values']));
  });
  return parts;
}

/**
 * A connector end naming an id that is more than one of a node's, a group's and a sticky's is
 * ambiguous (050, 053), so such a file is refused. Objects sharing an id that no end names stay
 * loadable (the format always allowed it); the integrity report flags them.
 */
function checkAmbiguousEnds(file: Record<string, unknown>, issues: Issue[]): void {
  const ends = new Set<unknown>(
    listOf(file.edges).flatMap((edge) => [recordOf(edge).from, recordOf(edge).to]),
  );
  const nodePaths = new Map<string, string>();
  for (const { id, path } of withPaths(file.nodes, ['nodes'])) {
    if (!nodePaths.has(id)) nodePaths.set(id, path);
  }
  const reported = new Set<string>();
  const groupPaths = new Map<string, string>();
  for (const { id, path } of withPaths(file.groups, ['groups'])) {
    if (!groupPaths.has(id)) groupPaths.set(id, path);
    const nodePath = nodePaths.get(id);
    if (nodePath === undefined || !ends.has(id) || reported.has(id)) continue;
    reported.add(id);
    issues.push({
      code: 'ambiguous-end',
      path,
      subject: id,
      evidence: JSON.stringify(id),
      message: `Id "${id}" names both a node and a group, so connector ends naming it are ambiguous (${nodePath}, ${path}).`,
    });
  }
  for (const { id, path } of withPaths(file.stickies, ['stickies'])) {
    if (!ends.has(id) || reported.has(id)) continue;
    const nodePath = nodePaths.get(id);
    const other = nodePath ?? groupPaths.get(id);
    if (other === undefined) continue;
    reported.add(id);
    issues.push({
      code: 'ambiguous-end',
      path,
      subject: id,
      evidence: JSON.stringify(id),
      message: `Id "${id}" names both a ${nodePath === undefined ? 'group' : 'node'} and a sticky, so connector ends naming it are ambiguous (${other}, ${path}).`,
    });
  }
}

/**
 * One issue per duplicated id per scope, naming every location, plus ambiguous connector ends.
 * Empty when ids are unique. Takes any JSON value; a valid file is the usual input.
 */
export function checkDuplicateIds(input: unknown): Issue[] {
  const file = recordOf(input);
  const issues: Issue[] = [];
  for (const c of COLLECTIONS) checkScope(withPaths(file[c], [c]), issues);
  listOf(file.flows).forEach((flow, i) => {
    checkScope(withPaths(recordOf(flow).steps, ['flows', i, 'steps']), issues);
    checkScope(withPaths(recordOf(flow).branches, ['flows', i, 'branches']), issues);
  });
  for (const [ruleId, rule] of Object.entries(recordOf(file.rules))) {
    const record = recordOf(rule);
    checkScope(
      [
        ...withPaths(record.inputs, ['rules', ruleId, 'inputs']),
        ...withPaths(record.outputs, ['rules', ruleId, 'outputs']),
      ],
      issues,
    );
    checkScope(withPaths(record.rows, ['rules', ruleId, 'rows']), issues);
  }
  checkScope(databaseParts(file), issues);
  checkAmbiguousEnds(file, issues);
  return issues;
}
