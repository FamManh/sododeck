import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { branchedDeck, flowDeck } from '../../test/flow-fixtures';
import { deckOf } from '../../test/render-canvas';
import { announced, renderFlows } from '../../test/render-flows';
import { recordClick, startEditing, startNewFlow } from './flow-session';

const steps = () => screen.getByRole('list', { name: 'Steps' });
const rowTexts = () =>
  within(steps())
    .getAllByRole('button', { name: /^Step / })
    .map((b) => b.textContent);

describe('StepList while recording (US1, US2)', () => {
  it('shows "No steps yet" and the first hint, then rows, numbers, labels and the next hint', () => {
    const { editor } = renderFlows(flowDeck);
    act(() => {
      startNewFlow('Place', 'delivery');
    });
    expect(screen.getByText('New flow · Delivery')).toBeInTheDocument();
    expect(screen.getByText('No steps yet')).toBeInTheDocument();
    expect(screen.getByText('Click any connection to add step 1.')).toBeInTheDocument();
    act(() => {
      recordClick(editor(), 'ab');
      recordClick(editor(), 'bc');
    });
    const rows = within(steps()).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('1Customer App → API GatewayHTTPS');
    expect(rows[1]).toHaveTextContent('2API Gateway → Order ServicePOST /orders');
    expect(screen.getByText('Next: click an edge leaving Order Service')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Steps/ })).toHaveTextContent('2');
  });

  it('shows the refused click in the step list, with nothing added', () => {
    const { editor, doc } = renderFlows(flowDeck);
    act(() => {
      startNewFlow('Place', null);
      recordClick(editor(), 'ab');
      recordClick(editor(), 'cd');
    });
    expect(screen.getByText('Edge not added')).toBeInTheDocument();
    expect(
      screen.getByText("Order Service → Event Bus doesn't start at API Gateway."),
    ).toBeInTheDocument();
    expect(toJSON(doc).flows.at(-1)?.steps).toHaveLength(1);
  });

  it('says when the flow cannot continue', () => {
    const { editor } = renderFlows(flowDeck);
    act(() => {
      startNewFlow('Place', null);
      recordClick(editor(), 'cd');
    });
    expect(
      screen.getByText("This flow can't continue from Event Bus. Press Done, or add a branch."),
    ).toBeInTheDocument();
  });

  it('says a flow needs connections on a deck without any', () => {
    renderFlows(deckOf({ nodes: [{ id: 'a', type: 'service', title: 'A' }] }));
    act(() => {
      startNewFlow('X', null);
    });
    expect(
      screen.getByText('A flow needs connections. Draw some on the canvas first.'),
    ).toBeInTheDocument();
  });
});

