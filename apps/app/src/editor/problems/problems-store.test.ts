import { createEditor, fromJSON, type DeckProblems } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { deckOf } from '../../test/render-canvas';
import { createInlineProblemsClient, type ProblemsClient } from './problems-client';
import { createProblemsStore, PROBLEMS_DELAY_MS } from './problems-store';

const twoNodes = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A' },
    { id: 'b', type: 'service', title: 'B' },
  ],
  edges: [{ id: 'e', from: 'a', to: 'b' }],
});

/** Resolves pending promise callbacks. */
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('createProblemsStore (015 R4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes the first result at once', async () => {
    const doc = fromJSON(twoNodes);
    const store = createProblemsStore(doc, createInlineProblemsClient());
    expect(store.get()).toBeNull();
    const stop = store.subscribe(() => undefined);
    await flush();
    expect(store.get()?.total).toBe(0);
    stop();
  });

  it('follows a change from another tab with no user action (036 FR-019, SC-007)', async () => {
    const doc = fromJSON(twoNodes);
    const store = createProblemsStore(doc, createInlineProblemsClient());
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    await flush();
    expect(store.get()?.total).toBe(0);
    listener.mockClear();

    // Another tab adds a duplicate connection; its update arrives with no editor origin here.
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    createEditor(other).add('edges', { id: 'dup', from: 'a', to: 'b' });
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));

    await vi.advanceTimersByTimeAsync(PROBLEMS_DELAY_MS);
    expect(store.get()?.list.map((p) => p.kind)).toEqual(['duplicate-connection']);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it('coalesces edits within the window into one check and follows undo', async () => {
    const doc = fromJSON(twoNodes);
    const inline = createInlineProblemsClient();
    const check = vi.fn((file: SododeckFile) => inline.check(file));
    const store = createProblemsStore(doc, { ...inline, check });
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    await flush();
    listener.mockClear();
    const editor = createEditor(doc);
    editor.add('edges', { id: 'dup', from: 'a', to: 'b' });
    editor.update('nodes', 'b', { title: 'Bee' });
    await vi.advanceTimersByTimeAsync(PROBLEMS_DELAY_MS - 1);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(2);
    expect(store.get()?.list.map((p) => p.detail)).toEqual(['A → Bee appears twice']);
    expect(listener).toHaveBeenCalledTimes(1);
    editor.undo();
    editor.undo();
    await vi.advanceTimersByTimeAsync(PROBLEMS_DELAY_MS);
    expect(store.get()?.total).toBe(0);
    stop();
  });

  it('drops a result for a superseded snapshot', async () => {
    const doc = fromJSON(twoNodes);
    const resolvers: ((r: DeckProblems) => void)[] = [];
    const client: ProblemsClient = {
      check: (_file: SododeckFile) =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
      terminate: () => undefined,
    };
    const store = createProblemsStore(doc, client);
    const stop = store.subscribe(() => undefined);
    createEditor(doc).update('nodes', 'a', { title: 'A2' });
    await vi.advanceTimersByTimeAsync(PROBLEMS_DELAY_MS);
    expect(resolvers).toHaveLength(2);
    const newer = { list: [], total: 0, errors: 0, warnings: 0, byObject: new Map() };
    resolvers[1]?.(newer);
    await flush();
    resolvers[0]?.({ list: [], total: 9, errors: 0, warnings: 9, byObject: new Map() });
    await flush();
    expect(store.get()).toBe(newer);
    stop();
  });

  it('checks only while subscribed, and terminates a client it owns', async () => {
    const doc = fromJSON(twoNodes);
    const inline = createInlineProblemsClient();
    const check = vi.fn((file: SododeckFile) => inline.check(file));
    const terminate = vi.fn();
    const store = createProblemsStore(doc, { check, terminate }, { ownsClient: true });
    expect(check).not.toHaveBeenCalled();
    const stop = store.subscribe(() => undefined);
    expect(check).toHaveBeenCalledTimes(1);
    stop();
    expect(terminate).toHaveBeenCalledTimes(1);
    createEditor(doc).update('nodes', 'a', { title: 'A2' });
    await vi.advanceTimersByTimeAsync(PROBLEMS_DELAY_MS * 2);
    expect(check).toHaveBeenCalledTimes(1);
    expect(store.get()).toBeNull(); // the first answer arrived after the last subscriber left
  });
});
