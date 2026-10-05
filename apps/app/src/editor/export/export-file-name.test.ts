import { describe, expect, it } from 'vitest';

import { exportFileName, formatBytes } from './export-file-name';

describe('exportFileName', () => {
  it('names decks and flows with a safe Unicode slug', () => {
    expect(exportFileName('Logistics Delivery', null, 'json')).toBe('logistics-delivery.sododeck');
    expect(exportFileName('Logistics Delivery', 'Place order', 'png')).toBe(
      'logistics-delivery-place-order.png',
    );
    expect(exportFileName('Giao hàng nhanh', null, 'svg')).toBe('giao-hàng-nhanh.svg');
    expect(exportFileName('注文フロー', null, 'svg')).toBe('注文フロー.svg');
    expect(exportFileName('🚀 !!!', null, 'svg')).toBe('untitled-deck.svg');
    expect(exportFileName(undefined, null, 'json')).toBe('untitled-deck.sododeck');
    expect(exportFileName('x'.repeat(200), null, 'png')).toBe(`${'x'.repeat(80)}.png`);
  });
});

describe('formatBytes', () => {
  it('uses binary units', () => {
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(12186)).toBe('11.9 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
});
