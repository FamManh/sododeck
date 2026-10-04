import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createEditor, fromJSON, getObject, toJSON } from '../src';
import { repairViewRefs } from '../src/repair';
import { expectConverged, sync, twoDocs } from './helpers';

const frame = { position: { x: 0, y: 0 }, size: { width: 200, height: 100 } };

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'n1', type: 'service', title: 'One', group: 'g1' },
    { id: 'n2', type: 'service', title: 'Two' },
  ],
  groups: [
    { id: 'g1', title: 'G1' },
    { id: 'g2', title: 'G2' },
  ],
  views: [
    { id: 'base', type: 'system', title: 'Base' },
    {
      id: 'v',
      type: 'custom',
      title: 'Custom',
      includes: ['n1', 'n2'],
      excludeGroups: ['g2'],
      positions: { n1: { x: 1, y: 1 }, n2: { x: 2, y: 2 } },
      groupFrames: { g1: frame, g2: frame },
      pinned: ['n2'],
      collapsed: ['g2'],
    },
  ],
};

/** Removes `ids` from the stored deck by hand, leaving every view entry naming them. */
function withoutObjects(file: SododeckFile, ids: readonly string[]): Y.Doc {
  const doc = fromJSON(file);
  doc.transact(() => {
    for (const id of ids) {
      doc.getMap('nodes').delete(id);
      doc.getMap('groups').delete(id);
    }
  });
  return doc;
}

describe('repairViewRefs (036 R9)', () => {
  it('removes view entries naming nothing, dropping lists the local cascade drops', () => {
    const doc = withoutObjects(deck, ['n2', 'g2']);
    let changed = false;
    doc.transact(() => {
      changed = repairViewRefs(doc);
    });
    expect(changed).toBe(true);
    const view = toJSON(doc).views.find((v) => v.id === 'v');
    expect(view).toEqual({
      id: 'v',
      type: 'custom',
      title: 'Custom',
      includes: ['n1'],
      positions: { n1: { x: 1, y: 1 } },
      groupFrames: { g1: frame },
    });
    expect(() => fromJSON(toJSON(doc))).not.toThrow();
  });

  it('changes nothing in a clean deck', () => {
    const doc = fromJSON(deck);
    let transactions = 0;
    doc.on('afterTransaction', () => transactions++);
    expect(repairViewRefs(doc)).toBe(false);
    expect(transactions).toBe(0);
  });

  it('cleans up after "A deletes a node, B pins it", outside undo, and settles (FR-021, FR-022)', () => {
    for (const order of ['ab', 'ba'] as const) {
      const { a, b } = twoDocs(deck);
      a.editor.remove('nodes', 'n1');
      b.editor.setPinned('v', ['n1'], true);
      b.editor.moveInView('v', { n1: { x: 9, y: 9 } });
      sync(a, b, order);
      expectConverged(a, b);
      for (const side of [a, b]) {
        const view = toJSON(side.doc).views.find((v) => v.id === 'v');
        expect(view?.pinned).toEqual(['n2']);
        expect(view?.positions).toEqual({ n2: { x: 2, y: 2 } });
        expect(view?.includes).toEqual(['n2']);
      }
      // Each side's history holds only its own edits: the repair is never an undo step. (B's pin
      // and move named the deleted node, so the repair emptied them and Yjs skips them.)
      const undoAll = (editor: typeof a.editor) => {
        let steps = 0;
        while (editor.undo()) steps++;
        return steps;
      };
      expect(undoAll(a.editor)).toBe(1);
      expect(getObject(a.doc, 'nodes', 'n1')).toBeDefined();
      expect(undoAll(b.editor)).toBeLessThanOrEqual(2);
    }
  });

  it('settles: after the repairs are exchanged, a further sync carries nothing', () => {
    for (const order of ['ab', 'ba'] as const) {
      const { a, b } = twoDocs(deck);
      a.editor.remove('nodes', 'n1');
      b.editor.setPinned('v', ['n1'], true);
      sync(a, b, order);
      sync(a, b, order);
      const states = [Y.encodeStateVector(a.doc), Y.encodeStateVector(b.doc)];
      sync(a, b, order);
      expect([Y.encodeStateVector(a.doc), Y.encodeStateVector(b.doc)]).toEqual(states);
      expectConverged(a, b);
    }
  });

  it('never repairs on open: a loaded dangling entry stays until a change arrives from elsewhere', () => {
    const file: SododeckFile = {
      ...deck,
      views: [
        deck.views[0],
        { ...deck.views[1], pinned: ['n2', 'ghost'] },
      ] as SododeckFile['views'],
    };
    const { a, b } = twoDocs(file);
    expect(toJSON(a.doc).views[1]?.pinned).toEqual(['n2', 'ghost']);
    a.editor.update('nodes', 'n2', { title: 'Local edit' });
    expect(toJSON(a.doc).views[1]?.pinned).toEqual(['n2', 'ghost']);
    // A view change from the other side triggers the check.
    b.editor.updateView('v', { title: 'Renamed' });
    sync(a, b);
    expect(toJSON(a.doc).views[1]?.pinned).toEqual(['n2']);
    sync(a, b);
    expectConverged(a, b);
  });

  it('can be turned off', () => {
    const { a, b } = twoDocs(deck);
    a.editor.destroy();
    b.editor.destroy();
    const quiet = createEditor(b.doc, { repair: false });
    // A delete with no cascade (as an older or foreign client might send).
    a.doc.transact(() => {
      a.doc.getMap('nodes').delete('n2');
    });
    sync(a, b);
    expect(toJSON(b.doc).views.find((v) => v.id === 'v')?.pinned).toEqual(['n2']);
    quiet.destroy();
  });

  it('keeps a collapsed derived schema group (048)', () => {
    const file: SododeckFile = {
      ...deck,
      views: [
        { id: 'base', type: 'system', title: 'Base' },
        { id: 'v', type: 'custom', title: 'Custom', collapsed: ['schema:billing', 'g2', 'gone'] },
      ],
    };
    const doc = fromJSON(file);
    doc.transact(() => {
      repairViewRefs(doc);
    });
    expect(toJSON(doc).views[1]?.collapsed).toEqual(['schema:billing', 'g2']);
  });
});
