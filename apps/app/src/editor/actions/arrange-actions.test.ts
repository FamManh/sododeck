import { stackOrder, toJSON, type DeckDoc } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore, type MenuTarget } from '../../state/ui-store';
import { actionContext, sel } from '../../test/action-fixtures';
import { deckOf } from '../../test/render-canvas';
import { actionsFor } from './actions-for';
import { ACTIONS } from './index';
import type { ActionContext } from './types';

const asset = 'a'.repeat(64);
const picture = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  asset,
  position: { x: 0, y: 0 },
  size: { width: 80, height: 60 },
  ...extra,
});
const file: SododeckFile = deckOf({
  nodes: [
    { id: 'c0', type: 'service', title: 'C0' },
    { id: 'c1', type: 'service', title: 'C1' },
  ],
  images: [picture('i0'), picture('i1', { locked: true })],
  assets: {
    [asset]: { type: 'image/png', bytes: 1, width: 1, height: 1, name: 'a.png', data: '' },
  },
});

const order = (doc: DeckDoc) =>
  stackOrder(toJSON(doc)).map((entry) => (entry.kind === 'node' ? entry.id : `img:${entry.id}`));

function run(target: MenuTarget, id: string, where: 'menu' | 'toolbar' = 'menu', doc?: DeckDoc) {
  const ctx = actionContext(target, 'edit', doc ?? file);
  const all = actionsFor(ACTIONS, ctx, where).flatMap((s) => s.actions);
  const item = all.flatMap((a) => [a, ...(a.children ?? [])]).find((a) => a.id === id);
  if (item === undefined) throw new Error(`no ${id}`);
  return {
    ctx,
    item,
    run: () => {
      item.run();
    },
  };
}

beforeEach(() => {
  useUiStore.getState().resetForDeck();
});

describe('arrange over cards and images (055)', () => {
  const image: MenuTarget = { kind: 'image', ids: sel({ images: ['i0'] }) };

  it('Bring to front puts an image above every card, one undo step', () => {
    const { ctx, run: go } = run(image, 'arrange.front');
    expect(order(ctx.doc)).toEqual(['c0', 'img:i0', 'c1', 'img:i1']);
    go();
    expect(order(ctx.doc)).toEqual(['c0', 'c1', 'img:i1', 'img:i0']);
    ctx.editor.undo();
    expect(order(ctx.doc)).toEqual(['c0', 'img:i0', 'c1', 'img:i1']);
  });

  it('Send backward and Bring forward move past one neighbour; Send to back goes under cards', () => {
    const start = run(image, 'arrange.front');
    start.run();
    const backward = actionContext(image, 'edit', start.ctx.doc);
    const step = actionsFor(ACTIONS, backward, 'toolbar')
      .flatMap((s) => s.actions)
      .find((a) => a.id === 'arrange.toolbar.backward');
    step?.run();
    expect(order(start.ctx.doc)).toEqual(['c0', 'c1', 'img:i0', 'img:i1']);
    const back = run(image, 'arrange.back', 'menu', start.ctx.doc);
    back.run();
    expect(order(start.ctx.doc)[0]).toBe('img:i0');
  });

  it('works on cards and images together from the mixed menu', () => {
    const mixed: MenuTarget = { kind: 'mixed', ids: sel({ nodes: ['c0'], images: ['i0'] }) };
    const { ctx, run: go } = run(mixed, 'arrange.back');
    go();
    expect(order(ctx.doc).slice(0, 2)).toEqual(['c0', 'img:i0']);
  });

  it('refuses a locked image with the reason, and leaves the order alone', () => {
    const locked: MenuTarget = { kind: 'image', ids: sel({ images: ['i1'] }) };
    const { ctx, item } = run(locked, 'arrange');
    expect(item.children?.every((child) => child.disabled !== null)).toBe(true);
    expect(order(ctx.doc)).toEqual(['c0', 'img:i0', 'c1', 'img:i1']);
  });

  it('keeps moving cards alone as before', () => {
    const cards: MenuTarget = { kind: 'component', ids: sel({ nodes: ['c0'] }) };
    const { ctx, run: go } = run(cards, 'arrange.front');
    go();
    expect(toJSON(ctx.doc).nodes.map((n) => n.id)).toEqual(['c1', 'c0']);
  });

  it('is offered on the image toolbar next to alt text, caption, lock and delete', () => {
    const ctx: ActionContext = actionContext(image, 'edit', file);
    const toolbar = actionsFor(ACTIONS, ctx, 'toolbar')
      .flatMap((s) => s.actions)
      .map((a) => a.label);
    expect(toolbar).toEqual([
      'Alt text',
      'Caption',
      'Flip horizontal',
      'Flip vertical',
      'Lock',
      'Bring forward',
      'Send backward',
      'Delete',
    ]);
  });
});
