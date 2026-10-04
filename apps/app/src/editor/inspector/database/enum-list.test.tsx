import { toJSON } from '@sododeck/model';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { shopDeck } from '../../../db/fixtures/shop';
import { useUiStore } from '../../../state/ui-store';
import { renderWithEditor } from '../../../test/render-canvas';
import { EnumList } from './enum-list';

beforeEach(() => {
  useUiStore.getState().resetForDeck();
});

describe('EnumList (052 US4)', () => {
  it('lists the deck enums with their value counts; a row opens the enum drawer', async () => {
    const user = userEvent.setup();
    renderWithEditor(<EnumList deck={shopDeck('postgres')} />, shopDeck('postgres'));
    const row = screen.getByRole('button', { name: /order_status/ });
    expect(row).toHaveTextContent('4 values');
    await user.click(row);
    expect(useUiStore.getState().drawer).toMatchObject({
      open: true,
      mode: 'enum',
      enumId: 'enum.order_status',
    });
  });

  it('"Add enum" creates enum_n and opens its drawer with the name selected', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(
      <EnumList deck={shopDeck('postgres')} />,
      shopDeck('postgres'),
    );
    await user.click(screen.getByRole('button', { name: 'Add enum' }));
    const added = toJSON(doc).enums?.find((e) => e.name === 'enum_1');
    expect(added).toBeDefined();
    expect(useUiStore.getState().enumNameSelect).toBe(added?.id);
  });

  it('says so when the deck has no enums', () => {
    renderWithEditor(<EnumList deck={{ ...shopDeck('postgres'), enums: [] }} />);
    expect(screen.getByText('No enums yet.')).toBeInTheDocument();
  });
});
