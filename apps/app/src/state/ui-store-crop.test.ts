import { createDeck } from '@sododeck/model';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from './ui-store';

const state = () => useUiStore.getState();
const half = { x: 0.5, y: 0, width: 0.5, height: 1 };

beforeEach(() => {
  state().resetForDeck();
});

describe('crop session (057)', () => {
  it('opens, moves the working frame and closes', () => {
    state().openCrop('img-1', { x: 0, y: 0, width: 1, height: 1 });
    expect(state().cropSession).toEqual({
      imageId: 'img-1',
      crop: { x: 0, y: 0, width: 1, height: 1 },
      handle: null,
    });
    state().updateCrop(half, 'left');
    expect(state().cropSession).toEqual({ imageId: 'img-1', crop: half, handle: 'left' });
    state().updateCrop({ ...half, y: 0.1 });
    expect(state().cropSession?.handle).toBe('left');
    state().updateCrop(half, null);
    expect(state().cropSession?.handle).toBeNull();
    state().closeCrop();
    expect(state().cropSession).toBeNull();
  });

  it('ignores a move with no session open', () => {
    state().updateCrop(half);
    expect(state().cropSession).toBeNull();
  });

  it('never touches a document', () => {
    const doc = createDeck();
    const before = doc.getMap('images').size;
    state().openCrop('img-1', half);
    state().updateCrop(half);
    state().closeCrop();
    expect(doc.getMap('images').size).toBe(before);
  });

  it('closes on a deck switch and when flow mode opens', () => {
    state().openCrop('img-1', half);
    state().resetForDeck('other');
    expect(state().cropSession).toBeNull();
    state().openCrop('img-1', half);
    state().openFlow('f1');
    expect(state().cropSession).toBeNull();
  });
});
