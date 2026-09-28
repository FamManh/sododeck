import type { Node } from '@sododeck/schema';
import { Cpu, Link, Shapes, Table2, Tags, User } from 'lucide-react';

import { useUiStore, type ToolbarFieldId } from '../../state/ui-store';
import { bulkView, type Shared } from '../inspector/derive';
import { kindLabel } from '../kind-label';
import type { Action, ActionContext } from './types';

/** The selected components, in deck order. */
export function selectedNodes(ctx: ActionContext): Node[] {
  const ids = new Set(ctx.selection.nodes);
  return ctx.deck.nodes.filter((node) => ids.has(node.id));
}

const shown = (shared: Shared<string>, format: (value: string) => string, none: string) =>
  shared.mixed ? 'Mixed' : shared.value === '' ? none : format(shared.value);

const open = (field: ToolbarFieldId) => () => {
  useUiStore.getState().openToolbarField(field);
};

const field = (
  id: ToolbarFieldId,
  label: Action['label'],
  icon: Action['icon'],
  many: boolean,
): Action => ({
  id: `field.${id}`,
  label,
  ...(icon === undefined ? {} : { icon }),
  section: 'edit',
  field: id,
  where: { toolbar: many ? ['component', 'components'] : ['component'] },
  run: open(id),
});

/**
 * The selection toolbar's field buttons (019 FR-020, FR-021): each opens its popover. The name
 * carries the current value, or "Mixed" when the selected components differ.
 */
export const FIELD_ACTIONS: readonly Action[] = [
  field(
    'kind',
    (ctx) => `Kind: ${shown(bulkView(selectedNodes(ctx)).kind, kindLabel, 'none')}`,
    Shapes,
    true,
  ),
  field(
    'owner',
    (ctx) => `Owner: ${shown(bulkView(selectedNodes(ctx)).owner, (v) => v, 'none')}`,
    User,
    true,
  ),
  field('tags', 'Tags', Tags, true),
  field(
    'tech',
    (ctx) => `Technology: ${shown(bulkView(selectedNodes(ctx)).tech, (v) => v, 'none')}`,
    Cpu,
    true,
  ),
  field('links', 'Links', Link, false),
  field('rules', 'Rules', Table2, false),
];
