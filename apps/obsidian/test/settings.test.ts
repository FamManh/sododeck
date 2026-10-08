import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, readSettings } from '../src/settings';

describe('readSettings', () => {
  it('defaults to the attachment folder', () => {
    expect(DEFAULT_SETTINGS.pictureStorage).toBe('attachments');
    expect(readSettings(undefined)).toEqual({ pictureStorage: 'attachments' });
    expect(readSettings(null)).toEqual({ pictureStorage: 'attachments' });
    expect(readSettings({})).toEqual({ pictureStorage: 'attachments' });
  });

  it('keeps a known stored value and falls back for anything else', () => {
    expect(readSettings({ pictureStorage: 'embedded' })).toEqual({ pictureStorage: 'embedded' });
    expect(readSettings({ pictureStorage: 'attachments' })).toEqual({
      pictureStorage: 'attachments',
    });
    expect(readSettings({ pictureStorage: 'cloud' })).toEqual({ pictureStorage: 'attachments' });
    expect(readSettings({ pictureStorage: 7 })).toEqual({ pictureStorage: 'attachments' });
    expect(readSettings('x')).toEqual({ pictureStorage: 'attachments' });
  });
});
