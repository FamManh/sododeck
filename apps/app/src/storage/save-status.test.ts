import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSaveStatusStore,
  reduceSaveStatus,
  SAVING_SHOW_DELAY_MS,
  type SaveStatus,
} from './save-status';

describe('reduceSaveStatus', () => {
  const saved: SaveStatus = { kind: 'saved' };

  it('goes pending on a change, and back to saved when the write lands (051 US6)', () => {
    const pending = reduceSaveStatus(saved, { type: 'pending' }, 1000);
    expect(pending).toEqual({ kind: 'pending', since: 1000 });
    expect(reduceSaveStatus(pending, { type: 'pending' }, 1050)).toBe(pending);
    expect(reduceSaveStatus(pending, { type: 'saved', at: 1100 }, 1100)).toEqual(saved);
  });

  it('holds saving for the minimum time before saved', () => {
    const saving: SaveStatus = { kind: 'saving', since: 1000 };
    expect(reduceSaveStatus(saving, { type: 'pending' }, 1050)).toBe(saving);
    expect(reduceSaveStatus(saving, { type: 'saved', at: 1100 }, 1100)).toBe(saving);
    expect(reduceSaveStatus(saving, { type: 'saved', at: 1200 }, 1200)).toEqual(saved);
  });

  it('keeps the first unsaved time across failures and clears only on saved', () => {
    const failed = { type: 'failed', firstUnsavedAt: 5, errorName: 'QuotaExceededError' } as const;
    const error = reduceSaveStatus(saved, failed, 10);
    expect(error).toEqual({ kind: 'error', firstUnsavedAt: 5, errorName: 'QuotaExceededError' });
    expect(reduceSaveStatus(error, { type: 'pending' }, 20)).toBe(error);
    expect(
      reduceSaveStatus(error, { type: 'failed', firstUnsavedAt: 30, errorName: 'X' }, 40),
    ).toEqual({ kind: 'error', firstUnsavedAt: 5, errorName: 'X' });
    expect(reduceSaveStatus(error, { type: 'saved', at: 50 }, 50)).toEqual(saved);
  });

  it('ignores saved while saved', () => {
    expect(reduceSaveStatus(saved, { type: 'saved', at: 1 }, 1)).toBe(saved);
  });
});

describe('save status store', () => {
  let clock = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const make = () => createSaveStatusStore(() => clock);
  const advance = (ms: number) => {
    clock += ms;
    vi.advanceTimersByTime(ms);
  };

  it('never shows "Saving…" when the write lands within 100 ms (051 US6)', () => {
    const store = make();
    const kinds = new Set<string>();
    store.subscribe((state) => kinds.add(state.status.kind));
    store.getState().dispatch({ type: 'pending' });
    expect(store.getState().status.kind).toBe('pending');
    advance(100);
    store.getState().dispatch({ type: 'saved', at: clock });
    expect(store.getState().status.kind).toBe('saved');
    advance(SAVING_SHOW_DELAY_MS);
    expect(store.getState().status.kind).toBe('saved');
    expect(kinds.has('saving')).toBe(false);
  });

  it('never shows "Saving…" while typing 30 keys 80 ms apart', () => {
    const store = make();
    const kinds = new Set<string>();
    store.subscribe((state) => kinds.add(state.status.kind));
    for (let key = 0; key < 30; key += 1) {
      store.getState().dispatch({ type: 'pending' });
      advance(80);
      if (key % 2 === 1) store.getState().dispatch({ type: 'saved', at: clock });
    }
    store.getState().dispatch({ type: 'saved', at: clock });
    advance(2000);
    expect(kinds.has('saving')).toBe(false);
    expect(store.getState().status.kind).toBe('saved');
  });

  it('shows "Saving…" when a write is pending for 1 s, then holds it 200 ms', () => {
    const store = make();
    store.getState().dispatch({ type: 'pending' });
    advance(999);
    expect(store.getState().status.kind).toBe('pending');
    advance(1);
    expect(store.getState().status).toEqual({ kind: 'saving', since: 1000 });
    advance(130);
    store.getState().dispatch({ type: 'saved', at: clock });
    expect(store.getState().status.kind).toBe('saving');
    advance(69);
    expect(store.getState().status.kind).toBe('saving');
    advance(1);
    expect(store.getState().status.kind).toBe('saved');
  });

  it('shows saved at once when the write resolves 400 ms after "Saving…" showed', () => {
    const store = make();
    store.getState().dispatch({ type: 'pending' });
    advance(SAVING_SHOW_DELAY_MS);
    advance(400);
    store.getState().dispatch({ type: 'saved', at: clock });
    expect(store.getState().status.kind).toBe('saved');
  });

  it('does not claim saved for a change made while the hold runs', () => {
    const store = make();
    store.getState().dispatch({ type: 'pending' });
    advance(SAVING_SHOW_DELAY_MS);
    advance(100);
    store.getState().dispatch({ type: 'saved', at: clock });
    advance(20);
    store.getState().dispatch({ type: 'pending' });
    advance(200);
    expect(store.getState().status.kind).toBe('saving');
    store.getState().dispatch({ type: 'saved', at: clock });
    expect(store.getState().status.kind).toBe('saved');
  });

  it('shows an error at once, even while the write is pending', () => {
    const store = make();
    store.getState().dispatch({ type: 'pending' });
    advance(50);
    store.getState().dispatch({ type: 'failed', firstUnsavedAt: 0, errorName: 'Quota' });
    expect(store.getState().status.kind).toBe('error');
    advance(SAVING_SHOW_DELAY_MS);
    expect(store.getState().status.kind).toBe('error');
  });

  it('stays in error until a later save succeeds', () => {
    const store = make();
    store.getState().dispatch({ type: 'pending' });
    advance(50);
    store.getState().dispatch({ type: 'failed', firstUnsavedAt: 0, errorName: 'Quota' });
    store.getState().dispatch({ type: 'pending' });
    advance(1000);
    expect(store.getState().status).toEqual({
      kind: 'error',
      firstUnsavedAt: 0,
      errorName: 'Quota',
    });
    store.getState().dispatch({ type: 'saved', at: clock });
    expect(store.getState().status.kind).toBe('saved');
  });

  it('resets to saved', () => {
    const store = make();
    store.getState().dispatch({ type: 'failed', firstUnsavedAt: 0, errorName: 'Quota' });
    store.getState().reset();
    expect(store.getState().status.kind).toBe('saved');
  });
});
