import { toJSON, type DeckEditor } from '@sododeck/model';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { Canvas } from '../canvas';
import { addComponent } from '../canvas-actions';
import { cardLayout } from '../card-layout';
import { useEditorShortcuts } from '../use-canvas-shortcuts';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'Service 3', position: { x: 0, y: 0 } },
    { id: 'b', type: 'database', title: 'B', position: { x: 300, y: 0 } },
    { id: 'c', type: 'queue', title: 'C', position: { x: 0, y: 200 } },
    { id: 'd', type: 'client', title: 'D', position: { x: 300, y: 200 } },
  ],
});

const ui = () => useUiStore.getState();

function EditorKeys() {
  useEditorShortcuts();
  return null;
}

function renderCanvas() {
  const env = renderWithEditor(
    <>
      <Canvas />
      <EditorKeys />
    </>,
    deck,
  );
  const titles = () => toJSON(env.doc).nodes.map((n) => n.title);
  return { ...env, titles };
}

function startEdit(id: string) {
  act(() => {
    ui().select({ nodes: [id] });
    ui().focus(id);
    ui().startTitleEdit({ target: 'node', id, isNew: false });
  });
  return screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Component title' });
}

const card = (name: string) => screen.getByRole('group', { name });

describe('CardTitleInput (019 US1)', () => {
  it('selects the title, commits on Enter as one undo step, and returns focus to the card', async () => {
    const user = userEvent.setup();
    const { editor, titles } = renderCanvas();
    const field = startEdit('a');
    expect(field).toHaveFocus();
    expect(field).toHaveValue('Service 3');
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 'Service 3'.length]);

    await user.keyboard('Billing API{Enter}');
    expect(titles()[0]).toBe('Billing API');
    expect(ui().titleEdit).toBeNull();
    expect(ui().announcement.text).toBe('Renamed to Billing API');
    expect(screen.queryByRole('textbox', { name: 'Component title' })).toBeNull();
    expect(card('Service: Billing API')).toHaveFocus();

    act(() => {
      editor().undo();
    });
    expect(titles()[0]).toBe('Service 3');
    expect(editor().canUndo()).toBe(false);
  });

  it('edits a long title over several lines, as shown; line breaks become spaces (2026-10-02)', async () => {
    const user = userEvent.setup();
    const { titles } = renderCanvas();
    const field = startEdit('a');
    // A wrapping field, not a one-line input that cuts the title off.
    expect(field.tagName).toBe('TEXTAREA');
    await user.clear(field);
    await user.paste('Order fulfilment\nand inventory');
    expect(field).toHaveValue('Order fulfilment and inventory');
    await user.keyboard('{Enter}');
    expect(titles()[0]).toBe('Order fulfilment and inventory');
  });

  it('wears the Deck title style: selection colour and the same line cap as the shown title (029)', () => {
    renderCanvas();
    const field = startEdit('a');
    expect(field.className).toContain('selection:bg-deck-text-selection');
    // The cap is the lines `cardLayout` gave the title, in the title's 1.28 line height.
    const lines = cardLayout({ title: 'Service 3', tags: [], childCount: 0 }).titleLines;
    expect(field.style.maxHeight).toBe(`${String(lines * 1.28)}em`);
  });

  it('cancels on Esc: nothing written, focus back on the card, the selection kept', async () => {
    const user = userEvent.setup();
    const { editor, titles } = renderCanvas();
    startEdit('a');
    await user.keyboard('Billing{Escape}');
    expect(titles()[0]).toBe('Service 3');
    expect(editor().canUndo()).toBe(false);
    expect(ui().titleEdit).toBeNull();
    expect(ui().selection.nodes).toEqual(['a']);
    expect(card('Service: Service 3')).toHaveFocus();
  });

  it('keeps the previous title for an empty or unchanged commit (FR-005)', async () => {
    const user = userEvent.setup();
    const { editor, titles } = renderCanvas();
    const field = startEdit('a');
    await user.clear(field);
    await user.keyboard('{Enter}');
    expect(titles()[0]).toBe('Service 3');
    startEdit('a');
    await user.keyboard('{Enter}');
    expect(titles()[0]).toBe('Service 3');
    expect(editor().canUndo()).toBe(false);
    expect(ui().titleEdit).toBeNull();
  });

  it('Tab commits and moves to the next card in reading order; ⇧Tab to the previous', async () => {
    const user = userEvent.setup();
    const { titles } = renderCanvas();
    startEdit('a');
    await user.keyboard('One{Tab}');
    expect(ui().titleEdit?.id).toBe('b');
    expect(ui().selection.nodes).toEqual(['b']);
    const second = screen.getByRole('textbox', { name: 'Component title' });
    expect(second).toHaveFocus();
    await user.keyboard('Two{Tab}');
    expect(ui().titleEdit?.id).toBe('c');
    await user.keyboard('Three{Shift>}{Tab}{/Shift}');
    expect(ui().titleEdit?.id).toBe('b');
    await user.keyboard('{Escape}');
    expect(titles()).toEqual(['One', 'Two', 'Three', 'D']);
  });

  it('commits on blur, e.g. a click elsewhere (FR-004)', async () => {
    const user = userEvent.setup();
    const { titles } = renderCanvas();
    startEdit('a');
    await user.keyboard('Blurred');
    act(() => {
      card('Database: B').focus();
    });
    expect(titles()[0]).toBe('Blurred');
    expect(ui().titleEdit).toBeNull();
  });

  it('ends without writing when the card is removed meanwhile', () => {
    const { editor, titles } = renderCanvas();
    const field = startEdit('a');
    fireEvent.change(field, { target: { value: 'Gone' } });
    act(() => {
      editor().remove('nodes', 'a');
    });
    expect(ui().titleEdit).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Component title' })).toBeNull();
    expect(titles()).toEqual(['B', 'C', 'D']);
  });

  it('keeps ⌘Z inside the field for the text: the document is not undone', async () => {
    const user = userEvent.setup();
    const { editor, titles } = renderCanvas();
    act(() => {
      editor().update('nodes', 'b', { title: 'Before' });
    });
    startEdit('a');
    await user.keyboard('X{Meta>}z{/Meta}{Control>}z{/Control}');
    expect(titles()[1]).toBe('Before');
    expect(within(card('Service: Service 3')).getByRole('textbox')).toBeInTheDocument();
  });
});

