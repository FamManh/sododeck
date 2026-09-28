import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob, downloadText, safeFileName } from './download';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('safeFileName', () => {
  it('replaces characters file systems refuse', () => {
    expect(safeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
    expect(safeFileName('tab\there\u0000')).toBe('tab-here-');
  });

  it('collapses spaces, trims and limits the length', () => {
    expect(safeFileName('  Payments   flow  ')).toBe('Payments flow');
    expect(safeFileName('x'.repeat(150))).toHaveLength(100);
  });

  it('falls back to "Untitled deck"', () => {
    expect(safeFileName('   ')).toBe('Untitled deck');
    expect(safeFileName('')).toBe('Untitled deck');
  });
});

describe('downloadText', () => {
  it('downloads a supplied blob with its MIME type', async () => {
    const create = vi.fn(() => 'blob:svg');
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    downloadBlob('diagram.svg', blob);
    expect(create).toHaveBeenCalledWith(blob);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revoke).toHaveBeenCalledWith('blob:svg');
  });
  it('clicks a temporary anchor with the file name and revokes the URL', async () => {
    const create = vi.fn(() => 'blob:test');
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this);
    });

    downloadText('Shop.sododeck.json', '{}\n');

    expect(clicks).toHaveLength(1);
    expect(clicks[0]?.download).toBe('Shop.sododeck.json');
    expect(clicks[0]?.getAttribute('href')).toBe('blob:test');
    expect(document.querySelector('a[download]')).toBeNull();
    const blob = (create.mock.calls[0] as unknown[] | undefined)?.[0];
    expect(blob).toBeInstanceOf(Blob);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
