/**
 * Applying an import (044 research R6, FR-021): one `editor.batch`, so one change and one undo
 * step: the dialect when FR-007 applies, the enums (their real ids replace the plan's in
 * `enumRef`), the tables, relationships and groups through `pasteFragment` (new ids for every
 * object and part, references remapped), the parent card, the stickies and the description. The
 * fragment is checked before anything is written. Main thread; writes only through the model.
 */
import {
  createDeck,
  createEditor,
  getObject,
  NEW_DECK_PACKS,
  parseFragment,
  serializeFragment,
  toJSON,
  type DeckEditor,
  type Fragment,
} from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import type { Placement } from './place-import';
import type { ImportPlan } from './types';

export interface AppliedImport {
  nodes: Id[];
  edges: Id[];
  groups: Id[];
  enums: Id[];
  stickies: Id[];
  /** Plan id → deck id for tables, columns, edges, groups and enums. */
  idMap: Map<Id, Id>;
}

export interface ApplyTarget {
  /** The database card the tables go into (FR-019). */
  cardId?: Id;
  /** The view pasted into (positions are written there too when it is not the base view). */
  viewId?: Id;
}

export class ImportApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportApplyError';
  }
}

/** The plan's fragment with positions and frames from `placement`. */
function placedFragment(plan: ImportPlan, placement: Placement): Fragment {
  const { deck } = plan.fragment;
  return {
    sododeckFragment: 1,
    deck: {
      ...deck,
      nodes: deck.nodes.map((node) => {
        const position = placement.positions[node.id];
        return position === undefined ? node : { ...node, position };
      }),
      groups: deck.groups.map((group) => {
        const frame = placement.frames[group.id];
        return frame === undefined
          ? group
          : { ...group, position: frame.position, size: frame.size };
      }),
    },
  };
}

export function applyImport(
  editor: DeckEditor,
  plan: ImportPlan,
  placement: Placement,
  target: ApplyTarget = {},
): AppliedImport {
  const placed = placedFragment(plan, placement);
  // Validate first: Yjs cannot roll back a batch that throws halfway.
  if (parseFragment(serializeFragment(placed)) === null) {
    throw new ImportApplyError('The import produced an invalid schema');
  }
  if (target.cardId !== undefined && getObject(editor.doc, 'nodes', target.cardId) === undefined) {
    throw new ImportApplyError('The database card no longer exists');
  }

  return editor.batch(() => {
    if (plan.setDialect !== null) editor.setDialect(plan.setDialect);
    const idMap = new Map<Id, Id>();
    const enums = plan.enums.map(({ planId, id: _id, ...data }) => {
      const id = editor.addEnum(data);
      idMap.set(planId, id);
      return id;
    });
    const fragment: Fragment = {
      ...placed,
      deck: {
        ...placed.deck,
        nodes: placed.deck.nodes.map((node) =>
          node.columns === undefined
            ? node
            : {
                ...node,
                columns: node.columns.map((c) => {
                  if (c.enumRef === undefined) return c;
                  const real = idMap.get(c.enumRef);
                  return real === undefined ? c : { ...c, enumRef: real };
                }),
              },
        ),
      },
    };
    const pasted = editor.pasteFragment(fragment, {
      offset: { x: 0, y: 0 },
      ...(target.viewId === undefined ? {} : { viewId: target.viewId }),
    });

    // Paste returns ids in fragment order; columns, indexes and checks keep their order too.
    fragment.deck.nodes.forEach((node, i) => {
      const id = pasted.nodes[i];
      if (id === undefined) return;
      idMap.set(node.id, id);
      const stored = getObject(editor.doc, 'nodes', id);
      (node.columns ?? []).forEach((c, k) => {
        const real = stored?.columns?.[k]?.id;
        if (real !== undefined) idMap.set(c.id, real);
      });
    });
    fragment.deck.edges.forEach((edge, i) => {
      const id = pasted.edges[i];
      if (id !== undefined) idMap.set(edge.id, id);
    });
    fragment.deck.groups.forEach((group, i) => {
      const id = pasted.groups[i];
      if (id !== undefined) idMap.set(group.id, id);
    });

    if (target.cardId !== undefined) {
      for (const id of pasted.nodes) editor.update('nodes', id, { parent: target.cardId });
    }
    const stickies = plan.stickies.map((sticky, i) =>
      editor.add('stickies', {
        text: sticky.text,
        ...(sticky.color === undefined ? {} : { color: sticky.color }),
        ...(placement.stickies[i] === undefined ? {} : { position: placement.stickies[i] }),
      }),
    );
    if (plan.description !== undefined) editor.updateMeta({ description: plan.description });
    return {
      nodes: pasted.nodes,
      edges: pasted.edges,
      groups: pasted.groups,
      enums,
      stickies,
      idMap,
    };
  });
}

/**
 * The import as a new deck file (FR-022): an empty deck named `name` with the import's dialect,
 * the plan applied, serialised. The open deck is not touched; the caller adds the file to the
 * library.
 */
export function importAsNewDeck(
  plan: ImportPlan,
  placement: Placement,
  name: string,
): SododeckFile {
  const doc = createDeck();
  const editor = createEditor(doc);
  try {
    editor.updateMeta({ name });
    for (const pack of NEW_DECK_PACKS) editor.setPackOn(pack, true);
    applyImport(editor, plan, placement);
    return toJSON(doc);
  } finally {
    editor.destroy();
  }
}
