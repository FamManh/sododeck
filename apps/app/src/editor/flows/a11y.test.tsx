/**
 * 006 accessibility pass (FR-040, constitution VII): every control has a name, and no state is
 * shown by color alone — error path, invalid, broken, chain break and filter matches all carry an
 * icon with a name or visible text.
 */
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { branchedDeck, flowDeck } from '../../test/flow-fixtures';
import { announced, renderFlows } from '../../test/render-flows';
import { recordClick, startEditing, startNewFlow } from './flow-session';

const unnamed = (root: HTMLElement) =>
  within(root)
    .queryAllByRole('button')
    .concat(within(root).queryAllByRole('textbox'), within(root).queryAllByRole('switch'))
    .filter((el) => (el.getAttribute('aria-label') ?? el.textContent).trim() === '' && !el.id);

describe('flow authoring accessibility', () => {
  it('names every button, field and switch in the list, the session and the inspectors', () => {
    const { editor, ui } = renderFlows(branchedDeck);
    expect(unnamed(document.body)).toEqual([]);
    act(() => {
      startEditing(editor(), 'pay');
      ui().setActiveBranch('fail');
    });
    expect(unnamed(document.body)).toEqual([]);
    expect(screen.getByRole('switch', { name: 'Error path' })).toHaveAccessibleDescription(
      'Draws dashed with an error icon',
    );
  });

  it('shows states with text, not only color', async () => {
    const { editor, ui, user } = renderFlows({
      ...branchedDeck,
      flows: [
        ...branchedDeck.flows,
        {
          id: 'odd',
          title: 'Odd',
          steps: [
            { id: 'o1', edge: 'ab' },
            { id: 'o2', edge: 'cd' },
            { id: 'o3', edge: 'gone' },
          ],
        },
      ],
    });
    // Error path: header text and badge name.
    act(() => {
      ui().setActiveFlow('pay');
    });
    expect(screen.getByRole('button', { name: /payment failed, error path/ })).toHaveTextContent(
      'error path',
    );
    expect(screen.getByRole('button', { name: /^Step 3b \(error path\)/ })).toBeInTheDocument();
    // Chain break and broken step: icon plus text.
    act(() => {
      ui().setActiveFlow('odd');
    });
    expect(screen.getByText("Doesn't start where step 1 ended")).toBeInTheDocument();
    expect(screen.getByText('Connection deleted')).toBeInTheDocument();
    // Filter match: a <mark>, bold and underlined.
    await user.click(screen.getByRole('button', { name: 'Back to canvas' }));
    await user.type(screen.getByRole('searchbox', { name: 'Filter flows' }), 'odd');
    expect(screen.getByText('Odd', { selector: 'mark' })).toHaveClass('font-semibold', 'underline');
    // Invalid click: announced with the reason.
    await user.clear(screen.getByRole('searchbox', { name: 'Filter flows' }));
    act(() => {
      startNewFlow('X', null);
      recordClick(editor(), 'ab');
      recordClick(editor(), 'ab');
    });
    expect(announced()).toMatch(/^Can't add .* as step 2\. It doesn't start at API Gateway\.$/);
    expect(screen.getByText('Edge not added')).toBeInTheDocument();
  });

  it('announces every recording and editing event from the contract', () => {
    const { editor } = renderFlows(flowDeck);
    const heard: string[] = [];
    act(() => {
      startNewFlow('Place', null);
      heard.push(announced());
      recordClick(editor(), 'ab');
      heard.push(announced());
    });
    expect(heard).toEqual([
      'Recording ‘Place’. Click a connection to add step 1.',
      'Step 1 added: Customer App → API Gateway',
    ]);
  });
});
