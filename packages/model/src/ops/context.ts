/** What operation modules get from the editor, and lookups that throw `not-found`. */
import type { Id } from '@sododeck/schema';
import type * as Y from 'yjs';

import type { YObject } from '../convert';
import { DeckEditError } from '../errors';
import type { IdPrefix } from '../ids';
import { indexOfId, type DeckDoc } from '../layout';

/** What operation modules need from the editor. */
export interface EditContext {
  readonly doc: DeckDoc;
  /**
   * Runs `fn` in one transaction with the editor's origin. `key` names the object a field edit
   * targets (a typing burst on one key is one undo step); omit it for structural edits (add,
   * remove, move), which are always a step of their own.
   */
  transact<T>(fn: () => T, key?: string): T;
  allocate(prefix: IdPrefix, reserved?: ReadonlySet<Id>): Id;
}

/** Origins of every live editor, so `observeDeck` can tell local edits from remote ones. */
export const editorOrigins = new WeakSet<object>();

export function findIndexById(array: Y.Array<YObject>, id: Id, what: string): number {
  const index = indexOfId(array, id);
  if (index === -1) {
    throw new DeckEditError('not-found', [
      { path: '', message: `${what} "${id}" does not exist.` },
    ]);
  }
  return index;
}

export function getMapById(array: Y.Array<YObject>, id: Id, what: string): YObject {
  return array.get(findIndexById(array, id, what));
}
