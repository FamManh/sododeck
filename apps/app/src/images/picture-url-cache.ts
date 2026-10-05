import type { PictureStore } from './picture-store';

export type PictureState =
  { status: 'loading' } | { status: 'ready'; url: string } | { status: 'missing' };

const LOADING: PictureState = { status: 'loading' };
const MISSING: PictureState = { status: 'missing' };

/** A picture's row can lag behind the document (another tab, a catch-up): look once more. */
export const RETRY_MS = 1000;

interface Entry {
  state: PictureState;
  refs: number;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setTimeout> | undefined;
  retried: boolean;
  dead: boolean;
  onFocus: () => void;
}

const entries = new Map<string, Entry>();

function setState(entry: Entry, state: PictureState): void {
  entry.state = state;
  for (const listener of [...entry.listeners]) listener();
}

async function load(store: PictureStore, id: string, entry: Entry): Promise<void> {
  let blob: Blob | null;
  try {
    blob = await store.get(id);
  } catch {
    blob = null;
  }
  if (entry.dead || entry.state.status === 'ready') return;
  if (blob !== null) {
    if (entry.timer !== undefined) clearTimeout(entry.timer);
    entry.timer = undefined;
    setState(entry, { status: 'ready', url: URL.createObjectURL(blob) });
    return;
  }
  if (entry.retried) {
    setState(entry, MISSING);
    return;
  }
  entry.retried = true;
  entry.timer = setTimeout(() => {
    entry.timer = undefined;
    void load(store, id, entry);
  }, RETRY_MS);
}

/** The state a picture has right now, without taking a share of it. */
export function peekPicture(store: PictureStore, id: string): PictureState {
  return entries.get(`${store.key}/${id}`)?.state ?? LOADING;
}

export interface PictureHandle {
  state: () => PictureState;
  subscribe: (listener: () => void) => () => void;
  release: () => void;
}

/**
 * Shares one object URL per picture of a deck (055): the first user loads it, the last one
 * revokes it. A missing picture shows as missing after one retry, and a window focus looks again.
 */
export function acquirePicture(store: PictureStore, id: string): PictureHandle {
  const key = `${store.key}/${id}`;
  let entry = entries.get(key);
  if (entry === undefined) {
    const created: Entry = {
      state: LOADING,
      refs: 0,
      listeners: new Set(),
      timer: undefined,
      retried: false,
      dead: false,
      onFocus: () => {
        if (created.state.status === 'missing') void load(store, id, created);
      },
    };
    entry = created;
    entries.set(key, entry);
    window.addEventListener('focus', entry.onFocus);
    void load(store, id, entry);
  }
  const mine = entry;
  mine.refs += 1;
  let released = false;
  return {
    state: () => mine.state,
    subscribe(listener) {
      mine.listeners.add(listener);
      return () => {
        mine.listeners.delete(listener);
      };
    },
    release() {
      if (released) return;
      released = true;
      mine.refs -= 1;
      if (mine.refs > 0) return;
      mine.dead = true;
      if (mine.timer !== undefined) clearTimeout(mine.timer);
      window.removeEventListener('focus', mine.onFocus);
      if (mine.state.status === 'ready') URL.revokeObjectURL(mine.state.url);
      entries.delete(key);
    },
  };
}
