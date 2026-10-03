import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { analyzeFlow, fromJSON, getObject, getRule, toJSON } from '../src';
import { bothOrders, expectConverged, sync, twoDocs, type Side } from './helpers';

/**
 * Two documents edited separately, then synced in both delivery orders (036 contract
 * guarantees 1–9). `bothOrders` already asserts that both sides read as the same deck.
 */

const base: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'n1', type: 'service', title: 'One', description: 'First service.' },
    { id: 'n2', type: 'service', title: 'Two' },
    { id: 'n3', type: 'database', title: 'Three' },
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2' },
    { id: 'e2', from: 'n2', to: 'n3' },
    { id: 'e3', from: 'n3', to: 'n1' },
  ],
  flows: [
    {
      id: 'f',
      title: 'Flow',
      steps: [
        { id: 's1', edge: 'e1', title: 'Step 1' },
        { id: 's2', edge: 'e2', title: 'Step 2' },
        { id: 's3', edge: 'e3', title: 'Step 3' },
      ],
    },
  ],
  rules: {
    R: {
      title: 'Carrier',
      hitPolicy: 'first',
      inputs: [
        { id: 'i1', label: 'Weight' },
        { id: 'i2', label: 'Zone' },
      ],
      outputs: [{ id: 'o1', label: 'Carrier' }],
      rows: [
        { id: 'r1', when: ['< 5', 'EU'], then: ['Post'] },
        { id: 'r2', when: ['', ''], then: ['Truck'] },
      ],
    },
  },
};

const stepIds = (side: Side) => getObject(side.doc, 'flows', 'f')?.steps.map((s) => s.id) ?? [];
const nodeIds = (side: Side) => toJSON(side.doc).nodes.map((n) => n.id);
const rowIds = (side: Side) => getRule(side.doc, 'R')?.rows.map((r) => r.id) ?? [];

/** Every row has exactly one cell per column, and the deck re-imports (guarantee 6). */
function expectRectangular(side: Side): void {
  const file = toJSON(side.doc);
  for (const rule of Object.values(file.rules)) {
    for (const row of rule.rows) {
      expect(row.when).toHaveLength(rule.inputs.length);
      expect(row.then).toHaveLength(rule.outputs.length);
    }
  }
  expect(() => fromJSON(file)).not.toThrow();
}

