import {
  checkDeck,
  createEditor,
  fromJSON,
  toJSON,
  type DeckEditor,
  type Problem,
} from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readDeck } from '../../model/use-deck-snapshot';
import { useUiStore, type Selection } from '../../state/ui-store';
import { deckOf } from '../../test/render-canvas';
import { collapsedOf, readViewState } from '../views/use-current-view';
import { goToProblem, type ProblemNavContext } from './go-to-problem';

const initialUi = useUiStore.getState();

const deck = () =>
  deckOf({
    groups: [
      { id: 'outer', title: 'Outer' },
      { id: 'inner', title: 'Inner', parent: 'outer' },
    ],
    nodes: [
      { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
      { id: 'b', type: 'service', title: 'B', position: { x: 200, y: 0 } },
      // A broken reference on a component: the component is the problem's target.
      { id: 'lonely', type: 'service', title: 'Lonely', group: 'inner', rules: ['gone'] },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b' },
      { id: 'e2', from: 'a', to: 'b' },
    ],
    flows: [
      {
        id: 'f',
        title: 'Pay',
        branches: [
          { id: 'b1', label: 'ok', condition: 'paid' },
          { id: 'b2', label: 'ko', condition: 'Paid' },
        ],
        steps: [
          { id: 's1', edge: 'e1' },
          { id: 's2', edge: 'gone' },
          { id: 's3', edge: 'e1', branch: 'b1' },
          { id: 's4', edge: 'e1', branch: 'b2' },
        ],
      },
    ],
    rules: {
      R: { title: 'Tier', hitPolicy: 'first', inputs: [], outputs: [], rows: [] },
    },
    stickies: [{ id: 'n1', text: 'Note', position: { x: 0, y: 200 } }],
  });

function setup(file: SododeckFile = deck()) {
  const doc = fromJSON(file);
  const editor = createEditor(doc);
  const ctx = {
    editor,
    screen: 'canvas' as const,
    announce: vi.fn(),
    openRules: vi.fn(),
    navigateToCanvas: vi.fn(),
    fitView: vi.fn(),
    setCenter: vi.fn(),
    getZoom: () => 1,
    select: vi.fn((selection: Partial<Selection>) => {
      useUiStore.getState().select(selection);
    }),
    focus: vi.fn(),
    exitFlow: vi.fn(),
    openFlow: vi.fn<(e: DeckEditor, flowId: string, stepId?: string | null) => void>(),
    isHidden: (id: string) => readViewState(doc).hidden.has(id),
    firstViewShowing: vi.fn<ProblemNavContext['firstViewShowing'] & object>(() => null),
    showToast: vi.fn(),
  } satisfies ProblemNavContext;
  const problem = (kind: Problem['kind']): Problem => {
    const found = checkDeck(readDeck(doc)).list.find((p) => p.kind === kind);
    if (found === undefined) throw new Error(`no ${kind}`);
    return found;
  };
  /** The problem on the component "Lonely" (a broken reference). */
  const onLonely = (): Problem => {
    const found = checkDeck(readDeck(doc)).list.find(
      (p) => p.target.type === 'node' && p.target.id === 'lonely',
    );
    if (found === undefined) throw new Error('no problem on Lonely');
    return found;
  };
  return { doc, editor, ctx, problem, onLonely };
}

describe('goToProblem (015 US2, FR-017–019)', () => {
  beforeEach(() => {
    useUiStore.setState(initialUi, true);
  });

  it('selects, focuses and fits a component, and records the cursor', () => {
    const { ctx, onLonely } = setup();
    const onComponent = onLonely();
    expect(goToProblem(onComponent, ctx)).toBe(true);
    expect(ctx.select).toHaveBeenCalledWith({ nodes: ['lonely'] });
    expect(ctx.focus).toHaveBeenCalledWith('lonely');
    expect(ctx.fitView).toHaveBeenCalled();
    expect(useUiStore.getState().problemCursor).toBe(onComponent.key);
  });

  it('expands collapsed groups around the component, without an undo step', () => {
    const { editor, doc, ctx, onLonely } = setup();
    editor.setCollapsed(readViewState(doc).view.id, 'outer', true);
    editor.setCollapsed(readViewState(doc).view.id, 'inner', true);
    const canUndo = editor.canUndo();
    goToProblem(onLonely(), ctx);
    expect(collapsedOf(doc).size).toBe(0);
    expect(editor.canUndo()).toBe(canUndo);
  });

  it('goes up the drill-in until the component is in scope', () => {
    const { ctx, problem, onLonely } = setup();
    const viewport = { x: 0, y: 0, zoom: 1 };
    useUiStore.setState({
      drill: [
        { kind: 'group', id: 'outer', viewport },
        { kind: 'group', id: 'inner', viewport },
      ],
    });
    goToProblem(problem('duplicate-connection'), ctx);
    expect(useUiStore.getState().drill).toHaveLength(2); // edges: no reveal needed
    useUiStore.setState({ drill: [{ kind: 'node', id: 'a', viewport }] });
    goToProblem(onLonely(), ctx);
    expect(useUiStore.getState().drill).toHaveLength(0);
  });

  it('selects all duplicate connections together', () => {
    const { ctx, problem } = setup();
    goToProblem(problem('duplicate-connection'), ctx);
    expect(ctx.select).toHaveBeenCalledWith({ edges: ['e1', 'e2'] });
    expect(ctx.setCenter).toHaveBeenCalled();
  });

  it('opens a flow at the broken step, and at the fork for branch problems', () => {
    const { editor, ctx, problem } = setup();
    goToProblem(problem('step-without-connection'), ctx);
    expect(ctx.openFlow).toHaveBeenLastCalledWith(editor, 'f', 's2');
    goToProblem(problem('overlapping-conditions'), ctx);
    expect(ctx.openFlow).toHaveBeenLastCalledWith(editor, 'f', 's2');
  });

  it('opens the rule editor for rule problems', () => {
    const { ctx, problem } = setup();
    goToProblem(problem('rule-without-catch-all'), ctx);
    expect(ctx.openRules).toHaveBeenCalledWith('R');
  });

  it('selects the holder of a broken reference', () => {
    const base = deck();
    const orphan = { id: 'orphan', title: 'Orphan', parent: 'gone' };
    const { ctx, editor } = setup({ ...base, groups: [...base.groups, orphan] });
    const found = checkDeck(readDeck(editor.doc)).list.find(
      (p) => p.kind === 'broken-reference' && p.target.type === 'object',
    );
    if (found === undefined) throw new Error('no broken reference on an object');
    goToProblem(found, ctx);
    expect(ctx.select).toHaveBeenCalledWith({ groups: ['orphan'] });
  });

  it('selects every card of an unknown type (030)', () => {
    const base = deck();
    const { ctx, problem } = setup({
      ...base,
      nodes: [
        ...base.nodes,
        { id: 'r1', type: 'robot', title: 'R1', position: { x: 400, y: 0 } },
        { id: 'r2', type: 'robot', title: 'R2', position: { x: 600, y: 0 } },
      ],
    });
    goToProblem(problem('unknown-card-type'), ctx);
    expect(ctx.select).toHaveBeenLastCalledWith({ nodes: ['r1', 'r2'] });
  });

  it('goes to the deck level for an unknown pack without selecting anything (030)', () => {
    const { ctx, problem } = setup({ ...deck(), packs: ['architecture', 'future-pack'] });
    expect(goToProblem(problem('unknown-pack'), ctx)).toBe(true);
    expect(ctx.select).toHaveBeenCalledWith({});
  });

  it('offers another view when the current one hides the component', () => {
    const { ctx, onLonely } = setup({
      ...deck(),
      views: [
        { id: 'v1', type: 'custom', title: 'No inner', excludeGroups: ['inner'] },
        { id: 'v2', type: 'system', title: 'System' },
      ],
    });
    ctx.firstViewShowing.mockReturnValue({ id: 'v2', title: 'System' });
    goToProblem(onLonely(), ctx);
    expect(ctx.select).not.toHaveBeenCalled();
    expect(ctx.showToast).toHaveBeenCalledWith(
      'Lonely is hidden in this view',
      expect.objectContaining({ label: 'Show in System' }),
    );
  });

  it('announces a target that no longer exists', () => {
    const { editor, ctx, onLonely } = setup();
    const onComponent = onLonely();
    editor.remove('nodes', 'lonely');
    expect(goToProblem(onComponent, ctx)).toBe(false);
    expect(ctx.announce).toHaveBeenCalledWith('This item no longer exists');
  });
});

describe('goToProblem on a schema row (047 US2, R7)', () => {
  const schemaDeck = () =>
    deckOf({
      dialect: 'postgres',
      nodes: [
        {
          id: 'ord',
          type: 'db-table',
          title: 'orders',
          detail: 'names',
          position: { x: 0, y: 0 },
          columns: [
            { id: 'o-id', name: 'id', type: 'uuid', pk: true, notNull: true },
            { id: 'o-st', name: 'status', type: 'text', notNull: true, defaultExpr: 'NULL' },
          ],
        },
        {
          id: 'pts',
          type: 'db-table',
          title: 'points',
          position: { x: 400, y: 0 },
          columns: [
            { id: 'p-id', name: 'id', type: 'integer', pk: true },
            { id: 'p-ref', name: 'customer_ref', type: 'int' },
          ],
        },
      ],
      edges: [
        {
          id: 'rel',
          from: 'pts',
          to: 'ord',
          fromColumns: ['p-ref'],
          toColumns: ['o-id'],
          cardinality: 'n-1',
        },
      ],
    });

  const nullDefault = (s: ReturnType<typeof setup>) => s.problem('db-null-default');
  const state = () => useUiStore.getState();
  const shownDetail = (s: ReturnType<typeof setup>) =>
    readViewState(s.doc).deck.nodes.find((n) => n.id === 'ord')?.detail;

  beforeEach(() => {
    useUiStore.setState(initialUi, true);
  });

  it('focuses the row, reveals the table and opens the popover, writing nothing', () => {
    const s = setup(schemaDeck());
    const problem = nullDefault(s);
    const before = toJSON(s.doc);
    expect(shownDetail(s)).toBe('names');
    expect(goToProblem(problem, s.ctx)).toBe(true);
    expect(state().selection.nodes).toEqual(['ord']);
    expect(state().focusedRow).toEqual({ tableId: 'ord', columnId: 'o-st' });
    expect(state().problemReveal).toMatchObject({ tableId: 'ord' });
    expect(state().problemPopover).toEqual({ key: problem.key });
    expect(s.ctx.fitView).toHaveBeenCalled();
    expect(shownDetail(s)).toBe('all');
    expect(toJSON(s.doc)).toEqual(before);
    expect(s.editor.canUndo()).toBe(false);
  });

  it('opens the database card that holds the table before selecting it', () => {
    const file = schemaDeck();
    const s = setup({
      ...file,
      nodes: [
        { id: 'db', type: 'database', title: 'Orders DB', position: { x: 0, y: 0 } },
        ...file.nodes.map((n) => (n.id === 'ord' ? { ...n, parent: 'db' } : n)),
      ],
    });
    expect(goToProblem(nullDefault(s), s.ctx)).toBe(true);
    expect(state().drill.map((f) => f.id)).toEqual(['db']);
    expect(state().selection.nodes).toEqual(['ord']);
  });

  it('opens the database card of a relationship problem before selecting it', () => {
    const file = schemaDeck();
    const s = setup({
      ...file,
      nodes: [
        { id: 'db', type: 'database', title: 'Orders DB', position: { x: 0, y: 0 } },
        ...file.nodes.map((n) => ({ ...n, parent: 'db' })),
      ],
    });
    expect(goToProblem(s.problem('db-type-mismatch'), s.ctx)).toBe(true);
    expect(state().drill.map((f) => f.id)).toEqual(['db']);
    expect(state().selection.edges).toEqual(['rel']);
  });

  it('drops the reveal when the selection leaves the table', () => {
    const s = setup(schemaDeck());
    goToProblem(nullDefault(s), s.ctx);
    state().setFocusedRow(null);
    state().select({ nodes: ['pts'] });
    expect(state().problemReveal).toBeNull();
    expect(shownDetail(s)).toBe('names');
  });

  it('keeps the reveal while the table stays selected', () => {
    const s = setup(schemaDeck());
    goToProblem(nullDefault(s), s.ctx);
    state().select({ nodes: ['ord'] });
    expect(state().problemReveal).toMatchObject({ tableId: 'ord' });
  });

  it('opens the popover for a relationship problem on its referencing row', () => {
    const s = setup(schemaDeck());
    const problem = s.problem('db-type-mismatch');
    expect(goToProblem(problem, s.ctx)).toBe(true);
    expect(state().selection.edges).toEqual(['rel']);
    expect(state().focusedRow).toEqual({ tableId: 'pts', columnId: 'p-ref' });
    expect(state().problemPopover).toEqual({ key: problem.key });
  });

  it('opens the enum drawer for an enum problem, with no popover', () => {
    const file = schemaDeck();
    file.enums = [{ id: 'en', name: 'status', values: [] }];
    const s = setup(file);
    const problem = s.problem('db-empty-enum');
    expect(goToProblem(problem, s.ctx)).toBe(true);
    expect(state().drawer).toMatchObject({ open: true, mode: 'enum', enumId: 'en' });
    expect(state().problemPopover).toBeNull();
  });

  it('opens no popover for a problem without a fix', () => {
    const s = setup();
    goToProblem(s.onLonely(), s.ctx);
    expect(state().problemPopover).toBeNull();
  });

  it('is cleared when another deck opens', () => {
    const s = setup(schemaDeck());
    goToProblem(nullDefault(s), s.ctx);
    state().resetForDeck();
    expect(state().problemPopover).toBeNull();
    expect(state().problemReveal).toBeNull();
  });
});
