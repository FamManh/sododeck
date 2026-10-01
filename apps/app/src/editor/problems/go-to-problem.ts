import { analyzeFlow, type Problem } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { openResult, edgeCenter, type OpenResultContext } from '../command-palette/open-result';
import type { PaletteResult } from '../command-palette/palette-results';
import { visibleGraph, scopeOf } from '../visible-graph';
import { readViewState, selectView, setGroupCollapsed } from '../views/use-current-view';

export type ProblemNavContext = OpenResultContext;

const result = (kind: PaletteResult['kind'], id: Id, flowId?: Id): PaletteResult => ({
  kind,
  id,
  title: '',
  meta: '',
  ...(flowId === undefined ? {} : { flowId }),
});

/** Group ids containing `nodeId`, innermost first. */
function ancestorGroups(deck: SododeckFile, nodeId: Id): Id[] {
  const parentOf = new Map(deck.groups.map((g) => [g.id, g.parent]));
  const chain: Id[] = [];
  let group = deck.nodes.find((n) => n.id === nodeId)?.group;
  while (group !== undefined && !chain.includes(group)) {
    chain.push(group);
    group = parentOf.get(group);
  }
  return chain;
}

/**
 * Makes a component visible before it is selected (FR-018): expands collapsed groups around it in
 * the current view (never an undo step, 011) and goes up the drill-in until it is in scope.
 */
function reveal(context: ProblemNavContext, nodeId: Id): void {
  const view = readViewState(context.editor.doc);
  if (view.hidden.has(nodeId)) return; // openResult offers "Show in <view>" instead
  for (const groupId of ancestorGroups(view.deck, nodeId)) {
    if (view.collapsed.has(groupId)) setGroupCollapsed(context.editor, groupId, false);
  }
  const ui = useUiStore.getState();
  let depth = ui.drill.length;
  while (
    depth > 0 &&
    !visibleGraph(view.deck, scopeOf(ui.drill.slice(0, depth)), new Set()).nodes.includes(nodeId)
  ) {
    depth--;
  }
  if (depth < ui.drill.length) ui.drillUp(depth);
}

function goToNode(context: ProblemNavContext, nodeId: Id): boolean {
  if (readDeck(context.editor.doc).nodes.some((n) => n.id === nodeId)) reveal(context, nodeId);
  return openResult(result('node', nodeId), context);
}

function goToEdges(context: ProblemNavContext, ids: readonly Id[]): boolean {
  const deck = readDeck(context.editor.doc);
  const edges = deck.edges.filter((e) => ids.includes(e.id));
  const [first] = edges;
  if (first === undefined) return openResult(result('edge', ids[0] ?? ''), context);
  if (edges.length === 1) return openResult(result('edge', first.id), context);
  if (context.screen === 'rules') context.navigateToCanvas();
  if (isFlowMode(useUiStore.getState())) context.exitFlow();
  context.select({ edges: edges.map((e) => e.id) });
  const center = edgeCenter(deck, first.from, first.to, context.getZoom());
  if (center !== null) {
    context.setCenter(center.x, center.y, { zoom: context.getZoom() });
  }
  return true;
}

function goToFlow(
  context: ProblemNavContext,
  flowId: Id,
  stepId: Id | undefined,
  branchIds: readonly Id[] | undefined,
): boolean {
  const flow = readDeck(context.editor.doc).flows.find((f) => f.id === flowId);
  if (flow !== undefined && stepId === undefined && branchIds !== undefined) {
    // Branch problems open the flow at its fork, where the branches are listed.
    const fork = analyzeFlow(flow, readDeck(context.editor.doc).edges).branchStepId;
    if (fork !== null) return openResult(result('step', fork, flowId), context);
  }
  return stepId === undefined
    ? openResult(result('flow', flowId), context)
    : openResult(result('step', stepId, flowId), context);
}

/**
 * Takes the user to a problem (015 FR-017–019): selects the object and brings it into view, opens
 * the flow at the step, or opens the rule; reuses the command palette's opening so hidden-in-view
 * and deleted targets behave the same. Records the problem as the ⌘. position.
 */
export function goToProblem(problem: Problem, context: ProblemNavContext): boolean {
  useUiStore.getState().setProblemCursor(problem.key);
  const { target } = problem;
  switch (target.type) {
    case 'node':
      return goToNode(context, target.id);
    case 'edges':
      return goToEdges(context, target.ids);
    case 'flow':
      return goToFlow(context, target.flowId, target.stepId, target.branchIds);
    case 'rule':
      return openResult(result('rule', target.ruleId), context);
    case 'object': {
      const { ref } = target;
      const deck = readDeck(context.editor.doc);
      switch (ref.scope) {
        case 'stickies':
          return openResult(result('sticky', ref.id), context);
        case 'rules':
          return openResult(result('rule', ref.id), context);
        case 'groups': {
          if (!deck.groups.some((g) => g.id === ref.id)) break;
          if (context.screen === 'rules') context.navigateToCanvas();
          if (isFlowMode(useUiStore.getState())) context.exitFlow();
          context.select({ groups: [ref.id] });
          return true;
        }
        case 'views': {
          const view = readViewState(context.editor.doc).views.find((v) => v.id === ref.id);
          if (view === undefined) break;
          if (context.screen === 'rules') context.navigateToCanvas();
          selectView(view);
          return true;
        }
        default:
          break;
      }
      context.announce('This item no longer exists');
      return false;
    }
  }
}
