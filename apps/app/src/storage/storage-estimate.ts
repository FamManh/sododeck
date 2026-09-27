import { supportsPersistentStorage, supportsStorageEstimate } from '../lib/features';

export type PersistState = 'on' | 'off' | 'declined' | 'unsupported';

export interface StorageState {
  persisted: PersistState;
  /** Bytes, when the browser reports them (approximate). */
  usage?: number;
  quota?: number;
}

async function estimate(): Promise<Pick<StorageState, 'usage' | 'quota'>> {
  if (!supportsStorageEstimate()) return {};
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { ...(usage === undefined ? {} : { usage }), ...(quota === undefined ? {} : { quota }) };
  } catch {
    return {};
  }
}

/** Usage and persistence, feature-detected with a silent fallback (FR-030–FR-032, R11). */
export async function readStorageState(): Promise<StorageState> {
  const usage = await estimate();
  if (!supportsPersistentStorage() || typeof navigator.storage.persisted !== 'function') {
    return { persisted: 'unsupported', ...usage };
  }
  try {
    return { persisted: (await navigator.storage.persisted()) ? 'on' : 'off', ...usage };
  } catch {
    return { persisted: 'unsupported', ...usage };
  }
}

/** Asks the browser to keep the library; `declined` when it says no. */
export async function requestPersistence(): Promise<StorageState> {
  if (!supportsPersistentStorage()) return readStorageState();
  let granted: boolean;
  try {
    granted = await navigator.storage.persist();
  } catch {
    granted = false;
  }
  return { persisted: granted ? 'on' : 'declined', ...(await estimate()) };
}

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;

/** "1.2 MB", "300 kB", "10 GB" (decimal units, like the browsers' own settings pages). */
export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  // Intl's short form of "byte" is "byte"; the usual abbreviation reads better.
  if (unit === 0) return `${String(Math.round(value))} B`;
  return new Intl.NumberFormat('en', {
    style: 'unit',
    unit: UNITS[unit] ?? 'byte',
    unitDisplay: 'short',
    maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0,
  }).format(value);
}

/** Above this share of the quota the card warns (FR-033). */
export const STORAGE_WARNING_RATIO = 0.8;
