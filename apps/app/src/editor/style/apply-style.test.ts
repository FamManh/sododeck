import { toJSON } from '@sododeck/model';
import { describe, expect, it, vi } from 'vitest';

import { renderWithEditor, deckOf } from '../../test/render-canvas';
import { useUiStore } from '../../state/ui-store';
import { addDeckColour, applyStyle, removeDeckColour, skippedCount } from './apply-style';

function fileWithNodesAndGroup() {
  return deckOf({
    nodes: [
      { id: 'n1', title: 'A', type: 'service' },
      { id: 'n2', title: 'B', type: 'service' },
      { id: 'n3', title: 'C', type: 'service' },
    ],
    groups: [{ id: 'g1', title: 'G' }],
  });
}

const emptySelection = { nodes: [], edges: [], groups: [], stickies: [] };

describe('applyStyle (020 T030)', () => {
  it('is one undo step: one editor.undo() restores the original style', () => {
    const { editor, doc } = renderWithEditor(null, fileWithNodesAndGroup());
    applyStyle(editor(), { ...emptySelection, nodes: ['n1', 'n2'] }, 'fill', 'green');

    expect(toJSON(doc).nodes.filter((n) => n.style?.fill === 'green')).toHaveLength(2);

    editor().undo();

    expect(toJSON(doc).nodes.every((n) => n.style?.fill === undefined)).toBe(true);
  });

  it('passes only the selected nodes and groups to setStyle, dropping edges and stickies', () => {
    const { editor } = renderWithEditor(null, fileWithNodesAndGroup());
    const spy = vi.spyOn(editor(), 'setStyle');

    applyStyle(
      editor(),
      { nodes: ['n1'], edges: ['e1'], groups: ['g1'], stickies: ['s1'] },
      'stroke',
      'blue',
    );

    expect(spy).toHaveBeenCalledWith({ nodes: ['n1'], groups: ['g1'] }, 'stroke', 'blue');
  });

  it('announces "Fill set to Green on 2 components"', () => {
    const { editor } = renderWithEditor(null, fileWithNodesAndGroup());
    applyStyle(editor(), { ...emptySelection, nodes: ['n1', 'n2'] }, 'fill', 'green');
    expect(useUiStore.getState().announcement.text).toBe('Fill set to Green on 2 components');
  });

  it('announces "Fill removed from 3 components"', () => {
    const { editor } = renderWithEditor(null, fileWithNodesAndGroup());
    applyStyle(editor(), { ...emptySelection, nodes: ['n1', 'n2', 'n3'] }, 'fill', null);
    expect(useUiStore.getState().announcement.text).toBe('Fill removed from 3 components');
  });

  it('announces a group-only target as "group" / "groups"', () => {
    const { editor } = renderWithEditor(null, fileWithNodesAndGroup());
    applyStyle(editor(), { ...emptySelection, groups: ['g1'] }, 'stroke', '#7a3cff');
    expect(useUiStore.getState().announcement.text).toBe('Stroke set to #7a3cff on 1 group');
  });

  it('"No colour" on fill keeps the stroke, and one undo restores each fill (020 T036)', () => {
    const { editor, doc } = renderWithEditor(null, fileWithNodesAndGroup());
    applyStyle(editor(), { ...emptySelection, nodes: ['n1', 'n2'] }, 'stroke', 'blue');
    applyStyle(editor(), { ...emptySelection, nodes: ['n1', 'n2'] }, 'fill', 'green');

    applyStyle(editor(), { ...emptySelection, nodes: ['n1', 'n2'] }, 'fill', null);
    expect(toJSON(doc).nodes.filter((n) => n.style?.fill !== undefined)).toHaveLength(0);
    expect(toJSON(doc).nodes.filter((n) => n.style?.stroke === 'blue')).toHaveLength(2);

    editor().undo();
    expect(toJSON(doc).nodes.filter((n) => n.style?.fill === 'green')).toHaveLength(2);
    expect(toJSON(doc).nodes.filter((n) => n.style?.stroke === 'blue')).toHaveLength(2);
  });

  it('skippedCount counts selected edges and stickies (020 T036/T037)', () => {
    expect(skippedCount({ ...emptySelection, nodes: ['n1'] })).toBe(0);
    expect(skippedCount({ ...emptySelection, nodes: ['n1'], edges: ['e1'] })).toBe(1);
    expect(
      skippedCount({ ...emptySelection, nodes: ['n1'], edges: ['e1'], stickies: ['s1'] }),
    ).toBe(2);
  });
});

