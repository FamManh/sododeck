import { toJSON } from '@sododeck/model';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { Canvas } from '../canvas';
import { useEditorShortcuts } from '../use-canvas-shortcuts';

function Editor() {
  useEditorShortcuts();
  return <Canvas />;
}

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 300, y: 0 } },
  ],
});

describe('⌘G then naming the group (016 FR-012)', () => {
  it('renames the new group from its label', async () => {
    const env = editorWrapper(deck);
    render(<Editor />, { wrapper: env.wrapper });
    const user = userEvent.setup();
    act(() => {
      useUiStore.getState().select({ nodes: ['a', 'b'] });
    });
    fireEvent.keyDown(document.body, { key: 'g', code: 'KeyG', metaKey: true });
    const input = await screen.findByRole('textbox', { name: 'Group title' });
    expect(input).toHaveFocus();
    await user.keyboard('Payments{Enter}');
    expect(toJSON(env.doc).groups[0]?.title).toBe('Payments');
    expect(
      await screen.findByRole('button', { name: 'Payments group, 2 nodes' }),
    ).toBeInTheDocument();
  });
});
