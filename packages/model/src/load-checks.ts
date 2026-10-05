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
import type { Issue, SododeckFile } from '@sododeck/schema';

import { cropOverflows, trimCrop } from './geometry';
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

/** An image whose crop ran past the picture edge and was cut back on load (057, rule C2). */
export interface TrimmedCrop {
  imageId: string;
  /** Where the crop is in the file, `images.<i>.crop`. */
  path: string;
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Cuts back every image crop that runs past the picture's right or bottom edge (057 contract C2),
 * so a hand-edited near-miss never refuses the deck (spec FR-016); a crop left with nothing to
 * show is dropped. Crops the schema would refuse anyway (wrong type, out of 0–1) are left for it to
 * report. `input` is not changed; the result shares everything it did not touch.
 */
export function trimCrops(input: unknown): { input: unknown; trimmed: TrimmedCrop[] } {
  const trimmed: TrimmedCrop[] = [];
  if (!isPlainRecord(input) || !Array.isArray(input.images)) return { input, trimmed };
  const images = input.images.map((image: unknown, i) => {
    if (!isPlainRecord(image) || !isPlainRecord(image.crop)) return image;
    const { x, y, width, height } = image.crop;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number' ||
      x < 0 ||
      y < 0 ||
      x >= 1 ||
      y >= 1 ||
      width <= 0 ||
      height <= 0 ||
      width > 1 ||
      height > 1 ||
      !cropOverflows({ x, y, width, height })
    ) {
      return image;
    }
    trimmed.push({ imageId: String(image.id), path: `images.${String(i)}.crop` });
    const cut = trimCrop({ x, y, width, height });
    if (cut.width <= 0 || cut.height <= 0) {
      const { crop: _dropped, ...rest } = image;
      return rest;
    }
    return { ...image, crop: cut };
  });
  return { input: trimmed.length > 0 ? { ...input, images } : input, trimmed };
}
