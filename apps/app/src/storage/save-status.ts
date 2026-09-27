import { create } from 'zustand';

/** What the deck persistence reports (contracts/storage-api.md). */
export type SaveEvent =
  | { type: 'pending' }
  | { type: 'saved'; at: number }
  | { type: 'failed'; firstUnsavedAt: number; errorName: string };

export type SaveStatus =
  | { kind: 'saved' }
  | { kind: 'saving'; since: number }
  | { kind: 'error'; firstUnsavedAt: number; errorName: string };

/** "Saving…" stays at least this long, so a fast save does not flicker (research R3). */
export const SAVING_MIN_MS = 200;
/** "Saved" shows at most this long after the write resolved (§g-25). */
export const SAVED_MAX_HOLD_MS = 300;

const SAVED: SaveStatus = { kind: 'saved' };

/**
 * The status state machine (data-model.md). Pure: a `saved` that arrives before "Saving…" was
 * shown for `SAVING_MIN_MS` leaves the state unchanged; the store applies it when that time is up.
 * An error clears only on `saved`, and keeps the time of the first unsaved change.
 */
export function reduceSaveStatus(state: SaveStatus, event: SaveEvent, now: number): SaveStatus {
  switch (event.type) {
    case 'pending':
      return state.kind === 'saved' ? { kind: 'saving', since: now } : state;
    case 'saved':
      if (state.kind === 'saved') return state;
      if (state.kind === 'saving' && now - state.since < SAVING_MIN_MS) return state;
      return SAVED;
    case 'failed':
      return {
        kind: 'error',
        firstUnsavedAt: state.kind === 'error' ? state.firstUnsavedAt : event.firstUnsavedAt,
        errorName: event.errorName,
      };
  }
}

interface SaveStatusStore {
  status: SaveStatus;
  dispatch: (event: SaveEvent) => void;
  reset: () => void;
}

/** UI-only: the save status of the open deck. `now` is injectable for tests. */
export function createSaveStatusStore(now: () => number = Date.now) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // A newer change waits for its own write: a delayed "saved" must not claim it.
  let waiting = false;
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  return create<SaveStatusStore>()((set, get) => ({
    status: SAVED,
    dispatch: (event) => {
      const status = get().status;
      if (event.type !== 'saved') {
        waiting = true;
        clear();
        set({ status: reduceSaveStatus(status, event, now()) });
        return;
      }
      waiting = false;
      if (status.kind === 'saving') {
        const left = SAVING_MIN_MS - (now() - status.since);
        if (left > 0) {
          clear();
          timer = setTimeout(() => {
            timer = undefined;
            if (!waiting) set({ status: SAVED });
          }, left);
          return;
        }
      }
      set({ status: reduceSaveStatus(status, event, now()) });
    },
    reset: () => {
      clear();
      waiting = false;
      set({ status: SAVED });
    },
  }));
}

export const useSaveStatusStore = createSaveStatusStore();