describe('addDeckColour (020 T044)', () => {
  it('adds the swatch and applies the colour in one undo step', () => {
    const { editor, doc } = renderWithEditor(null, fileWithNodesAndGroup());
    const ok = addDeckColour(
      editor(),
      { ...emptySelection, nodes: ['n1', 'n2'] },
      'fill',
      '#7a3cff',
    );

    expect(ok).toBe(true);
    expect(toJSON(doc).swatches).toEqual(['#7a3cff']);
    expect(toJSON(doc).nodes.filter((n) => n.style?.fill === '#7a3cff')).toHaveLength(2);

    editor().undo();
    expect(toJSON(doc).swatches).toBeUndefined();
    expect(toJSON(doc).nodes.every((n) => n.style?.fill === undefined)).toBe(true);
  });

  it('applies an existing deck colour without duplicating the swatch', () => {
    const { editor, doc } = renderWithEditor(
      null,
      deckOf({ ...fileWithNodesAndGroup(), swatches: ['#7a3cff'] }),
    );
    addDeckColour(editor(), { ...emptySelection, nodes: ['n1'] }, 'fill', '#7a3cff');

    expect(toJSON(doc).swatches).toEqual(['#7a3cff']);
    expect(toJSON(doc).nodes.find((n) => n.id === 'n1')?.style?.fill).toBe('#7a3cff');
  });

  it('announces "Saved to this deck as n of 12"', () => {
    const { editor } = renderWithEditor(
      null,
      deckOf({ ...fileWithNodesAndGroup(), swatches: ['#111111'] }),
    );
    addDeckColour(editor(), { ...emptySelection, nodes: ['n1'] }, 'fill', '#7a3cff');
    expect(useUiStore.getState().announcement.text).toBe('Saved to this deck as 2 of 12');
  });

  it('at 12 colours returns false and writes nothing', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `#${String(i).padStart(6, '0')}`);
    const { editor, doc } = renderWithEditor(
      null,
      deckOf({ ...fileWithNodesAndGroup(), swatches: twelve }),
    );
    const before = toJSON(doc);

    const ok = addDeckColour(editor(), { ...emptySelection, nodes: ['n1'] }, 'fill', '#7a3cff');

    expect(ok).toBe(false);
    expect(toJSON(doc)).toEqual(before);
  });
});

describe('removeDeckColour (020 T050)', () => {
  it('is one undo step, and leaves node styles untouched', () => {
    const { editor, doc } = renderWithEditor(
      null,
      deckOf({
        ...fileWithNodesAndGroup(),
        swatches: ['#7a3cff', '#111111'],
        nodes: [
          { id: 'n1', title: 'A', type: 'service', style: { fill: '#7a3cff' } },
          { id: 'n2', title: 'B', type: 'service' },
        ],
      }),
    );

    removeDeckColour(editor(), '#7a3cff');

    expect(toJSON(doc).swatches).toEqual(['#111111']);
    expect(toJSON(doc).nodes.find((n) => n.id === 'n1')?.style?.fill).toBe('#7a3cff');

    editor().undo();
    expect(toJSON(doc).swatches).toEqual(['#7a3cff', '#111111']);
  });

  it('announces "Removed #7a3cff from deck colours"', () => {
    const { editor } = renderWithEditor(
      null,
      deckOf({ ...fileWithNodesAndGroup(), swatches: ['#7a3cff'] }),
    );
    removeDeckColour(editor(), '#7a3cff');
    expect(useUiStore.getState().announcement.text).toBe('Removed #7a3cff from deck colours');
  });
});
