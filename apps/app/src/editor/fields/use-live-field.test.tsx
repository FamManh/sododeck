import { toJSON } from '@sododeck/model';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { useLiveField } from './use-live-field';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'Orders', owner: 'Core' },
    { id: 'b', type: 'service', title: 'Payments' },
  ],
});

function TitleField({ id, required = true }: { id: string; required?: boolean }) {
  const editor = useEditor();
  const file = useDeckSnapshot(editor.doc);
  const node = file.nodes.find((n) => n.id === id);
  const field = useLiveField({
    label: 'Title',
    value: node?.title ?? '',
    required,
    onWrite: (title) => {
      editor.update('nodes', id, { title });
    },
  });
  return (
    <>
      <input
        aria-label="Title"
        value={field.value}
        onChange={(e) => {
          field.onChange(e.target.value);
        }}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
        onKeyDown={field.onKeyDown}
      />
      {field.error !== undefined && <span role="alert">{field.error}</span>}
    </>
  );
}

function Harness() {
  const [id, setId] = useState('a');
  return (
    <>
      <TitleField key={id} id={id} />
      <button
        type="button"
        onClick={() => {
          setId('b');
        }}
      >
        Select b
      </button>
    </>
  );
}

function setup() {
  const view = renderWithEditor(<Harness />, deck);
  return { ...view, user: userEvent.setup(), title: () => toJSON(view.doc).nodes[0]?.title };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLiveField (research R4)', () => {
  it('writes while typing, and one ⌘Z after blur restores the value from before focus', async () => {
    const { user, title, editor } = setup();
    const field = screen.getByRole('textbox', { name: 'Title' });
    await user.type(field, ' API');
    await waitFor(() => {
      expect(title()).toBe('Orders API');
    });
    await user.type(field, ' v2');
    await user.tab();
    expect(title()).toBe('Orders API v2');
    act(() => {
      editor().undo();
    });
    expect(title()).toBe('Orders');
    expect(editor().canUndo()).toBe(false);
  });

  it('begins the gesture on the first change after focus, not on focus', async () => {
    const { user, editor } = setup();
    const begin = vi.spyOn(editor(), 'beginGesture');
    const end = vi.spyOn(editor(), 'endGesture');
    await user.click(screen.getByRole('textbox', { name: 'Title' }));
    expect(begin).not.toHaveBeenCalled();
    await user.keyboard('xy');
    expect(begin).toHaveBeenCalledOnce();
    await user.keyboard('{Enter}');
    expect(end).toHaveBeenCalledOnce();
  });

  it('writes at most once per animation frame, with the latest text', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const { user, editor } = setup();
    const update = vi.spyOn(editor(), 'update');
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'abc');
    expect(update).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
    act(() => {
      frames[0]?.(0);
    });
    expect(update).toHaveBeenCalledExactlyOnceWith('nodes', 'a', { title: 'Ordersabc' });
  });

  it('reverts to the value from before focus on Esc and ends the gesture', async () => {
    const { user, title, editor } = setup();
    const field = screen.getByRole('textbox', { name: 'Title' });
    await user.type(field, ' draft');
    await user.keyboard('{Escape}');
    expect(field).toHaveValue('Orders');
    expect(title()).toBe('Orders');
    act(() => {
      editor().update('nodes', 'b', { title: 'Later' });
    });
    act(() => {
      editor().undo();
    });
    expect(toJSON(editor().doc).nodes[1]?.title).toBe('Payments');
    expect(title()).toBe('Orders');
  });

  it('never writes an empty required value, and reverts it on blur with an error', async () => {
    const { user, title } = setup();
    const field = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(field);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Title can’t be empty.');
    expect(title()).toBe('Orders');
    await user.type(field, 'X{Backspace}');
    await user.tab();
    expect(title()).toBe('Orders');
    expect(field).toHaveValue('Orders');
    expect(screen.getByRole('alert')).toHaveTextContent('Title can’t be empty.');
  });

  it('ends the gesture when the field unmounts mid-typing (selection change)', async () => {
    const { user, title, editor } = setup();
    const end = vi.spyOn(editor(), 'endGesture');
    await user.type(screen.getByRole('textbox', { name: 'Title' }), '!');
    act(() => {
      screen.getByRole('button', { name: 'Select b' }).click();
    });
    expect(end).toHaveBeenCalledOnce();
    expect(title()).toBe('Orders!');
    act(() => {
      editor().update('nodes', 'b', { title: 'Other' });
    });
    act(() => {
      editor().undo();
    });
    expect(title()).toBe('Orders!');
  });
});
