import { fromJSON, parseFragment, toJSON } from '@sododeck/model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { actionContext, actionDeck, sel, TARGETS } from '../../test/action-fixtures';
import { deckOf } from '../../test/render-canvas';
import { FRAGMENT_HINT_KEY, forgetFragment } from '../editing/clipboard-ops';
import { shortcutLabel } from '../shell/shortcuts';
import { actionsFor, findAction, runAction } from './actions-for';
import { ACTIONS } from './index';
import type { MenuTarget } from '../../state/ui-store';
import { commitTitle } from '../quick-edit/title-edit';
import type { ActionContext, Mode } from './types';

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

  it('deletes every selected kind, groups included (ungrouped, not emptied)', () => {
    const ctx = actionContext({
      kind: 'mixed',
      ids: sel({ nodes: ['p'], edges: ['e'], groups: ['g'], stickies: ['s'] }),
    });
    expect(actionsFor(ACTIONS, ctx, 'menu').flatMap((s) => s.actions.map((a) => a.id))).toContain(
      'delete',
    );
    runAction(ACTIONS, 'delete', ctx);
    expect(ui().pendingDelete?.targets).toEqual([
      { scope: 'nodes', id: 'p' },
      { scope: 'edges', id: 'e' },
      { scope: 'stickies', id: 's' },
      { scope: 'groups', id: 'g' },
    ]);
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
      position: { x: 108, y: 162 },
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

  it('says how many connectors go with an ungrouped group, one undo restoring them (050 FR-022)', () => {
    const file = toJSON(fromJSON(actionDeck));
    file.edges.push(
      { id: 'pg', from: 'p', to: 'g', protocol: 'http', direction: 'forward' },
      { id: 'gc', from: 'g', to: 'child', protocol: 'http', direction: 'forward' },
    );
    const ctx = actionContext(TARGETS.group, 'edit', file);
    runAction(ACTIONS, 'group.ungroup', ctx);
    expect(toJSON(ctx.doc).edges.map((e) => e.id)).toEqual(['e']);
    expect(ui().announcement.text).toBe('Ungrouped Core · also deleted 2 connections');
    ctx.editor.undo();
    expect(toJSON(ctx.doc).edges.map((e) => e.id)).toEqual(['e', 'pg', 'gc']);
  });

  it('announces a plain ungroup when the group has no connectors', () => {
    runAction(ACTIONS, 'group.ungroup', actionContext(TARGETS.group));
    expect(ui().announcement.text).toBe('Ungrouped Core');
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

describe('clipboard actions (016 US1)', () => {
  const clipboard = (readText?: () => Promise<string>) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText, ...(readText === undefined ? {} : { readText }) },
      configurable: true,
    });
    return writeText;
  };
  afterEach(() => {
    localStorage.clear();
    forgetFragment();
  });

  it('copies the components with their connections and announces it', async () => {
    const writeText = clipboard();
    const ctx = actionContext(TARGETS.components);
    expect(runAction(ACTIONS, 'clipboard.copy', ctx)).toBe(true);
    await vi.waitFor(() => {
      expect(ui().announcement.text).toBe('Copied 2 components and 1 connection');
    });
    const text = String(writeText.mock.calls[0]?.[0]);
    expect(parseFragment(text)?.deck.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(localStorage.getItem(FRAGMENT_HINT_KEY)).not.toBeNull();
    // Copying never writes the deck.
    expect(ctx.editor.canUndo()).toBe(false);
  });

  it('copies a group with its whole subtree', async () => {
    const writeText = clipboard();
    runAction(ACTIONS, 'clipboard.copy', actionContext(TARGETS.group));
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    const fragment = parseFragment(String(writeText.mock.calls[0]?.[0]));
    expect(fragment?.deck.groups.map((g) => g.id)).toEqual(['g']);
    expect(fragment?.deck.nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('says so when the clipboard refuses the write', async () => {
    const ctx = actionContext(TARGETS.component);
    runAction(ACTIONS, 'clipboard.copy', ctx);
    await vi.waitFor(() => {
      expect(ctx.toast).toHaveBeenCalledWith('Could not use the clipboard');
    });
  });

  it('cuts: the copy, then the Delete confirmation', async () => {
    clipboard();
    runAction(ACTIONS, 'clipboard.cut', actionContext(TARGETS.components));
    await vi.waitFor(() => {
      expect(ui().pendingDelete?.targets).toEqual([
        { scope: 'nodes', id: 'a' },
        { scope: 'nodes', id: 'b' },
      ]);
    });
    expect(ui().announcement.text).toBe('Cut 2 components and 1 connection');
  });

  it('duplicates 24 px away as one undo step, leaving the clipboard alone', () => {
    const writeText = clipboard();
    const ctx = actionContext(TARGETS.components);
    expect(runAction(ACTIONS, 'clipboard.duplicate', ctx)).toBe(true);
    const file = toJSON(ctx.doc);
    const copies = file.nodes.slice(4);
    expect(copies.map((n) => n.position)).toEqual([
      { x: 24, y: 24 },
      { x: 324, y: 24 },
    ]);
    // Still in the group the originals are in.
    expect(copies.map((n) => n.group)).toEqual(['g', 'g']);
    expect(file.edges).toHaveLength(2);
    expect(ui().selection.nodes).toEqual(copies.map((n) => n.id));
    expect(ui().announcement.text).toBe('Duplicated 2 components');
    expect(writeText).not.toHaveBeenCalled();
    ctx.editor.undo();
    expect(toJSON(ctx.doc).nodes).toHaveLength(4);
    expect(ctx.editor.canUndo()).toBe(false);
  });

  it('pastes from the menu at the menu point, and names what it pasted', async () => {
    const source = actionContext(TARGETS.components);
    const writeText = clipboard();
    runAction(ACTIONS, 'clipboard.copy', source);
    await vi.waitFor(() => {
      expect(ui().announcement.text).toMatch(/^Copied/);
    });
    const text = String(writeText.mock.calls[0]?.[0]);
    clipboard(() => Promise.resolve(text));
    const ctx = actionContext(TARGETS.canvas);
    expect(runAction(ACTIONS, 'clipboard.paste', ctx)).toBe(true);
    await vi.waitFor(() => {
      expect(toJSON(ctx.doc).nodes).toHaveLength(6);
    });
    // The fake canvas maps the menu point (100, 100) to (200, 200): the copies' top-left.
    expect(
      toJSON(ctx.doc)
        .nodes.slice(4)
        .map((n) => n.position),
    ).toEqual([
      { x: 200, y: 200 },
      { x: 500, y: 200 },
    ]);
    expect(ui().announcement.text).toBe('Pasted 2 components and 1 connection');
    ctx.editor.undo();
    expect(toJSON(ctx.doc).nodes).toHaveLength(4);
  });

  it('pastes nothing from plain text', async () => {
    clipboard(() => Promise.resolve('just some text'));
    localStorage.setItem(FRAGMENT_HINT_KEY, '1');
    const ctx = actionContext(TARGETS.canvas);
    runAction(ACTIONS, 'clipboard.paste', ctx);
    await vi.waitFor(() => {
      expect(ui().announcement.text).toBe('Nothing to paste');
    });
    expect(ctx.editor.canUndo()).toBe(false);
  });

  it('disables Paste with a reason', () => {
    const paste = () =>
      actionsFor(ACTIONS, actionContext(TARGETS.canvas), 'menu')
        .flatMap((s) => s.actions)
        .find((a) => a.id === 'clipboard.paste');
    clipboard();
    expect(paste()?.disabled).toBe(`Press ${shortcutLabel('paste')} to paste`);
    clipboard(() => Promise.resolve(''));
    expect(paste()?.disabled).toBe('Nothing to paste: copy components first');
    localStorage.setItem(FRAGMENT_HINT_KEY, '1');
    expect(paste()?.disabled).toBeNull();
  });

  it('offers Copy in flow mode and nothing that edits', () => {
    const ids = (mode: 'flow' | 'session') =>
      actionsFor(ACTIONS, actionContext(TARGETS.components, mode), 'menu').flatMap((s) =>
        s.actions.map((a) => a.id),
      );
    for (const mode of ['flow', 'session'] as const) {
      expect(ids(mode)).toContain('clipboard.copy');
      expect(ids(mode)).not.toContain('clipboard.cut');
      expect(ids(mode)).not.toContain('clipboard.duplicate');
    }
    expect(
      actionsFor(ACTIONS, actionContext(TARGETS.canvas, 'flow'), 'menu').flatMap((s) =>
        s.actions.map((a) => a.id),
      ),
    ).not.toContain('clipboard.paste');
  });
});

describe('group.create (016 US2, ⌘G)', () => {
  const four = { kind: 'components', ids: sel({ nodes: ['a', 'b', 'p', 'child'] }) } as const;

  it('groups the components in a fitted frame and opens its name for editing', () => {
    const ctx = actionContext(four);
    expect(runAction(ACTIONS, 'group.create', ctx)).toBe(true);
    const file = toJSON(ctx.doc);
    const group = file.groups.at(-1);
    // Cards (184 × 76 at every level) from (0, 0) to (300, 300), plus 24 px padding.
    expect(group).toMatchObject({
      title: 'New group',
      position: { x: -24, y: -24 },
      size: { width: 300 + 184 + 48, height: 300 + 76 + 48 },
    });
    expect(group).not.toHaveProperty('parent');
    expect(file.nodes.map((n) => n.group)).toEqual(Array(4).fill(group?.id));
    expect(ui().titleEdit).toEqual({ target: 'group', id: group?.id, isNew: true });
    expect(ui().selection.groups).toEqual([group?.id]);
    expect(ui().announcement.text).toBe('Grouped 4 components');
  });

  it('undoes the name, then the group', () => {
    const ctx = actionContext(four);
    runAction(ACTIONS, 'group.create', ctx);
    const id = toJSON(ctx.doc).groups.at(-1)?.id ?? '';
    commitTitle(ctx.editor, 'group', id, 'Payments', 'New group');
    ctx.editor.undo();
    expect(toJSON(ctx.doc).groups.at(-1)?.title).toBe('New group');
    ctx.editor.undo();
    expect(toJSON(ctx.doc).groups.map((g) => g.id)).toEqual(['g']);
    expect(ctx.editor.canUndo()).toBe(false);
  });

  it('nests the new group in the innermost common group', () => {
    const ctx = actionContext(TARGETS.components);
    runAction(ACTIONS, 'group.create', ctx);
    expect(toJSON(ctx.doc).groups.at(-1)?.parent).toBe('g');
  });

  it('is disabled below two components and absent in flow mode', () => {
    const item = (target: MenuTarget, mode: Mode = 'edit') =>
      actionsFor(ACTIONS, actionContext(target, mode), 'menu')
        .flatMap((s) => s.actions)
        .find((a) => a.id === 'group.create');
    expect(item(TARGETS.component)?.disabled).toBe('Select two or more components');
    expect(item(TARGETS.components)?.disabled).toBeNull();
    expect(item(TARGETS.components, 'flow')).toBeUndefined();
    expect(item(TARGETS.mixed)).toBeUndefined();
  });
});

describe('Align ▸ (016 US3, R12)', () => {
  const threeDeck = deckOf({
    nodes: [
      { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
      { id: 'b', type: 'service', title: 'B', position: { x: 250, y: 40 } },
      { id: 'c', type: 'service', title: 'C', position: { x: 700, y: 90 } },
    ],
  });
  const three = { kind: 'components', ids: sel({ nodes: ['a', 'b', 'c'] }) } as const;
  const submenu = (target: MenuTarget) =>
    actionsFor(ACTIONS, actionContext(target, 'edit', threeDeck), 'menu')
      .flatMap((s) => s.actions)
      .find((a) => a.id === 'arrange.align');

  it('lists the contract items in order, with rules between the groups', () => {
    const items = submenu(three)?.children ?? [];
    expect(items.map((i) => i.label)).toEqual([
      'Align left',
      'Align centre',
      'Align right',
      'Align top',
      'Align middle',
      'Align bottom',
      'Distribute horizontally',
      'Distribute vertically',
    ]);
    expect(items.filter((i) => i.separatorBefore).map((i) => i.label)).toEqual([
      'Align top',
      'Distribute horizontally',
    ]);
    expect(items.find((i) => i.label === 'Align left')?.shortcut).toBe('align-left');
  });

  it('is disabled below two components, distribute below three', () => {
    expect(submenu({ kind: 'component', ids: sel({ nodes: ['a'] }) })?.disabled).toBe(
      'Select two or more components',
    );
    const two = submenu({ kind: 'components', ids: sel({ nodes: ['a', 'b'] }) });
    expect(two?.disabled).toBeNull();
    expect(two?.children?.find((i) => i.id === 'arrange.distribute.horizontal')?.disabled).toBe(
      'Select three or more components',
    );
  });

  it('aligns left as one undo step and says so', () => {
    const ctx = actionContext(three, 'edit', threeDeck);
    runChild(ctx, 'arrange.align', 'arrange.align.left');
    expect(toJSON(ctx.doc).nodes.map((n) => n.position?.x)).toEqual([0, 0, 0]);
    expect(ui().announcement.text).toBe('Aligned 3 components left');
    ctx.editor.undo();
    expect(toJSON(ctx.doc).nodes.map((n) => n.position?.x)).toEqual([0, 250, 700]);
    expect(ctx.editor.canUndo()).toBe(false);
  });

  it('distributes with equal gaps, the outermost cards staying put', () => {
    const ctx = actionContext(three, 'edit', threeDeck);
    runChild(ctx, 'arrange.align', 'arrange.distribute.horizontal');
    const xs = toJSON(ctx.doc).nodes.map((n) => n.position?.x ?? 0);
    expect(xs[0]).toBe(0);
    expect(xs[2]).toBe(700);
    // The fake canvas zoom is 1: component cards, 164 wide.
    const gap1 = (xs[1] ?? 0) - 164;
    const gap2 = 700 - ((xs[1] ?? 0) + 164);
    expect(Math.abs(gap1 - gap2)).toBeLessThanOrEqual(1);
    expect(ui().announcement.text).toBe('Distributed 3 components horizontally');
  });
});
