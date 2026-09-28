import { fromJSON, toJSON } from '@sododeck/model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { actionContext, sel, TARGETS } from '../../test/action-fixtures';
import { actionsFor, findAction, runAction } from './actions-for';
import { ACTIONS } from './index';
import type { ActionContext } from './types';

const ui = () => useUiStore.getState();

/** Runs a submenu item (Arrange ▸ …, Protocol ▸ …) the way the menu does. */
function runChild(ctx: ActionContext, parent: string, child: string) {
  const item = actionsFor(ACTIONS, ctx, 'menu')
    .flatMap((s) => s.actions)
    .find((a) => a.id === parent)
    ?.children?.find((c) => c.id === child);
  if (item === undefined) throw new Error(`no ${child}`);
  item.run();
}

beforeEach(() => {
  ui().resetForDeck();
});
afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

describe('running actions (019 R8)', () => {
  it('arranges draw order as one undo step that survives save and load (FR-037)', () => {
    const ctx = actionContext({ kind: 'components', ids: sel({ nodes: ['a', 'b'] }) });
    const order = () => toJSON(ctx.doc).nodes.map((n) => n.id);
    runChild(ctx, 'arrange', 'arrange.front');
    expect(order()).toEqual(['p', 'child', 'a', 'b']);
    expect(toJSON(fromJSON(toJSON(ctx.doc))).nodes.map((n) => n.id)).toEqual(order());
    ctx.editor.undo();
    expect(order()).toEqual(['a', 'b', 'p', 'child']);
    const back = actionContext({ kind: 'component', ids: sel({ nodes: ['p'] }) });
    runChild(back, 'arrange', 'arrange.back');
    expect(toJSON(back.doc).nodes.map((n) => n.id)).toEqual(['p', 'a', 'b', 'child']);
  });

  it('copies the Selection-tab JSON and confirms with a toast (FR-036)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const ctx = actionContext(TARGETS.component);
    expect(runAction(ACTIONS, 'json.copy', ctx)).toBe(true);
    await vi.waitFor(() => {
      expect(ctx.toast).toHaveBeenCalledWith('Copied JSON for A');
    });
    expect(JSON.parse(String(writeText.mock.calls[0]?.[0]))).toMatchObject({ id: 'a', title: 'A' });
  });

  it('says so when the clipboard is unavailable', async () => {
    const ctx = actionContext(TARGETS.mixed);
    runAction(ACTIONS, 'json.copy', ctx);
    await vi.waitFor(() => {
      expect(ctx.toast).toHaveBeenCalledWith(expect.stringMatching(/^Couldn't copy/));
    });
  });

  it('deletes through the confirmation, as the Delete key does (FR-038)', () => {
    runAction(ACTIONS, 'delete', actionContext(TARGETS.mixed));
    expect(ui().pendingDelete?.targets).toEqual([
      { scope: 'nodes', id: 'a' },
      { scope: 'edges', id: 'e' },
    ]);
    runAction(ACTIONS, 'delete', actionContext(TARGETS.sticky));
    expect(ui().pendingDelete?.targets).toEqual([{ scope: 'stickies', id: 's' }]);
  });

  it('pins and unpins in the current view', () => {
    const ctx = actionContext(TARGETS.components);
    runAction(ACTIONS, 'view.pin', ctx);
    const pinnedCtx = actionContext(TARGETS.components, 'edit', ctx.doc);
    expect(
      actionsFor(ACTIONS, pinnedCtx, 'menu').flatMap((s) => s.actions.map((a) => a.label)),
    ).toContain('Unpin all');
    expect(ui().announcement.text).toBe('Pinned 2 components');
  });

  it('adds a component at the menu point, in title edit (FR-012)', () => {
    const ctx = actionContext(TARGETS.canvas);
    runChild(ctx, 'canvas.add', 'canvas.add.database');
    const added = toJSON(ctx.doc).nodes.at(-1);
    // The fake canvas maps the screen point (100, 100) to (200, 200); the card is centred there.
    expect(added).toMatchObject({
      type: 'database',
      title: 'Untitled database',
      position: { x: 118, y: 175 },
    });
    expect(ui().titleEdit).toMatchObject({ isNew: true, kind: 'database' });
  });

  it('ungroups as one undo step, members moving to the parent level (US6)', () => {
    const ctx = actionContext(TARGETS.group);
    expect(runAction(ACTIONS, 'group.ungroup', ctx)).toBe(true);
    const file = toJSON(ctx.doc);
    expect(file.groups).toEqual([]);
    expect(file.nodes.filter((n) => n.group !== undefined)).toEqual([]);
    ctx.editor.undo();
    expect(toJSON(ctx.doc).groups.map((g) => g.id)).toEqual(['g']);
    expect(
      toJSON(ctx.doc)
        .nodes.filter((n) => n.group === 'g')
        .map((n) => n.id),
    ).toEqual(['a', 'b']);
    expect(ctx.editor.canUndo()).toBe(false);
  });

  it('selects a group’s direct members', () => {
    runAction(ACTIONS, 'group.selectMembers', actionContext(TARGETS.group));
    expect(ui().selection.nodes).toEqual(['a', 'b']);
  });

  it('sets a connection’s protocol and direction, one undo step each', () => {
    const ctx = actionContext(TARGETS.connection);
    runChild(ctx, 'edge.protocol', 'edge.protocol.grpc');
    runChild(ctx, 'edge.direction', 'edge.direction.both');
    expect(toJSON(ctx.doc).edges[0]).toMatchObject({ protocol: 'grpc', direction: 'both' });
    ctx.editor.undo();
    expect(toJSON(ctx.doc).edges[0]).toMatchObject({ protocol: 'grpc', direction: 'forward' });
    const checked = actionsFor(ACTIONS, actionContext(TARGETS.connection, 'edit', ctx.doc), 'menu')
      .flatMap((s) => s.actions)
      .find((a) => a.id === 'edge.protocol')
      ?.children?.find((c) => c.checked);
    expect(checked?.label).toBe('gRPC');
  });

  it('opens the label popover and runs Fit in any mode', () => {
    runAction(ACTIONS, 'edge.label', actionContext(TARGETS.connection));
    expect(ui().popover).toEqual({ kind: 'edge', edgeId: 'e' });
    const ctx = actionContext(TARGETS.canvas, 'flow');
    expect(runAction(ACTIONS, 'canvas.fit', ctx)).toBe(true);
    expect(ctx.canvas?.fitView).toHaveBeenCalledWith({ padding: 0.2 });
    expect(findAction(ACTIONS, 'canvas.fit')?.modes).toContain('flow');
  });
});
