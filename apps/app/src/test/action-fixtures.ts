import { createEditor, fromJSON, toJSON, type DeckDoc } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { vi } from 'vitest';

import { actionsFor } from '../editor/actions/actions-for';
import { ACTIONS } from '../editor/actions/index';
import type { ActionContext, Mode, Surface } from '../editor/actions/types';
import { scopeOf, visibleGraph } from '../editor/visible-graph';
import { viewStateOf } from '../editor/views/view-state';
import { EMPTY_SELECTION, type MenuTarget, type Selection } from '../state/ui-store';
import { deckOf } from './render-canvas';

/** A deck with every menu target: components (one with a child), a group, an edge, a note. */
export const actionDeck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', group: 'g', position: { x: 0, y: 0 } },
    { id: 'b', type: 'database', title: 'B', group: 'g', position: { x: 300, y: 0 } },
    { id: 'p', type: 'service', title: 'Parent', position: { x: 0, y: 300 } },
    { id: 'child', type: 'service', title: 'Child', parent: 'p', position: { x: 0, y: 0 } },
  ],
  edges: [{ id: 'e', from: 'a', to: 'b', protocol: 'http', direction: 'forward' }],
  groups: [{ id: 'g', title: 'Core' }],
  stickies: [{ id: 's', text: 'Note', position: { x: 0, y: 600 } }],
});

export const sel = (patch: Partial<Selection>): Selection => ({ ...EMPTY_SELECTION, ...patch });

export const TARGETS = {
  component: { kind: 'component', ids: sel({ nodes: ['a'] }) },
  parent: { kind: 'component', ids: sel({ nodes: ['p'] }) },
  components: { kind: 'components', ids: sel({ nodes: ['a', 'b'] }) },
  connection: { kind: 'connection', ids: sel({ edges: ['e'] }) },
  group: { kind: 'group', ids: sel({ groups: ['g'] }) },
  sticky: { kind: 'sticky', ids: sel({ stickies: ['s'] }) },
  mixed: { kind: 'mixed', ids: sel({ nodes: ['a'], edges: ['e'] }) },
  canvas: { kind: 'canvas' },
} satisfies Record<string, MenuTarget>;

/** An action context on a fresh doc, with a fake canvas API. */
export function actionContext(
  target: MenuTarget,
  mode: Mode = 'edit',
  file: SododeckFile | DeckDoc = actionDeck,
): ActionContext & { doc: DeckDoc } {
  const doc = 'nodes' in file ? fromJSON(file) : file;
  const deck = toJSON(doc);
  const view = viewStateOf(deck, null, new Set());
  return {
    doc,
    editor: createEditor(doc),
    deck,
    view,
    target,
    selection: target.kind === 'canvas' ? EMPTY_SELECTION : target.ids,
    mode,
    point: { x: 100, y: 100 },
    childCount: visibleGraph(view.deck, scopeOf([]), view.collapsed).childCount,
    canvas: {
      fitView: vi.fn(),
      screenToFlowPosition: (p) => ({ x: p.x * 2, y: p.y * 2 }),
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    },
    toast: vi.fn(),
  };
}

/** Labels per section, as a menu or the toolbar would show them. */
export function labels(target: MenuTarget, surface: Surface, mode: Mode = 'edit'): string[][] {
  return actionsFor(ACTIONS, actionContext(target, mode), surface).map((section) =>
    section.actions.map((action) => action.label),
  );
}
