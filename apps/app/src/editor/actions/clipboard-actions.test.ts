import { toJSON } from '@sododeck/model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { actionContext, sel, TARGETS } from '../../test/action-fixtures';
import { deckOf } from '../../test/render-canvas';
import { forgetFragment } from '../editing/clipboard-ops';
import { copyImage } from '../export/copy-image';
import type { RenderedImage } from '../export/render-image';
import { actionsFor, runAction } from './actions-for';
import { ACTIONS } from './index';
import type { ActionContext } from './types';

vi.mock('../export/copy-image', () => ({ copyImage: vi.fn() }));

const ui = () => useUiStore.getState();

function setClipboard(clipboard: Partial<Clipboard> | undefined) {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
}

const menuItem = (ctx: ActionContext, id: string) =>
  actionsFor(ACTIONS, ctx, 'menu')
    .flatMap((section) => section.actions)
    .find((action) => action.id === id);

/** A marquee-like selection: two cards, a note and the connector between the cards. */
const board = deckOf({
  name: 'Board',
  nodes: [
    { id: 'a', type: 'service', title: 'Alpha', position: { x: 0, y: 0 } },
    { id: 'b', type: 'database', title: 'Beta', position: { x: 300, y: 0 } },
    { id: 'c', type: 'service', title: 'Gamma', position: { x: 900, y: 0 } },
  ],
  edges: [
    { id: 'ab', from: 'a', to: 'b', label: 'reads' },
    { id: 'bc', from: 'b', to: 'c' },
  ],
  stickies: [{ id: 'n', text: 'Remember', position: { x: 0, y: 300 } }],
});
const marquee = {
  kind: 'mixed',
  ids: sel({ nodes: ['a', 'b'], edges: ['ab'], stickies: ['n'] }),
} as const;

beforeEach(() => {
  ui().resetForDeck();
  vi.mocked(copyImage).mockResolvedValue(true);
});
afterEach(() => {
  setClipboard(undefined);
  localStorage.clear();
  forgetFragment();
  vi.clearAllMocks();
});

describe('the selection menu (feedback: clipboard on a marquee selection)', () => {
  it('offers Cut, Copy, Paste, Duplicate, Copy as PNG and Copy as SVG with key hints', () => {
    const clip = actionsFor(ACTIONS, actionContext(marquee, 'edit', board), 'menu').find(
      (section) => section.id === 'clipboard',
    );
    expect(clip?.actions.map((a) => [a.label, a.shortcut ?? null])).toEqual([
      ['Cut', 'cut'],
      ['Copy', 'copy'],
      ['Paste', 'paste'],
      ['Duplicate', 'duplicate'],
      ['Copy as PNG', null],
      ['Copy as SVG', null],
    ]);
  });

  it('disables Paste until something was copied, with a reason', () => {
    setClipboard({ writeText: vi.fn() });
    const ctx = actionContext(TARGETS.sticky);
    expect(menuItem(ctx, 'clipboard.pasteHere')?.disabled).toMatch(/to paste$/);
    expect(menuItem(ctx, 'clipboard.copy')?.disabled).toBeNull();
  });

  it('copies notes too', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const ctx = actionContext(TARGETS.sticky);
    expect(runAction(ACTIONS, 'clipboard.copy', ctx)).toBe(true);
    await vi.waitFor(() => {
      expect(ctx.toast).toHaveBeenCalledWith('Copied 1 note');
    });
  });

  it('cuts, copies and pastes a mixed selection: fresh ids, remapped edges, one undo step', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // No `readText`: Paste falls back to this tab's in-memory copy.
    setClipboard({ writeText });
    const source = actionContext(marquee, 'edit', board);
    runAction(ACTIONS, 'clipboard.copy', source);
    await vi.waitFor(() => {
      expect(source.toast).toHaveBeenCalledWith('Copied 2 components and 1 note and 1 connection');
    });
    const ctx = actionContext(marquee, 'edit', source.doc);
    const paste = menuItem(ctx, 'clipboard.pasteHere');
    expect(paste?.disabled).toBeNull();
    paste?.run();
    const deck = toJSON(ctx.doc);
    const copies = deck.nodes.slice(3);
    expect(copies.map((n) => n.title)).toEqual(['Alpha', 'Beta']);
    expect(copies.every((n) => !['a', 'b', 'c'].includes(n.id))).toBe(true);
    // At the menu point (the fake canvas maps (100, 100) to (200, 200)).
    expect(copies[0]?.position).toEqual({ x: 200, y: 200 });
    const [alpha, beta] = copies;
    const pastedEdges = deck.edges.filter((e) => !['ab', 'bc'].includes(e.id));
    expect(pastedEdges).toEqual([expect.objectContaining({ from: alpha?.id, to: beta?.id })]);
    expect(deck.stickies.filter((s) => s.id !== 'n').map((s) => s.text)).toEqual(['Remember']);
    expect(ui().selection.nodes).toEqual([alpha?.id, beta?.id]);
    ctx.editor.undo();
    expect(toJSON(ctx.doc)).toEqual(board);
  });

  it('falls back to the in-memory copy when reading the clipboard is refused', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const readText = vi.fn().mockRejectedValue(new Error('denied'));
    setClipboard({ writeText, readText });
    const ctx = actionContext(TARGETS.component, 'edit', board);
    runAction(ACTIONS, 'clipboard.copy', { ...ctx, selection: sel({ nodes: ['c'] }) });
    await vi.waitFor(() => {
      expect(ctx.toast).toHaveBeenCalledWith('Copied 1 component');
    });
    runAction(ACTIONS, 'clipboard.paste', actionContext(TARGETS.canvas, 'edit', ctx.doc));
    await vi.waitFor(() => {
      expect(toJSON(ctx.doc).nodes.map((n) => n.title)).toEqual([
        'Alpha',
        'Beta',
        'Gamma',
        'Gamma',
      ]);
    });
  });

  it('copies the selection as PNG and SVG through the Export dialog path', async () => {
    const ctx = actionContext(marquee, 'flow', board);
    expect(menuItem(ctx, 'clipboard.copyPng')?.disabled).toBeNull();
    runAction(ACTIONS, 'clipboard.copyPng', ctx);
    await vi.waitFor(() => {
      expect(ctx.toast).toHaveBeenCalledWith('Copied as PNG');
    });
    const [format, image] = vi.mocked(copyImage).mock.calls[0] ?? [];
    expect(format).toBe('png');
    const { svg } = await (image as Promise<RenderedImage>);
    expect(svg).toContain('Alpha');
    expect(svg).toContain('Remember');
    expect(svg).not.toContain('Gamma');

    vi.mocked(copyImage).mockResolvedValueOnce(false);
    runAction(ACTIONS, 'clipboard.copySvg', ctx);
    await vi.waitFor(() => {
      expect(ctx.toast).toHaveBeenCalledWith("Couldn't copy the image");
    });
    expect(vi.mocked(copyImage).mock.calls[1]?.[0]).toBe('svg');
  });
});
