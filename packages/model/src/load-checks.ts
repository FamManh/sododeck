/**
 * Identity checks on load (research R7, spec FR-020). A duplicated id makes every reference to it
 * ambiguous, so such a file is refused and never auto-fixed. Scopes: each collection, the steps
 * of one flow, the branches of one flow, the columns (inputs and outputs together) of one rule, the
 * rows of one rule, and the database parts (040, research R8): every table's columns, indexes and
 * checks plus the enums and their values, together across the deck. The same id in two different
 * scopes is allowed by the format, except a node, a group and a sticky sharing an id that a
 * connector end names (050, 053). An image id that equals one of those is refused earlier, by the
 * format's rule I5.
 */
import { toPointer, type Issue, type SododeckFile } from '@sododeck/schema';

import { COLLECTIONS } from './layout';

/** Every location of the id after the first is reported once, naming all of them (062). */
function checkScope(items: readonly { id: string; path: string }[], issues: Issue[]): void {
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

const withPaths = (items: readonly { id: string }[], prefix: readonly (string | number)[]) =>
  items.map((item, i) => ({ id: item.id, path: toPointer([...prefix, i, 'id']) }));

/** Every column, index and check of every node, then every enum and enum value, with paths. */
function databaseParts(file: SododeckFile): { id: string; path: string }[] {
  const parts: { id: string; path: string }[] = [];
  file.nodes.forEach((node, i) => {
    parts.push(...withPaths(node.columns ?? [], ['nodes', i, 'columns']));
    parts.push(...withPaths(node.indexes ?? [], ['nodes', i, 'indexes']));
    parts.push(...withPaths(node.checks ?? [], ['nodes', i, 'checks']));
  });
  (file.enums ?? []).forEach((item, i) => {
    parts.push({ id: item.id, path: toPointer(['enums', i, 'id']) });
    parts.push(...withPaths(item.values, ['enums', i, 'values']));
  });
  return parts;
}

/**
 * A connector end naming an id that is more than one of a node's, a group's and a sticky's is
 * ambiguous (050, 053), so such a file is refused. Objects sharing an id that no end names stay
 * loadable (the format always allowed it); the integrity report flags them.
 */
function checkAmbiguousEnds(file: SododeckFile, issues: Issue[]): void {
  const ends = new Set(file.edges.flatMap((edge) => [edge.from, edge.to]));
  const nodePaths = new Map<string, string>();
  file.nodes.forEach((node, i) => {
    if (!nodePaths.has(node.id)) nodePaths.set(node.id, toPointer(['nodes', i, 'id']));
  });
  const reported = new Set<string>();
  const groupPaths = new Map<string, string>();
  file.groups.forEach((group, i) => {
    const path = toPointer(['groups', i, 'id']);
    if (!groupPaths.has(group.id)) groupPaths.set(group.id, path);
    const nodePath = nodePaths.get(group.id);
    if (nodePath === undefined || !ends.has(group.id) || reported.has(group.id)) return;
    reported.add(group.id);
    issues.push({
      code: 'ambiguous-end',
      path,
      subject: group.id,
      evidence: JSON.stringify(group.id),
      message: `Id "${group.id}" names both a node and a group, so connector ends naming it are ambiguous (${nodePath}, ${path}).`,
    });
  });
  file.stickies.forEach((sticky, i) => {
    if (!ends.has(sticky.id) || reported.has(sticky.id)) return;
    const nodePath = nodePaths.get(sticky.id);
    const groupPath = groupPaths.get(sticky.id);
    const other = nodePath ?? groupPath;
    if (other === undefined) return;
    reported.add(sticky.id);
    const path = toPointer(['stickies', i, 'id']);
    issues.push({
      code: 'ambiguous-end',
      path,
      subject: sticky.id,
      evidence: JSON.stringify(sticky.id),
      message: `Id "${sticky.id}" names both a ${nodePath === undefined ? 'group' : 'node'} and a sticky, so connector ends naming it are ambiguous (${other}, ${path}).`,
    });
  });
}

/** One issue per duplicated id per scope, naming every location. Empty when ids are unique. */
export function checkDuplicateIds(file: SododeckFile): Issue[] {
  const issues: Issue[] = [];
  for (const c of COLLECTIONS) checkScope(withPaths(file[c] ?? [], [c]), issues);
  file.flows.forEach((flow, i) => {
    checkScope(withPaths(flow.steps, ['flows', i, 'steps']), issues);
    checkScope(withPaths(flow.branches ?? [], ['flows', i, 'branches']), issues);
  });
  for (const [ruleId, rule] of Object.entries(file.rules)) {
    checkScope(
      [
        ...withPaths(rule.inputs, ['rules', ruleId, 'inputs']),
        ...withPaths(rule.outputs, ['rules', ruleId, 'outputs']),
      ],
      issues,
    );
    checkScope(withPaths(rule.rows, ['rules', ruleId, 'rows']), issues);
  }
  checkScope(databaseParts(file), issues);
  checkAmbiguousEnds(file, issues);
  return issues;
}
