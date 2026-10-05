import { describe, expect, it } from 'vitest';

import { prepare } from './detect';
import { parseSequence } from './parse-sequence';

const parse = (...lines: string[]) =>
  parseSequence(prepare(['sequenceDiagram', ...lines].join('\n')));
const people = (...lines: string[]) =>
  parse(...lines).participants.map((p) => [p.key, p.label, p.actor]);

describe('participants', () => {
  it.each([
    [['participant A'], [['A', 'A', false]]],
    [['participant A as Alice'], [['A', 'Alice', false]]],
    [['actor U'], [['U', 'U', true]]],
    [['actor U as The User'], [['U', 'The User', true]]],
    [
      ['participant B', 'participant A'],
      [
        ['B', 'B', false],
        ['A', 'A', false],
      ],
    ],
    [
      ['A->>B: hi'],
      [
        ['A', 'A', false],
        ['B', 'B', false],
      ],
    ],
    [
      ['participant B', 'A->>B: hi'],
      [
        ['B', 'B', false],
        ['A', 'A', false],
      ],
    ],
    [
      ['A->>B: hi', 'actor A as Ann'],
      [
        ['A', 'Ann', true],
        ['B', 'B', false],
      ],
    ],
  ] as [string[], unknown][])('%j', (lines, expected) => {
    expect(people(...lines)).toEqual(expected);
  });

  it('keeps typed participants as components and reports the metadata', () => {
    const result = parse('participant DB@{ "type": "database" }');
    expect(result.participants).toEqual([{ key: 'DB', label: 'DB', actor: false }]);
    expect(result.skipped).toEqual([expect.objectContaining({ reason: 'unsupported' })]);
  });
});

describe('messages', () => {
  it.each([
    ['A->>B: x', false],
    ['A-->>B: x', true],
    ['A->B: x', false],
    ['A-->B: x', true],
    ['A-)B: x', false],
    ['A--)B: x', true],
    ['A-xB: x', false],
    ['A--xB: x', true],
    ['A ->> B : x', false],
    ['A->>+B: x', false],
    ['A-->>-B: x', true],
  ])('%s', (line, dashed) => {
    const [message] = parse(line).messages;
    expect(message).toMatchObject({ from: 'A', to: 'B', label: 'x', dashed });
  });

  it('allows a missing label and a self message', () => {
    expect(parse('A->>B').messages[0]?.label).toBe('');
    expect(parse('A->>A: think').messages[0]).toMatchObject({ from: 'A', to: 'A' });
  });

  it('cleans labels and keeps colons after the first', () => {
    expect(parse('A->>B: R&amp;D<br/>now').messages[0]?.label).toBe('R&D\nnow');
    expect(parse('A->>B: GET /a:b').messages[0]?.label).toBe('GET /a:b');
  });

  it('records line numbers', () => {
    expect(parse('A->>B: 1', '', 'B->>A: 2').messages.map((m) => m.line)).toEqual([2, 4]);
  });
});

describe('title', () => {
  it('reads title with and without colon, or from front matter', () => {
    expect(parse('title Login').title).toBe('Login');
    expect(parse('title: Login').title).toBe('Login');
    expect(parseSequence(prepare('---\ntitle: FM\n---\nsequenceDiagram\nA->>B: x')).title).toBe(
      'FM',
    );
  });
});

describe('skipped and flattened lines', () => {
  it.each([
    ['autonumber', 'appearance'],
    ['activate A', 'flattened'],
    ['deactivate A', 'flattened'],
    ['Note over A,B: hello', 'flattened'],
    ['note right of A: hi', 'flattened'],
    ['box Purple Team', 'unsupported'],
    ['create participant C', 'unsupported'],
    ['destroy C', 'unsupported'],
    ['link A: Dashboard @ https://x.y', 'interaction'],
    ['links A: {"x": "https://x.y"}', 'interaction'],
    ['rect rgb(0, 255, 0)', 'appearance'],
    ['what is this', 'unreadable'],
    ['end', 'unreadable'],
  ])('%s → %s', (line, reason) => {
    const result = parse('A->>B: x', line);
    expect(result.skipped).toEqual([{ line: 3, text: line, reason }]);
    expect(result.messages).toHaveLength(1);
  });

  it('keeps blocks as reading-order messages and labels the first covered message', () => {
    const result = parse(
      'A->>B: before',
      'alt paid',
      'B->>A: ok',
      'B->>A: still ok',
      'else refused',
      'B->>A: no',
      'end',
      'A->>B: after',
    );
    expect(result.messages.map((m) => [m.label, m.block])).toEqual([
      ['before', undefined],
      ['ok', 'alt: paid'],
      ['still ok', undefined],
      ['no', 'else: refused'],
      ['after', undefined],
    ]);
    expect(result.flattened).toBe(true);
    expect(result.skipped.filter((s) => s.reason === 'flattened').map((s) => s.text)).toEqual([
      'alt paid',
      'else refused',
    ]);
  });

  it.each(['opt maybe', 'loop every day', 'par left', 'critical must', 'break stop'])(
    'flattens %s',
    (opener) => {
      const [kind, ...label] = opener.split(' ');
      const result = parse(opener, 'A->>B: x', 'end');
      expect(result.messages[0]?.block).toBe(`${kind}: ${label.join(' ')}`);
      expect(result.skipped).toEqual([expect.objectContaining({ reason: 'flattened' })]);
    },
  );

  it('handles and/option parts and nested blocks', () => {
    const result = parse(
      'par one',
      'A->>B: a',
      'and two',
      'A->>C: b',
      'end',
      'loop outer',
      'opt inner',
      'A->>B: c',
      'end',
      'end',
    );
    expect(result.messages.map((m) => m.block)).toEqual([
      'par: one',
      'and: two',
      'loop: outer\nopt: inner',
    ]);
  });

  it('does not flatten-note a plain diagram', () => {
    expect(parse('A->>B: x').flattened).toBe(false);
  });

  it('reports an else outside any block', () => {
    expect(parse('else x').skipped).toEqual([expect.objectContaining({ reason: 'unreadable' })]);
  });
});

describe('limits', () => {
  it('refuses more than 4,000 messages', () => {
    const lines = Array.from({ length: 4001 }, () => 'A->>B: x');
    expect(() => parse(...lines)).toThrow(/too-large/);
  });
  it('refuses more than 2,000 participants', () => {
    const lines = Array.from({ length: 2001 }, (_, i) => `participant P${i}`);
    expect(() => parse(...lines)).toThrow(/too-large/);
  });
});

describe('participants declared again (062 T032: never silent)', () => {
  it('keeps the last declaration and reports the repeat', () => {
    const parsed = parse(
      'participant A as Web',
      'A->>B: hi',
      'participant A as Web app',
      'participant A as Web app',
    );
    expect(parsed.participants[0]).toMatchObject({ key: 'A', label: 'Web app' });
    expect(parsed.skipped.filter((s) => s.reason === 'merged')).toEqual([
      { line: 4, text: 'participant A as Web app', reason: 'merged', key: 'A', lines: [2, 4] },
    ]);
  });
});
