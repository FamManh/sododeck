import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { Canvas } from '../canvas';
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
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Component title' });
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
