import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { readText, writeText } from '../src/text';

function attached(initial: string): { doc: Y.Doc; map: Y.Map<unknown>; text: Y.Text } {
  const doc = new Y.Doc();
  const map = doc.getMap<unknown>('m');
  const text = new Y.Text(initial);
  map.set('description', text);
  return { doc, map, text };
}

/** The delta of `text` for running `fn` in one transaction (insert and delete in any order). */
function deltaOf(doc: Y.Doc, text: Y.Text, fn: () => void): unknown[] {
  let delta: unknown[] = [];
  const handler = (event: Y.YTextEvent) => {
    delta = event.delta;
  };
  text.observe(handler);
  doc.transact(fn);
  text.unobserve(handler);
  return delta;
}

describe('writeText', () => {
  it('leaves the text equal to the new value', () => {
    const { text } = attached('Hello world');
    writeText(text, 'Hello brave new world!');
    expect(text.toJSON()).toBe('Hello brave new world!');
  });

  it('replaces only the differing middle', () => {
    const { doc, text } = attached('The quick fox');
    const delta = deltaOf(doc, text, () => {
      writeText(text, 'The slow fox');
    });
    expect(delta).toHaveLength(3);
    expect(delta[0]).toEqual({ retain: 4 });
    expect(delta).toEqual(expect.arrayContaining([{ delete: 5 }, { insert: 'slow' }]));
  });

  it('does nothing when the value is equal', () => {
    const { doc, text } = attached('Same');
    let transactions = 0;
    doc.on('afterTransaction', () => transactions++);
    writeText(text, 'Same');
    expect(transactions).toBe(0);
  });

  it('never splits a surrogate pair', () => {
    // 😀 and 😁 share their high surrogate.
    const { doc, text } = attached('a😀b');
    const delta = deltaOf(doc, text, () => {
      writeText(text, 'a😁b');
    });
    expect(text.toJSON()).toBe('a😁b');
    expect(delta).toHaveLength(3);
    expect(delta[0]).toEqual({ retain: 1 });
    expect(delta).toEqual(expect.arrayContaining([{ delete: 2 }, { insert: '😁' }]));
  });

  it('never splits a surrogate pair at the end', () => {
    const { text } = attached('😀');
    writeText(text, '😁');
    expect(text.toJSON()).toBe('😁');
    const low = attached('x😀');
    writeText(low.text, 'x🈀');
    expect(low.text.toJSON()).toBe('x🈀');
  });

  it('empties the text and keeps it attached', () => {
    const { map, text } = attached('Something');
    writeText(text, '');
    expect(text.toJSON()).toBe('');
    expect(map.get('description')).toBe(text);
  });
});

describe('readText', () => {
  it('reads characters as a string, an empty text as absent, and the blank marker as ""', () => {
    const { map, text } = attached('Hi');
    expect(readText(map, 'description', false)).toBe('Hi');
    writeText(text, '');
    expect(readText(map, 'description', false)).toBeUndefined();
    map.set('$blank:description', true);
    expect(readText(map, 'description', false)).toBe('');
    expect(readText(map, 'missing', false)).toBeUndefined();
  });

  it('reads an empty required text as ""', () => {
    const { map } = attached('');
    expect(readText(map, 'description', true)).toBe('');
  });
});
