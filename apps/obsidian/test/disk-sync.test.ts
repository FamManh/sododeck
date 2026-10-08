import { describe, expect, it } from 'vitest';

import { judge, type Known } from '../src/disk-sync';
import { decode } from '../src/file-codec';
import { deckText, noteOf } from './harness';

const known = (over: Partial<Known> = {}): Known => ({
  canvas: deckText(),
  written: deckText(),
  inFlight: undefined,
  ...over,
});

describe('judge', () => {
  it('ignores a deck text the canvas, the last write or the write in flight already has', () => {
    const a = deckText('Shop', 'A');
    const b = deckText('Shop', 'B');
    const c = deckText('Shop', 'C');
    expect(judge(decode('plain', a), known({ canvas: a }))).toEqual({ kind: 'ignore' });
    expect(judge(decode('plain', a), known({ canvas: b, written: a }))).toEqual({ kind: 'ignore' });
    expect(judge(decode('plain', a), known({ canvas: c, inFlight: a }))).toEqual({
      kind: 'ignore',
    });
  });

  it('forwards a different deck text', () => {
    const other = deckText('Shop', 'Else');
    expect(judge(decode('plain', other), known())).toEqual({ kind: 'external', deckText: other });
  });

  it('compares the deck, not the file: a user edit outside the region changes nothing', () => {
    const note = noteOf(deckText());
    expect(judge(decode('markdown', `${note}\nmy text\n`), known())).toEqual({ kind: 'ignore' });
  });

  it('reports a file that cannot be read as a deck', () => {
    const result = judge(
      decode(
        'markdown',
        '---\nsododeck-plugin: parsed\n---\n%% sododeck:begin %%\n%% sododeck:end %%\n',
      ),
      known(),
    );
    expect(result.kind).toBe('broken');
  });

  it('forwards an invalid deck as plain text (the canvas shows its problems)', () => {
    const result = judge(decode('plain', '{ not json'), known());
    expect(result).toEqual({ kind: 'external', deckText: '{ not json' });
  });
});
