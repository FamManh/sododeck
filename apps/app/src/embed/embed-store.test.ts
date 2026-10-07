import type { ProblemEntry } from '@sododeck/model/report-json';
import { beforeEach, describe, expect, it } from 'vitest';

import { useEmbedStore } from './embed-store';

const entry: ProblemEntry = {
  code: 'dangling-reference',
  severity: 'error',
  message: 'A connection points at a card that is not there.',
  fix: 'Remove the connection or add the card.',
};

const store = () => useEmbedStore.getState();

beforeEach(() => {
  store().reset();
});

describe('embed store transitions (data-model.md)', () => {
  it('starts waiting', () => {
    expect(store()).toMatchObject({ phase: 'waiting', fatal: null, problems: [], hostError: null });
  });

  it('waiting becomes slow, and slow does not touch other phases', () => {
    store().slow();
    expect(store().phase).toBe('slow');
    store().opened();
    store().slow();
    expect(store().phase).toBe('open');
  });

  it('waiting or slow, then a valid init, opens', () => {
    store().slow();
    store().opened();
    expect(store().phase).toBe('open');
  });

  it('a version mismatch is fatal and a later matching init opens', () => {
    store().failed('editor');
    expect(store()).toMatchObject({ phase: 'fatal', fatal: { side: 'editor' } });
    store().opened();
    expect(store()).toMatchObject({ phase: 'open', fatal: null });
  });

  it('an invalid file blocks with its problems, and a valid one clears them', () => {
    store().blocked([entry]);
    expect(store()).toMatchObject({ phase: 'blocked', problems: [entry] });
    store().opened();
    expect(store()).toMatchObject({ phase: 'open', problems: [] });
  });

  it('an open deck goes read-only on an invalid outside file', () => {
    store().opened();
    store().blocked([entry]);
    expect(store().phase).toBe('blocked');
  });

  it('keeps the host error until it is cleared, and capabilities from the latest init', () => {
    store().setHostError('Disk full');
    expect(store().hostError).toBe('Disk full');
    store().setHostError(null);
    expect(store().hostError).toBeNull();
    store().setCapabilities({ openLinks: true, exportFiles: false, pictures: true });
    expect(store().capabilities).toEqual({ openLinks: true, exportFiles: false, pictures: true });
  });
});
