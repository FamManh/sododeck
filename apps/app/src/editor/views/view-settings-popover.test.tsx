import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { Canvas } from '../canvas';
import { ViewSwitcher } from './view-switcher';

const deck = deckOf({
  nodes: [
    { id: 'app', type: 'client', title: 'App', group: 'clients', tags: ['mobile'] },
    { id: 'api', type: 'service', title: 'API', group: 'core', tags: ['legacy'] },
    { id: 'db', type: 'database', title: 'DB', group: 'data' },
  ],
  groups: [
    { id: 'clients', title: 'Clients' },
    { id: 'core', title: 'Core' },
    { id: 'data', title: 'Data', parent: 'core' },
  ],
  edges: [
    { id: 'e1', from: 'app', to: 'api' },
    { id: 'e2', from: 'api', to: 'db' },
  ],
  features: [{ id: 'checkout', title: 'Checkout' }],
  views: [
    { id: 'sys', type: 'system', title: 'System' },
    { id: 'mine', type: 'custom', title: 'Mine', feature: 'gone' },
  ],
});

function Harness() {
  return (
    <>
      <ViewSwitcher />
      <Canvas />
    </>
  );
}

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: 'Mine, custom view' }));
  await user.click(screen.getByRole('button', { name: 'View options for Mine' }));
  await user.click(screen.getByRole('menuitem', { name: 'View settings…' }));
  return screen.findByRole('dialog', { name: 'View settings: Mine' });
}

describe('view settings popover (FR-043)', () => {
  it('lists subtitle choices and the types of packs that are on and the tags the deck uses', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Harness />, deck);
    const dialog = await openSettings(user);
    const subtitle = within(dialog).getByRole('radiogroup', { name: 'Subtitle' });
    expect(within(subtitle).getAllByRole('radio')).toHaveLength(5);
    expect(within(subtitle).getByRole('radio', { name: 'Flows · owner' })).toBeInTheDocument();
    const names = (name: string) =>
      within(within(dialog).getByRole('group', { name }))
        .getAllByRole('checkbox')
        .map((box) => box.id)
        .map((id) => document.querySelector(`label[for="${id}"]`)?.textContent);
    expect(names('Hide groups')).toEqual(['Clients', 'Core', 'Data']);
    const architecture = [
      'Service',
      'Database',
      'Gateway',
      'Client',
      'Queue',
      'External',
      'Component',
    ];
    expect(names('Hide types')).toEqual(architecture);
    expect(names('Hide tags')).toEqual(['legacy', 'mobile']);
    expect(names('Dim types')).toEqual(architecture);
  });

  it('shows a deleted feature, and offers All features or a feature', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Harness />, deck);
    const dialog = await openSettings(user);
    const feature = within(dialog).getByRole('combobox', { name: 'Feature' });
    expect(feature).toHaveTextContent('gone (deleted)');
    await user.click(feature);
    await user.click(await screen.findByRole('option', { name: 'All features' }));
    expect(toJSON(doc).views[1]?.feature).toBeUndefined();
  });

  it('hides a group in this view only, one undo step per change', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(<Harness />, deck);
    const dialog = await openSettings(user);
    const groups = within(dialog).getByRole('group', { name: 'Hide groups' });
    await user.click(within(groups).getByRole('checkbox', { name: 'Clients' }));
    await user.click(within(dialog).getByRole('radio', { name: 'Owner' }));
    expect(toJSON(doc).views[1]).toMatchObject({
      excludeGroups: ['clients'],
      subtitleField: 'owner',
    });
    expect(screen.queryByRole('group', { name: 'Client: App' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Service: API' })).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).views[1]?.subtitleField).toBeUndefined();
    expect(toJSON(doc).views[1]?.excludeGroups).toEqual(['clients']);
    act(() => {
      useUiStore.getState().switchView('sys');
    });
    expect(screen.getByRole('group', { name: 'Client: App' })).toBeInTheDocument();
  });

  it('closes with Esc and returns focus to the tab', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Harness />, deck);
    await openSettings(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'View settings: Mine' })).not.toBeInTheDocument();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(screen.getByRole('tab', { name: 'Mine, custom view' })).toHaveFocus();
  });
});

describe('view settings: tags by key (033)', () => {
  const cased = deckOf({
    nodes: [
      { id: 'a', type: 'client', title: 'A', tags: ['PCI'] },
      { id: 'b', type: 'service', title: 'B', tags: ['pci', 'Lan'] },
    ],
    views: [
      { id: 'sys', type: 'system', title: 'System' },
      { id: 'mine', type: 'custom', title: 'Mine' },
    ],
  });

  it('lists one entry per tag key, and hiding stores the display spelling', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Harness />, cased);
    const dialog = await openSettings(user);
    const group = within(dialog).getByRole('group', { name: 'Hide tags' });
    expect(within(group).getAllByRole('checkbox')).toHaveLength(2);
    await user.click(within(group).getByRole('checkbox', { name: 'PCI' }));
    expect(toJSON(doc).views.find((v) => v.id === 'mine')?.excludeTags).toEqual(['PCI']);
    await user.click(within(group).getByRole('checkbox', { name: 'PCI' }));
    expect(toJSON(doc).views.find((v) => v.id === 'mine')?.excludeTags).toBeUndefined();
  });

  it('shows a tag as hidden when the stored spelling differs only in case', async () => {
    const user = userEvent.setup();
    const stored = {
      ...cased,
      views: [
        { id: 'sys', type: 'system' as const, title: 'System' },
        { id: 'mine', type: 'custom' as const, title: 'Mine', excludeTags: ['pci'] },
      ],
    };
    renderWithEditor(<Harness />, stored);
    const dialog = await openSettings(user);
    expect(within(dialog).getByRole('checkbox', { name: 'PCI' })).toBeChecked();
  });

  it('groups types by category and keeps a hidden type whose pack is off (030)', async () => {
    const user = userEvent.setup();
    renderWithEditor(
      <Harness />,
      deckOf({
        ...deck,
        packs: ['architecture', 'process'],
        views: [
          { id: 'sys', type: 'system', title: 'System' },
          { id: 'mine', type: 'custom', title: 'Mine', excludeKinds: ['warehouse'] },
        ],
      }),
    );
    const dialog = await openSettings(user);
    const hide = within(dialog).getByRole('group', { name: 'Hide types' });
    expect(
      within(hide)
        .getAllByRole('group')
        .map((g) => g.getAttribute('aria-labelledby'))
        .map((id) => document.getElementById(id ?? '')?.textContent),
    ).toEqual(['Process', 'Architecture', 'Logistics']);
    expect(within(hide).getByRole('checkbox', { name: 'Warehouse' })).toBeChecked();
    expect(within(hide).queryByRole('checkbox', { name: 'Truck route' })).toBeNull();
  });
});
