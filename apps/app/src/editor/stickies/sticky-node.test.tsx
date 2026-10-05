import { readDeck } from '../../model/use-deck-snapshot';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeProps } from '@xyflow/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import type { StickyFlowNode } from '../deck-to-flow';
import { toStickyNodes } from '../deck-to-flow';
import type { FlowOverlay } from '../flows/flow-overlay';
import { StickyNode } from './sticky-node';

const deck = deckOf({
  nodes: [{ id: 'svc', type: 'service', title: 'Order Service' }],
  stickies: [
    {
      id: 'st1',
      text: '**Owner**\n\n- retry `<script>`',
      anchor: 'svc',
      position: { x: 10, y: -8 },
    },
    { id: 'st2', text: 'One line only', position: { x: 40, y: 50 }, collapsed: true },
    { id: 'st3', text: '   ', position: { x: 12, y: 16 } },
  ],
});

function stickyProps(
  file: ReturnType<typeof readDeck>,
  stickyId: string,
  overlay?: FlowOverlay,
  flow?: {
    flowMode: boolean;
    notesDisplay: 'dimmed' | 'shown' | 'hidden';
    emptyFlow: boolean;
    brokenCurrentStep: boolean;
  },
): NodeProps<StickyFlowNode> {
  const sticky = toStickyNodes(
    file,
    { nodes: [], edges: [], groups: [], stickies: [], images: [] },
    overlay,
    flow,
  ).find((node) => node.data.stickyId === stickyId);
  if (sticky === undefined) throw new Error(`Missing sticky ${stickyId}`);
  return sticky as unknown as NodeProps<StickyFlowNode>;
}

function renderSticky(stickyId: string) {
  const rendered = renderWithEditor(<StickyNode {...stickyProps(deck, stickyId)} />, deck);
  return {
    ...rendered,
    rerenderSticky: (id = stickyId) => {
      rendered.rerender(<StickyNode {...stickyProps(readDeck(rendered.doc), id)} />);
    },
  };
}

function renderFlowSticky(stickyId: string) {
  const overlay: FlowOverlay = { edges: new Map(), nodes: new Map() };
  const rendered = renderWithEditor(
    <StickyNode
      {...stickyProps(deck, stickyId, overlay, {
        flowMode: true,
        notesDisplay: 'dimmed',
        emptyFlow: false,
        brokenCurrentStep: false,
      })}
    />,
    deck,
  );
  act(() => {
    useUiStore.getState().openFlow('flow-1', 'step-1');
  });
  return rendered;
}

