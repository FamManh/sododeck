/**
 * Pure derived views of the library (data-model.md "Derived views"). Records come from Dexie;
 * nothing here reads or writes the database.
 */
import type { DeckRecord, FolderRecord } from '../storage/library-db';

export type LibrarySection = 'all' | 'recent' | 'samples' | `folder:${string}`;

export const RECENT_LIMIT = 8;

export function folderSection(id: string): LibrarySection {
  return `folder:${id}`;
}

/** The folder id of a folder section, else `null`. */
export function sectionFolderId(section: LibrarySection): string | null {
  return section.startsWith('folder:') ? section.slice('folder:'.length) : null;
}

const live = (decks: readonly DeckRecord[]) => decks.filter((d) => d.deletedAt === null);

/** Recent (FR-011): the 8 most recently opened decks, newest first. */
export function recentDecks(decks: readonly DeckRecord[]): DeckRecord[] {
  return live(decks)
    .filter((d): d is DeckRecord & { openedAt: number } => d.openedAt !== null)
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, RECENT_LIMIT);
}

export function matchesSearch(name: string, search: string): boolean {
  const query = search.trim().toLocaleLowerCase('en');
  return query === '' || name.toLocaleLowerCase('en').includes(query);
}

/** The decks of a section, filtered by the search text (FR-012). */
export function selectDecks(
  decks: readonly DeckRecord[],
  { section, search }: { section: LibrarySection; search: string },
): DeckRecord[] {
  const folderId = sectionFolderId(section);
  const inSection =
    section === 'recent'
      ? recentDecks(decks)
      : section === 'samples'
        ? [] // TODO(M5): sample decks (013).
        : live(decks)
            .filter((d) => folderId === null || d.folderId === folderId)
            .sort((a, b) => b.updatedAt - a.updatedAt);
  return inSection.filter((d) => matchesSearch(d.name, search));
}

export function sectionTitle(section: LibrarySection, folders: readonly FolderRecord[]): string {
  switch (section) {
    case 'all':
      return 'All decks';
    case 'recent':
      return 'Recent';
    case 'samples':
      return 'Samples';
    default: {
      const id = sectionFolderId(section);
      return folders.find((f) => f.id === id)?.name ?? 'All decks';
    }
  }
}

export function deckCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'deck' : 'decks'} · stored in this browser`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const sameYear = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
const otherYear = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago", then "Sep 18". */
export function relativeTime(ms: number, now: number): string {
  const age = Math.max(0, now - ms);
  if (age < MINUTE) return 'just now';
  if (age < HOUR) return relative.format(-Math.floor(age / MINUTE), 'minute');
  if (age < DAY) return relative.format(-Math.floor(age / HOUR), 'hour');
  if (age < 7 * DAY) return relative.format(-Math.floor(age / DAY), 'day');
  const date = new Date(ms);
  return (date.getFullYear() === new Date(now).getFullYear() ? sameYear : otherYear).format(date);
}
