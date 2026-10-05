import { ToastProvider, Toaster } from '@sododeck/ui/components/toast';
import { act, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCopyReport } from './copy-report';

function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>
    {children}
    <Toaster />
  </ToastProvider>
);

afterEach(() => {
  stubClipboard(undefined);
});

describe('useCopyReport (062 R10)', () => {
  it('copies the built text, toasts the confirmation and keeps no fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const build = vi.fn(() => '{"a":1}');
    const { result } = renderHook(() => useCopyReport(build, 'Copied problems'), { wrapper });
    expect(result.current.status).toBe('idle');
    await act(() => result.current.copy());
    expect(writeText).toHaveBeenCalledWith('{"a":1}');
    expect(result.current.status).toBe('copied');
    expect(result.current.text).toBeNull();
    expect(await screen.findByText('Copied problems')).toBeInTheDocument();
  });

  it('exposes the text for a hand copy when the clipboard refuses', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const { result } = renderHook(() => useCopyReport(() => 'text', 'Copied report'), {
      wrapper,
    });
    await act(() => result.current.copy());
    expect(result.current.status).toBe('failed');
    expect(result.current.text).toBe('text');
    expect(await screen.findByText(/^Couldn't copy/)).toBeInTheDocument();
  });

  it('falls back when there is no clipboard API, and resets', async () => {
    stubClipboard(undefined);
    const { result } = renderHook(() => useCopyReport(() => 'x', 'Copied problems'), { wrapper });
    await act(() => result.current.copy());
    expect(result.current.text).toBe('x');
    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.text).toBeNull();
  });
});
