import { toJSON, type DeckDoc } from '@sododeck/model';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { toStickyNodes, type StickyFlowNode } from '../deck-to-flow';
import { SelectionToolbar } from '../quick-edit/selection-toolbar';
import { StickyNode } from './sticky-node';
import type { NodeProps } from '@xyflow/react';

const deck = deckOf({
  nodes: [{ id: 'svc', type: 'service', title: 'Order Service', position: { x: 0, y: 0 } }],
  tagColors: { PCI: 'violet' },
  stickies: [
    { id: 's1', text: 'hello world', position: { x: 600, y: 0 }, color: 'blue' },
    { id: 's2', text: 'second', position: { x: 600, y: 300 } },
    // Sits over the card, so "Pin" has a card to pin to.
    { id: 's3', text: 'over card', position: { x: 20, y: 20 } },
  ],
});

const ui = () => useUiStore.getState();
const stickiesOf = (doc: DeckDoc) => toJSON(doc).stickies;
const sticky = (doc: DeckDoc, id: string) => stickiesOf(doc).find((s) => s.id === id);

function setup(file = deck) {
  const env = renderWithEditor(<SelectionToolbar />, file);
  return { ...env, user: userEvent.setup() };
}

const select = (...stickies: string[]) => {
  act(() => {
    ui().select({ stickies });
  });
};
const toolbar = () => screen.queryByRole('toolbar', { name: /^Selection:/ });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const labels = () =>
  within(screen.getByRole('toolbar'))
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));

