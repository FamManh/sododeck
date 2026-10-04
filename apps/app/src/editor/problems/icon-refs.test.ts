import { checkDeck } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

describe('unreadable icon references (038 T041)', () => {
  it('reports no problem for a reference this version cannot show', () => {
    const icons = ['simple:kafka', 'lucide:no-such-icon', 'mdi:database', 'a b', 'Server'];
    const file = {
      ...emptySododeckFile(),
      nodes: icons.map((icon, index) => ({
        id: `n${String(index)}`,
        type: 'service',
        title: `Node ${String(index)}`,
        icon,
        position: { x: index * 200, y: 0 },
      })),
    };
    expect(checkDeck(file).total).toBe(0);
  });
});
