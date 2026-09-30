import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import full from '@sododeck/schema/examples/full.sododeck.json' with { type: 'json' };
import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { groupBounds } from './canvas-geometry';
import { fitMissingFrames } from './open-deck';
import { viewStateOf } from './views/view-state';

/** The full example as saved before 016: no group or view frames. */
const oldDeck: SododeckFile = {
  ...(full as SododeckFile),
  groups: (full as SododeckFile).groups.map(({ position: _p, size: _s, ...group }) => group),
  views: (full as SododeckFile).views.map(({ groupFrames: _f, ...view }) => view),
};

describe('fitMissingFrames (016 research R2, SC-003b)', () => {
  it('stores a frame for every non-empty group, with no undo step', () => {
    const doc = fromJSON(oldDeck);
    const editor = createEditor(doc);
    fitMissingFrames(editor, toJSON(doc));
    const after = toJSON(doc);
    for (const group of after.groups) {
      expect(group.position, group.id).toBeDefined();
      expect(group.size, group.id).toBeDefined();
    }
    expect(editor.canUndo()).toBe(false);
    expect(editor.undo()).toBe(false);
    expect(toJSON(doc)).toEqual(after);
  });

  it('draws the same group boxes at component level as the derived boxes did', () => {
    const doc = fromJSON(oldDeck);
    fitMissingFrames(createEditor(doc), toJSON(doc));
    const after = toJSON(doc);
    expect(groupBounds(after, 'component')).toEqual(groupBounds(oldDeck, 'component'));
  });

  it('fits views with their own positions from those positions', () => {
    const doc = fromJSON(oldDeck);
    fitMissingFrames(createEditor(doc), toJSON(doc));
    const after = toJSON(doc);
    const infra = after.views.find((v) => v.id === 'infra');
    expect(Object.keys(infra?.groupFrames ?? {})).not.toHaveLength(0);
    // The view draws its members inside its own frames.
    const before = viewStateOf(oldDeck, 'infra').deck;
    expect(groupBounds(viewStateOf(after, 'infra').deck, 'component')).toEqual(
      groupBounds(before, 'component'),
    );
    // Views without own positions keep using the base frames.
    expect(after.views.find((v) => v.id === 'feature')?.groupFrames).toBeUndefined();
  });

  it('writes nothing the second time (every group is framed)', () => {
    const first = fromJSON(oldDeck);
    fitMissingFrames(createEditor(first), toJSON(first));
    const doc = fromJSON(toJSON(first));
    const editor = createEditor(doc);
    const before = toJSON(doc);
    let updates = 0;
    doc.on('update', () => updates++);
    fitMissingFrames(editor, before);
    expect(updates).toBe(0);
    expect(toJSON(doc)).toEqual(before);
  });
});
