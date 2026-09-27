import type { SododeckFile } from '@sododeck/schema';

import { fromY } from '../convert';
import { metaMap } from '../deck';
import type { EditContext } from '../editor';
import { assertValid, validateObject } from '../validate';
import { applyPatch, writePatch } from './patch';
import type { Patch } from './types';

export type MetaPatch = Patch<Pick<SododeckFile, 'name' | 'description' | 'tags'>>;

const FIELDS = ['name', 'description', 'tags'] as const;

/** Sets or clears (`null`) the deck's name, description and tags. */
export function updateMeta(ctx: EditContext, patch: MetaPatch): void {
  const meta = metaMap(ctx.doc);
  const current: Record<string, unknown> = {};
  for (const key of FIELDS) {
    const value = meta.get(key);
    if (value !== undefined) current[key] = fromY(value);
  }
  const { candidate, changed } = applyPatch(current, patch, ['$schema', 'version']);
  if (changed.length === 0) return;
  assertValid(validateObject('meta', candidate));
  ctx.transact(() => {
    writePatch(meta, candidate, changed);
  });
}