describe('sticky toolbar (053 US3)', () => {
  it('names one note and several notes', () => {
    setup();
    select('s1');
    expect(toolbar()).toHaveAccessibleName('Selection: note hello world');
    select('s1', 's2');
    expect(toolbar()).toHaveAccessibleName('Selection: 2 notes');
  });

  it('lists the controls in contract order, each with a name', () => {
    setup();
    select('s1');
    expect(labels()).toEqual([
      'Text size: Auto',
      'Bold',
      'Align: centre',
      'Link',
      'Note colour: Blue',
      'Tags',
      'Collapse',
      'Pin',
      'Lock',
      'Delete',
    ]);
  });

  it('is hidden while dragging or panning and in flow mode', () => {
    setup();
    select('s1');
    act(() => {
      ui().setCanvasGesture('pan');
    });
    expect(toolbar()).toBeNull();
    act(() => {
      ui().setCanvasGesture(null);
      ui().openFlow('f');
    });
    expect(toolbar()).toBeNull();
  });

  describe('text size', () => {
    it('lists Auto and the fixed sizes with the current one checked', async () => {
      const { user } = setup();
      select('s1');
      await user.click(button('Text size: Auto'));
      const menu = await screen.findByRole('menu', { name: /^Text size/ });
      expect(
        within(menu)
          .getAllByRole('menuitemradio')
          .map((i) => i.textContent),
      ).toEqual(['Auto', '12', '14', '16', '20', '24', '32']);
      expect(within(menu).getByRole('menuitemradio', { name: 'Auto' })).toBeChecked();
    });

    it('fixes the size of every selected note in one undo step', async () => {
      const { user, doc, editor } = setup();
      select('s1', 's2');
      await user.click(button('Text size: Auto'));
      await user.click(await screen.findByRole('menuitemradio', { name: '20' }));
      expect([sticky(doc, 's1')?.fontSize, sticky(doc, 's2')?.fontSize]).toEqual([20, 20]);
      expect(button('Text size: 20')).toBeInTheDocument();
      act(() => {
        editor().undo();
      });
      expect([sticky(doc, 's1')?.fontSize, sticky(doc, 's2')?.fontSize]).toEqual([
        undefined,
        undefined,
      ]);
    });

    it('goes back to Auto', async () => {
      const { user, doc } = setup(
        deckOf({ stickies: [{ id: 'a', text: 'x', position: { x: 0, y: 0 }, fontSize: 16 }] }),
      );
      select('a');
      await user.click(button('Text size: 16'));
      await user.click(await screen.findByRole('menuitemradio', { name: 'Auto' }));
      expect(sticky(doc, 'a')?.fontSize).toBeUndefined();
    });
  });

  describe('alignment', () => {
    it('cycles right, left, centre and is keyboard operable', async () => {
      const { user, doc } = setup();
      select('s1');
      await user.click(button('Align: centre'));
      expect(sticky(doc, 's1')?.align).toBe('right');
      await user.click(button('Align: right'));
      expect(sticky(doc, 's1')?.align).toBe('left');
      button('Align: left').focus();
      await user.keyboard('{Enter}');
      expect(sticky(doc, 's1')?.align).toBeUndefined();
      expect(button('Align: centre')).toBeInTheDocument();
    });

    it('aligns several notes together in one undo step', async () => {
      const { user, doc, editor } = setup();
      select('s1', 's2');
      await user.click(button('Align: centre'));
      expect([sticky(doc, 's1')?.align, sticky(doc, 's2')?.align]).toEqual(['right', 'right']);
      act(() => {
        editor().undo();
      });
      expect([sticky(doc, 's1')?.align, sticky(doc, 's2')?.align]).toEqual([undefined, undefined]);
    });
  });

  describe('bold and link without editing', () => {
    it('wraps and unwraps the whole text', async () => {
      const { user, doc } = setup();
      select('s1');
      await user.click(button('Bold'));
      expect(sticky(doc, 's1')?.text).toBe('**hello world**');
      await user.click(button('Bold'));
      expect(sticky(doc, 's1')?.text).toBe('hello world');
    });

    it('makes the whole text a link with a placeholder address', async () => {
      const { user, doc } = setup();
      select('s1');
      await user.click(button('Link'));
      expect(sticky(doc, 's1')?.text).toBe('[hello world](https://)');
    });

    it('bolds several notes as one undo step', async () => {
      const { user, doc, editor } = setup();
      select('s1', 's2');
      await user.click(button('Bold'));
      expect([sticky(doc, 's1')?.text, sticky(doc, 's2')?.text]).toEqual([
        '**hello world**',
        '**second**',
      ]);
      act(() => {
        editor().undo();
      });
      expect([sticky(doc, 's1')?.text, sticky(doc, 's2')?.text]).toEqual(['hello world', 'second']);
    });
  });

  describe('bold and link while editing', () => {
    function renderEditing() {
      const sticky1 = toStickyNodes(deck, { nodes: [], edges: [], groups: [], stickies: [] }).find(
        (node) => node.data.stickyId === 's1',
      );
      if (sticky1 === undefined) throw new Error('missing s1');
      const props = sticky1 as unknown as NodeProps<StickyFlowNode>;
      const env = renderWithEditor(
        <>
          <SelectionToolbar />
          <StickyNode {...props} />
        </>,
        deck,
      );
      act(() => {
        ui().select({ stickies: ['s1'] });
        ui().setStickyEditing('s1');
      });
      return env;
    }

    const field = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Note text' });

    it('wraps only the selected words and keeps editing', async () => {
      const { doc } = renderEditing();
      const textarea = field();
      textarea.focus();
      textarea.setSelectionRange(0, 5);
      // The toolbar must not take focus from the field, or the edit would end first.
      expect(fireEvent.mouseDown(button('Bold'))).toBe(false);
      fireEvent.click(button('Bold'));
      await waitFor(() => {
        expect(sticky(doc, 's1')?.text).toBe('**hello** world');
      });
      expect(ui().stickyEditing).toBe('s1');
    });

    it('turns the selection into a link', async () => {
      const { doc } = renderEditing();
      const textarea = field();
      textarea.focus();
      textarea.setSelectionRange(6, 11);
      fireEvent.click(button('Link'));
      await waitFor(() => {
        expect(sticky(doc, 's1')?.text).toBe('hello [world](https://)');
      });
    });
  });

  describe('colour', () => {
    it('shows the five swatches with the current one ticked', async () => {
      const { user } = setup();
      select('s1');
      await user.click(button('Note colour: Blue'));
      const dialog = await screen.findByRole('dialog', { name: 'Note colour' });
      const radios = within(dialog).getAllByRole('radio');
      expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual([
        'Amber',
        'Blue',
        'Clay',
        'Green',
        'Grey',
      ]);
      expect(within(dialog).getByRole('radio', { name: 'Blue' })).toBeChecked();
    });

    it('recolours every selected note in one undo step and remembers the colour', async () => {
      const { user, doc, editor } = setup();
      select('s1', 's2');
      await user.click(button(/^Note colour/));
      await user.click(
        within(await screen.findByRole('dialog', { name: 'Note colour' })).getByRole('radio', {
          name: 'Green',
        }),
      );
      expect([sticky(doc, 's1')?.color, sticky(doc, 's2')?.color]).toEqual(['green', 'green']);
      expect(ui().lastStickyColour).toBe('green');
      act(() => {
        editor().undo();
      });
      expect([sticky(doc, 's1')?.color, sticky(doc, 's2')?.color]).toEqual(['blue', undefined]);
    });
  });

  describe('tags', () => {
    it('opens the shared picker and tags the notes', async () => {
      const { user, doc } = setup();
      select('s1', 's2');
      await user.click(button('Tags'));
      const dialog = await screen.findByRole('dialog', { name: 'Tags' });
      await user.type(within(dialog).getByRole('searchbox', { name: 'Filter tags' }), 'PCI{Enter}');
      expect([sticky(doc, 's1')?.tags, sticky(doc, 's2')?.tags]).toEqual([['PCI'], ['PCI']]);
    });
  });

  describe('expand, pin, lock, delete', () => {
    it('collapses and expands every selected note', async () => {
      const { user, doc, editor } = setup();
      select('s1', 's2');
      await user.click(button('Collapse'));
      expect([sticky(doc, 's1')?.collapsed, sticky(doc, 's2')?.collapsed]).toEqual([true, true]);
      expect(button('Expand')).toBeInTheDocument();
      act(() => {
        editor().undo();
      });
      expect(sticky(doc, 's1')?.collapsed).toBeUndefined();
      select('s1');
      await user.click(button('Collapse'));
      await user.click(button('Expand'));
      expect(sticky(doc, 's1')?.collapsed).toBeUndefined();
    });

    it('disables Pin with a reason when no card is under the note', () => {
      setup();
      select('s1');
      expect(button('Pin')).toBeDisabled();
    });

    it('pins to the card under the note, then unpins', async () => {
      const { user, doc } = setup();
      select('s3');
      await user.click(button('Pin'));
      expect(sticky(doc, 's3')?.anchor).toBe('svc');
      await user.click(button('Unpin'));
      expect(sticky(doc, 's3')?.anchor).toBeUndefined();
    });

    it('locks and unlocks every selected note in one undo step', async () => {
      const { user, doc, editor } = setup();
      select('s1', 's2');
      await user.click(button('Lock'));
      expect([sticky(doc, 's1')?.locked, sticky(doc, 's2')?.locked]).toEqual([true, true]);
      await user.click(button('Unlock'));
      expect([sticky(doc, 's1')?.locked, sticky(doc, 's2')?.locked]).toEqual([
        undefined,
        undefined,
      ]);
      act(() => {
        editor().undo();
      });
      expect(sticky(doc, 's1')?.locked).toBe(true);
    });

    it('leaves locked notes out of Pin and still lets Lock toggle them', async () => {
      const { user, doc } = setup(
        deckOf({
          nodes: [{ id: 'svc', type: 'service', title: 'S', position: { x: 0, y: 0 } }],
          stickies: [{ id: 'a', text: 'x', position: { x: 20, y: 20 }, locked: true }],
        }),
      );
      select('a');
      expect(button('Pin')).toBeDisabled();
      await user.click(button('Unlock'));
      expect(sticky(doc, 'a')?.locked).toBeUndefined();
    });

    it('asks to delete the selected notes', async () => {
      const { user } = setup();
      select('s1', 's2');
      await user.click(button('Delete'));
      expect(ui().pendingDelete?.targets).toEqual([
        { scope: 'stickies', id: 's1' },
        { scope: 'stickies', id: 's2' },
      ]);
    });
  });
});
