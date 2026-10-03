import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { createDeckSnapshot, createEditor, fromJSON, toJSON, type DeckEditor } from '../src';
import { cascadeDeck } from './cascade-deck';
import { seqIds } from './helpers';

function setup() {
  const doc = fromJSON(cascadeDeck);
  const editor = createEditor(doc, { newId: seqIds(), captureTimeout: 0 });
  const snapshot = createDeckSnapshot(doc);
  return { doc, editor, snapshot };
}

/** Same data and same key order as a full write-out (so serialized files are identical). */
function expectParity(snapshot: ReturnType<typeof setup>['snapshot'], doc: Y.Doc): void {
  expect(JSON.stringify(snapshot.get())).toBe(JSON.stringify(toJSON(doc)));
}

/** One of each operation the 002 edit, cascade and rule suites use. */
const OPERATIONS: [string, (editor: DeckEditor) => void][] = [
  [
    'updateMeta set',
    (e) => {
      e.updateMeta({ name: 'Deck', description: 'D', tags: ['a', 'b'] });
    },
  ],
  [
    'updateMeta clear',
    (e) => {
      e.updateMeta({ description: null, tags: null });
    },
  ],
  ['add node', (e) => e.add('nodes', { type: 'queue', title: 'Q', position: { x: 1, y: 2 } })],
  [
    'rename node',
    (e) => {
      e.update('nodes', 'a', { title: 'A2', tech: 'Go' });
    },
  ],
  [
    'move node',
    (e) => {
      e.update('nodes', 'a', { position: { x: 10, y: 20 } });
    },
  ],
  [
    'clear optional',
    (e) => {
      e.update('nodes', 'a', { tech: null, group: null });
    },
  ],
  [
    'reorder node',
    (e) => {
      e.reorder('nodes', 'child', 0);
    },
  ],
  ['add edge', (e) => e.add('edges', { from: 'child', to: 'a', protocol: 'grpc' })],
  [
    'update edge',
    (e) => {
      e.update('edges', 'e1', { label: 'new', direction: 'both' });
    },
  ],
  ['remove edge', (e) => e.remove('edges', 'e2')],
  ['add group', (e) => e.add('groups', { title: 'G', parent: 'outer' })],
  ['remove group', (e) => e.remove('groups', 'inner')],
  ['add view', (e) => e.add('views', { type: 'custom', title: 'V2', includes: ['a'] })],
  [
    'update view',
    (e) => {
      e.update('views', 'v', { title: 'V renamed' });
    },
  ],
  ['add feature', (e) => e.add('features', { title: 'F2' })],
  ['remove feature', (e) => e.remove('features', 'feat')],
  ['add flow', (e) => e.add('flows', { title: 'Flow 2' })],
  ['add step', (e) => e.addStep('fl', { edge: 'e3', title: 'New step' }, 0)],
  [
    'update step',
    (e) => {
      e.updateStep('fl', 's1', { title: 'Renamed step' });
    },
  ],
  [
    'move step',
    (e) => {
      e.moveStep('fl', 's1', 2);
    },
  ],
  ['remove step', (e) => e.removeStep('fl', 's2')],
  ['add rule', (e) => e.addRule({ title: 'New rule' })],
  [
    'update rule',
    (e) => {
      e.updateRule('R', { description: 'Why' });
    },
  ],
  ['add column', (e) => e.addRuleColumn('R', 'inputs', 'Zone')],
  [
    'rename column',
    (e) => {
      e.renameRuleColumn('R', 'in1', 'Weight');
    },
  ],
  ['add row', (e) => e.addRuleRow('R', { when: ['x', 'y'] })],
  [
    'set cell',
    (e) => {
      e.setRuleCell('R', 'r1', 'out1', 'z');
    },
  ],
  [
    'move row',
    (e) => {
      e.moveRuleRow('R', 'r1', 1);
    },
  ],
  [
    'remove row',
    (e) => {
      e.removeRuleRow('R', 'r1');
    },
  ],
  ['remove column', (e) => e.removeRuleColumn('R', 'in1')],
  ['remove rule', (e) => e.removeRule('Q')],
  ['add sticky', (e) => e.add('stickies', { text: 'Hi', position: { x: 0, y: 0 } })],
  [
    'update sticky',
    (e) => {
      e.update('stickies', 'st-free', { text: 'Moved' });
    },
  ],
  ['remove sticky', (e) => e.remove('stickies', 'st-e')],
  ['remove node (cascade)', (e) => e.remove('nodes', 'n')],
  ['remove flow', (e) => e.remove('flows', 'fl')],
  [
    'batch',
    (e) => {
      e.batch(() => {
        e.update('nodes', 'a', { position: { x: 1, y: 1 } });
        e.update('nodes', 'child', { position: { x: 2, y: 2 } });
        e.remove('views', 'v');
      });
    },
  ],
];

