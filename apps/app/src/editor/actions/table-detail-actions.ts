/**
 * A table's own detail (041 FR-015, research R9): Use deck setting, Names, Keys or All, from the
 * context menu and the toolbar when every target is a table. One undo step for the selection.
 */
import { isDbTable } from '@sododeck/model';
import type { DbDetail } from '@sododeck/schema';
import { ChevronsUpDown } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { DETAIL_NAMES } from '../table/table-text';
import type { Action, ActionContext } from './types';

type Choice = DbDetail | 'deck';

const CHOICES: readonly { value: Choice; label: string }[] = [
  { value: 'deck', label: 'Use deck setting' },
  { value: 'names', label: DETAIL_NAMES.names },
  { value: 'keys', label: DETAIL_NAMES.keys },
  { value: 'all', label: DETAIL_NAMES.all },
];

/** The selected nodes, when every one of them is a table; otherwise none. */
function selectedTables(ctx: ActionContext) {
  const ids = new Set(ctx.selection.nodes);
  const nodes = ctx.deck.nodes.filter((node) => ids.has(node.id));
  return nodes.length > 0 && nodes.length === ids.size && nodes.every(isDbTable) ? nodes : [];
}

/** The choice every selected table shares, or `'mixed'`. */
function sharedChoice(ctx: ActionContext): Choice | 'mixed' {
  const choices = new Set(selectedTables(ctx).map((node): Choice => node.detail ?? 'deck'));
  const [only] = choices;
  return choices.size === 1 && only !== undefined ? only : 'mixed';
}

const SHORT_NAME: Record<Choice | 'mixed', string> = {
  deck: 'Deck',
  mixed: 'Mixed',
  ...DETAIL_NAMES,
};

export const TABLE_DETAIL_ACTIONS: readonly Action[] = [
  {
    id: 'table.detail',
    label: 'Detail',
    toolbarLabel: (ctx) => `Detail: ${SHORT_NAME[sharedChoice(ctx)]}`,
    icon: ChevronsUpDown,
    section: 'edit',
    where: { menu: ['component', 'components'], toolbar: ['component', 'components'] },
    applies: (ctx) => selectedTables(ctx).length > 0,
    radio: true,
    children: () =>
      CHOICES.map(({ value, label }) => ({
        id: `table.detail.${value}`,
        label,
        section: 'edit',
        where: {},
        checked: (ctx) => sharedChoice(ctx) === value,
        run: (ctx) => {
          const ids = selectedTables(ctx).map((node) => node.id);
          ctx.editor.batch(() => {
            for (const id of ids) {
              ctx.editor.update('nodes', id, { detail: value === 'deck' ? null : value });
            }
          });
          useUiStore
            .getState()
            .announce(value === 'deck' ? 'Detail follows the deck' : `Detail: ${label}`);
        },
      })),
  },
];
