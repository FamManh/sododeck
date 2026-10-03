import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { Canvas } from './canvas';
import { Palette } from './palette';
import { SelectionToolbar } from './quick-edit/selection-toolbar';
import { DetailDrawer } from './shell/detail-drawer';
import { useEditorShortcuts } from './use-canvas-shortcuts';

const deck = deckOf({
  packs: ['architecture', 'process', 'logistics', 'data'],
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'queue', title: 'B', position: { x: 300, y: 0 } },
  ],
});

function Harness() {
  useEditorShortcuts();
  const file = useDeckSnapshot(useEditor().doc);
  return (
    <>
      <Canvas />
      <SelectionToolbar />
      <DetailDrawer deck={file} />
      <Palette />
    </>
  );
}

/** Every visible text and accessible name in the document. */
function allCopy(): string {
  const parts: string[] = [document.body.textContent];
  for (const el of document.body.querySelectorAll('[aria-label],[placeholder],[title]')) {
    parts.push(
      el.getAttribute('aria-label') ?? '',
      el.getAttribute('placeholder') ?? '',
      el.getAttribute('title') ?? '',
    );
  }
  return parts.join('\n');
}

describe('no "Kind" in the UI (030, clarify Q1)', () => {
  it('toolbar, drawer, bulk drawer and Add flyout say Type', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Harness />, deck);
    act(() => {
      useUiStore.getState().select({ nodes: ['a'] });
    });
    await user.click(screen.getByRole('button', { name: 'Open details' }));
    await screen.findByRole('complementary', { name: 'Details' });
    expect(allCopy()).not.toMatch(/\bkinds?\b/i);
    act(() => {
      useUiStore.getState().select({ nodes: ['a', 'b'] });
    });
    expect(allCopy()).not.toMatch(/\bkinds?\b/i);
    await user.click(screen.getByRole('button', { name: 'Type: Mixed' }));
    expect(allCopy()).not.toMatch(/\bkinds?\b/i);
  });
});