describe('CardTitleInput on a new card (019 US2)', () => {
  const add = (editor: () => DeckEditor) => {
    act(() => {
      addComponent(editor(), 'service', { x: 600, y: 400 }, { edit: true });
    });
    return screen.getByRole('textbox', { name: 'Component title' });
  };

  it('starts empty with the placeholder; Esc keeps "Untitled service" (FR-011, FR-014)', async () => {
    const user = userEvent.setup();
    const { editor, titles } = renderCanvas();
    const field = add(editor);
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('placeholder', 'Name this component');
    expect(field).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(titles()).toContain('Untitled service');
    expect(ui().titleEdit).toBeNull();
    add(editor);
    await user.keyboard('{Enter}');
    expect(titles().filter((t) => t === 'Untitled service')).toHaveLength(2);
  });

  it('⌘⏎ names it and adds another of the same kind in title edit; undo is name, then card', async () => {
    const user = userEvent.setup();
    const { editor, titles } = renderCanvas();
    add(editor);
    await user.keyboard('Auth{Meta>}{Enter}{/Meta}');
    expect(titles()).toEqual(['Service 3', 'B', 'C', 'D', 'Auth', 'Untitled service']);
    expect(ui().titleEdit).toMatchObject({ isNew: true, kind: 'service' });
    const second = screen.getByRole('textbox', { name: 'Component title' });
    expect(second).toHaveFocus();
    await user.keyboard('Users{Enter}');
    expect(titles().slice(4)).toEqual(['Auth', 'Users']);

    act(() => {
      editor().undo();
    });
    expect(titles().slice(4)).toEqual(['Auth', 'Untitled service']);
    act(() => {
      editor().undo();
    });
    expect(titles().slice(4)).toEqual(['Auth']);
    act(() => {
      editor().undo();
    });
    expect(titles().slice(4)).toEqual(['Untitled service']);
    act(() => {
      editor().undo();
    });
    expect(titles()).toHaveLength(4);
  });
});

describe('CardTitleInput on a text (founder feedback, 2026-10-06)', () => {
  const textDeck = deckOf({
    nodes: [
      { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
      { id: 't', type: 'text', title: 'Hello', position: { x: 0, y: 200 } },
    ],
  });

  function renderTextCanvas() {
    const env = renderWithEditor(
      <>
        <Canvas />
        <EditorKeys />
      </>,
      textDeck,
    );
    const ids = () => toJSON(env.doc).nodes.map((n) => n.id);
    const titles = () => toJSON(env.doc).nodes.map((n) => n.title);
    return { ...env, ids, titles };
  }

  const addText = (editor: () => DeckEditor) => {
    let id = '';
    act(() => {
      id = addComponent(editor(), 'text', { x: 600, y: 400 }, { edit: true });
    });
    return { id, field: screen.getByRole('textbox', { name: 'Component title' }) };
  };

  it('starts a new text empty with no "Name this component" placeholder', () => {
    const { editor } = renderTextCanvas();
    const { field } = addText(editor);
    expect(field).toHaveValue('');
    expect(field).not.toHaveAttribute('placeholder');
  });

  it('removes a new text left without typing, as one undo step', () => {
    const { editor, ids } = renderTextCanvas();
    const { id } = addText(editor);
    expect(ids()).toContain(id);
    act(() => {
      card('Service: A').focus();
    });
    expect(ids()).toEqual(['a', 't']);
    expect(ui().titleEdit).toBeNull();
    expect(toJSON(editor().doc).nodes.some((n) => n.title === 'Untitled text')).toBe(false);
    act(() => {
      editor().undo();
    });
    expect(ids()).toContain(id);
  });

  it('removes a new text on Esc when nothing was typed', async () => {
    const user = userEvent.setup();
    const { editor, ids } = renderTextCanvas();
    addText(editor);
    await user.keyboard('{Escape}');
    expect(ids()).toEqual(['a', 't']);
  });

  it('removes an existing text cleared to empty on blur, as one undo step', async () => {
    const user = userEvent.setup();
    const { editor, ids, titles } = renderTextCanvas();
    act(() => {
      ui().select({ nodes: ['t'] });
      ui().focus('t');
      ui().startTitleEdit({ target: 'node', id: 't', isNew: false });
    });
    const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Component title' });
    await user.clear(field);
    act(() => {
      card('Service: A').focus();
    });
    expect(ids()).toEqual(['a']);
    act(() => {
      editor().undo();
    });
    expect(titles()).toEqual(['A', 'Hello']);
  });

  it('still keeps the old title of a card cleared to empty (FR-005)', async () => {
    const user = userEvent.setup();
    const { titles } = renderTextCanvas();
    const field = startEdit('a');
    await user.clear(field);
    act(() => {
      screen.getByRole('group', { name: /^Hello/ }).focus();
    });
    expect(titles()).toEqual(['A', 'Hello']);
  });
});
