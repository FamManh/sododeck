/**
 * Authoring checks (027 research R5): advice for decks written by an AI agent, reported by the
 * skill's `lint` only. Every check is pure, returns warnings in the 062 entry shape, and points
 * `path` at the offending value. Thresholds are part of the skill's contract
 * (`contracts/scripts-cli.md`); change them together with `references/taste.md`.
 */
import { CATALOGUE, type AuthoringCode, type ProblemEntry } from '@sododeck/model';
import type { Node, SododeckFile } from '@sododeck/schema';

export type Detail = 'faithful' | 'balanced' | 'simplified';
export type Mode = 'new' | 'update' | 'codebase' | 'text';

export const DETAILS: readonly Detail[] = ['faithful', 'balanced', 'simplified'];
export const MODES: readonly Mode[] = ['new', 'update', 'codebase', 'text'];

/** Most cards one level (one drill-in screen) should hold, per detail dial. */
export const LEVEL_BUDGET: Readonly<Record<Detail, number>> = {
  faithful: 24,
  balanced: 12,
  simplified: 7,
};

/** Characters a card or group title shows before the card truncates it (240 px default card). */
export const TITLE_BUDGET = 40;
export const CONNECTOR_LABEL_BUDGET = 32;
export const ID_MAX = 32;

export interface AuthoringOptions {
  detail?: Detail;
  mode?: Mode;
}

function entry(
  code: AuthoringCode,
  path: string,
  subject: string | undefined,
  message: string,
  evidence?: string,
): ProblemEntry {
  return {
    code,
    severity: 'warning',
    path,
    ...(subject === undefined ? {} : { subject }),
    message,
    ...(evidence === undefined ? {} : { evidence }),
    fix: CATALOGUE[code].fix,
  };
}

/** Lower-case slug of a title, as an agent would derive an id from it. */
export function slugOf(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Why `id` is not a short slug, or undefined when it is one. */
function idProblem(id: string, title: string | undefined): string | undefined {
  if (id.length > ID_MAX)
    return `is ${String(id.length)} characters long (at most ${String(ID_MAX)})`;
  if (/[A-Z]/.test(id)) return 'has upper-case letters';
  if (/[_.:-]{2,}/.test(id)) return 'has repeated separators';
  if (title !== undefined && wordCount(title) >= 4 && id === slugOf(title)) {
    return 'is the whole title turned into a slug, so it reads like it would change on rename';
  }
  return undefined;
}

function checkIds(file: SododeckFile): ProblemEntry[] {
  const out: ProblemEntry[] = [];
  const visit = (collection: string, items: readonly { id: string; title?: string }[]) => {
    items.forEach((item, index) => {
      const why = idProblem(item.id, item.title);
      if (why !== undefined) {
        out.push(
          entry(
            'id-style',
            `/${collection}/${String(index)}/id`,
            item.id,
            `Id "${item.id}" ${why}.`,
            JSON.stringify(item.id),
          ),
        );
      }
    });
  };
  visit('nodes', file.nodes);
  visit('groups', file.groups);
  visit('edges', file.edges);
  visit('flows', file.flows);
  file.flows.forEach((flow, f) => {
    visit(`flows/${String(f)}/steps`, flow.steps);
  });
  return out;
}

function checkPositions(file: SododeckFile): ProblemEntry[] {
  const placed = file.nodes.filter((node) => node.position !== undefined).length;
  if (placed === 0 || placed === file.nodes.length) return [];
  const firstUnplaced = file.nodes.findIndex((node) => node.position === undefined);
  const node = file.nodes[firstUnplaced];
  return [
    entry(
      'positions-mixed',
      `/nodes/${String(firstUnplaced)}`,
      node?.id,
      `${String(placed)} of ${String(file.nodes.length)} cards have a position.`,
    ),
  ];
}

function checkOrphans(file: SododeckFile): ProblemEntry[] {
  const connected = new Set<string>();
  for (const edge of file.edges) {
    connected.add(edge.from);
    connected.add(edge.to);
  }
  const parents = new Set(
    file.nodes.flatMap((node) => (node.parent === undefined ? [] : [node.parent])),
  );
  const touched = new Set(
    file.flows.flatMap((flow) =>
      flow.steps.flatMap((step) => (step.touches ?? []).map((t) => t.table)),
    ),
  );
  const out: ProblemEntry[] = [];
  file.nodes.forEach((node, index) => {
    if (connected.has(node.id) || node.group !== undefined) return;
    if (parents.has(node.id) || touched.has(node.id)) return;
    out.push(
      entry(
        'orphan-card',
        `/nodes/${String(index)}`,
        node.id,
        `Card "${node.title}" has no connector, no group and nothing below it.`,
      ),
    );
  });
  return out;
}

const titleKey = (title: string) => title.trim().replace(/\s+/g, ' ').toLowerCase();

function checkDuplicateTitles(file: SododeckFile): ProblemEntry[] {
  const seen = new Map<string, Node>();
  const out: ProblemEntry[] = [];
  file.nodes.forEach((node, index) => {
    const key = `${node.group ?? ''}\u0000${node.parent ?? ''}\u0000${titleKey(node.title)}`;
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, node);
      return;
    }
    out.push(
      entry(
        'duplicate-title',
        `/nodes/${String(index)}/title`,
        node.id,
        `Cards "${first.id}" and "${node.id}" are both titled "${node.title}" in the same group and level.`,
        JSON.stringify(node.title),
      ),
    );
  });
  return out;
}

