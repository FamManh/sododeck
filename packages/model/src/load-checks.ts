/**
 * Identity checks on load (research R7, spec FR-020). A duplicated id makes every reference to it
 * ambiguous, so such a file is refused and never auto-fixed. Scopes: each collection, the steps
 * of one flow, the branches of one flow, the columns (inputs and outputs together) of one rule, the
 * rows of one rule, and the database parts (040, research R8): every table's columns, indexes and
 * checks plus the enums and their values, together across the deck. The same id in two different
 * scopes is allowed by the format, except a node and a group sharing an id that a connector end
 * names (050).
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
 * A connector end naming an id that is both a node's and a group's is ambiguous (050), so such a
 * file is refused. A node and a group sharing an id that no end names stays loadable (the format
 * always allowed it); the integrity report flags it.
 */
function checkAmbiguousEnds(file: SododeckFile, issues: Issue[]): void {
  const ends = new Set(file.edges.flatMap((edge) => [edge.from, edge.to]));
  const nodePaths = new Map<string, string>();
  file.nodes.forEach((node, i) => {
    if (!nodePaths.has(node.id)) nodePaths.set(node.id, `nodes.${String(i)}.id`);
  });
  const reported = new Set<string>();
  file.groups.forEach((group, i) => {
    const nodePath = nodePaths.get(group.id);
    if (nodePath === undefined || !ends.has(group.id) || reported.has(group.id)) return;
    reported.add(group.id);
    const path = `groups.${String(i)}.id`;
    issues.push({
      path,
      message: `Id "${group.id}" names both a node and a group, so connector ends naming it are ambiguous (${nodePath}, ${path}).`,
    });
  });
}

/** One issue per duplicated id per scope, naming every location. Empty when ids are unique. */
export function checkDuplicateIds(file: SododeckFile): Issue[] {
  const issues: Issue[] = [];
  for (const c of COLLECTIONS) checkScope(withPaths(file[c], c), issues);
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
