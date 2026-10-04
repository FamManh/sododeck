import { toJSON } from '@sododeck/model';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { actionContext, actionDeck, TARGETS } from '../../test/action-fixtures';
import { actionsFor, runAction } from './actions-for';
import { ACTIONS } from './index';

const withDatabase = { ...actionDeck, packs: [...(actionDeck.packs ?? []), 'database' as const] };

const menuLabels = (deck: typeof actionDeck) =>
  actionsFor(ACTIONS, actionContext(TARGETS.canvas, 'edit', deck), 'menu').flatMap((s) =>
    s.actions.map((a) => a.label),
  );

beforeEach(() => {
  useUiStore.getState().resetForDeck();
});

describe('canvas.addEnum (052 US4)', () => {
  it('shows "Add enum" only with the Database pack on', () => {
    expect(menuLabels(actionDeck)).not.toContain('Add enum');
    expect(menuLabels(withDatabase)).toContain('Add enum');
  });

  it('adds enum_n and opens the enum drawer with its name selected', () => {
    const ctx = actionContext(TARGETS.canvas, 'edit', withDatabase);
    expect(runAction(ACTIONS, 'canvas.addEnum', ctx)).toBe(true);
    const added = toJSON(ctx.doc).enums?.[0];
    expect(added?.name).toBe('enum_1');
    expect(useUiStore.getState().drawer).toMatchObject({
      open: true,
      mode: 'enum',
      enumId: added?.id,
    });
    expect(useUiStore.getState().enumNameSelect).toBe(added?.id);
  });
});
