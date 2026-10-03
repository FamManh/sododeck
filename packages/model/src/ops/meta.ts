import type { SododeckFile } from '@sododeck/schema';

import { fromY } from '../convert';
import { metaMap } from '../layout';
import { readMeta } from '../read';
import type { EditContext } from './context';
import { assertValid, validateObject } from '../validate';
import { writeFields } from '../write';
import { applyPatch } from './patch';
import type { Patch } from './types';

export type MetaPatch = Patch<Pick<SododeckFile, 'name' | 'description' | 'tags' | 'swatches'>>;

const FIELDS = ['name', 'description', 'tags', 'swatches'] as const;

/** Sets or clears (`null`) the deck's name, description and tags. */
export function updateMeta(ctx: EditContext, patch: MetaPatch): void {
  const meta = metaMap(ctx.doc);
  const stored = readMeta(ctx.doc) as Record<string, unknown>;
  const current: Record<string, unknown> = {};
  for (const key of FIELDS) if (stored[key] !== undefined) current[key] = stored[key];
  // `swatches` is always stored, even empty (020); a patch compares against the stored list.
  const swatches = meta.get('swatches');
  if (swatches !== undefined) current.swatches = fromY(swatches);
  const { candidate, changed } = applyPatch(current, patch, ['$schema', 'version']);
  if (changed.length === 0) return;
  assertValid(validateObject('meta', candidate));
  ctx.transact(() => {
    writeFields(meta, 'meta', candidate, changed);
  }, 'meta');
}
