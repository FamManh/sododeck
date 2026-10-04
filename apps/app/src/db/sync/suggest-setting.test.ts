import { describe, expect, it } from 'vitest';

import { suggestDbmlSetting } from './suggest-setting';

describe('suggestDbmlSetting', () => {
  it('suggests the closest known setting within two edits', () => {
    expect(suggestDbmlSetting('not nul')).toBe('not null');
    expect(suggestDbmlSetting('pkk')).toBe('pk');
    expect(suggestDbmlSetting('uniqe')).toBe('unique');
    expect(suggestDbmlSetting('incrment')).toBe('increment');
  });

  it('ignores case and surrounding space', () => {
    expect(suggestDbmlSetting(' Not Nul ')).toBe('not null');
  });

  it('suggests nothing for a known setting or a far word', () => {
    expect(suggestDbmlSetting('unique')).toBeUndefined();
    expect(suggestDbmlSetting('headcolor_xyz')).toBeUndefined();
    expect(suggestDbmlSetting('')).toBeUndefined();
  });
});
