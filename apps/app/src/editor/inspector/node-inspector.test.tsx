import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { inspectorDeck } from '../../test/inspector-fixtures';
import { renderInspector } from '../../test/render-inspector';

const setup = () => renderInspector(inspectorDeck, { nodes: ['p'] });
const node = (doc: Parameters<typeof toJSON>[0]) => toJSON(doc).nodes[1];

describe('NodeInspector (story 1, FR-008)', () => {
  it('shows the kind tile, title and "Kind · Group · id", and deletes through the dialog', async () => {
    const { user, ui } = setup();
    expect(screen.getByRole('heading', { name: 'Pricing Service' })).toBeInTheDocument();
    expect(screen.getByText('Service · Core · p')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete component' }));
    expect(ui().pendingDelete).toEqual({ targets: [{ scope: 'nodes', id: 'p' }] });
  });

  it('changes kind and group by picking, each one undo step; "No group" clears', async () => {
    const { user, doc, editor } = setup();
    const kind = screen.getByRole('combobox', { name: 'Kind' });
    await user.clear(kind);
    await user.type(kind, 'data');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(node(doc)?.type).toBe('database');
    const group = screen.getByRole('combobox', { name: 'Group' });
    await user.clear(group);
    await user.type(group, 'no');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(node(doc)?.group).toBeUndefined();
    expect(screen.getByText('Database · No group · p')).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(node(doc)).toMatchObject({ type: 'database', group: 'core' });
    act(() => {
      editor().undo();
    });
    expect(node(doc)?.type).toBe('service');
  });

  it('edits every knowledge field, and one ⌘Z undoes only the last one', async () => {
    const { user, doc, editor } = setup();
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.type(title, ' v2');
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'Returns a fee.{Enter}{Enter}- uses `Delivery tier`',
    );
    await user.click(screen.getByRole('radio', { name: 'Preview' }));
    const preview = screen.getByRole('region', { name: 'Description preview' });
    expect(within(preview).getByRole('listitem')).toHaveTextContent('uses Delivery tier');

    const owner = screen.getByRole('combobox', { name: 'Owner' });
    await user.clear(owner);
    await user.type(owner, 'Or');
    expect(
      within(screen.getByRole('listbox', { name: 'Owner suggestions' })).getByRole('option', {
        name: 'Orders',
      }),
    ).toBeInTheDocument();
    await user.clear(owner);
    await user.type(owner, 'Platform{Enter}');
    const tech = screen.getByRole('textbox', { name: 'Tech' });
    await user.clear(tech);
    await user.type(tech, 'Python{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Host' }), 'eu-west k8s{Enter}');
    await user.type(
      screen.getByRole('combobox', { name: 'Add tag' }),
      ' PCI {Enter}Billing{Enter}',
    );
    const addLink = screen.getByRole('textbox', { name: 'Add link' });
    await user.type(addLink, 'javascript:alert(1){Enter}');
    expect(screen.getByText('Only http, https or relative links')).toBeInTheDocument();
    await user.clear(addLink);
    await user.type(addLink, 'https://runbooks.example.com/pricing{Enter}');
    await user.tab();

    expect(node(doc)).toMatchObject({
      title: 'Pricing Service v2',
      description: 'Returns a fee.\n\n- uses `Delivery tier`',
      owner: 'Platform',
      tech: 'Python',
      host: 'eu-west k8s',
      tags: ['critical', 'pci', 'billing'],
      links: [{ url: 'https://runbooks.example.com/pricing', label: 'runbooks.example.com' }],
    });
    expect(screen.getByRole('heading', { name: 'Pricing Service v2' })).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(node(doc)?.links).toBeUndefined();
    expect(node(doc)?.tags).toEqual(['critical', 'pci', 'billing']);
  });

  it('lists connections with direction, and choosing one selects it', async () => {
    const { user, ui } = setup();
    const list = screen.getByRole('list', { name: 'Connections' });
    expect(screen.getByRole('heading', { name: 'Connections · 3' })).toBeInTheDocument();
    expect(
      within(list)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['← Order Service', '→ Payment Service', '← Dispatch Service']);
    await user.click(within(list).getByRole('button', { name: '→ Payment Service' }));
    expect(ui().selection).toEqual({ nodes: [], edges: ['py'], stickies: [] });
    expect(
      screen.getByRole('heading', { name: 'Pricing Service → Payment Service' }),
    ).toBeInTheDocument();
  });
});
