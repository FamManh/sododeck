import { toJSON } from '@sododeck/model';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { Palette } from './palette';
import { KIND_MIME } from './use-canvas-handlers';

describe('Palette', () => {
  it('offers the six kinds', () => {
    renderWithEditor(<Palette />);
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add Service',
      'Add Database',
      'Add Queue',
      'Add Gateway',
      'Add Client',
      'Add External',
    ]);
  });

  it('adds "New <kind>" on click and on Enter, selects and announces it', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Palette />);
    await user.click(screen.getByRole('button', { name: 'Add Service' }));
    const [node] = toJSON(doc).nodes;
    expect(node).toMatchObject({ type: 'service', title: 'New service' });
    expect(Number.isInteger(node?.position?.x)).toBe(true);
    const ui = useUiStore.getState();
    expect(ui.selection).toEqual({ nodes: [node?.id], edges: [] });
    expect(ui.focusedId).toBe(node?.id);
    expect(ui.announcement.text).toBe('Added New service');

    screen.getByRole('button', { name: 'Add Database' }).focus();
    await user.keyboard('{Enter}');
    expect(toJSON(doc).nodes.map((n) => n.title)).toEqual(['New service', 'New database']);
  });

  it('offsets a second add at the same spot', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Palette />, deckOf({}));
    await user.click(screen.getByRole('button', { name: 'Add Service' }));
    await user.click(screen.getByRole('button', { name: 'Add Service' }));
    const [a, b] = toJSON(doc).nodes;
    expect(b?.position).toEqual({ x: (a?.position?.x ?? 0) + 24, y: (a?.position?.y ?? 0) + 24 });
  });

  it('is a drag source for the kind', () => {
    renderWithEditor(<Palette />);
    const card = screen.getByRole('button', { name: 'Add Queue' });
    expect(card).toHaveAttribute('draggable', 'true');
    const data = new Map<string, string>();
    fireEvent.dragStart(card, {
      dataTransfer: { setData: (k: string, v: string) => data.set(k, v), effectAllowed: '' },
    });
    expect(data.get(KIND_MIME)).toBe('queue');
  });
});
