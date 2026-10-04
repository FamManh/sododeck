import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { actionContext, actionDeck, sel, TARGETS } from '../../test/action-fixtures';
import { deckOf } from '../../test/render-canvas';
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

describe('icon action (038 T022)', () => {
  const iconAction = (
    target: (typeof TARGETS)[keyof typeof TARGETS],
    surface: 'menu' | 'toolbar',
    mode: 'edit' | 'flow' | 'session' | 'viewOnly' = 'edit',
    file = actionDeck,
  ) =>
    actionsFor(ACTIONS, actionContext(target, mode, file), surface)
      .flatMap((section) => section.actions)
      .find((action) => action.id === 'style.icon');

  it('is "Icon" in the toolbar and "Icon…" in the menu for one or several components', () => {
    for (const target of [TARGETS.component, TARGETS.components, TARGETS.mixed]) {
      expect(iconAction(target, 'toolbar')?.label).toBe('Icon');
      expect(iconAction(target, 'menu')?.label).toBe('Icon…');
    }
    expect(iconAction(TARGETS.component, 'toolbar')?.field).toBe('icon');
  });

  it('is not offered for a group, sticky, connection or the canvas alone', () => {
    for (const target of [TARGETS.group, TARGETS.sticky, TARGETS.connection, TARGETS.canvas]) {
      expect(iconAction(target, 'toolbar')).toBeUndefined();
      expect(iconAction(target, 'menu')).toBeUndefined();
    }
  });

  it('is not offered when every selected node is drawn as a shape', () => {
    const shapes = deckOf({
      nodes: [
        { id: 'a', type: 'rectangle', title: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'rectangle', title: 'B', position: { x: 0, y: 0 } },
      ],
    });
    expect(iconAction(TARGETS.component, 'toolbar', 'edit', shapes)).toBeUndefined();
    expect(iconAction(TARGETS.components, 'menu', 'edit', shapes)).toBeUndefined();
  });

  it('is not offered in flow mode, a recording or the view-only editor', () => {
    for (const mode of ['flow', 'session', 'viewOnly'] as const) {
      expect(iconAction(TARGETS.component, 'menu', mode)).toBeUndefined();
      expect(iconAction(TARGETS.component, 'toolbar', mode)).toBeUndefined();
    }
  });

  it('running it opens the icon toolbar field', () => {
    useUiStore.getState().resetForDeck();
    expect(runAction(ACTIONS, 'style.icon', actionContext(TARGETS.component))).toBe(true);
    expect(useUiStore.getState().toolbarField).toBe('icon');
  });

  it('carries the icon the selected cards draw as the button glyph, or "mixed"', () => {
    const file = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', icon: 'lucide:zap', position: { x: 0, y: 0 } },
        { id: 'b', type: 'database', title: 'B', icon: 'lucide:zap', position: { x: 0, y: 0 } },
        { id: 'p', type: 'service', title: 'P', position: { x: 0, y: 0 } },
      ],
    });
    const glyph = (target: (typeof TARGETS)[keyof typeof TARGETS]) =>
      iconAction(target, 'toolbar', 'edit', file)?.glyph;
    expect(glyph(TARGETS.component)).toMatchObject({ name: 'zap' });
    expect(glyph(TARGETS.components)).toMatchObject({ name: 'zap' });
    expect(glyph({ kind: 'components', ids: sel({ nodes: ['a', 'p'] }) })).toBe('mixed');
    // No icon of its own: the button shows the type icon the card draws.
    expect(glyph({ kind: 'component', ids: sel({ nodes: ['p'] }) })).toMatchObject({
      set: 'lucide',
    });
  });
});
