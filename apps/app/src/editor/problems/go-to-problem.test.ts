import { checkDeck, createEditor, fromJSON, type DeckEditor, type Problem } from '@sododeck/model';
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
    stickies: [{ id: 'n1', text: 'Note', anchor: 'nowhere' }],
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
    const { ctx, problem } = setup();
    goToProblem(problem('broken-reference'), ctx);
    expect(ctx.select).toHaveBeenCalledWith({ stickies: ['n1'] });
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