describe('lists under concurrent edits (036 US2)', () => {
  it('keeps a field edit of a step another tab moved (AS1)', () => {
    bothOrders(
      base,
      ({ editor }) => {
        editor.moveStep('f', 's1', 2);
      },
      ({ editor }) => {
        editor.updateStep('f', 's1', { title: 'Renamed' });
      },
      (a) => {
        expect(stepIds(a)).toEqual(['s2', 's3', 's1']);
        expect(getObject(a.doc, 'flows', 'f')?.steps[2]?.title).toBe('Renamed');
      },
    );
  });

  it('keeps a field edit of a node and of a rule row another tab moved', () => {
    bothOrders(
      base,
      ({ editor }) => {
        editor.reorder('nodes', 'n1', 2);
        editor.moveRuleRow('R', 'r1', 1);
        editor.moveRuleColumn('R', 'i1', 1);
      },
      ({ editor }) => {
        editor.update('nodes', 'n1', { title: 'Uno' });
        editor.setRuleCell('R', 'r1', 'o1', 'Courier');
        editor.renameRuleColumn('R', 'i1', 'Mass');
      },
      (a) => {
        expect(nodeIds(a)).toEqual(['n2', 'n3', 'n1']);
        expect(getObject(a.doc, 'nodes', 'n1')?.title).toBe('Uno');
        const rule = getRule(a.doc, 'R');
        expect(rule?.rows.map((r) => r.id)).toEqual(['r2', 'r1']);
        expect(rule?.inputs).toEqual([
          { id: 'i2', label: 'Zone' },
          { id: 'i1', label: 'Mass' },
        ]);
        expect(rule?.rows[1]).toEqual({ id: 'r1', when: ['EU', '< 5'], then: ['Courier'] });
      },
    );
  });

  it('never duplicates an item moved on both sides (AS2)', () => {
    bothOrders(
      base,
      ({ editor }) => {
        editor.moveStep('f', 's1', 2);
        editor.reorder('nodes', 'n1', 2);
        editor.moveRuleRow('R', 'r1', 1);
      },
      ({ editor }) => {
        editor.moveStep('f', 's1', 1);
        editor.reorder('nodes', 'n1', 1);
        editor.moveRuleRow('R', 'r2', 0);
      },
      (a) => {
        expect([...stepIds(a)].sort()).toEqual(['s1', 's2', 's3']);
        expect([...nodeIds(a)].sort()).toEqual(['n1', 'n2', 'n3']);
        expect([...rowIds(a)].sort()).toEqual(['r1', 'r2']);
      },
    );
  });

  it('keeps both items inserted at one place, in the same order (AS3)', () => {
    bothOrders(
      base,
      ({ editor }) => {
        editor.add('nodes', { type: 'service', title: 'From A' });
        editor.addStep('f', { edge: 'e1', title: 'A' }, 1);
      },
      ({ editor }) => {
        editor.add('nodes', { type: 'service', title: 'From B' });
        editor.addStep('f', { edge: 'e1', title: 'B' }, 1);
      },
      (a) => {
        const file = toJSON(a.doc);
        expect(
          file.nodes
            .map((n) => n.title)
            .slice(3)
            .sort(),
        ).toEqual(['From A', 'From B']);
        const steps = file.flows[0]?.steps ?? [];
        expect(steps.map((s) => s.title)).toHaveLength(5);
        expect(steps[0]?.id).toBe('s1');
        expect(
          steps
            .slice(1, 3)
            .map((s) => s.title)
            .sort(),
        ).toEqual(['A', 'B']);
        expect(steps.slice(3).map((s) => s.id)).toEqual(['s2', 's3']);
      },
    );
  });

  it('puts a later insert between two tied items (R3)', () => {
    for (const order of ['ab', 'ba'] as const) {
      const { a, b } = twoDocs(base);
      a.editor.addStep('f', { edge: 'e1', title: 'A' }, 1);
      b.editor.addStep('f', { edge: 'e1', title: 'B' }, 1);
      sync(a, b, order);
      const tied = stepIds(a).slice(1, 3);
      const between = a.editor.addStep('f', { edge: 'e2', title: 'Between' }, 2);
      sync(a, b, order);
      expectConverged(a, b);
      expect(stepIds(b)).toEqual(['s1', tied[0], between, tied[1], 's2', 's3']);
    }
  });

  it('lets a delete win over a move or an edit, leaving no partial item (AS4)', () => {
    bothOrders(
      base,
      ({ editor }) => {
        editor.remove('nodes', 'n3');
        editor.removeStep('f', 's2');
        editor.removeRuleRow('R', 'r1');
      },
      ({ editor }) => {
        editor.reorder('nodes', 'n3', 0);
        editor.update('nodes', 'n3', { title: 'Edited' });
        editor.moveStep('f', 's2', 0);
        editor.updateStep('f', 's2', { title: 'Edited' });
        editor.setRuleCell('R', 'r1', 'i1', '> 9');
      },
      (a) => {
        expect(getObject(a.doc, 'nodes', 'n3')).toBeUndefined();
        expect(stepIds(a)).toEqual(['s1', 's3']);
        expect(rowIds(a)).toEqual(['r2']);
        expect(() => fromJSON(toJSON(a.doc))).not.toThrow();
      },
    );
  });

  it('undoes a local move without losing the other side’s edit (AS6)', () => {
    for (const order of ['ab', 'ba'] as const) {
      const { a, b } = twoDocs(base);
      a.editor.reorder('nodes', 'n1', 2);
      b.editor.update('nodes', 'n1', { title: 'Theirs' });
      sync(a, b, order);
      expect(a.editor.undo()).toBe(true);
      sync(a, b, order);
      expectConverged(a, b);
      expect(nodeIds(a)).toEqual(['n1', 'n2', 'n3']);
      expect(getObject(a.doc, 'nodes', 'n1')?.title).toBe('Theirs');
    }
  });

  it('keeps rule tables rectangular whatever columns and rows change (guarantee 6)', () => {
    bothOrders(
      base,
      ({ editor }) => {
        editor.addRuleColumn('R', 'inputs', 'Size');
      },
      ({ editor }) => {
        editor.addRuleRow('R', { when: ['> 5', 'US'], then: ['Ship'] });
      },
      (a) => {
        expectRectangular(a);
        expect(getRule(a.doc, 'R')?.rows.at(-1)?.when).toEqual(['> 5', 'US', '']);
      },
    );
    bothOrders(
      base,
      ({ editor }) => {
        editor.moveRuleColumn('R', 'i1', 1);
      },
      ({ editor }) => {
        editor.setRuleCell('R', 'r1', 'i1', '< 9');
      },
      (a) => {
        expectRectangular(a);
        expect(getRule(a.doc, 'R')?.rows[0]?.when).toEqual(['EU', '< 9']);
      },
    );
    bothOrders(
      base,
      ({ editor }) => {
        editor.removeRuleColumn('R', 'i2');
      },
      ({ editor }) => {
        editor.addRuleRow('R', { when: ['1', 'X'], then: ['Y'] });
      },
      (a) => {
        expectRectangular(a);
        expect(getRule(a.doc, 'R')?.rows.at(-1)?.when).toEqual(['1']);
      },
    );
  });

  it('keeps two different cells of one row edited at once', () => {
    bothOrders(
      base,
      ({ editor }) => {
        editor.setRuleCell('R', 'r1', 'i1', '< 10');
      },
      ({ editor }) => {
        editor.setRuleCell('R', 'r1', 'o1', 'Courier');
      },
      (a) => {
        expect(getRule(a.doc, 'R')?.rows[0]).toEqual({
          id: 'r1',
          when: ['< 10', 'EU'],
          then: ['Courier'],
        });
      },
    );
  });

  it('loses no step when a branch splits the tail while another tab appends (R4)', () => {
    bothOrders(
      base,
      ({ editor }) => {
        editor.addBranch('f', 's1', { label: 'b', firstEdge: 'e2' });
      },
      ({ editor }) => {
        editor.appendStep('f', null, { edge: 'e3', title: 'Appended' });
      },
      (a) => {
        const file = toJSON(a.doc);
        const flow = file.flows[0];
        if (flow === undefined) throw new Error('flow missing');
        const ids = flow.steps.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toHaveLength(5);
        const analysis = analyzeFlow(flow, file.edges);
        const main = analysis.main.map((p) => p.step.id);
        expect(main[0]).toBe('s1');
        expect(main).toHaveLength(2);
        const alternative = analysis.branches[0]?.steps.map((p) => p.step.id);
        expect(alternative).toEqual(['s2', 's3']);
      },
    );
  });

  it('stores the view presets once when both tabs make their first view edit', () => {
    const noViews = { ...base, views: [] };
    bothOrders(
      noViews,
      ({ editor }) => {
        editor.updateView('feature', { excludeKinds: ['database'] });
      },
      ({ editor }) => {
        editor.updateView('infra', { excludeKinds: ['client'] });
      },
      (a) => {
        expect(toJSON(a.doc).views.map((v) => v.id)).toEqual(['system', 'feature', 'infra']);
      },
    );
  });

  it('lets the later of two title writes win, leaving other fields alone (guarantee 8)', () => {
    bothOrders(
      base,
      ({ editor }) => {
        editor.update('nodes', 'n1', { title: 'Title A' });
      },
      ({ editor }) => {
        editor.update('nodes', 'n1', { title: 'Title B', tech: 'Go' });
      },
      (a) => {
        const node = getObject(a.doc, 'nodes', 'n1');
        expect(['Title A', 'Title B']).toContain(node?.title);
        expect(node).toMatchObject({ description: 'First service.', tech: 'Go' });
      },
    );
  });
});

