import { stickyLabel } from '@sododeck/model';
import { Copy, Ellipsis, Pin, Trash2 } from 'lucide-react';

import { copyText, couldNotCopyText } from '../../lib/clipboard';
import { useUiStore } from '../../state/ui-store';
import { selectionText, selectionView } from '../json-panel-view';
import { pinAnnouncement, pinState } from '../views/pin-state';
import { viewActions } from '../views/use-current-view';
import type { Action, ActionContext } from './types';

const ALL_MODES = ['edit', 'flow', 'session', 'viewOnly'] as const;

const pins = (ctx: ActionContext) => pinState(ctx.selection.nodes, ctx.view.render.pinned);

/** What "Copied JSON for …" names: the one object, or the count. */
function copiedName(ctx: ActionContext): string {
  const view = selectionView(ctx.deck, ctx.selection);
  if (view.entries.length !== 1) return `${String(view.entries.length)} items`;
  const [sticky] = ctx.selection.stickies;
  const note = ctx.deck.stickies.find((s) => s.id === sticky);
  return note === undefined ? view.label : (stickyLabel(note.text) ?? 'note');
}

/** Copy JSON, Pin / Unpin, Delete and the toolbar's More actions (019 R8). */
export const COMMON_ACTIONS: readonly Action[] = [
  {
    id: 'json.copy',
    label: 'Copy JSON',
    icon: Copy,
    shortcut: 'copy-json',
    section: 'clipboard',
    // Only ⇧⌘C (founder, 2026-10-02): a developer tool, kept out of the menus; groups have none
    // (spec FR-032). The JSON panel has its own Copy button.
    where: { keys: ['component', 'components', 'connection', 'sticky', 'mixed'] },
    modes: ALL_MODES,
    applies: (ctx) => selectionView(ctx.deck, ctx.selection).entries.length > 0,
    run: (ctx) => {
      // The Selection tab's text (FR-036); only on this explicit action, never sent anywhere.
      const text = selectionText(selectionView(ctx.deck, ctx.selection).entries);
      const name = copiedName(ctx);
      void copyText(text).then((copied) => {
        ctx.toast(copied ? `Copied JSON for ${name}` : couldNotCopyText());
      });
    },
  },
  {
    id: 'view.pin',
    label: (ctx) => {
      const state = pins(ctx);
      const many = ctx.selection.nodes.length > 1;
      if (state === 'all') return many ? 'Unpin all' : 'Unpin';
      return many ? 'Pin all' : 'Pin';
    },
    icon: Pin,
    section: 'view',
    where: { menu: ['component', 'components'] },
    run: (ctx) => {
      const pin = pins(ctx) !== 'all';
      viewActions(ctx.editor).pin(ctx.selection.nodes, pin);
      useUiStore.getState().announce(pinAnnouncement(pin, ctx.selection.nodes.length));
    },
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    shortcut: 'delete',
    section: 'danger',
    destructive: true,
    where: { menu: ['component', 'components', 'connection', 'sticky', 'mixed'] },
    // Groups are never deleted this way (the Delete key refuses them too).
    applies: (ctx) =>
      ctx.selection.nodes.length + ctx.selection.edges.length + ctx.selection.stickies.length > 0,
    run: (ctx) => {
      // The Delete key's path: the same confirmation and Undo toast (FR-038).
      const { nodes, edges, stickies } = ctx.selection;
      useUiStore.getState().requestDelete({ nodes, edges, stickies });
    },
  },
  {
    id: 'more',
    label: 'More actions',
    icon: Ellipsis,
    shortcut: 'context-menu',
    section: 'danger',
    where: { toolbar: ['component', 'components', 'connection', 'group', 'mixed'] },
  },
];
