import { create } from 'zustand';

/** What the deck persistence reports (contracts/storage-api.md). */
export type SaveEvent =
  | { type: 'pending' }
  | { type: 'saved'; at: number }
  | { type: 'failed'; firstUnsavedAt: number; errorName: string };

export type SaveStatus =
  | { kind: 'saved' }
  // A write is queued; shown exactly like `saved` until it has waited SAVING_SHOW_DELAY_MS (051).
  | { kind: 'pending'; since: number }
  | { kind: 'saving'; since: number }
  | { kind: 'error'; firstUnsavedAt: number; errorName: string };

/**
 * "Saving…" shows only once a write has been pending this long. Writes land ~100 ms after an edit,
 * so typing never spins the indicator (051 US6); a slow or stuck write still shows it.
 */
export const SAVING_SHOW_DELAY_MS = 1000;
/** "Saving…" stays at least this long, so a fast save does not flicker (research R3). */
export const SAVING_MIN_MS = 200;

const SAVED: SaveStatus = { kind: 'saved' };

/**
 * The status state machine (data-model.md). Pure: a change goes `pending` (the store turns it into
 * `saving` after `SAVING_SHOW_DELAY_MS`); a `saved` that arrives before "Saving…" was shown for
 * `SAVING_MIN_MS` leaves the state unchanged, and the store applies it when that time is up.
 * An error clears only on `saved`, and keeps the time of the first unsaved change.
 */
export function reduceSaveStatus(state: SaveStatus, event: SaveEvent, now: number): SaveStatus {
  switch (event.type) {
    case 'pending':
      return state.kind === 'saved' ? { kind: 'pending', since: now } : state;
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
  // Holds "Saving…" for its minimum time before a `saved` applies.
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  // Turns a write still pending after SAVING_SHOW_DELAY_MS into "Saving…".
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  // A newer change waits for its own write: a delayed "saved" must not claim it.
  let waiting = false;
  const clearHold = () => {
    if (holdTimer !== undefined) clearTimeout(holdTimer);
    holdTimer = undefined;
  };
  const clearShow = () => {
    if (showTimer !== undefined) clearTimeout(showTimer);
    showTimer = undefined;
  };

  return create<SaveStatusStore>()((set, get) => ({
    status: SAVED,
    dispatch: (event) => {
      const status = get().status;
      if (event.type !== 'saved') {
        waiting = true;
        clearHold();
        const next = reduceSaveStatus(status, event, now());
        if (next.kind !== 'pending') clearShow();
        else if (status.kind !== 'pending') {
          showTimer = setTimeout(() => {
            showTimer = undefined;
            if (get().status.kind === 'pending') set({ status: { kind: 'saving', since: now() } });
          }, SAVING_SHOW_DELAY_MS);
        }
        set({ status: next });
        return;
      }
      waiting = false;
      clearShow();
      if (status.kind === 'saving') {
        const left = SAVING_MIN_MS - (now() - status.since);
        if (left > 0) {
          clearHold();
          holdTimer = setTimeout(() => {
            holdTimer = undefined;
            if (!waiting) set({ status: SAVED });
          }, left);
          return;
        }
      }
      set({ status: reduceSaveStatus(status, event, now()) });
    },
    reset: () => {
      clearHold();
      clearShow();
      waiting = false;
      set({ status: SAVED });
    },
  }));
}

export const useSaveStatusStore = createSaveStatusStore();
