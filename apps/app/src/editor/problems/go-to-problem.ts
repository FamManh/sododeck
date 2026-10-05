import { analyzeFlow, type Problem } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import { isFlowMode, useUiStore, type CanvasViewport } from '../../state/ui-store';
import { openResult, edgeCenter, type OpenResultContext } from '../command-palette/open-result';
import type { PaletteResult } from '../command-palette/palette-results';
import { visibleGraph, scopeOf } from '../visible-graph';
import { focusRowSoon } from '../table/row-focus';
import { readViewState, selectView, setGroupCollapsed } from '../views/use-current-view';

export type ProblemNavContext = OpenResultContext & {
  /** The canvas viewport, saved in a drill frame so going back up restores it. */
  getViewport?: () => CanvasViewport;
};

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

/** Card ids containing `nodeId` (a table's database card), outermost first. */
function ancestorCards(deck: SododeckFile, nodeId: Id): Id[] {
  const chain: Id[] = [];
  let parent = deck.nodes.find((n) => n.id === nodeId)?.parent;
  while (parent !== undefined && !chain.includes(parent)) {
    chain.unshift(parent);
    parent = deck.nodes.find((n) => n.id === parent)?.parent;
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
  // A table inside a database card is drawn only once that card is opened.
  const viewport = context.getViewport?.() ?? { x: 0, y: 0, zoom: context.getZoom() };
  for (const cardId of ancestorCards(view.deck, nodeId)) {
    const { drill } = useUiStore.getState();
    if (visibleGraph(view.deck, scopeOf(drill), new Set()).nodes.includes(nodeId)) break;
    if (drill.some((frame) => frame.kind === 'node' && frame.id === cardId)) continue;
    useUiStore.getState().drillInto({ kind: 'node', id: cardId, viewport });
  }
}

function goToNode(context: ProblemNavContext, nodeId: Id): boolean {
  if (readDeck(context.editor.doc).nodes.some((n) => n.id === nodeId)) reveal(context, nodeId);
  return openResult(result('node', nodeId), context);
}

/** Several cards: the first is opened (revealed, centred), then every card is selected (030). */
function goToNodes(context: ProblemNavContext, ids: readonly Id[]): boolean {
  const [first] = ids;
  if (first === undefined) return false;
  const opened = goToNode(context, first);
  if (!opened || ids.length === 1) return opened;
  const deck = readDeck(context.editor.doc);
  const present = ids.filter((id) => deck.nodes.some((n) => n.id === id));
  for (const id of present) reveal(context, id);
  context.select({ nodes: present });
  return true;
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
 * After arriving at a schema problem (047 R7): focuses its row, draws its table at All until the
 * selection leaves (nothing is written) and opens the fix popover. Only when the object really was
 * selected: a card the view hides stays a toast. Problems without a fix open no popover.
 */
function withFix(problem: Problem, arrived: boolean, edgeIds: readonly Id[]): boolean {
  if (!arrived) return false;
  const ui = useUiStore.getState();
  const { column } = problem;
  const { selection } = ui;
  const selected =
    column === undefined
      ? selection.nodes.length > 0 || selection.edges.length > 0
      : selection.nodes.includes(column.tableId) ||
        edgeIds.some((id) => selection.edges.includes(id));
  if (!selected) return true;
  if (column !== undefined) {
    ui.setProblemReveal({
      tableId: column.tableId,
      ...(edgeIds.length > 0 ? { edges: edgeIds } : {}),
    });
    ui.setFocusedRow(column);
    focusRowSoon(column);
  }
  if ((problem.fixes?.length ?? 0) > 0) ui.setProblemPopover({ key: problem.key });
  return true;
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
      return withFix(problem, goToNode(context, target.id), []);
    case 'nodes':
      return withFix(problem, goToNodes(context, target.ids), []);
    case 'edges': {
      // A relationship between tables is drawn only once their database card is open.
      if (problem.kind.startsWith('db-')) {
        const deck = readDeck(context.editor.doc);
        const from = deck.edges.find((e) => e.id === target.ids[0])?.from;
        if (from !== undefined && deck.nodes.some((n) => n.id === from)) reveal(context, from);
      }
      return withFix(problem, goToEdges(context, target.ids), target.ids);
    }
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
        case 'meta':
          // A schema enum (047): the enum drawer is where its name and values are edited.
          if (ref.child?.kind === 'enum') {
            if (!deck.enums?.some((e) => e.id === ref.child?.id)) break;
            if (context.screen === 'rules') context.navigateToCanvas();
            useUiStore.getState().openEnumDrawer(ref.child.id);
            return true;
          }
          // Deck-level (an unknown pack id): nothing to select; the deck's settings are the place.
          if (context.screen === 'rules') context.navigateToCanvas();
          context.select({});
          return true;
        default:
          break;
      }
      context.announce('This item no longer exists');
      return false;
    }
  }
}
