import { toJSON } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { actionContext, actionDeck, labels, TARGETS } from '../../test/action-fixtures';
import { runAction } from './actions-for';
import { ACTIONS } from './index';

describe('node.resetSize (017 R4)', () => {
  it('is offered on a component, disabled at the default size', () => {
    expect(labels(TARGETS.component, 'menu').flat()).toContain('Reset size');
  });

  it('resets a sized card to its default in one undo step and announces it', () => {
    useUiStore.getState().resetForDeck();
    const sizedDeck = {
      ...actionDeck,
      nodes: actionDeck.nodes.map((n) =>
        n.id === 'a' ? { ...n, size: { width: 244, height: 140 } } : n,
      ),
    };
    const ctx = actionContext(TARGETS.component, 'edit', sizedDeck);
    expect(runAction(ACTIONS, 'node.resetSize', ctx)).toBe(true);
    expect(toJSON(ctx.doc).nodes.find((n) => n.id === 'a')?.size).toBeUndefined();
    expect(useUiStore.getState().announcement.text).toBe('Size reset');
    expect(ctx.editor.undo()).toBe(true);
    expect(toJSON(ctx.doc).nodes.find((n) => n.id === 'a')?.size).toEqual({
      width: 244,
      height: 140,
    });
  });
});