function checkLabels(file: SododeckFile): ProblemEntry[] {
  const out: ProblemEntry[] = [];
  const over = (
    path: string,
    subject: string,
    what: string,
    text: string,
    budget: number,
  ): void => {
    if (text.length <= budget) return;
    out.push(
      entry(
        'label-too-long',
        path,
        subject,
        `${what} has ${String(text.length)} characters (budget ${String(budget)}).`,
        JSON.stringify(text),
      ),
    );
  };
  file.nodes.forEach((node, i) => {
    over(`/nodes/${String(i)}/title`, node.id, 'Card title', node.title, TITLE_BUDGET);
  });
  file.groups.forEach((group, i) => {
    over(`/groups/${String(i)}/title`, group.id, 'Group title', group.title, TITLE_BUDGET);
  });
  file.edges.forEach((edge, i) => {
    if (edge.label !== undefined) {
      over(
        `/edges/${String(i)}/label`,
        edge.id,
        'Connector label',
        edge.label,
        CONNECTOR_LABEL_BUDGET,
      );
    }
  });
  return out;
}

function checkLevels(file: SododeckFile, detail: Detail): ProblemEntry[] {
  const budget = LEVEL_BUDGET[detail];
  const levels = new Map<string, number[]>();
  file.nodes.forEach((node, index) => {
    const key = node.parent ?? '';
    const list = levels.get(key) ?? [];
    list.push(index);
    levels.set(key, list);
  });
  const out: ProblemEntry[] = [];
  for (const [parent, indexes] of levels) {
    if (indexes.length <= budget) continue;
    const first = indexes[budget] ?? 0;
    const where = parent === '' ? 'the top level' : `the level under "${parent}"`;
    out.push(
      entry(
        'level-over-budget',
        `/nodes/${String(first)}`,
        parent === '' ? undefined : parent,
        `${String(indexes.length)} cards on ${where}; the ${detail} detail level allows ${String(budget)}.`,
      ),
    );
  }
  return out;
}

function checkSources(file: SododeckFile): ProblemEntry[] {
  const out: ProblemEntry[] = [];
  file.nodes.forEach((node, i) => {
    if ((node.links ?? []).length === 0) {
      out.push(
        entry(
          'connector-without-source',
          `/nodes/${String(i)}`,
          node.id,
          `Card "${node.title}" has no source link.`,
        ),
      );
    }
  });
  file.edges.forEach((edge, i) => {
    if ((edge.links ?? []).length === 0) {
      out.push(
        entry(
          'connector-without-source',
          `/edges/${String(i)}`,
          edge.id,
          `Connector "${edge.id}" (${edge.from} → ${edge.to}) has no source link.`,
        ),
      );
    }
  });
  return out;
}

/** Every authoring warning for `file` (unsorted; `lint` sorts the whole report). */
export function authoringChecks(
  file: SododeckFile,
  options: AuthoringOptions = {},
): ProblemEntry[] {
  const mode = options.mode ?? 'new';
  return [
    ...checkIds(file),
    ...(mode === 'update' ? [] : checkPositions(file)),
    ...checkOrphans(file),
    ...checkDuplicateTitles(file),
    ...checkLabels(file),
    ...checkLevels(file, options.detail ?? 'balanced'),
    ...(mode === 'codebase' ? checkSources(file) : []),
  ];
}
