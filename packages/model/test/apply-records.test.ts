import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { applyFields, mergeRecord, replaceArray } from '../src/apply-records';
import { toY, type YObject, type YValue } from '../src/convert';
import { readObject } from '../src/read';
import { blankKey } from '../src/text';
import { createObject } from '../src/write';

/** A stored object attached to a fresh doc, and the keys each later transaction changed. */
function stored(kind: Parameters<typeof createObject>[0], plain: Record<string, unknown>) {
  const doc = new Y.Doc();
  const root = doc.getMap<YObject>('root');
  doc.transact(() => {
    root.set('x', createObject(kind, plain, 'a0'));
  });
  const map = root.get('x') as YObject;
  const changed: string[] = [];
  root.observeDeep((events) => {
    for (const event of events) {
      const path = event.path.slice(1).join('.');
      if (event instanceof Y.YMapEvent) {
        for (const key of event.keysChanged)
          changed.push(path === '' ? String(key) : `${path}.${String(key)}`);
      }
      if (event instanceof Y.YTextEvent) changed.push(`${path}(text)`);
      if (event instanceof Y.YArrayEvent) changed.push(`${path}(array)`);
    }
  });
  const write = (fn: () => void) => {
    doc.transact(fn);
  };
  return { doc, map, changed, write };
}

const node = (patch: Record<string, unknown> = {}) => ({
  id: 'x',
  type: 'service',
  title: 'X',
  ...patch,
});

describe('mergeRecord (066 R5)', () => {
  it('writes changed keys, leaves equal ones, removes missing ones, recurses into maps', () => {
    const doc = new Y.Doc();
    const root = doc.getMap<YValue>('root');
    doc.transact(() => {
      root.set('rec', toY({ a: 1, b: 2, gone: 3, inner: { x: 1, y: 2 } }));
    });
    const rec = root.get('rec') as YObject;
    const inner = rec.get('inner');
    const changed: string[] = [];
    rec.observeDeep((events) => {
      for (const event of events) {
        for (const key of (event as Y.YMapEvent<unknown>).keysChanged) {
          changed.push([...event.path, key].join('.'));
        }
      }
    });
    doc.transact(() => {
      mergeRecord(rec, { a: 1, b: 5, inner: { x: 1, y: 3, z: 4 } });
    });
    expect(changed.sort()).toEqual(['b', 'gone', 'inner.y', 'inner.z']);
    expect(rec.get('inner')).toBe(inner);
    expect(rec.toJSON()).toEqual({ a: 1, b: 5, inner: { x: 1, y: 3, z: 4 } });
  });
});

describe('applyFields (066 R4–R5)', () => {
  it('writes only scalar and array fields that differ', () => {
    const { map, changed, write } = stored('nodes', node({ tags: ['a'], tech: 'Go' }));
    write(() => {
      applyFields(
        map,
        'nodes',
        readObject('nodes', 'x', map),
        node({ tags: ['a', 'b'], tech: 'Go' }),
      );
    });
    expect(changed).toEqual(['tags']);
    expect(readObject('nodes', 'x', map)).toEqual(node({ tags: ['a', 'b'], tech: 'Go' }));
  });

  it('writes position and size per axis, keeping the nested map', () => {
    const size = { width: 10, height: 20 };
    const plain = node({ position: { x: 1, y: 2 }, size });
    const { map, changed, write } = stored('nodes', plain);
    const position = map.get('position');
    write(() => {
      applyFields(map, 'nodes', plain, node({ position: { x: 1, y: 9 }, size }));
    });
    expect(changed).toEqual(['position.y']);
    expect(map.get('position')).toBe(position);
  });

  it('replaces a differing long text with a new Y.Text and keeps an equal one', () => {
    const plain = node({ description: 'old' });
    const { map, changed, write } = stored('nodes', plain);
    const text = map.get('description');
    write(() => {
      applyFields(map, 'nodes', plain, node({ description: 'old' }));
    });
    expect(changed).toEqual([]);
    expect(map.get('description')).toBe(text);
    write(() => {
      applyFields(map, 'nodes', plain, node({ description: 'new' }));
    });
    expect(map.get('description')).not.toBe(text);
    expect(readObject('nodes', 'x', map).description).toBe('new');
  });

  it('keeps the blank marker rule: an explicit empty text is marked, a value clears the mark', () => {
    const plain = node({ description: 'some' });
    const { map, write } = stored('nodes', plain);
    write(() => {
      applyFields(map, 'nodes', plain, node({ description: '' }));
    });
    expect(map.get(blankKey('description'))).toBe(true);
    expect(readObject('nodes', 'x', map).description).toBe('');
    write(() => {
      applyFields(map, 'nodes', node({ description: '' }), node({ description: 'back' }));
    });
    expect(map.has(blankKey('description'))).toBe(false);
    write(() => {
      applyFields(map, 'nodes', node({ description: 'back' }), node());
    });
    expect(readObject('nodes', 'x', map)).not.toHaveProperty('description');
  });

  it('writes typed values one key each', () => {
    const plain = node({ values: { a: 1, b: 'x' } });
    const { map, changed, write } = stored('nodes', plain);
    write(() => {
      applyFields(map, 'nodes', plain, node({ values: { a: 1, c: true } }));
    });
    expect(changed.sort()).toEqual(['$value:b', '$value:c']);
    expect(readObject('nodes', 'x', map).values).toEqual({ a: 1, c: true });
  });

  it('merges a style key by key', () => {
    const plain = node({ style: { fill: '#000000', stroke: '#111111' } });
    const { map, changed, write } = stored('nodes', plain);
    write(() => {
      applyFields(map, 'nodes', plain, node({ style: { fill: '#000000', stroke: '#222222' } }));
    });
    expect(changed).toEqual(['style.stroke']);
  });

  it('merges a view’s positions and group frames per key', () => {
    const plain = {
      id: 'x',
      title: 'V',
      type: 'custom',
      positions: { a: { x: 1, y: 1 }, b: { x: 2, y: 2 } },
      groupFrames: { g: { position: { x: 0, y: 0 }, size: { width: 5, height: 5 } } },
    };
    const { map, changed, write } = stored('views', plain);
    write(() => {
      applyFields(map, 'views', plain, {
        ...plain,
        positions: { a: { x: 1, y: 1 }, b: { x: 3, y: 2 }, c: { x: 0, y: 0 } },
        groupFrames: {},
      });
    });
    expect(changed.sort()).toEqual(['groupFrames.g', 'positions.b.x', 'positions.c']);
  });

  it('skips a flow’s child lists (written by the caller)', () => {
    const plain = { id: 'x', title: 'F', steps: [] };
    const { map, changed, write } = stored('flows', plain);
    write(() => {
      applyFields(map, 'flows', plain, { ...plain, steps: [{ id: 's', edge: 'e' }], branches: [] });
    });
    expect(changed).toEqual([]);
  });
});

describe('replaceArray (066 R5)', () => {
  it('writes nothing for equal contents and replaces in place otherwise', () => {
    const doc = new Y.Doc();
    const array = doc.getArray<YValue>('a');
    doc.transact(() => {
      array.push(['#000000', '#111111']);
    });
    let events = 0;
    array.observe(() => events++);
    doc.transact(() => {
      replaceArray(array, ['#000000', '#111111']);
    });
    expect(events).toBe(0);
    doc.transact(() => {
      replaceArray(array, ['#222222']);
    });
    expect(events).toBe(1);
    expect(array.toArray()).toEqual(['#222222']);
    expect(doc.getArray('a')).toBe(array);
  });
});
