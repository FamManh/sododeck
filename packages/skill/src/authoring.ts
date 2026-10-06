/**
 * Authoring checks (027 research R5): advice for decks written by an AI agent, reported by the
 * skill's `lint` only. Every check is pure, returns warnings in the 062 entry shape, and points
 * `path` at the offending value. Thresholds are part of the skill's contract
 * (`contracts/scripts-cli.md`); change them together with `references/taste.md`.
 */
import { CATALOGUE, type AuthoringCode, type ProblemEntry } from '@sododeck/model';
import type { Edge, Node, SododeckFile } from '@sododeck/schema';

export type Detail = 'faithful' | 'balanced' | 'simplified';
export type Mode = 'new' | 'update' | 'codebase' | 'text';

export const DETAILS: readonly Detail[] = ['faithful', 'balanced', 'simplified'];
export const MODES: readonly Mode[] = ['new', 'update', 'codebase', 'text'];

/**
 * Most cards one level (one drill-in screen) should hold, only when the user asked for a detail
 * dial. No dial draws the system at the detail it really has. Hand-laid decks group cards in
 * frames, so a screen holds far more than an auto-laid one before it stops reading (ADR 0042).
 */
export const LEVEL_BUDGET: Readonly<Partial<Record<Detail, number>>> = {
  faithful: 60,
  balanced: 30,
  simplified: 10,
};

/**
 * The box the layout checks assume for a card without `size`. The real height depends on the
 * fields the card shows, which only the app measures; 96 px covers a title, a type line and one
 * field row, and the 6 px margin below absorbs the rest.
 */
export const CARD_BOX = { width: 184, height: 96 } as const;
export const STICKY_BOX = { width: 200, height: 200 } as const;
/** Padding a group frame adds around its cards: the title bar on top, a margin elsewhere. */
export const FRAME_PADDING = { side: 24, top: 40 } as const;
/** How close (px) a line may pass a card before it counts as running over it. */
export const LINE_MARGIN = 6;

/** Characters a card or group title shows before the card truncates it (240 px default card). */
export const TITLE_BUDGET = 40;
export const CONNECTOR_LABEL_BUDGET = 32;
export const ID_MAX = 32;
/** More connectors than this on one card makes it a hub that crosses the whole diagram. */
export const HUB_MAX = 8;

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
  const out: ProblemEntry[] = [];
  file.nodes.forEach((node, index) => {
    if (node.position !== undefined) return;
    out.push(
      entry(
        'card-without-position',
        `/nodes/${String(index)}`,
        node.id,
        `Card "${node.title}" has no position.`,
      ),
    );
  });
  return out;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const centre = (b: Box) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Whether the segment a→b passes within `LINE_MARGIN` of `box` (sampled; boxes are ≥ 24 px). */
function segmentHits(a: { x: number; y: number }, b: { x: number; y: number }, box: Box): boolean {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const samples = Math.max(2, Math.ceil(length / 4));
  for (let k = 1; k < samples; k += 1) {
    const t = k / samples;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (
      x > box.x0 - LINE_MARGIN &&
      x < box.x1 + LINE_MARGIN &&
      y > box.y0 - LINE_MARGIN &&
      y < box.y1 + LINE_MARGIN
    ) {
      return true;
    }
  }
  return false;
}

/** The level a card is drawn on: the screen of its parent card, or the top. */
const levelOf = (node: Node) => node.parent ?? '';

/**
 * Card boxes per level, group frames per level (stored frame, else the cards' bounding box plus
 * padding, nested groups included), sticky boxes on the top level.
 */
function layoutBoxes(file: SododeckFile) {
  const cards = new Map<string, { box: Box; level: string; group: string | undefined }>();
  for (const node of file.nodes) {
    if (node.position === undefined) continue;
    const size = node.size ?? CARD_BOX;
    const { x, y } = node.position;
    cards.set(node.id, {
      box: { x0: x, y0: y, x1: x + size.width, y1: y + size.height },
      level: levelOf(node),
      group: node.group,
    });
  }
  const parentOf = new Map(file.groups.map((g) => [g.id, g.parent]));
  /** Every group the card sits in, innermost first. */
  const chain = (group: string | undefined): string[] => {
    const out: string[] = [];
    let current = group;
    while (current !== undefined && !out.includes(current)) {
      out.push(current);
      current = parentOf.get(current);
    }
    return out;
  };
  const frames = new Map<string, { box: Box; level: string; members: Set<string> }>();
  for (const group of file.groups) {
    const members = [...cards].filter(([, c]) => chain(c.group).includes(group.id));
    const ids = new Set(members.map(([id]) => id));
    if (group.position !== undefined && group.size !== undefined) {
      const { x, y } = group.position;
      const level = members[0]?.[1].level ?? '';
      frames.set(group.id, {
        box: { x0: x, y0: y, x1: x + group.size.width, y1: y + group.size.height },
        level,
        members: ids,
      });
      continue;
    }
    if (members.length === 0) continue;
    const boxes = members.map(([, c]) => c.box);
    frames.set(group.id, {
      box: {
        x0: Math.min(...boxes.map((b) => b.x0)) - FRAME_PADDING.side,
        y0: Math.min(...boxes.map((b) => b.y0)) - FRAME_PADDING.top,
        x1: Math.max(...boxes.map((b) => b.x1)) + FRAME_PADDING.side,
        y1: Math.max(...boxes.map((b) => b.y1)) + FRAME_PADDING.side,
      },
      level: members[0]?.[1].level ?? '',
      members: ids,
    });
  }
  const stickies = new Map<string, Box>();
  for (const sticky of file.stickies) {
    if (sticky.position === undefined) continue;
    const size = sticky.size ?? STICKY_BOX;
    const { x, y } = sticky.position;
    stickies.set(sticky.id, { x0: x, y0: y, x1: x + size.width, y1: y + size.height });
  }
  return { cards, frames, stickies, chain };
}