const textBase: SododeckFile = {
  ...base,
  nodes: [
    { id: 'n1', type: 'service', title: 'One', description: 'Start. Middle. End.' },
    ...base.nodes.slice(1),
  ],
  stickies: [{ id: 'k', text: '', position: { x: 0, y: 0 } }],
};

const description = (side: Side, id = 'n1') => getObject(side.doc, 'nodes', id)?.description;

describe('long text under concurrent typing (036 US3)', () => {
  it('keeps a sentence added at the start and one added at the end (AS1)', () => {
    bothOrders(
      textBase,
      ({ editor }) => {
        editor.update('nodes', 'n1', { description: 'Intro. Start. Middle. End.' });
      },
      ({ editor }) => {
        editor.update('nodes', 'n1', { description: 'Start. Middle. End. Outro.' });
      },
      (a) => {
        expect(description(a)).toBe('Intro. Start. Middle. End. Outro.');
      },
    );
  });

  it('keeps both words typed at the same place, neither inside the other (AS2)', () => {
    bothOrders(
      textBase,
      ({ editor }) => {
        editor.update('nodes', 'n1', { description: 'Start. Middle. End. Alpha' });
      },
      ({ editor }) => {
        editor.update('nodes', 'n1', { description: 'Start. Middle. End. Beta' });
      },
      (a) => {
        // Each side inserted " Alpha" / " Beta" as one run after "End.".
        expect(['Start. Middle. End. Alpha Beta', 'Start. Middle. End. Beta Alpha']).toContain(
          description(a),
        );
      },
    );
  });

  it('keeps what one tab typed while the other cleared the field', () => {
    bothOrders(
      textBase,
      ({ editor }) => {
        editor.update('nodes', 'n1', { description: null });
      },
      ({ editor }) => {
        editor.update('nodes', 'n1', { description: 'Start. Middle. End. More' });
      },
      (a) => {
        expect(description(a)).toBe(' More');
      },
    );
  });

  it('keeps both first texts of an empty description, step notes and note text', () => {
    bothOrders(
      textBase,
      ({ editor }) => {
        editor.update('nodes', 'n2', { description: 'From A.' });
        editor.updateStep('f', 's1', { notes: 'Notes A.' });
        editor.update('stickies', 'k', { text: 'Note A.' });
      },
      ({ editor }) => {
        editor.update('nodes', 'n2', { description: 'From B.' });
        editor.updateStep('f', 's1', { notes: 'Notes B.' });
        editor.update('stickies', 'k', { text: 'Note B.' });
      },
      (a) => {
        const both = (value: string | undefined, x: string, y: string) => {
          expect([`${x}${y}`, `${y}${x}`]).toContain(value);
        };
        both(description(a, 'n2'), 'From A.', 'From B.');
        both(getObject(a.doc, 'flows', 'f')?.steps[0]?.notes, 'Notes A.', 'Notes B.');
        both(getObject(a.doc, 'stickies', 'k')?.text, 'Note A.', 'Note B.');
      },
    );
  });

  it('keeps the untouched parts when one tab replaces the whole field (FR-015)', () => {
    bothOrders(
      textBase,
      ({ editor }) => {
        editor.update('nodes', 'n1', { description: 'Start. Changed. End.' });
      },
      ({ editor }) => {
        editor.update('nodes', 'n1', { description: 'Start. Middle. End!!' });
      },
      (a) => {
        expect(description(a)).toBe('Start. Changed. End!!');
      },
    );
  });

  it('keeps last write wins for a title changed on both sides (AS5)', () => {
    bothOrders(
      textBase,
      ({ editor }) => {
        editor.update('nodes', 'n2', { title: 'Left' });
      },
      ({ editor }) => {
        editor.update('nodes', 'n2', { title: 'Right' });
      },
      (a) => {
        expect(['Left', 'Right']).toContain(getObject(a.doc, 'nodes', 'n2')?.title);
      },
    );
  });

  it('exports merged text as a plain string that round-trips (AS6)', () => {
    bothOrders(
      textBase,
      ({ editor }) => {
        editor.update('nodes', 'n1', { description: 'A: Start. Middle. End.' });
        editor.updateMeta({ description: 'Deck by A.' });
      },
      ({ editor }) => {
        editor.update('nodes', 'n1', { description: 'Start. Middle. End. :B' });
        editor.updateMeta({ description: 'Deck by B.' });
      },
      (a) => {
        const file = toJSON(a.doc);
        expect(typeof file.nodes[0]?.description).toBe('string');
        expect(typeof file.description).toBe('string');
        expect(toJSON(fromJSON(file))).toEqual(file);
      },
    );
  });

  it('undoes only the local characters (AS4, FR-017)', () => {
    for (const order of ['ab', 'ba'] as const) {
      const { a, b } = twoDocs(textBase);
      a.editor.update('nodes', 'n1', { description: 'Start. Middle. End. Mine' });
      b.editor.update('nodes', 'n1', { description: 'Theirs Start. Middle. End.' });
      sync(a, b, order);
      expect(description(a)).toBe('Theirs Start. Middle. End. Mine');
      expect(a.editor.undo()).toBe(true);
      sync(a, b, order);
      expectConverged(a, b);
      expect(description(b)).toBe('Theirs Start. Middle. End.');
    }
  });
});