describe('StickyNode', () => {
  it('names notes by label, pin state, collapse state and empty text', () => {
    const first = renderSticky('st1');
    expect(
      screen.getByRole('group', { name: 'Note: Owner, pinned to Order Service' }),
    ).toBeInTheDocument();
    first.unmount();

    const second = renderSticky('st2');
    expect(
      screen.getByRole('group', { name: 'Note: One line only, collapsed' }),
    ).toBeInTheDocument();
    second.unmount();

    renderSticky('st3');
    expect(screen.getByRole('group', { name: 'Note: empty' })).toBeInTheDocument();
  });

  it('renders markdown body, escaped scripts, collapsed line and toggle labels', async () => {
    const user = userEvent.setup();
    const { rerenderSticky } = renderSticky('st1');
    expect(screen.getByText('Owner').tagName).toBe('STRONG');
    expect(screen.getByText('<script>').tagName).toBe('CODE');

    await user.click(screen.getByRole('button', { name: 'Collapse note' }));
    expect(useUiStore.getState().announcement.text).toBe('Note collapsed');
    rerenderSticky();
    expect(screen.getByRole('button', { name: 'Expand note' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByText('Owner')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand note' }));
    expect(useUiStore.getState().announcement.text).toBe('Note expanded');
  });

  it('shows the pinned footer and updates it when the node title changes', () => {
    const { editor, rerenderSticky } = renderSticky('st1');
    expect(screen.getByText('Pinned to Order Service')).toBeInTheDocument();
    act(() => {
      editor().update('nodes', 'svc', { title: 'Payments API' });
    });
    rerenderSticky();
    expect(screen.getByText('Pinned to Payments API')).toBeInTheDocument();
  });

  it('enters edit mode on double-click, Enter or F2, writes live, and leaves on Esc or blur', async () => {
    const user = userEvent.setup();
    const { doc, rerenderSticky } = renderSticky('st1');
    const card = screen.getByRole('group', { name: 'Note: Owner, pinned to Order Service' });

    fireEvent.doubleClick(card);
    const firstBox = await screen.findByRole('textbox', { name: 'Note text' });
    await user.clear(firstBox);
    await user.type(firstBox, 'Updated text');
    await waitFor(() => {
      expect(readDeck(doc).stickies.find((sticky) => sticky.id === 'st1')?.text).toBe(
        'Updated text',
      );
    });
    fireEvent.blur(firstBox);
    rerenderSticky();
    expect(screen.queryByRole('textbox', { name: 'Note text' })).not.toBeInTheDocument();
    expect(readDeck(doc).stickies.find((sticky) => sticky.id === 'st1')?.text).toBe('Updated text');

    fireEvent.keyDown(card, { key: 'Enter' });
    const secondBox = await screen.findByRole('textbox', { name: 'Note text' });
    await user.clear(secondBox);
    await user.type(secondBox, 'Escaped text');
    await user.keyboard('{Escape}');
    rerenderSticky();
    expect(screen.queryByRole('textbox', { name: 'Note text' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(readDeck(doc).stickies.find((sticky) => sticky.id === 'st1')?.text).toBe(
        'Updated text',
      );
    });

    fireEvent.keyDown(card, { key: 'F2' });
    expect(await screen.findByRole('textbox', { name: 'Note text' })).toBeInTheDocument();
  });

  it('is view-only in flow mode: dimmed naming, no collapse button, and no edit shortcuts', async () => {
    const user = userEvent.setup();
    const { doc } = renderFlowSticky('st1');
    const card = screen.getByRole('group', {
      name: 'Note: Owner, pinned to Order Service, dimmed',
    });

    expect(screen.queryByRole('button', { name: 'Collapse note' })).not.toBeInTheDocument();
    fireEvent.doubleClick(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: 'F2' });
    fireEvent.keyDown(card, { key: 'c', code: 'KeyC', altKey: true });
    await user.keyboard('{ArrowRight}');

    expect(screen.queryByRole('textbox', { name: 'Note text' })).not.toBeInTheDocument();
    expect(readDeck(doc).stickies.find((sticky) => sticky.id === 'st1')?.collapsed).toBeUndefined();
  });
});

// jsdom has no layout: give the fit a deterministic content height (one line is 1.4 em; a
// character is 0.55 em wide), read from the element the way the browser's `scrollHeight` is.
let scrollHeight: PropertyDescriptor | undefined;
beforeAll(() => {
  scrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      const size = Number.parseFloat(this.style.fontSize) || 16;
      const width = Number.parseFloat(this.style.width) || 174;
      const lines = Math.max(1, Math.ceil((this.textContent.length * size * 0.55) / width));
      return lines * size * 1.4;
    },
  });
});
afterAll(() => {
  if (scrollHeight !== undefined) {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeight);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
  }
});

const noted = (stickies: ReturnType<typeof readDeck>['stickies']) =>
  deckOf({ nodes: [{ id: 'svc', type: 'service', title: 'Order Service' }], stickies });

function renderNote(
  file: ReturnType<typeof readDeck>,
  stickyId: string,
  over: Partial<NodeProps<StickyFlowNode>> = {},
) {
  const props = { ...stickyProps(file, stickyId), ...over } as NodeProps<StickyFlowNode>;
  const rendered = renderWithEditor(<StickyNode {...props} />, file);
  return {
    ...rendered,
    rerenderNote: (
      next = readDeck(rendered.doc),
      over2: Partial<NodeProps<StickyFlowNode>> = over,
    ) => {
      rendered.rerender(<StickyNode {...{ ...stickyProps(next, stickyId), ...over2 }} />);
    },
  };
}

