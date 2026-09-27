import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSaveStatusStore, reduceSaveStatus, type SaveStatus } from './save-status';

describe('reduceSaveStatus', () => {
  const saved: SaveStatus = { kind: 'saved' };

  it('goes saving on a pending change and back to saved after the minimum time', () => {
    const saving = reduceSaveStatus(saved, { type: 'pending' }, 1000);
    expect(saving).toEqual({ kind: 'saving', since: 1000 });
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

  it('holds "Saving…" to 200 ms when the write resolves at 130 ms', () => {
    const store = make();
    store.getState().dispatch({ type: 'pending' });
    expect(store.getState().status.kind).toBe('saving');
    advance(130);
    store.getState().dispatch({ type: 'saved', at: clock });
    expect(store.getState().status.kind).toBe('saving');
    advance(69);
    expect(store.getState().status.kind).toBe('saving');
    advance(1);
    expect(store.getState().status.kind).toBe('saved');
  });

  it('shows saved at once when the write resolves after 400 ms', () => {
    const store = make();
    store.getState().dispatch({ type: 'pending' });
    advance(400);
    store.getState().dispatch({ type: 'saved', at: clock });
    expect(store.getState().status.kind).toBe('saved');
  });

  it('does not claim saved for a change made while the hold runs', () => {
    const store = make();
    store.getState().dispatch({ type: 'pending' });
    advance(100);
    store.getState().dispatch({ type: 'saved', at: clock });
    advance(20);
    store.getState().dispatch({ type: 'pending' });
    advance(200);
    expect(store.getState().status.kind).toBe('saving');
    store.getState().dispatch({ type: 'saved', at: clock });
    expect(store.getState().status.kind).toBe('saved');
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
