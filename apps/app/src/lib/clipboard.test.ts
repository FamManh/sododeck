import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyText, couldNotCopyText } from './clipboard';

const setClipboard = (clipboard: unknown) => {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
};

afterEach(() => {
  setClipboard(undefined);
});

describe('copyText', () => {
  it('writes the text and resolves true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await expect(copyText('{"a":1}')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('{"a":1}');
  });

  it('resolves false when the clipboard is missing', async () => {
    setClipboard(undefined);
    await expect(copyText('x')).resolves.toBe(false);
  });

  it('resolves false when the write is refused', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    await expect(copyText('x')).resolves.toBe(false);
  });
});

describe('couldNotCopyText', () => {
  it('names the platform copy keys', () => {
    expect(couldNotCopyText(true)).toBe("Couldn't copy — select the text and press ⌘C");
    expect(couldNotCopyText(false)).toBe("Couldn't copy — select the text and press Ctrl+C");
  });
});
