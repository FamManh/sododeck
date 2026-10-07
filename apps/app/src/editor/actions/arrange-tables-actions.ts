/**
 * "Arrange tables" on a selection holding two or more tables: the deck's auto-layout lays them out
 * by their relationships (`arrange-tables.ts`), off the main thread, and the result is written in
 * one undo step. Locked tables keep their place; other selected cards are left alone.
 */
import { isDbTable, isLocked } from '@sododeck/model';
import type { Id } from '@sododeck/schema';
import { Network } from 'lucide-react';

import { getLayoutClient } from '../../layout/layout-client';
import type { LayoutRequest, LayoutResult } from '../../layout/elk-layout';
import { useUiStore } from '../../state/ui-store';
import { arrangeRequest, placeArranged } from '../arrange-tables';
import { oneStep } from '../fields/one-step';
import { LOCKED_HINT } from '../lock';
import { laidOutFrames } from '../tidy-layout';
import type { Action, ActionContext } from './types';

const selectedTables = (ctx: ActionContext) => {
  const ids = new Set(ctx.selection.nodes);
  return ctx.view.deck.nodes.filter((node) => ids.has(node.id) && isDbTable(node));
};

/** The selected tables that may move. */
export function arrangeableTables(ctx: ActionContext): Id[] {
  return selectedTables(ctx)
    .filter((node) => !isLocked(node))
    .map((node) => node.id);
}

/**
 * Lays out the selected tables and writes the result (one undo step). Resolves to how many tables
 * moved; 0 when there was nothing to arrange or the layout failed.
 */
export async function arrangeSelectedTables(
  ctx: ActionContext,
  runLayout: (request: LayoutRequest) => Promise<LayoutResult> = (request) =>
    getLayoutClient().layout(request),
): Promise<number> {
  const ids = arrangeableTables(ctx);
  if (ids.length < 2) return 0;
  const deck = ctx.view.deck;
  let result: LayoutResult;
  try {
    result = await runLayout(arrangeRequest(deck, ids));
  } catch {
    useUiStore.getState().announce('Arrange failed; nothing was moved');
    return 0;
  }
  const positions = Object.fromEntries(placeArranged(deck, ids, result));
  // Schema groups follow their tables in the same step, as after Tidy layout.
  const frames = laidOutFrames(deck, positions);
  oneStep(ctx.editor, () => {
    ctx.editor.moveInView(ctx.view.view.id, positions);
    ctx.editor.setGroupFrames(ctx.view.view.id, frames);
  });
  useUiStore.getState().announce(`Arranged ${String(ids.length)} tables`);
  return ids.length;
}

export const ARRANGE_TABLES_ACTIONS: readonly Action[] = [
  {
    id: 'arrange.tables',
    label: 'Arrange tables',
    icon: Network,
    description: 'Lays the selected tables out by their relationships',
    section: 'arrange',
    where: { menu: ['components', 'mixed'] },
    applies: (ctx) => selectedTables(ctx).length >= 2,
    disabledReason: (ctx) => (arrangeableTables(ctx).length < 2 ? LOCKED_HINT : null),
    run: (ctx) => {
      void arrangeSelectedTables(ctx);
    },
  },
];
