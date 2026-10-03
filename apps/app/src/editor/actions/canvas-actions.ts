import { deckPacks, typesOfPacks } from '@sododeck/model';
import { CirclePlus, Maximize, SquareDashedMousePointer, StickyNote } from 'lucide-react';

import { addComponent, centredOn, selectAllComponents } from '../canvas-actions';
import { typeName } from '../type-label';
import { addNoteAt } from '../stickies/sticky-actions';
import type { Action, ActionContext } from './types';

/** The flow point the menu was opened at (FR-012, FR-033), or `null` without a canvas. */
function flowPoint(ctx: ActionContext) {
  if (ctx.canvas === null || ctx.point === null) return null;
  return ctx.canvas.screenToFlowPosition(ctx.point);
}

/** The empty-canvas menu: Add component ▸, Add sticky, Select all, Fit (019 FR-033). */
export const CANVAS_ACTIONS: readonly Action[] = [
  {
    id: 'canvas.add',
    label: 'Add component',
    icon: CirclePlus,
    shortcut: 'add-component',
    section: 'edit',
    where: { menu: ['canvas'] },
    children: (ctx) =>
      typesOfPacks(deckPacks(ctx.deck)).map(({ id: kind }, index) => ({
        id: `canvas.add.${kind}`,
        label: typeName(kind),
        hint: index < 9 ? String(index + 1) : undefined,
        section: 'edit',
        where: {},
        run: (ctx) => {
          const point = flowPoint(ctx);
          if (point !== null)
            addComponent(ctx.editor, kind, centredOn(point, kind), { edit: true });
        },
      })),
  },
  {
    id: 'canvas.addSticky',
    label: 'Add sticky',
    icon: StickyNote,
    shortcut: 'note-here',
    section: 'edit',
    where: { menu: ['canvas'] },
    run: (ctx) => {
      const point = flowPoint(ctx);
      if (point !== null) addNoteAt(ctx.editor, point);
    },
  },
  {
    id: 'canvas.selectAll',
    label: 'Select all',
    icon: SquareDashedMousePointer,
    shortcut: 'select-all',
    section: 'view',
    where: { menu: ['canvas'] },
    applies: (ctx) => ctx.deck.nodes.length > 0,
    run: (ctx) => {
      selectAllComponents(ctx.editor);
    },
  },
  {
    id: 'canvas.fit',
    label: 'Fit',
    icon: Maximize,
    shortcut: 'zoom-fit',
    section: 'view',
    where: { menu: ['canvas'] },
    modes: ['edit', 'flow', 'session', 'viewOnly'],
    run: (ctx) => {
      void ctx.canvas?.fitView({ padding: 0.2 });
    },
  },
];