describe('createDeckSnapshot', () => {
  it('starts equal to toJSON', () => {
    const { doc, snapshot } = setup();
    expectParity(snapshot, doc);
  });

  it('equals toJSON after every operation, and after undoing and redoing them all', () => {
    const { doc, editor, snapshot } = setup();
    let steps = 0;
    for (const [name, run] of OPERATIONS) {
      run(editor);
      steps++;
      expect.soft(JSON.stringify(snapshot.get()), name).toBe(JSON.stringify(toJSON(doc)));
    }
    while (editor.undo()) expectParity(snapshot, doc);
    expect(snapshot.get()).toEqual(cascadeDeck);
    let redone = 0;
    while (editor.redo()) {
      redone++;
      expectParity(snapshot, doc);
    }
    expect(redone).toBe(steps);
  });

  it('keeps the identity of everything an edit did not touch', () => {
    const { editor, snapshot } = setup();
    const before = snapshot.get();
    editor.update('nodes', 'n', { title: 'Renamed' });
    const after = snapshot.get();
    expect(after).not.toBe(before);
    expect(after.nodes).not.toBe(before.nodes);
    expect(after.nodes[1]).not.toBe(before.nodes[1]);
    expect(after.nodes[1]?.title).toBe('Renamed');
    expect(after.nodes[0]).toBe(before.nodes[0]);
    expect(after.nodes[2]).toBe(before.nodes[2]);
    for (const key of [
      'groups',
      'edges',
      'views',
      'features',
      'flows',
      'rules',
      'stickies',
    ] as const) {
      expect(after[key], key).toBe(before[key]);
    }
  });

  it('keeps untouched flows and rules when a step or a rule cell changes', () => {
    const { editor, snapshot } = setup();
    const before = snapshot.get();
    editor.setRuleCell('R', 'r1', 'out1', 'y');
    const after = snapshot.get();
    expect(after.rules.R).not.toBe(before.rules.R);
    expect(after.rules.Q).toBe(before.rules.Q);
    expect(after.flows).toBe(before.flows);
  });

  it('notifies once per transaction, after get() is up to date', () => {
    const { editor, snapshot } = setup();
    const seen: string[] = [];
    const listener = vi.fn(() => {
      seen.push(snapshot.get().nodes[0]?.title ?? '');
    });
    const stop = snapshot.subscribe(listener);
    editor.update('nodes', 'a', { title: 'One' });
    editor.batch(() => {
      editor.update('nodes', 'a', { title: 'Two' });
      editor.update('nodes', 'n', { title: 'N2' });
    });
    expect(seen).toEqual(['One', 'Two']);
    stop();
    editor.update('nodes', 'a', { title: 'Three' });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops following the document after destroy()', () => {
    const { doc, editor, snapshot } = setup();
    const listener = vi.fn();
    snapshot.subscribe(listener);
    const last = snapshot.get();
    snapshot.destroy();
    editor.update('nodes', 'a', { title: 'After' });
    expect(listener).not.toHaveBeenCalled();
    expect(snapshot.get()).toBe(last);
    expect(toJSON(doc).nodes[0]?.title).toBe('After');
  });

  it('reflects remote changes (transactions without an editor origin)', () => {
    const { doc, snapshot } = setup();
    // Another tab's edits, arriving as one update.
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    const theirs = createEditor(other);
    theirs.batch(() => {
      theirs.update('nodes', 'a', { title: 'Remote' });
      theirs.add('nodes', { id: 'r', type: 'client', title: 'R' });
      theirs.updateMeta({ name: 'Remote deck' });
    });
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));
    expectParity(snapshot, doc);
    expect(snapshot.get().nodes.map((n) => n.id)).toEqual(['a', 'n', 'child', 'r']);
  });
});
