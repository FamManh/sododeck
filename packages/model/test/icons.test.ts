import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { iconUsage } from '../src';

const node = (id: string, icon?: string): SododeckFile['nodes'][number] => ({
  id,
  type: 'service',
  title: id,
  ...(icon === undefined ? {} : { icon }),
});

describe('iconUsage (038)', () => {
  it('is empty for a deck without icons', () => {
    expect(iconUsage({ ...emptySododeckFile(), nodes: [node('a'), node('b')] })).toEqual([]);
    expect(iconUsage(emptySododeckFile())).toEqual([]);
  });

  it('counts references as written, most used first, ties by first appearance', () => {
    const deck: SododeckFile = {
      ...emptySododeckFile(),
      nodes: [
        node('a', 'lucide:zap'),
        node('b', 'server'),
        node('c', 'lucide:zap'),
        node('d', 'lucide:bell'),
        node('e', 'Server'),
        node('f', 'server'),
        node('g'),
      ],
    };
    expect(iconUsage(deck)).toEqual([
      { ref: 'lucide:zap', count: 2 },
      { ref: 'server', count: 2 },
      { ref: 'lucide:bell', count: 1 },
      { ref: 'Server', count: 1 },
    ]);
  });
});
