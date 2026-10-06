import { toJSON } from '@sododeck/model';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { inspectorDeck } from '../../test/inspector-fixtures';
import { editorWrapper } from '../../test/render-canvas';
import { CanvasBackgroundSection } from './canvas-background-section';

function Harness() {
  const deck = useDeckSnapshot(useEditor().doc);
  return <CanvasBackgroundSection deck={deck} />;
}

function setup(file = inspectorDeck) {
  const { wrapper, doc, editor } = editorWrapper(file);
  render(<Harness />, { wrapper });
  return { doc, editor, user: userEvent.setup() };
}

const hexField = () => screen.getByRole('textbox', { name: 'Background colour' });
const well = () => screen.getByLabelText<HTMLInputElement>('Pick background colour');
const reset = () => screen.getByRole('button', { name: 'Reset to theme default' });

describe('CanvasBackgroundSection (ADR 0044)', () => {
  it('starts on dots following the theme, with nothing to reset', () => {
    const { doc } = setup();
    expect(screen.getByRole('radio', { name: 'Dots' })).toHaveAttribute('aria-checked', 'true');
    expect(hexField()).toHaveValue('');
    expect(screen.getByText('Follows the light or dark theme.')).toBeInTheDocument();
    expect(reset()).toBeDisabled();
    expect(toJSON(doc)).not.toHaveProperty('canvasBackground');
  });

  it('writes the pattern in one undo step, dots as the absent key', async () => {
    const { doc, editor, user } = setup();
    await user.click(screen.getByRole('radio', { name: 'Grid' }));
    expect(toJSON(doc).canvasBackground).toEqual({ pattern: 'grid' });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).not.toHaveProperty('canvasBackground');
    await user.click(screen.getByRole('radio', { name: 'None' }));
    await user.click(screen.getByRole('radio', { name: 'Dots' }));
    expect(toJSON(doc)).not.toHaveProperty('canvasBackground');
  });

  it('takes any hex in the text field, normalised, and refuses anything else', async () => {
    const { doc, user } = setup();
    await user.type(hexField(), '1F2A44{Enter}');
    expect(toJSON(doc).canvasBackground).toEqual({ color: '#1f2a44' });
    expect(well()).toHaveValue('#1f2a44');
    expect(screen.getByText('Saved in this deck, the same in light and dark.')).toBeInTheDocument();

    await user.clear(hexField());
    await user.type(hexField(), 'beige');
    await user.tab();
    expect(hexField()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Enter a 6-digit hex colour/)).toBeInTheDocument();
    expect(toJSON(doc).canvasBackground).toEqual({ color: '#1f2a44' });
  });

  it('writes the colour well once, when the picker commits', () => {
    const { doc, editor } = setup();
    // `input` while dragging: no write.
    fireEvent.input(well(), { target: { value: '#336699' } });
    expect(toJSON(doc)).not.toHaveProperty('canvasBackground');
    // The native `change` when the picker closes: one write, one undo step.
    fireEvent.change(well(), { target: { value: '#336699' } });
    expect(toJSON(doc).canvasBackground).toEqual({ color: '#336699' });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).not.toHaveProperty('canvasBackground');
  });

  it('resets pattern and colour to the theme default in one undo step', async () => {
    const { doc, editor, user } = setup({
      ...inspectorDeck,
      canvasBackground: { pattern: 'none', color: '#f4efe6' },
    });
    expect(hexField()).toHaveValue('#f4efe6');
    await user.click(reset());
    expect(toJSON(doc)).not.toHaveProperty('canvasBackground');
    expect(hexField()).toHaveValue('');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).canvasBackground).toEqual({ pattern: 'none', color: '#f4efe6' });
  });
});
