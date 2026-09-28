import { createEditor, fromJSON } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_SELECTION, type MenuTarget } from '../../state/ui-store';
import { viewStateOf } from '../views/view-state';
import { actionsFor, findAction, runAction } from './actions-for';
import type { Action, ActionContext, Mode } from './types';

const deck = emptySododeckFile();

function ctx(target: MenuTarget, mode: Mode = 'edit'): ActionContext {
  return {
    editor: createEditor(fromJSON(deck)),
    deck,
    view: viewStateOf(deck, null, new Set()),
    target,
    selection: target.kind === 'canvas' ? EMPTY_SELECTION : target.ids,
    mode,
    point: null,
    childCount: new Map(),
    canvas: null,
  };
}

const one: MenuTarget = { kind: 'component', ids: { ...EMPTY_SELECTION, nodes: ['n1'] } };
const canvas: MenuTarget = { kind: 'canvas' };

const LIST: readonly Action[] = [
  {
    id: 'delete',
    label: 'Delete',
    section: 'danger',
    destructive: true,
    where: { menu: ['component', 'components'] },
  },
  {
    id: 'details',
    label: 'Open details',
    section: 'open',
    modes: ['edit', 'flow'],
    where: { menu: ['component'], toolbar: ['component'] },
  },
  {
    id: 'rename',
    label: (c) => (c.target.kind === 'group' ? 'Rename group' : 'Rename'),
    section: 'open',
    where: { menu: ['component', 'group'] },
  },
  {
    id: 'inside',
    label: 'Open inside',
    section: 'open',
    where: { menu: ['component'] },
    applies: () => false,
  },
  {
    id: 'copy',
    label: 'Copy JSON',
    section: 'clipboard',
    modes: ['edit', 'flow'],
    where: { menu: ['component', 'canvas'] },
    disabledReason: (c) => (c.target.kind === 'canvas' ? 'Nothing selected' : null),
  },
  {
    id: 'arrange',
    label: 'Arrange',
    section: 'arrange',
    where: { menu: ['component'] },
    children: () => [
      { id: 'arrange.front', label: 'Bring to front', section: 'arrange', where: {} },
      { id: 'arrange.back', label: 'Send to back', section: 'arrange', where: {} },
    ],
  },
];

const ids = (sections: ReturnType<typeof actionsFor>) =>
  sections.map((s) => [s.id, s.actions.map((a) => a.id)]);

describe('actionsFor', () => {
  it('keeps section order and list order, and drops empty sections', () => {
    expect(ids(actionsFor(LIST, ctx(one), 'menu'))).toEqual([
      ['open', ['details', 'rename']],
      ['clipboard', ['copy']],
      ['arrange', ['arrange']],
      ['danger', ['delete']],
    ]);
  });

  it('filters by surface and target', () => {
    expect(ids(actionsFor(LIST, ctx(one), 'toolbar'))).toEqual([['open', ['details']]]);
    const group: MenuTarget = { kind: 'group', ids: { ...EMPTY_SELECTION, groups: ['g1'] } };
    const sections = actionsFor(LIST, ctx(group), 'menu');
    expect(ids(sections)).toEqual([['open', ['rename']]]);
    expect(sections[0]?.actions[0]?.label).toBe('Rename group');
  });

  it('keeps only the actions of the current mode (edit by default)', () => {
    expect(ids(actionsFor(LIST, ctx(one, 'flow'), 'menu'))).toEqual([
      ['open', ['details']],
      ['clipboard', ['copy']],
    ]);
    expect(ids(actionsFor(LIST, ctx(one, 'session'), 'menu'))).toEqual([]);
  });

  it('resolves disabled reasons, children and flags', () => {
    const [clipboard] = actionsFor(LIST, ctx(canvas), 'menu');
    expect(clipboard?.actions[0]).toMatchObject({ id: 'copy', disabled: 'Nothing selected' });
    const menu = actionsFor(LIST, ctx(one), 'menu');
    const arrange = menu.find((s) => s.id === 'arrange')?.actions[0];
    expect(arrange?.children?.map((a) => a.label)).toEqual(['Bring to front', 'Send to back']);
    expect(menu.find((s) => s.id === 'danger')?.actions[0]?.destructive).toBe(true);
  });
});

describe('runAction', () => {
  it('runs an action only where it applies and is enabled', () => {
    const run = vi.fn();
    const list: Action[] = [
      { id: 'a', label: 'A', section: 'edit', where: { menu: ['component'] }, run },
      {
        id: 'b',
        label: 'B',
        section: 'edit',
        where: { toolbar: ['component'] },
        disabledReason: () => 'No',
        run,
      },
    ];
    expect(runAction(list, 'a', ctx(one))).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(runAction(list, 'a', ctx(canvas))).toBe(false);
    expect(runAction(list, 'a', ctx(one, 'flow'))).toBe(false);
    expect(runAction(list, 'b', ctx(one))).toBe(false);
    expect(runAction(list, 'missing', ctx(one))).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('finds an action by id', () => {
    expect(findAction(LIST, 'rename')?.label).toBeTypeOf('function');
    expect(findAction(LIST, 'nope')).toBeUndefined();
  });
});