const textOf = () => screen.getByTestId('sticky-text');
const fontOf = () => Number.parseFloat(textOf().style.fontSize);

describe('StickyNode connection handles (053 US1)', () => {
  const file = noted([{ id: 'n', text: 'Why retry?', position: { x: 0, y: 0 } }]);
  const handles = () => screen.getAllByRole('button', { name: 'Connect from Why retry?' });

  it('has four side handles, shown on hover and focus, always while selected', () => {
    const { unmount } = renderNote(file, 'n');
    expect(handles().map((h) => h.getAttribute('data-handleid'))).toEqual([
      'top',
      'right',
      'bottom',
      'left',
    ]);
    for (const handle of handles()) {
      expect(handle).toHaveClass('react-flow__handle', 'source', 'connectable');
      expect(handle).toHaveClass('group-hover/sticky:opacity-100');
      expect(handle).not.toHaveClass('opacity-100');
    }
    unmount();
    renderNote(file, 'n', { selected: true });
    for (const handle of handles()) expect(handle).toHaveClass('opacity-100');
  });

  it('Enter or Space on a handle opens the connect popover for the note', async () => {
    const user = userEvent.setup();
    renderNote(file, 'n');
    const right = handles()[1];
    right?.focus();
    await user.keyboard('{Enter}');
    expect(useUiStore.getState().popover).toEqual({ kind: 'connect', fromId: 'n' });
    act(() => {
      useUiStore.getState().closePopover();
    });
    right?.focus();
    await user.keyboard(' ');
    expect(useUiStore.getState().popover).toEqual({ kind: 'connect', fromId: 'n' });
  });

  it('C on the focused note opens the connect popover, and does not type into it', () => {
    renderNote(file, 'n');
    fireEvent.keyDown(screen.getByRole('group', { name: 'Note: Why retry?' }), {
      key: 'c',
      code: 'KeyC',
    });
    expect(useUiStore.getState().popover).toEqual({ kind: 'connect', fromId: 'n' });
  });

  it('a locked note starts no connector but stays a target', () => {
    const locked = noted([{ id: 'n', text: 'Why retry?', position: { x: 0, y: 0 }, locked: true }]);
    renderNote(locked, 'n', { selected: true });
    for (const handle of handles()) {
      expect(handle).not.toHaveClass('connectable');
      expect(handle).toHaveClass('pointer-events-none');
    }
    // The note itself is still in the DOM as the drop target the hit test reads.
    expect(screen.getByTestId('sticky-node')).toHaveAttribute('data-node-id', 'sticky:n');
  });

  it('takes no new connector in flow mode', () => {
    renderNote(file, 'n');
    act(() => {
      useUiStore.getState().openFlow('f', null);
    });
    for (const handle of handles()) expect(handle).not.toHaveClass('connectable');
  });

  it('lights the note while a dragged connector end would land on it', () => {
    renderNote(file, 'n');
    expect(screen.getByTestId('sticky-node')).not.toHaveAttribute('data-endpoint-target');
    act(() => {
      useUiStore.getState().setEndpointPreview({
        edgeId: 'e',
        end: 'target',
        targetId: 'n',
        targetKind: 'sticky',
        box: { x: 0, y: 0, width: 200, height: 200 },
        side: 'left',
        at: 0.5,
        point: { x: 0, y: 100 },
        snapped: false,
        automatic: false,
        valid: 'ok',
      });
    });
    expect(screen.getByTestId('sticky-node')).toHaveAttribute('data-endpoint-target', 'ok');
  });
});

