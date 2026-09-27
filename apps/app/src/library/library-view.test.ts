import { describe, expect, it } from 'vitest';

import { deckRecord } from '../test/library-fixtures';
import {
  deckCountLabel,
  recentDecks,
  relativeTime,
  sectionTitle,
  selectDecks,
} from './library-view';

const decks = [
  deckRecord('a', { name: 'Payments flow', folderId: 'f1', updatedAt: 3 }),
  deckRecord('b', { name: 'Logistics', folderId: 'f2', updatedAt: 2 }),
  deckRecord('c', { name: 'Checkout PAYments', updatedAt: 1 }),
  deckRecord('d', { name: 'Gone', deletedAt: 5, updatedAt: 9, openedAt: 9 }),
];

describe('library views', () => {
  it('lists live decks by last edit, and a folder only its decks', () => {
    expect(selectDecks(decks, { section: 'all', search: '' }).map((d) => d.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(selectDecks(decks, { section: 'folder:f1', search: '' }).map((d) => d.id)).toEqual([
      'a',
    ]);
  });

  it('searches names trimmed and ignoring case', () => {
    expect(selectDecks(decks, { section: 'all', search: '  pay ' }).map((d) => d.id)).toEqual([
      'a',
      'c',
    ]);
    expect(selectDecks(decks, { section: 'all', search: 'zzz' })).toEqual([]);
  });

  it('keeps the 8 most recently opened decks, newest first', () => {
    const opened = Array.from({ length: 9 }, (_, i) =>
      deckRecord(`r${String(i)}`, { openedAt: 100 + i }),
    );
    const recent = recentDecks([...opened, deckRecord('never'), ...decks]);
    expect(recent.map((d) => d.id)).toEqual(['r8', 'r7', 'r6', 'r5', 'r4', 'r3', 'r2', 'r1']);
    expect(selectDecks(opened, { section: 'recent', search: '' })).toHaveLength(8);
  });

  it('has an empty Samples section', () => {
    expect(selectDecks(decks, { section: 'samples', search: '' })).toEqual([]);
  });

  it('names sections and counts decks', () => {
    const folders = [
      { id: 'f1', name: 'Payments', nameKey: 'payments', createdAt: 0, deletedAt: null },
    ];
    expect(sectionTitle('all', folders)).toBe('All decks');
    expect(sectionTitle('recent', folders)).toBe('Recent');
    expect(sectionTitle('folder:f1', folders)).toBe('Payments');
    expect(deckCountLabel(1)).toBe('1 deck · stored in this browser');
    expect(deckCountLabel(3)).toBe('3 decks · stored in this browser');
  });

  it('formats relative times', () => {
    const now = new Date(2026, 8, 27, 12).getTime();
    expect(relativeTime(now - 10_000, now)).toBe('just now');
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(relativeTime(now - 2 * 3_600_000, now)).toBe('2 hours ago');
    expect(relativeTime(now - 26 * 3_600_000, now)).toBe('yesterday');
    expect(relativeTime(now - 3 * 86_400_000, now)).toBe('3 days ago');
    expect(relativeTime(new Date(2026, 8, 18).getTime(), now)).toBe('Sep 18');
    expect(relativeTime(new Date(2025, 0, 2).getTime(), now)).toBe('Jan 2, 2025');
  });
});
