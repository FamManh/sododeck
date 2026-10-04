import { resolveIcon } from '@sododeck/ui/icon-sets';
import { describe, expect, it } from 'vitest';

import { usedIcons } from './used-icons';

describe('usedIcons (038 T043)', () => {
  it('merges spellings, drops unreadable references and sorts by merged count', () => {
    const icons = usedIcons([
      { ref: 'lucide:zap', count: 2 },
      { ref: 'simple:kafka', count: 9 },
      { ref: 'server', count: 2 },
      { ref: 'lucide:server', count: 1 },
      { ref: 'lucide:database', count: 3 },
    ]);
    expect(icons.map((i) => i.name)).toEqual(['server', 'database', 'zap']);
  });

  it('keeps first-seen order for ties and returns nothing for no usage', () => {
    expect(usedIcons([])).toEqual([]);
    const tie = usedIcons([
      { ref: 'lucide:zap', count: 1 },
      { ref: 'lucide:search', count: 1 },
    ]);
    expect(tie).toEqual([resolveIcon('lucide:zap'), resolveIcon('lucide:search')]);
  });
});
