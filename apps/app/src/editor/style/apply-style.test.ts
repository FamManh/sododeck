import { toJSON } from '@sododeck/model';
import { describe, expect, it, vi } from 'vitest';

import { renderWithEditor, deckOf } from '../../test/render-canvas';
import { useUiStore } from '../../state/ui-store';
import { applyStyle, skippedCount } from './apply-style';

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
