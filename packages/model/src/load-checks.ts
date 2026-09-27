/**
 * Identity checks on load (research R7, spec FR-020). A duplicated id makes every reference to it
 * ambiguous, so such a file is refused and never auto-fixed. Scopes: each collection, the steps
 * of one flow, the columns (inputs and outputs together) of one rule, and the rows of one rule.
 * The same id in two different scopes is allowed by the format.
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

/** One issue per duplicated id per scope, naming every location. Empty when ids are unique. */
export function checkDuplicateIds(file: SododeckFile): Issue[] {
  const issues: Issue[] = [];
  for (const c of COLLECTIONS) checkScope(withPaths(file[c], c), issues);
  file.flows.forEach((flow, i) => {
    checkScope(withPaths(flow.steps, `flows.${String(i)}.steps`), issues);
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
  return issues;
}
