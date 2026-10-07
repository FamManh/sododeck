import { describe, expect, it } from 'vitest';

import { hostOrigin } from '../embed/host-origin';
import { channelOrigin, isOwnUpdate, storageOrigin } from './origins';

describe('isOwnUpdate', () => {
  it('is true for the editor, undo and redo origins', () => {
    expect(isOwnUpdate(null)).toBe(true);
    expect(isOwnUpdate({ local: true })).toBe(true);
    expect(isOwnUpdate('undo')).toBe(true);
  });

  it('is false for storage, other tabs and the host (067)', () => {
    expect(isOwnUpdate(storageOrigin)).toBe(false);
    expect(isOwnUpdate(channelOrigin)).toBe(false);
    expect(isOwnUpdate(hostOrigin)).toBe(false);
  });
});
