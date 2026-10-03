import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatDateRange,
  formatNumber,
  linkText,
  personInitials,
  valueText,
} from './field-format';

describe('field value formats (032)', () => {
  it('formats dates short, with the year only outside the current year', () => {
    expect(formatDate('2026-10-14', 2026)).toBe('14 Oct');
    expect(formatDate('2025-10-14', 2026)).toBe('14 Oct 2025');
    expect(formatDate('14/10', 2026)).toBe('14/10');
  });

  it('formats ranges in one month, across months, across years and equal ends', () => {
    expect(formatDateRange('2026-10-06', '2026-10-17', 2026)).toBe('6–17 Oct');
    expect(formatDateRange('2026-09-28', '2026-10-03', 2026)).toBe('28 Sep – 3 Oct');
    expect(formatDateRange('2026-10-06', '2026-10-06', 2026)).toBe('6 Oct');
    expect(formatDateRange('2025-12-28', '2026-01-03', 2026)).toBe('28 Dec 2025 – 3 Jan 2026');
    expect(formatDateRange('2027-10-06', '2027-10-17', 2026)).toBe('6–17 Oct 2027');
  });

  it('takes initials from the first two words', () => {
    expect(personInitials('Minh Tran')).toBe('MT');
    expect(personInitials('lan')).toBe('L');
    expect(personInitials('  Anh  Thu  Le ')).toBe('AT');
  });

  it('shows links without the scheme unless labelled, numbers with units', () => {
    expect(linkText({ url: 'https://runbook.sodo.dev/orders' })).toBe('runbook.sodo.dev/orders');
    expect(linkText({ url: 'mailto:a@x.io' })).toBe('a@x.io');
    expect(linkText({ url: 'https://x.io', label: 'X' })).toBe('X');
    expect(formatNumber(24, 'h')).toBe('24 h');
    expect(formatNumber(2.5, undefined)).toBe('2.5');
  });

  it('reads a value as text, or undefined when it does not fit', () => {
    const select = { kind: 'select' as const, options: [{ id: 'o', label: 'South' }] };
    expect(valueText(select, 'o')).toBe('South');
    expect(valueText(select, 'gone')).toBeUndefined();
    expect(valueText({ kind: 'progress' }, 140)).toBe('100 %');
    expect(valueText({ kind: 'number', unit: 'pts' }, 5)).toBe('5 pts');
    expect(valueText({ kind: 'text' }, '')).toBeUndefined();
  });
});
