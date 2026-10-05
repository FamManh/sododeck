/**
 * Identity checks on load (research R7, spec FR-020). A duplicated id makes every reference to it
 * ambiguous, so such a file is refused and never auto-fixed. Scopes: each collection, the steps
 * of one flow, the branches of one flow, the columns (inputs and outputs together) of one rule, the
 * rows of one rule, and the database parts (040, research R8): every table's columns, indexes and
 * checks plus the enums and their values, together across the deck. The same id in two different
 * scopes is allowed by the format, except a node, a group and a sticky sharing an id that a
 * connector end names (050, 053, 055: images too).
 */
import type { Issue, SododeckFile } from '@sododeck/schema';

import { COLLECTIONS } from './layout';

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
        path: list[1] ?? '',
        message: `Id "${id}" is used more than once (${list.join(', ')}).`,
      });
    }
  }
}

const withPaths = (items: readonly { id: string }[], prefix: string) =>
  items.map((item, i) => ({ id: item.id, path: `${prefix}.${String(i)}.id` }));

/** Every column, index and check of every node, then every enum and enum value, with paths. */
function databaseParts(file: SododeckFile): { id: string; path: string }[] {
  const parts: { id: string; path: string }[] = [];
  file.nodes.forEach((node, i) => {
    const prefix = `nodes.${String(i)}`;
    parts.push(...withPaths(node.columns ?? [], `${prefix}.columns`));
    parts.push(...withPaths(node.indexes ?? [], `${prefix}.indexes`));
    parts.push(...withPaths(node.checks ?? [], `${prefix}.checks`));
  });
  (file.enums ?? []).forEach((item, i) => {
    parts.push({ id: item.id, path: `enums.${String(i)}.id` });
    parts.push(...withPaths(item.values, `enums.${String(i)}.values`));
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
    if (!nodePaths.has(node.id)) nodePaths.set(node.id, `nodes.${String(i)}.id`);
  });
  const reported = new Set<string>();
  const groupPaths = new Map<string, string>();
  const stickyPaths = new Map<string, string>();
  file.groups.forEach((group, i) => {
    const path = `groups.${String(i)}.id`;
    if (!groupPaths.has(group.id)) groupPaths.set(group.id, path);
    const nodePath = nodePaths.get(group.id);
    if (nodePath === undefined || !ends.has(group.id) || reported.has(group.id)) return;
    reported.add(group.id);
    issues.push({
      path,
      message: `Id "${group.id}" names both a node and a group, so connector ends naming it are ambiguous (${nodePath}, ${path}).`,
    });
  });
  file.stickies.forEach((sticky, i) => {
    if (!stickyPaths.has(sticky.id)) stickyPaths.set(sticky.id, `stickies.${String(i)}.id`);
    if (!ends.has(sticky.id) || reported.has(sticky.id)) return;
    const nodePath = nodePaths.get(sticky.id);
    const groupPath = groupPaths.get(sticky.id);
    const other = nodePath ?? groupPath;
    if (other === undefined) return;
    reported.add(sticky.id);
    const path = `stickies.${String(i)}.id`;
    issues.push({
      path,
      message: `Id "${sticky.id}" names both a ${nodePath === undefined ? 'group' : 'node'} and a sticky, so connector ends naming it are ambiguous (${other}, ${path}).`,
    });
  });
  (file.images ?? []).forEach((image, i) => {
    if (!ends.has(image.id) || reported.has(image.id)) return;
    const found: [string, string | undefined][] = [
      ['node', nodePaths.get(image.id)],
      ['group', groupPaths.get(image.id)],
      ['sticky', stickyPaths.get(image.id)],
    ];
    const clash = found.find(([, at]) => at !== undefined);
    if (clash === undefined) return;
    reported.add(image.id);
    const path = `images.${String(i)}.id`;
    issues.push({
      path,
      message: `Id "${image.id}" names both a ${clash[0]} and an image, so connector ends naming it are ambiguous (${clash[1] ?? ''}, ${path}).`,
    });
  });
}

/** One issue per duplicated id per scope, naming every location. Empty when ids are unique. */
export function checkDuplicateIds(file: SododeckFile): Issue[] {
  const issues: Issue[] = [];
  for (const c of COLLECTIONS) checkScope(withPaths(file[c] ?? [], c), issues);
  file.flows.forEach((flow, i) => {
    checkScope(withPaths(flow.steps, `flows.${String(i)}.steps`), issues);
    checkScope(withPaths(flow.branches ?? [], `flows.${String(i)}.branches`), issues);
  });
  for (const [ruleId, rule] of Object.entries(file.rules)) {
    const prefix = `rules.${ruleId}`;
    checkScope(
      [
        ...withPaths(rule.inputs, `${prefix}.inputs`),
        ...withPaths(rule.outputs, `${prefix}.outputs`),
      ],
      issues,
    );
    checkScope(withPaths(rule.rows, `${prefix}.rows`), issues);
  }
  checkScope(databaseParts(file), issues);
  checkAmbiguousEnds(file, issues);
  return issues;
}
