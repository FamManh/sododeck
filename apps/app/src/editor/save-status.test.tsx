import { serializeDeck } from '@sododeck/model';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as download from '../storage/download';
import { useSaveStatusStore } from '../storage/save-status';
import { deckOf, editorWrapper } from '../test/render-canvas';
import { SaveContext, type SaveControls } from './save-context';
import { SaveStatus } from './save-status';

const deck = deckOf({ name: 'Shop', nodes: [{ id: 'a', type: 'service', title: 'A' }] });

function setup(controls: Partial<SaveControls> = {}, variant: 'text' | 'icon' = 'text') {
  const save: SaveControls = {
    mode: 'stored',
    flush: vi.fn(() => Promise.resolve()),
    markExported: vi.fn(),
    ...controls,
  };
  const env = editorWrapper(deck);
  render(
    <SaveContext value={save}>
      <SaveStatus variant={variant} />
    </SaveContext>,
    { wrapper: env.wrapper },
  );
  return { save, user: userEvent.setup() };
}

const status = () =>
  screen.getAllByRole('status').find((el) => el.getAttribute('aria-live') === 'polite');

beforeEach(() => {
  useSaveStatusStore.getState().reset();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SaveStatus', () => {
  it('keeps "Saved in this browser" while a write is quick, "Saving…" after 1 s (051 US6)', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    try {
      setup();
      expect(status()).toHaveTextContent('Saved in this browser');
      expect(status()?.querySelector('svg')).not.toBeNull();
      act(() => {
        useSaveStatusStore.getState().dispatch({ type: 'pending' });
      });
      expect(status()).toHaveTextContent('Saved in this browser');
      expect(status()?.querySelector('.animate-spin, .motion-safe\\:animate-spin')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(status()).toHaveTextContent('Saving…');
      expect(status()?.querySelector('svg')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the error with Export, and details with Export and Retry', async () => {
    const downloadText = vi.spyOn(download, 'downloadText').mockImplementation(() => undefined);
    const { save, user } = setup();
    act(() => {
      useSaveStatusStore.getState().dispatch({
        type: 'failed',
        firstUnsavedAt: new Date(2026, 8, 27, 14, 32).getTime(),
        errorName: 'QuotaExceededError',
      });
    });
    const region = status();
    if (!region) throw new Error('no status');
    await user.click(within(region).getByRole('button', { name: 'Export' }));
    expect(downloadText).toHaveBeenCalledWith('Shop.sododeck.json', serializeDeck(deck));
    expect(save.markExported).toHaveBeenCalledOnce();

    await user.click(
      within(region).getByRole('button', { name: "Couldn't save — export a backup" }),
    );
    const details = screen.getByRole('dialog', { name: "Couldn't save your last change" });
    expect(details).toHaveTextContent('Unsaved since');
    expect(details).toHaveTextContent('02:32 PM');
    expect(details).toHaveTextContent('QuotaExceededError');
    await user.click(within(details).getByRole('button', { name: 'Retry' }));
    expect(save.flush).toHaveBeenCalledOnce();
    await user.click(within(details).getByRole('button', { name: 'Export .sododeck.json' }));
    expect(downloadText).toHaveBeenCalledTimes(2);
  });

  it('says "Demo · not saved" for the demo deck', () => {
    setup({ mode: 'demo' });
    expect(screen.getByText('Demo · not saved')).toBeInTheDocument();
  });

  describe('icon variant (018, §g-51)', () => {
    const icon = () => status()?.querySelector('svg');

    it('shows a different icon shape per state with the same words as its name', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      setup({}, 'icon');
      expect(status()).toHaveTextContent('Saved in this browser');
      expect(icon()).toHaveClass('lucide-check');
      act(() => {
        useSaveStatusStore.getState().dispatch({ type: 'pending' });
      });
      // A pending write looks saved until it has waited 1 s (051 US6).
      expect(icon()).toHaveClass('lucide-check');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      vi.useRealTimers();
      expect(status()).toHaveTextContent('Saving…');
      // The loader only spins when motion is allowed.
      expect(icon()).toHaveClass('lucide-loader-circle', 'motion-safe:animate-spin');
    });

    it('opens the error details from the alert icon', async () => {
      const { save, user } = setup({}, 'icon');
      act(() => {
        useSaveStatusStore.getState().dispatch({
          type: 'failed',
          firstUnsavedAt: Date.now(),
          errorName: 'QuotaExceededError',
        });
      });
      const region = status();
      if (!region) throw new Error('no status');
      expect(icon()).toHaveClass('lucide-circle-alert');
      await user.click(
        within(region).getByRole('button', { name: "Couldn't save — export a backup" }),
      );
      const details = screen.getByRole('dialog', { name: "Couldn't save your last change" });
      await user.click(within(details).getByRole('button', { name: 'Retry' }));
      expect(save.flush).toHaveBeenCalledOnce();
    });
  });
});
