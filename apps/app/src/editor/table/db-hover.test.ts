import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import {
  blurTarget,
  cancelDbHover,
  DB_GRACE_MS,
  DB_REST_MS,
  enterPopover,
  enterTarget,
  leaveTarget,
  notePointerPress,
  setDbHoverConnecting,
} from './db-hover';

const initial = useUiStore.getState();
const open = () => useUiStore.getState().dbPopover;
const email = { kind: 'column' as const, nodeId: 'users', columnId: 'email' };
const id = { kind: 'column' as const, nodeId: 'users', columnId: 'id' };
const usersTitle = { kind: 'table' as const, nodeId: 'users' };

describe('db hover timing (064)', () => {
  beforeEach(() => {
    useUiStore.setState(initial, true);
    vi.useFakeTimers();
  });
  afterEach(() => {
    cancelDbHover();
    setDbHoverConnecting(false);
    vi.useRealTimers();
  });

  it('opens after the 300 ms rest', () => {
    enterTarget(email, 'mouse');
    vi.advanceTimersByTime(DB_REST_MS - 1);
    expect(open()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(open()).toEqual({ ...email, source: 'hover' });
  });

  it('switches at once to another target of the same table (FR-006)', () => {
    enterTarget(email, 'mouse');
    vi.advanceTimersByTime(DB_REST_MS);
    leaveTarget();
    enterTarget(usersTitle, 'mouse');
    expect(open()).toEqual({ ...usersTitle, source: 'hover' });
    enterTarget(id, 'mouse');
    expect(open()).toEqual({ ...id, source: 'hover' });
  });

  it('waits again for another table', () => {
    enterTarget(email, 'mouse');
    vi.advanceTimersByTime(DB_REST_MS);
    enterTarget({ kind: 'table', nodeId: 'orders' }, 'mouse');
    expect(open()).toEqual({ ...email, source: 'hover' });
    vi.advanceTimersByTime(DB_REST_MS);
    expect(open()).toEqual({ kind: 'table', nodeId: 'orders', source: 'hover' });
  });

  it('closes after the grace unless the pointer reaches the popover', () => {
    enterTarget(email, 'mouse');
    vi.advanceTimersByTime(DB_REST_MS);
    leaveTarget();
    vi.advanceTimersByTime(DB_GRACE_MS - 1);
    enterPopover();
    vi.advanceTimersByTime(DB_GRACE_MS);
    expect(open()).not.toBeNull();
    leaveTarget();
    vi.advanceTimersByTime(DB_GRACE_MS);
    expect(open()).toBeNull();
  });

  it('never opens for touch', () => {
    enterTarget(email, 'touch');
    vi.advanceTimersByTime(DB_REST_MS * 2);
    expect(open()).toBeNull();
  });

  it('opens nothing while suspended and closes when a suspension starts', () => {
    useUiStore.setState({ canvasGesture: 'drag' });
    enterTarget(email, 'mouse');
    vi.advanceTimersByTime(DB_REST_MS);
    expect(open()).toBeNull();
    useUiStore.setState({ canvasGesture: null });
    enterTarget(email, 'mouse');
    vi.advanceTimersByTime(DB_REST_MS);
    expect(open()).not.toBeNull();
    useUiStore.setState({ canvasGesture: 'drag' });
    expect(open()).toBeNull();
  });

  it('closes when a connection starts and opens nothing while connecting', () => {
    useUiStore.getState().openDbPopover({ ...email, source: 'click' });
    setDbHoverConnecting(true);
    expect(open()).toBeNull();
    enterTarget(email, 'mouse');
    vi.advanceTimersByTime(DB_REST_MS);
    expect(open()).toBeNull();
  });

  it('opens no keyboard popover for a focus a press caused', () => {
    notePointerPress();
    enterTarget(id, 'keyboard');
    vi.advanceTimersByTime(DB_REST_MS);
    expect(open()).toBeNull();
  });

  it('leave never closes a click or keyboard popover; blur closes a keyboard one', () => {
    useUiStore.getState().openDbPopover({ ...email, source: 'click' });
    leaveTarget();
    vi.advanceTimersByTime(DB_GRACE_MS);
    expect(open()?.source).toBe('click');
    enterTarget(id, 'mouse');
    vi.advanceTimersByTime(DB_REST_MS);
    expect(open()).toEqual({ ...email, source: 'click' });
    useUiStore.getState().closeDbPopover();
    enterTarget(id, 'keyboard');
    vi.advanceTimersByTime(DB_REST_MS);
    expect(open()).toEqual({ ...id, source: 'keyboard' });
    leaveTarget();
    vi.advanceTimersByTime(DB_GRACE_MS);
    expect(open()?.source).toBe('keyboard');
    blurTarget();
    expect(open()).toBeNull();
  });
});