describe('StepList editing (US3, FR-019a, FR-021)', () => {
  it('shows the title as the main line once set, and the condition on the second', () => {
    const { editor, ui } = renderFlows(flowDeck);
    act(() => {
      ui().setActiveFlow('place');
      editor().updateStep('place', 's1', { title: 'Open app', condition: 'logged in' });
    });
    expect(within(steps()).getAllByRole('listitem')[0]).toHaveTextContent(
      '1Open appHTTPS · logged in',
    );
    expect(rowTexts()).toHaveLength(2);
  });

  it('flags a chain break with an icon and text after ⌥↓ in edit mode', async () => {
    const { editor, user } = renderFlows(flowDeck);
    act(() => {
      startEditing(editor(), 'place');
    });
    act(() => {
      within(steps())
        .getAllByRole('button', { name: /^Step 1/ })[0]
        ?.focus();
    });
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(announced()).toBe('Moved to position 2 of 2');
    expect(screen.getByText("Doesn't start where step 1 ended")).toBeInTheDocument();
  });

  it('⌫ removes the focused step with no dialog; ⌘Z brings it back', async () => {
    const { editor, user, doc } = renderFlows(flowDeck);
    act(() => {
      startEditing(editor(), 'place');
    });
    act(() => {
      within(steps())
        .getAllByRole('button', { name: /^Step 2/ })[0]
        ?.focus();
    });
    await user.keyboard('{Backspace}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(toJSON(doc).flows[0]?.steps.map((s) => s.id)).toEqual(['s1']);
    expect(announced()).toBe('Removed step 2');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).flows[0]?.steps.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('removes a step with its row button', async () => {
    const { editor, user, doc } = renderFlows(flowDeck);
    act(() => {
      startEditing(editor(), 'place');
    });
    await user.click(screen.getByRole('button', { name: 'Remove step 1' }));
    expect(toJSON(doc).flows[0]?.steps.map((s) => s.id)).toEqual(['s2']);
  });
});

describe('StepList branches (US4)', () => {
  it('shows "◇" headers, 3a/3b numbering, the error-path text and "2 + 2 branches"', () => {
    const { ui } = renderFlows(branchedDeck);
    act(() => {
      ui().setActiveFlow('pay');
    });
    expect(screen.getByRole('heading', { name: /Steps/ })).toHaveTextContent('2 + 2 branches');
    expect(screen.getByRole('button', { name: 'Branch a: payment ok' })).toBeInTheDocument();
    const error = screen.getByRole('button', { name: 'Branch b: payment failed, error path' });
    expect(error).toHaveTextContent('error path');
    expect(
      within(screen.getByRole('list', { name: 'Branch b' })).getByText('3b'),
    ).toBeInTheDocument();
  });

  it('B on a branch step is refused; B on the branch step itself adds a branch', async () => {
    const { editor, user, ui } = renderFlows(branchedDeck);
    act(() => {
      startEditing(editor(), 'pay');
    });
    act(() => {
      within(screen.getByRole('list', { name: 'Branch a' }))
        .getByRole('button', { name: /^Step 3a/ })
        .focus();
    });
    await user.keyboard('b');
    expect(announced()).toBe('Branches can only start from the main path.');
    act(() => {
      within(steps())
        .getAllByRole('button', { name: /^Step 1/ })[0]
        ?.focus();
    });
    await user.keyboard('b');
    expect(announced()).toBe('This flow already branches after step 2.');
    act(() => {
      within(steps())
        .getAllByRole('button', { name: /^Step 2/ })[0]
        ?.focus();
    });
    await user.keyboard('b');
    expect(ui().flowSession?.addingBranch).toBe(true);
    expect(screen.getByText('Editing ‘Pay’ · adding branch after step 2')).toBeInTheDocument();
  });

  it('⌫ on the branch step is refused while branches exist', async () => {
    const { editor, user, doc } = renderFlows(branchedDeck);
    act(() => {
      startEditing(editor(), 'pay');
    });
    act(() => {
      within(steps())
        .getAllByRole('button', { name: /^Step 2/ })[0]
        ?.focus();
    });
    await user.keyboard('{Backspace}');
    expect(announced()).toBe('Delete its branches first');
    expect(toJSON(doc).flows.at(-1)?.steps).toHaveLength(4);
  });
});

describe('broken steps (US5, clarification Q2)', () => {
  it('shows "Connection deleted", keeps Done enabled, and does not flag neighbours', () => {
    const { editor } = renderFlows({
      ...flowDeck,
      flows: [
        {
          id: 'place',
          title: 'Place order',
          steps: [
            { id: 's1', edge: 'ab' },
            { id: 's2', edge: 'bc', title: 'Create order' },
            { id: 's3', edge: 'cd' },
          ],
        },
      ],
    });
    act(() => {
      editor().remove('edges', 'bc');
      startEditing(editor(), 'place');
    });
    const rows = within(steps()).getAllByRole('listitem');
    expect(rows[1]).toHaveTextContent('Create orderConnection deleted');
    expect(screen.queryByText(/Doesn't start where/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('reads "Unknown connection" for an untitled broken step; removing it keeps the others', async () => {
    const { editor, user, doc } = renderFlows(flowDeck);
    act(() => {
      editor().remove('edges', 'ab');
      startEditing(editor(), 'place');
    });
    expect(within(steps()).getAllByRole('listitem')[0]).toHaveTextContent(
      'Unknown connectionConnection deleted',
    );
    await user.click(screen.getByRole('button', { name: 'Remove step 1' }));
    expect(toJSON(doc).flows[0]?.steps.map((s) => s.id)).toEqual(['s2']);
  });
});
