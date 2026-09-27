import { ToastProvider, Toaster } from '@sododeck/ui/components/toast';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StorageCard } from './storage-card';

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(storage: Partial<StorageManager> | undefined) {
  vi.stubGlobal('navigator', storage === undefined ? {} : { storage });
  render(
    <ToastProvider>
      <StorageCard refreshKey={0} />
      <Toaster />
    </ToastProvider>,
  );
  return userEvent.setup();
}

const estimate = (usage: number, quota: number) => () => Promise.resolve({ usage, quota });

describe('StorageCard', () => {
  it('shows usage and Off with a request button; granting turns it On with a toast', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    const user = setup({
      estimate: estimate(1_200_000, 10_000_000),
      persisted: () => Promise.resolve(false),
      persist,
    });
    const card = await screen.findByRole('region', { name: 'Browser storage' });
    expect(within(card).getByRole('meter', { name: 'Storage used' })).toHaveAttribute(
      'aria-valuenow',
      '12',
    );
    expect(card).toHaveTextContent('1.2 MB of 10 MB used');
    expect(card).toHaveTextContent('Persistent storage · Off');
    await user.click(within(card).getByRole('button', { name: 'Request persistent storage' }));
    expect(persist).toHaveBeenCalledOnce();
    expect(await within(card).findByText('On')).toBeInTheDocument();
    expect(card).toHaveTextContent('Persistent storage · On');
    expect(card.querySelector('svg.lucide-shield-check')).not.toBeNull();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    expect(await screen.findByText('Persistent storage is on')).toBeInTheDocument();
  });

  it('explains a refusal and keeps the card Off', async () => {
    const user = setup({
      estimate: estimate(1000, 10_000_000),
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(false),
    });
    const card = await screen.findByRole('region', { name: 'Browser storage' });
    await user.click(within(card).getByRole('button', { name: 'Request persistent storage' }));
    expect(
      await within(card).findByText('Browser declined. Try again after installing the app.'),
    ).toBeInTheDocument();
    expect(card).toHaveTextContent('Persistent storage · Off');
  });

  it('falls back silently where persistence is unsupported', async () => {
    setup(undefined);
    const card = await screen.findByRole('region', { name: 'Browser storage' });
    expect(card).toHaveTextContent('Not persistent in this browser');
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    expect(within(card).queryByRole('meter')).not.toBeInTheDocument();
  });

  it('warns with an icon above 80 % usage', async () => {
    setup({
      estimate: estimate(9_000_000, 10_000_000),
      persisted: () => Promise.resolve(true),
      persist: () => Promise.resolve(true),
    });
    const warning = await screen.findByText(
      'Storage is almost full. Export decks you want to keep.',
    );
    expect(warning.querySelector('svg')).not.toBeNull();
  });
});
