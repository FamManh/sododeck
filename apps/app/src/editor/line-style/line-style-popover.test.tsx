import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { inspectorDeck } from '../../test/inspector-fixtures';
import { renderInspector } from '../../test/render-inspector';

/** The drawer's Line section is the same component as the popover body. */
const setup = (edges = ['op']) => renderInspector(inspectorDeck, { edges });
const style = (doc: Parameters<typeof toJSON>[0], index = 0) => toJSON(doc).edges[index]?.style;

describe('Line style controls (022 US1)', () => {
  it('has the roles and names of the contract', () => {
    setup();
    expect(screen.getByRole('radiogroup', { name: 'Type' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Dash' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Weight' })).toHaveAttribute(
      'aria-valuetext',
      '2 px, default',
    );
    expect(screen.getByRole('radiogroup', { name: 'Colour' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Animate direction' })).not.toBeChecked();
  });

  it('writes only the picked key, one undo step per pick', async () => {
    const { user, doc, editor } = setup();
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Dash' })).getByRole('radio', {
        name: 'Dashed',
      }),
    );
    expect(style(doc)).toEqual({ dash: 'dashed' });
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Colour' })).getByRole('radio', {
        name: 'Blue',
      }),
    );
    expect(style(doc)).toEqual({ dash: 'dashed', color: 'blue' });
    await user.click(screen.getByRole('switch', { name: 'Animate direction' }));
    expect(style(doc)).toEqual({ dash: 'dashed', color: 'blue', animated: true });
    act(() => {
      editor().undo();
    });
    expect(style(doc)).toEqual({ dash: 'dashed', color: 'blue' });
  });

  it('"No colour" and the default dash remove their keys', async () => {
    const { user, doc } = setup();
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Colour' })).getByRole('radio', {
        name: 'Red',
      }),
    );
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Colour' })).getByRole('radio', {
        name: 'No colour',
      }),
    );
    expect(style(doc)).toBeUndefined();
    expect(toJSON(doc).edges[0]).not.toHaveProperty('style');
  });

  it('moves the weight with arrows, Home and End, and says the value', async () => {
    const { user, doc } = setup();
    const slider = screen.getByRole('slider', { name: 'Weight' });
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(style(doc)).toEqual({ width: 3 });
    expect(slider).toHaveAttribute('aria-valuetext', '3 px');
    await user.keyboard('{End}');
    expect(style(doc)).toEqual({ width: 4 });
    await user.keyboard('{Home}');
    expect(style(doc)).toEqual({ width: 1 });
    await user.keyboard('{ArrowRight}{ArrowRight}');
    // 1.5 then 2: back to the default, which is not stored.
    expect(toJSON(doc).edges[0]).not.toHaveProperty('style');
  });

  it('shows Mixed for connectors that differ, and a pick writes that key to all', async () => {
    const { user, doc, editor } = setup(['op', 'py']);
    act(() => {
      editor().setEdgeStyle(['py'], { dash: 'dotted', width: 3 });
    });
    expect(screen.getAllByText('Mixed').length).toBeGreaterThanOrEqual(2);
    const dash = screen.getByRole('radiogroup', { name: 'Dash' });
    expect(within(dash).queryByRole('radio', { checked: true })).toBeNull();
    await user.click(within(dash).getByRole('radio', { name: 'Dashed' }));
    expect(style(doc, 0)).toEqual({ dash: 'dashed' });
    expect(style(doc, 1)).toEqual({ dash: 'dashed', width: 3 });
  });
});