/** The bends of `edge` between centres `a` and `b`, as the schema defines waypoints. */
function polyline(edge: Edge, a: { x: number; y: number }, b: { x: number; y: number }) {
  const bends = (edge.route?.waypoints ?? []).map((w) => ({
    x: 'x' in w && w.x !== undefined ? a.x + w.x * (b.x - a.x) : (a.x + b.x) / 2 + (w.dx ?? 0),
    y: 'y' in w && w.y !== undefined ? a.y + w.y * (b.y - a.y) : (a.y + b.y) / 2 + (w.dy ?? 0),
  }));
  return [a, ...bends, b];
}

function checkLayout(file: SododeckFile): ProblemEntry[] {
  const { cards, frames, stickies, chain } = layoutBoxes(file);
  const out: ProblemEntry[] = [];
  const endBox = (id: string): { box: Box; level: string } | undefined => {
    const card = cards.get(id);
    if (card !== undefined) return card;
    const frame = frames.get(id);
    if (frame !== undefined) return frame;
    const sticky = stickies.get(id);
    return sticky === undefined ? undefined : { box: sticky, level: '' };
  };

  file.edges.forEach((edge, index) => {
    const from = endBox(edge.from);
    const to = endBox(edge.to);
    if (from === undefined || to === undefined || from.level !== to.level) return;
    const points = polyline(edge, centre(from.box), centre(to.box));
    const obstacles: [string, Box][] = [
      ...[...cards]
        .filter(([, c]) => c.level === from.level)
        .map(([id, c]): [string, Box] => [id, c.box]),
      ...(from.level === '' ? [...stickies] : []),
    ];
    // A card inside a group frame the connector ends on is not in the way.
    const inEndGroup = (id: string) => {
      const groups = chain(cards.get(id)?.group);
      return groups.includes(edge.from) || groups.includes(edge.to);
    };
    for (const [id, box] of obstacles) {
      if (id === edge.from || id === edge.to || inEndGroup(id)) continue;
      const hit = points.some((p, k) => {
        const q = points[k + 1];
        return q !== undefined && segmentHits(p, q, box);
      });
      if (!hit) continue;
      out.push(
        entry(
          'connector-crosses-card',
          `/edges/${String(index)}`,
          edge.id,
          `Connector "${edge.id}" (${edge.from} → ${edge.to}) runs over "${id}".`,
        ),
      );
    }
  });

  const groupIndex = new Map(file.groups.map((g, i) => [g.id, i]));
  const parentOf = new Map(file.groups.map((g) => [g.id, g.parent]));
  for (const [groupId, frame] of frames) {
    for (const [cardId, card] of cards) {
      if (card.level !== frame.level || frame.members.has(cardId)) continue;
      if (!overlaps(frame.box, card.box)) continue;
      out.push(
        entry(
          'frame-covers-card',
          `/groups/${String(groupIndex.get(groupId) ?? 0)}`,
          groupId,
          `The frame of group "${groupId}" covers card "${cardId}", which is not in it.`,
        ),
      );
    }
    for (const [stickyId, box] of stickies) {
      if (frame.level !== '' || !overlaps(frame.box, box)) continue;
      out.push(
        entry(
          'frame-covers-card',
          `/groups/${String(groupIndex.get(groupId) ?? 0)}`,
          groupId,
          `The frame of group "${groupId}" covers note "${stickyId}".`,
        ),
      );
    }
  }
  // Sibling frames (same parent group, same level) never share space; nested frames may.
  const list = [...frames];
  list.forEach(([a, fa], i) => {
    for (const [b, fb] of list.slice(i + 1)) {
      if (fa.level !== fb.level || parentOf.get(a) !== parentOf.get(b)) continue;
      if (!overlaps(fa.box, fb.box)) continue;
      out.push(
        entry(
          'frames-overlap',
          `/groups/${String(groupIndex.get(b) ?? 0)}`,
          b,
          `The frames of groups "${a}" and "${b}" overlap.`,
        ),
      );
    }
  });
  return out;
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

function checkLevels(file: SododeckFile, detail: Detail | undefined): ProblemEntry[] {
  const budget = detail === undefined ? undefined : LEVEL_BUDGET[detail];
  if (budget === undefined) return [];
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
        `${String(indexes.length)} cards on ${where}; the ${String(detail)} detail level allows ${String(budget)}.`,
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

/**
 * Hub cards: measured on a real 56-card deck, a card with many connectors crosses the whole
 * diagram. (`group-by-kind` from the same measurement is retired: hand-laid decks group by role,
 * ADR 0042.)
 */
function checkHubs(file: SododeckFile): ProblemEntry[] {
  const out: ProblemEntry[] = [];
  const degree = new Map<string, number>();
  for (const edge of file.edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  file.nodes.forEach((node, index) => {
    const count = degree.get(node.id) ?? 0;
    if (count > HUB_MAX) {
      out.push(
        entry(
          'hub-card',
          `/nodes/${String(index)}`,
          node.id,
          `Card "${node.title}" has ${String(count)} connectors (more than ${String(HUB_MAX)}).`,
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
    ...checkPositions(file),
    ...checkLayout(file),
    ...checkOrphans(file),
    ...checkDuplicateTitles(file),
    ...checkLabels(file),
    ...checkLevels(file, options.detail),
    ...checkHubs(file),
    ...(mode === 'codebase' ? checkSources(file) : []),
  ];
}
