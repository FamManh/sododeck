import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Toaster, ToastProvider, useToast, type ToastOptions } from '../src/components/toast';

function Trigger({ options }: { options: ToastOptions[] }) {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        for (const option of options) toast(option);
      }}
    >
      Trigger
    </button>
  );
}

function renderWith(...options: ToastOptions[]) {
  render(
    <ToastProvider>
      <Trigger options={options} />
      <Toaster />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
}

function mockReducedMotion(reduced: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: reduced && query.includes('reduce'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Toast', () => {
  it('shows the message and dismisses itself after 2.6 s', () => {
    renderWith({ message: 'View saved' });
    expect(screen.getByText('View saved', { selector: '[data-slot=toast-message]' })).toBeVisible();

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(
      screen.queryByText('View saved', { selector: '[data-slot=toast-message]' }),
    ).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('View saved', { selector: '[data-slot=toast-message]' })).toBeNull();
  });

  it('announces the message politely', () => {
    renderWith({ message: 'View saved' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const regions = [...document.querySelectorAll('[aria-live]')].filter((region) =>
      region.textContent.includes('View saved'),
    );
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.some((region) => region.getAttribute('aria-live') === 'polite')).toBe(true);
  });

  it('runs its action', () => {
    const onAction = vi.fn();
    renderWith({ message: 'Node deleted', action: { label: 'Undo', onAction } });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('shows several toasts in call order', () => {
    renderWith({ message: 'First' }, { message: 'Second' }, { message: 'Third' });
    const messages = [...document.querySelectorAll('[data-slot=toast-message]')].map(
      (node) => node.textContent,
    );
    expect(messages).toEqual(['First', 'Second', 'Third']);
  });

  it('keeps the 2.6 s reading time and drops animation under reduced motion', () => {
    mockReducedMotion(true);
    renderWith({ message: 'View saved' });
    const toast = document.querySelector('[data-slot=toast]');
    expect(toast).toHaveAttribute('data-reduced-motion', 'true');

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(
      screen.queryByText('View saved', { selector: '[data-slot=toast-message]' }),
    ).not.toBeNull();
  });
});
