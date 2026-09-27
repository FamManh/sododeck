import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import type { Flow } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { branchedFlow, flowDeck } from '../../test/flow-fixtures';
import {
  flowsIn,
  indexForMoveWithinFeature,
  moveToFeature,
  stepIndexForMoveWithinPath,
} from './flow-order';

const ids = (flows: readonly Flow[]) => flows.map((f) => f.id);

describe('flow order', () => {
  it('lists flows per feature, with dangling features under No feature', () => {
    expect(ids(flowsIn(flowDeck, 'delivery'))).toEqual(['place', 'assign']);
    const dangling = { ...flowDeck, flows: [{ id: 'z', title: 'Z', feature: 'gone', steps: [] }] };
    expect(ids(flowsIn(dangling, null))).toEqual(['z']);
  });

  it('turns a position within a feature into a global flows index', () => {
    const doc = fromJSON(flowDeck);
    const editor = createEditor(doc);
    editor.reorder('flows', 'assign', indexForMoveWithinFeature(flowDeck, 'assign', 'delivery', 0));
    expect(ids(flowsIn(toJSON(doc), 'delivery'))).toEqual(['assign', 'place']);
    const now = toJSON(doc);
    editor.reorder('flows', 'assign', indexForMoveWithinFeature(now, 'assign', 'delivery', 5));
    expect(ids(flowsIn(toJSON(doc), 'delivery'))).toEqual(['place', 'assign']);
  });

  it('moves a flow to the end of another feature in one undo step', () => {
    const doc = fromJSON(flowDeck);
    const editor = createEditor(doc);
    moveToFeature(editor, 'place', 'payments');
    moveToFeature(editor, 'loose', 'payments');
    expect(ids(flowsIn(toJSON(doc), 'payments'))).toEqual(['place', 'loose']);
    editor.undo();
    expect(ids(flowsIn(toJSON(doc), null))).toEqual(['loose']);
  });

  it('turns a position within a path into a steps index', () => {
    expect(stepIndexForMoveWithinPath(branchedFlow, 'p2', 0)).toBe(0);
    expect(stepIndexForMoveWithinPath(branchedFlow, 'p1', 1)).toBe(1);
    expect(stepIndexForMoveWithinPath(branchedFlow, 'p1', 9)).toBe(1);
    expect(stepIndexForMoveWithinPath(branchedFlow, 'p3b', 0)).toBe(3);
  });
});
