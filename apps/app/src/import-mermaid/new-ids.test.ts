import { describe, expect, it } from 'vitest';

import { createImportIds } from './new-ids';

describe('createImportIds', () => {
  it('gives unique ids in the model format', () => {
    const ids = createImportIds();
    const made = Array.from({ length: 2000 }, () => ids.next('node'));
    expect(new Set(made).size).toBe(2000);
    for (const id of made) expect(id).toMatch(/^node-[0-9a-z]{10}$/);
  });

  it('uses the prefix of the object type, not a title or a Mermaid key', () => {
    const ids = createImportIds();
    expect(ids.next('group')).toMatch(/^group-/);
    expect(ids.next('edge')).toMatch(/^edge-/);
    expect(ids.next('flow')).toMatch(/^flow-/);
    expect(ids.next('step')).toMatch(/^step-/);
    for (const key of ['A', 'Web app', 'node1']) expect(ids.next('node')).not.toContain(key);
  });

  it('retries a collision', () => {
    const queue = ['x-1', 'x-1', 'x-2'];
    const ids = createImportIds(() => queue.shift() ?? 'x-3');
    expect([ids.next('node'), ids.next('node')]).toEqual(['x-1', 'x-2']);
  });
});
