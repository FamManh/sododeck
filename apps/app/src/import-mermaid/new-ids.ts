/**
 * Fresh ids for an imported deck (FR-009): the model's generator (`<prefix>-<random>`), never the
 * Mermaid ids or titles, which are used only inside a parser to join links.
 */
import { defaultNewId, type IdPrefix } from '@sododeck/model';
import type { Id } from '@sododeck/schema';

export interface ImportIds {
  /** An id not handed out before by this source. */
  next(prefix: IdPrefix): Id;
}

export function createImportIds(newId: (prefix: string) => Id = defaultNewId): ImportIds {
  const used = new Set<Id>();
  return {
    next(prefix) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const id = newId(prefix);
        if (!used.has(id)) {
          used.add(id);
          return id;
        }
      }
      throw new Error('Could not generate a unique id');
    },
  };
}
