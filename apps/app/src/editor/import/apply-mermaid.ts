/**
 * Applying a Mermaid import to the open deck: the worker's placed deck file goes in as a
 * fragment through `pasteFragment` (new ids for every card, connector and group, references
 * remapped), then its flows are added with their steps on the new connectors. One
 * `editor.batch`, so one change and one undo step. The fragment is checked before anything is
 * written. Main thread; writes only through the model.
 *
 * Placement: the imported cluster keeps its own layout and is moved as a whole so that its
 * top-left corner sits `IMPORT_GAP` to the right of everything already on the canvas, top edges
 * aligned. An empty deck keeps the cluster where the layout put it. Nothing it brings overlaps
 * an existing card or group frame.
 */
import {
  fragmentOrigin,
  parseFragment,
  serializeFragment,
  toFragment,
  type DeckEditor,
  type Fragment,
} from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import type { Rect } from '../canvas-geometry';

/** Space between what the deck already shows and the imported cluster, in canvas px. */
export const IMPORT_GAP = 160;

export interface AppliedMermaid {
  nodes: Id[];
  edges: Id[];
  groups: Id[];
  flows: Id[];
}

export class MermaidApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MermaidApplyError';
  }
}

/**
 * How far to move the fragment so that it lands right of `existing` (top edges aligned); no move
 * when the deck has nothing yet.
 */
export function mermaidOffset(
  fragment: Fragment,
  existing: readonly Rect[],
): { x: number; y: number } {
  if (existing.length === 0) return { x: 0, y: 0 };
  const right = Math.max(...existing.map((r) => r.x + r.width));
  const top = Math.min(...existing.map((r) => r.y));
  const origin = fragmentOrigin(fragment);
  return { x: right + IMPORT_GAP - origin.x, y: top - origin.y };
}

export function applyMermaid(
  editor: DeckEditor,
  file: SododeckFile,
  target: { existing: readonly Rect[]; viewId?: Id },
): AppliedMermaid {
  const fragment = toFragment(file, {
    nodes: file.nodes.map((n) => n.id),
    groups: file.groups.map((g) => g.id),
  });
  // Validate first: Yjs cannot roll back a batch that throws halfway.
  if (parseFragment(serializeFragment(fragment)) === null) {
    throw new MermaidApplyError('The diagram produced an invalid deck');
  }
  const offset = mermaidOffset(fragment, target.existing);

  return editor.batch(() => {
    const pasted = editor.pasteFragment(fragment, {
      offset,
      ...(target.viewId === undefined ? {} : { viewId: target.viewId }),
    });
    // Paste returns the edges in fragment order (every end is inside the fragment).
    const edgeIds = new Map<Id, Id>();
    fragment.deck.edges.forEach((edge, i) => {
      const id = pasted.edges[i];
      if (id !== undefined) edgeIds.set(edge.id, id);
    });
    const flows = file.flows.map((flow) => {
      const flowId = editor.add('flows', { title: flow.title });
      for (const { id: _id, branch: _branch, edge, ...step } of flow.steps) {
        const real = edgeIds.get(edge);
        if (real !== undefined) editor.addStep(flowId, { ...step, edge: real });
      }
      return flowId;
    });
    return { nodes: pasted.nodes, edges: pasted.edges, groups: pasted.groups, flows };
  });
}
