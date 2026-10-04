import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { actionContext, labels, TARGETS } from '../../test/action-fixtures';
import { runAction } from './actions-for';
import { ACTIONS } from './index';

const openSection = (target: (typeof TARGETS)[keyof typeof TARGETS], mode = 'edit' as const) =>
  labels(target, 'menu', mode)[0] ?? [];

describe('title actions (019 R8)', () => {
  it('offers Open details and Rename; Open inside on a group or a component with children', () => {
    expect(openSection(TARGETS.component)).toEqual(['Open details', 'Rename']);
    expect(openSection(TARGETS.parent)).toEqual(['Open details', 'Open inside', 'Rename']);
    // Double-click renames a frame, so the menu is the pointer's way into a group.
    expect(openSection(TARGETS.group)).toEqual(['Open details', 'Open inside', 'Rename']);
    expect(openSection(TARGETS.connection)).toContain('Open details');
    expect(openSection(TARGETS.canvas)).not.toContain('Open details');
  });

  it('keeps only Open details in flow mode', () => {
    expect(labels(TARGETS.parent, 'menu', 'flow')[0]).toEqual(['Open details']);
  });

  it('puts Open details on the one-component toolbar and Rename on the group toolbar', () => {
    expect(labels(TARGETS.component, 'toolbar').flat()).toContain('Open details');
    expect(labels(TARGETS.components, 'toolbar').flat()).not.toContain('Open details');
    expect(labels(TARGETS.group, 'toolbar').flat()).toContain('Rename');
  });

  it('runs: rename starts title edit, open inside drills in, details opens the drawer', () => {
    useUiStore.getState().resetForDeck();
    expect(runAction(ACTIONS, 'title.rename', actionContext(TARGETS.group))).toBe(true);
    expect(useUiStore.getState().titleEdit).toEqual({ target: 'group', id: 'g', isNew: false });
    expect(runAction(ACTIONS, 'node.openInside', actionContext(TARGETS.parent))).toBe(true);
    expect(useUiStore.getState().drill.map((f) => f.id)).toEqual(['p']);
    expect(runAction(ACTIONS, 'node.openInside', actionContext(TARGETS.component))).toBe(false);
    useUiStore.getState().resetForDeck();
    expect(runAction(ACTIONS, 'node.openInside', actionContext(TARGETS.group))).toBe(true);
    expect(useUiStore.getState().drill).toMatchObject([{ kind: 'group', id: 'g' }]);
    useUiStore.getState().resetForDeck();
    runAction(ACTIONS, 'details.open', actionContext(TARGETS.component));
    expect(useUiStore.getState().drawer.open).toBe(true);
    expect(useUiStore.getState().selection.nodes).toEqual(['a']);
  });
});
