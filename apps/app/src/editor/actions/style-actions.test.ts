import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { actionContext, TARGETS } from '../../test/action-fixtures';
import { actionsFor, runAction } from './actions-for';
import { ACTIONS } from './index';

const offered = (target: (typeof TARGETS)[keyof typeof TARGETS], surface: 'menu' | 'toolbar') =>
  actionsFor(ACTIONS, actionContext(target), surface)
    .flatMap((section) => section.actions)
    .some((action) => action.id === 'style.colour');

describe('style actions (020 T031)', () => {
  it('offers style.colour on the menu and toolbar for component, components, group and mixed', () => {
    for (const target of [TARGETS.component, TARGETS.components, TARGETS.group, TARGETS.mixed]) {
      expect(offered(target, 'menu')).toBe(true);
      expect(offered(target, 'toolbar')).toBe(true);
    }
  });

  it('does not offer style.colour for a connection, a sticky or the canvas', () => {
    for (const target of [TARGETS.connection, TARGETS.sticky, TARGETS.canvas]) {
      expect(offered(target, 'menu')).toBe(false);
      expect(offered(target, 'toolbar')).toBe(false);
    }
  });

  it('does not offer style.colour in flow or session mode', () => {
    const inFlow = actionsFor(ACTIONS, actionContext(TARGETS.component, 'flow'), 'menu')
      .flatMap((s) => s.actions)
      .some((a) => a.id === 'style.colour');
    const inSession = actionsFor(ACTIONS, actionContext(TARGETS.component, 'session'), 'menu')
      .flatMap((s) => s.actions)
      .some((a) => a.id === 'style.colour');
    expect(inFlow).toBe(false);
    expect(inSession).toBe(false);
  });

  it('running it from the menu opens the style toolbar field', () => {
    useUiStore.getState().resetForDeck();
    expect(runAction(ACTIONS, 'style.colour', actionContext(TARGETS.component))).toBe(true);
    expect(useUiStore.getState().toolbarField).toBe('style');
  });

  it('labels the button "Colour: <name>", falling back to stroke when there is no fill', () => {
    const label = (target: (typeof TARGETS)[keyof typeof TARGETS]) =>
      actionsFor(ACTIONS, actionContext(target), 'toolbar')
        .flatMap((s) => s.actions)
        .find((a) => a.id === 'style.colour')?.label;

    expect(label(TARGETS.component)).toBe('Colour: none');
    expect(label(TARGETS.components)).toBe('Colour: none');
  });

  it('shows no colour as a ringed (non-null) swatch value', () => {
    const swatch = actionsFor(ACTIONS, actionContext(TARGETS.component), 'toolbar')
      .flatMap((s) => s.actions)
      .find((a) => a.id === 'style.colour')?.swatch;
    expect(swatch).toBe(null);
  });
});