describe('StickyNode paper, size and text fit (053 US2)', () => {
  it('draws on the paper: no icon, no header, sized by default 200 x 200', () => {
    const file = noted([{ id: 'n', text: 'Short', position: { x: 0, y: 0 } }]);
    renderNote(file, 'n');
    const node = screen.getByTestId('sticky-node');
    expect(node.querySelector('[data-slot="sticky-paper"]')).not.toBeNull();
    expect(node).toHaveStyle({ width: '200px', height: '200px' });
    // The only icon is the collapse chevron: no note icon, no header.
    expect(node.querySelectorAll('svg')).toHaveLength(1);
  });

  it('applies a stored size', () => {
    const file = noted([
      { id: 'n', text: 'Short', position: { x: 0, y: 0 }, size: { width: 240, height: 160 } },
    ]);
    renderNote(file, 'n');
    expect(screen.getByTestId('sticky-node')).toHaveStyle({ width: '240px', height: '160px' });
  });

  it('Auto: the biggest text that fits, and it follows the text as it grows and shrinks', async () => {
    const file = noted([{ id: 'n', text: 'Short', position: { x: 0, y: 0 } }]);
    const { doc, editor, rerenderNote } = renderNote(file, 'n');
    await waitFor(() => {
      expect(fontOf()).toBe(32);
    });
    act(() => {
      editor().update('stickies', 'n', {
        text: 'A longer note about the retry policy and its limits for the platform team',
      });
    });
    rerenderNote(readDeck(doc));
    await waitFor(() => {
      expect(fontOf()).toBeLessThan(32);
    });
    const small = fontOf();
    act(() => {
      editor().update('stickies', 'n', { text: 'Short' });
    });
    rerenderNote(readDeck(doc));
    await waitFor(() => {
      expect(fontOf()).toBeGreaterThan(small);
    });
  });

  it('uses a fixed text size as it is, whatever the text', () => {
    const file = noted([
      { id: 'n', text: 'x'.repeat(2000), position: { x: 0, y: 0 }, fontSize: 20 },
    ]);
    const { container } = renderNote(file, 'n');
    expect(fontOf()).toBe(20);
    expect(container.querySelector('[data-fit-twin]')).toBeNull();
  });

  it('aligns the text', () => {
    const file = noted([{ id: 'n', text: 'Left', position: { x: 0, y: 0 }, align: 'left' }]);
    renderNote(file, 'n');
    expect(textOf()).toHaveStyle({ textAlign: 'left' });
  });

  it('centres by default', () => {
    renderNote(noted([{ id: 'n', text: 'Mid', position: { x: 0, y: 0 } }]), 'n');
    expect(textOf()).toHaveStyle({ textAlign: 'center' });
  });

  it('shows tags as chips along the bottom and collapses the rest to "+N"', () => {
    const tags = ['platform', 'security', 'billing', 'checkout', 'catalog', 'search', 'orders'];
    const file = noted([{ id: 'n', text: 'Tagged', position: { x: 0, y: 0 }, tags }]);
    renderNote(file, 'n');
    const list = screen.getByRole('list', { name: 'Tags' });
    const items = within(list).getAllByRole('listitem');
    expect(items.length).toBeLessThan(tags.length + 1);
    const more = items.at(-1);
    expect(more).toHaveTextContent(/^\+\d+$/);
    expect(more).toHaveAttribute('title', expect.stringContaining('orders'));
  });

  it('shows every tag when they fit', () => {
    const file = noted([
      { id: 'n', text: 'Tagged', position: { x: 0, y: 0 }, tags: ['api', 'ops'] },
    ]);
    renderNote(file, 'n');
    expect(
      within(screen.getByRole('list', { name: 'Tags' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['api', 'ops']);
  });

  it('cues clipped text and keeps the whole text in the document', async () => {
    const long = 'word '.repeat(600);
    const file = noted([{ id: 'n', text: long, position: { x: 0, y: 0 } }]);
    const { doc } = renderNote(file, 'n');
    expect(await screen.findByRole('img', { name: 'Text is cut off' })).toBeInTheDocument();
    expect(fontOf()).toBe(9);
    expect(readDeck(doc).stickies[0]?.text).toBe(long);
  });

  it('shows no cue when the text fits', async () => {
    renderNote(noted([{ id: 'n', text: 'Fits', position: { x: 0, y: 0 } }]), 'n');
    await waitFor(() => {
      expect(fontOf()).toBe(32);
    });
    expect(screen.queryByRole('img', { name: 'Text is cut off' })).not.toBeInTheDocument();
  });

  it('collapsed: the one-line form, a 40 px box and no resize handles', () => {
    const file = noted([
      { id: 'n', text: 'One line only', position: { x: 0, y: 0 }, collapsed: true, tags: ['api'] },
    ]);
    renderNote(file, 'n', { selected: true });
    expect(screen.getByTestId('sticky-node')).toHaveStyle({ height: '40px' });
    expect(screen.getByText('One line only')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Tags' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.react-flow__resize-control')).toHaveLength(0);
  });

  it('locked: a lock glyph that unlocks, no resize handles, text still editable', async () => {
    const user = userEvent.setup();
    const file = noted([{ id: 'n', text: 'Locked one', position: { x: 0, y: 0 }, locked: true }]);
    const { doc } = renderNote(file, 'n', { selected: true });
    expect(document.querySelectorAll('.react-flow__resize-control')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Unlock note' }));
    expect(readDeck(doc).stickies[0]?.locked).toBeUndefined();
  });

  it('shows eight resize handles on a selected, expanded, unlocked note, and none otherwise', () => {
    const file = noted([{ id: 'n', text: 'Resizable', position: { x: 0, y: 0 } }]);
    const first = renderNote(file, 'n');
    expect(document.querySelectorAll('.react-flow__resize-control')).toHaveLength(0);
    first.unmount();
    renderNote(file, 'n', { selected: true });
    expect(document.querySelectorAll('.react-flow__resize-control.sd-resize-handle')).toHaveLength(
      8,
    );
  });

  it('shows no resize handles in flow mode', () => {
    const file = noted([{ id: 'n', text: 'Resizable', position: { x: 0, y: 0 } }]);
    renderNote(file, 'n', { selected: true });
    act(() => {
      useUiStore.getState().openFlow('f', null);
    });
    expect(document.querySelectorAll('.react-flow__resize-control')).toHaveLength(0);
  });

  it('Alt + arrow resizes the focused note, and a locked note refuses', () => {
    const file = noted([
      { id: 'n', text: 'Resizable', position: { x: 0, y: 0 } },
      { id: 'l', text: 'Pinned', position: { x: 0, y: 300 }, locked: true },
    ]);
    const { doc } = renderNote(file, 'n');
    fireEvent.keyDown(screen.getByRole('group', { name: 'Note: Resizable' }), {
      key: 'ArrowRight',
      altKey: true,
    });
    expect(readDeck(doc).stickies[0]?.size).toEqual({ width: 208, height: 200 });
    // The plain arrow still moves it, and does not resize.
    fireEvent.keyDown(screen.getByRole('group', { name: 'Note: Resizable' }), {
      key: 'ArrowDown',
    });
    expect(readDeck(doc).stickies[0]?.size).toEqual({ width: 208, height: 200 });
  });

  it('a locked note does not resize from the keyboard and says why', () => {
    const file = noted([{ id: 'l', text: 'Pinned', position: { x: 0, y: 0 }, locked: true }]);
    const { doc } = renderNote(file, 'l');
    fireEvent.keyDown(screen.getByRole('group', { name: 'Note: Pinned, locked' }), {
      key: 'ArrowRight',
      altKey: true,
    });
    expect(readDeck(doc).stickies[0]?.size).toBeUndefined();
    expect(useUiStore.getState().announcement.text).toContain('Locked');
  });

  it('names the shortcuts that work on the note', () => {
    renderNote(noted([{ id: 'n', text: 'Keys', position: { x: 0, y: 0 } }]), 'n');
    expect(screen.getByRole('group', { name: 'Note: Keys' })).toHaveAttribute(
      'aria-keyshortcuts',
      expect.stringContaining('Alt+ArrowRight'),
    );
  });
});
