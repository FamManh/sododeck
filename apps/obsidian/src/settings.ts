/**
 * The plugin's one setting (070 R11): where new pictures go. Pure part; the settings tab that
 * shows it lives in `settings-tab.ts` (glue).
 */
import type { PictureStorage } from './ports';

export interface SododeckSettings {
  pictureStorage: PictureStorage;
}

export const DEFAULT_SETTINGS: SododeckSettings = { pictureStorage: 'attachments' };

/** Anything stored that is not a known value falls back to the default (a hand-edited data.json). */
export function readSettings(stored: unknown): SododeckSettings {
  if (typeof stored !== 'object' || stored === null) return { ...DEFAULT_SETTINGS };
  const value = (stored as Record<string, unknown>).pictureStorage;
  return {
    pictureStorage: value === 'embedded' || value === 'attachments' ? value : 'attachments',
  };
}

export const PICTURE_STORAGE_LABELS: Record<PictureStorage, string> = {
  attachments: 'In the attachment folder (recommended)',
  embedded: 'Inside the deck file',
};
