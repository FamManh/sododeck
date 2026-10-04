import { toJSON } from '@sododeck/model';
import { describe, expect, it, vi } from 'vitest';

import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { applyIcon, cardIds } from './apply-icon';

const select = (...nodes: string[]) => ({ nodes, edges: [], groups: [], stickies: [] });

function setup() {
  return renderWithEditor(
    null,
    deckOf({
      nodes: [
        { id: 'a', title: 'A', type: 'service', icon: 'server' },
        { id: 'b', title: 'B', type: 'database' },
        // A shape type: drawn without an icon, so the picker never touches it.
        { id: 'c', title: 'C', type: 'rectangle', icon: 'mdi:database' },
      ],
    }),
  );
}

describe('applyIcon (038 T020)', () => {
  it('calls setNodeIcon once with only the cards', () => {
    const { editor } = setup();
    const spy = vi.spyOn(editor(), 'setNodeIcon');
    applyIcon(editor(), select('a', 'b', 'c'), 'lucide:zap');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(['a', 'b'], 'lucide:zap');
  });

  it('keeps the stored icon of a shape', () => {
    const { editor, doc } = setup();
    applyIcon(editor(), select('a', 'c'), 'lucide:zap');
    const nodes = toJSON(doc).nodes;
    expect(nodes.find((n) => n.id === 'c')?.icon).toBe('mdi:database');
    expect(nodes.find((n) => n.id === 'a')?.icon).toBe('lucide:zap');
  });

  it('does nothing when no selected node is a card', () => {
    const { editor } = setup();
    const spy = vi.spyOn(editor(), 'setNodeIcon');
    applyIcon(editor(), select('c'), 'lucide:zap');
    applyIcon(editor(), select(), null);
    expect(spy).not.toHaveBeenCalled();
  });

  it('is one undo step and null removes the key', () => {
    const { editor, doc } = setup();
    applyIcon(editor(), select('a', 'b'), 'lucide:zap');
    editor().undo();
    expect(toJSON(doc).nodes.map((n) => n.icon)).toEqual(['server', undefined, 'mdi:database']);
    applyIcon(editor(), select('a'), null);
    expect(toJSON(doc).nodes.find((n) => n.id === 'a')?.icon).toBeUndefined();
  });

  it('cardIds lists the selected cards in deck order', () => {
    const { doc } = setup();
    expect(cardIds(toJSON(doc), select('b', 'c', 'a'))).toEqual(['a', 'b']);
  });
});
