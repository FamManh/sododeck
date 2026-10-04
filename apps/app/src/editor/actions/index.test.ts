import { describe, expect, it } from 'vitest';

import { SHORTCUTS } from '../shell/shortcuts';
import { actionContext, labels, TARGETS } from '../../test/action-fixtures';
import { actionsFor } from './actions-for';
import { ACTIONS } from './index';

describe('ACTIONS', () => {
  it('has unique ids', () => {
    const ids = ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only shortcuts from SHORTCUTS', () => {
    const known = new Set<string>(SHORTCUTS.map((s) => s.id));
    for (const action of ACTIONS) {
      if (action.shortcut !== undefined) expect(known.has(action.shortcut), action.id).toBe(true);
    }
  });

  it('offers every action on at least one surface and target', () => {
    for (const action of ACTIONS) {
      const kinds = [
        ...(action.where.menu ?? []),
        ...(action.where.toolbar ?? []),
        ...(action.where.keys ?? []),
      ];
      expect(kinds.length, action.id).toBeGreaterThan(0);
    }
  });
});

describe('the menus and toolbars of the contract (019 contracts/quick-edit-ui.md)', () => {
  it('lists each target’s menu, in sections', () => {
    expect(labels(TARGETS.component, 'menu')).toEqual([
      ['Open details', 'Rename'],
      ['Reset size', 'Colour: none', 'Icon…'],
      ['Copy', 'Cut', 'Duplicate'],
      ['Group', 'Align', 'Arrange', 'Spread ends evenly'],
      ['Pin'],
      ['Delete'],
    ]);
    expect(labels(TARGETS.parent, 'menu')[0]).toEqual(['Open details', 'Open inside', 'Rename']);
    expect(labels(TARGETS.components, 'menu')).toEqual([
      ['Open details'],
      ['Colour: none', 'Icon…'],
      ['Copy', 'Cut', 'Duplicate'],
      ['Group', 'Align', 'Arrange', 'Spread ends evenly'],
      ['Pin all'],
      ['Delete'],
    ]);
    expect(labels(TARGETS.connection, 'menu')).toEqual([
      ['Open details', 'Edit label', 'Protocol', 'Direction'],
      ['Line type', 'Dash', 'Weight', 'Colour…', 'Animate direction'],
      ['Delete'],
    ]);
    expect(labels(TARGETS.group, 'menu')).toEqual([
      ['Open details', 'Open inside', 'Rename'],
      ['Collapse', 'Select members', 'Colour: none'],
      ['Copy', 'Cut', 'Duplicate'],
      ['Spread ends evenly'],
      ['Delete group'],
    ]);
    expect(labels(TARGETS.canvas, 'menu')).toEqual([
      ['Paste'],
      ['Add component', 'Add sticky'],
      ['Select all', 'Fit'],
    ]);
    expect(labels(TARGETS.sticky, 'menu')).toEqual([['Open details'], ['Delete']]);
    expect(labels(TARGETS.mixed, 'menu')).toEqual([
      ['Colour: none', 'Icon…'],
      ['Spread ends evenly'],
      ['Delete'],
    ]);
  });

  it('keeps only Open details, Copy and Fit in flow mode and sessions', () => {
    for (const mode of ['flow', 'session'] as const) {
      expect(labels(TARGETS.component, 'menu', mode)).toEqual([['Open details'], ['Copy']]);
      expect(labels(TARGETS.connection, 'menu', mode)).toEqual([['Open details']]);
      expect(labels(TARGETS.group, 'menu', mode)).toEqual([['Open details'], ['Copy']]);
      expect(labels(TARGETS.canvas, 'menu', mode)).toEqual([['Fit']]);
    }
  });

  it('lists each toolbar variant’s buttons', () => {
    expect(labels(TARGETS.component, 'toolbar').flat()).toEqual([
      'Open details',
      'Type: Service',
      'Owner: none',
      'Tags',
      'Technology: none',
      'Links',
      'Rules',
      'Colour: none',
      'Icon',
      'Spread ends evenly',
      'More actions',
    ]);
    expect(labels(TARGETS.components, 'toolbar').flat()).toEqual([
      'Type: Mixed',
      'Owner: none',
      'Tags',
      'Technology: none',
      'Colour: none',
      'Icon',
      'Group',
      'Align',
      'Spread ends evenly',
      'More actions',
    ]);
    expect(labels(TARGETS.connection, 'toolbar').flat()).toEqual([
      'Label',
      'Protocol: HTTP',
      'Direction: Forward',
      'Line style',
      'More actions',
    ]);
    expect(labels(TARGETS.group, 'toolbar').flat()).toEqual([
      'Rename',
      'Ungroup',
      'Collapse',
      'Select members',
      'Colour: none',
      'Spread ends evenly',
      'More actions',
    ]);
    expect(labels(TARGETS.mixed, 'toolbar').flat()).toEqual([
      'Colour: none',
      'Icon',
      'Spread ends evenly',
      'More actions',
    ]);
  });

  it('has a runnable action behind every item it shows (SC-006)', () => {
    for (const target of Object.values(TARGETS)) {
      for (const surface of ['menu', 'toolbar'] as const) {
        for (const section of actionsFor(ACTIONS, actionContext(target), surface)) {
          for (const action of section.actions) {
            const runnable =
              ACTIONS.find((a) => a.id === action.id)?.run !== undefined ||
              (action.children?.length ?? 0) > 0 ||
              action.field !== undefined ||
              action.id === 'more';
            expect(runnable, `${target.kind} ${action.id}`).toBe(true);
          }
        }
      }
    }
  });
});
