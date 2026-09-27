import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { branchedDeck, flowDeck } from '../../test/flow-fixtures';
import { renderFlows } from '../../test/render-flows';
import { startEditing } from './flow-session';

const inspector = () => screen.getByRole('complementary', { name: 'Inspector' });

describe('InspectorFlow (US3, FR-003)', () => {
  it('edits title, description and owner (with suggestions), each one undo step', async () => {
    const withOwners = {
      ...flowDeck,
      features: [
        { id: 'delivery', title: 'Delivery', owner: 'Ordering' },
        ...flowDeck.features.slice(1),
      ],
    };
    const { user, doc, editor } = renderFlows(withOwners);
    // Flow mode shows the current step (007); the flow's fields show while editing its steps.
    act(() => {
      startEditing(editor(), 'place');
    });
    expect(screen.getByRole('heading', { name: 'Place order' })).toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Checkout{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Pays **now**');
    await user.tab();
    const owner = screen.getByRole('combobox', { name: 'Owner' });
    await user.type(owner, 'ord');
    expect(
      within(screen.getByRole('listbox', { name: 'Owner suggestions' })).getByRole('option', {
        name: 'Ordering',
      }),
    ).toBeInTheDocument();
    await user.clear(owner);
    await user.type(owner, 'Mobile{Enter}');
    expect(toJSON(doc).flows[0]).toMatchObject({
      title: 'Checkout',
      description: 'Pays **now**',
      owner: 'Mobile',
    });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).flows[0]?.owner).toBeUndefined();
    expect(inspector()).toBeInTheDocument();
  });

  it('adds Write / Preview, tags, links and the summary line (008 story 2)', async () => {
    const broken = {
      ...branchedDeck,
      edges: branchedDeck.edges.filter((e) => e.id !== 'cx'),
    };
    const { user, doc, editor } = renderFlows(broken);
    act(() => {
      startEditing(editor(), 'pay');
    });
    expect(screen.getByText('4 steps · 2 branches · 4 components')).toBeInTheDocument();
    expect(screen.getByText(/1 broken step/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Description' }), '- charge `card`');
    await user.click(screen.getByRole('radio', { name: 'Preview' }));
    expect(
      within(screen.getByRole('region', { name: 'Description preview' })).getByRole('listitem'),
    ).toHaveTextContent('charge card');
    await user.type(screen.getByRole('combobox', { name: 'Add tag' }), 'Checkout{Enter}');
    await user.type(
      screen.getByRole('textbox', { name: 'Add link' }),
      'https://example.com/brief{Enter}',
    );
    expect(toJSON(doc).flows.find((f) => f.id === 'pay')).toMatchObject({
      description: '- charge `card`',
      tags: ['checkout'],
      links: [{ url: 'https://example.com/brief', label: 'example.com' }],
    });
  });

  it('shows the feature select and "Edit steps" for a flow without steps in flow mode', async () => {
    const { user, ui } = renderFlows(flowDeck);
    act(() => {
      ui().setActiveFlow('assign');
    });
    expect(screen.getByRole('combobox', { name: 'Feature' })).toHaveTextContent('Delivery');
    await user.click(screen.getAllByRole('button', { name: 'Edit steps' })[0] as HTMLElement);
    expect(ui().flowSession).toMatchObject({ mode: 'edit', flowId: 'assign' });
  });
});
