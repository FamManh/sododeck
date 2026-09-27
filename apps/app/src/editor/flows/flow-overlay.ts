/**
 * Canvas marks of the shown or recorded flow (006 research R6): numbered badges, path, error-path,
 * candidate, preview and invalid styles on edges, and the "Step n starts here" ring on the next
 * start node. Pure; `toFlowEdges` / `toFlowNodes` read it through their per-object cache.
 */
import type { FlowAnalysis } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import type { FlowSession } from '../../state/ui-store';
import { sessionPath } from './session-path';

export interface EdgeBadge {
  /** Step number, e.g. "3" or "4b". */
  label: string;
  errorPath: boolean;
  /** The active step. */
  current: boolean;
  /** The step does not start where the previous one ended (FR-021). */
  chainBreak: boolean;
}

export type EdgeFlowStyle = 'path' | 'error' | 'candidate' | 'preview' | 'invalid';

export interface EdgeFlowMark {
  /** One per step that travels the edge, in path order. */
  badges: readonly EdgeBadge[];
  style: EdgeFlowStyle;
  /** An error-path step travels the edge: the label gets an alert icon (FR-026). */
  errorIcon: boolean;
}

export interface NodeFlowMark {
  /** "Step 4 starts here". */
  startsHere: string;
}

export interface FlowOverlay {
  edges: ReadonlyMap<string, EdgeFlowMark>;
  nodes: ReadonlyMap<string, NodeFlowMark>;
}

export const EMPTY_OVERLAY: FlowOverlay = { edges: new Map(), nodes: new Map() };

/** Marks for `analysis` (the shown flow) and, during a session, its next step. */
export function flowOverlay(
  deck: SododeckFile,
  analysis: FlowAnalysis | null,
  session: FlowSession | null,
  hoverEdgeId: string | null,
  activeStepId: string | null = null,
): FlowOverlay {
  const badges = new Map<string, EdgeBadge[]>();
  if (analysis !== null) {
    const paths = [
      { steps: analysis.main, errorPath: false },
      ...analysis.branches.map((b) => ({ steps: b.steps, errorPath: b.branch.errorPath === true })),
    ];
    for (const { steps, errorPath } of paths) {
      for (const s of steps) {
        if (s.broken) continue;
        const list = badges.get(s.step.edge) ?? [];
        list.push({
          label: s.number,
          errorPath,
          current: s.step.id === activeStepId,
          chainBreak: s.chainBreak,
        });
        badges.set(s.step.edge, list);
      }
    }
  }

  const edges = new Map<string, EdgeFlowMark>();
  for (const [edgeId, list] of badges) {
    const allError = list.every((b) => b.errorPath);
    edges.set(edgeId, {
      badges: list,
      style: allError ? 'error' : 'path',
      errorIcon: list.some((b) => b.errorPath),
    });
  }

  const nodes = new Map<string, NodeFlowMark>();
  if (session === null) return { edges, nodes };

  const path = sessionPath(analysis, session.target);
  const mark = (edgeId: string, style: EdgeFlowStyle) => {
    const existing = edges.get(edgeId);
    edges.set(edgeId, {
      badges: existing?.badges ?? [],
      errorIcon: existing?.errorIcon ?? false,
      style,
    });
  };
  if (path.nextStart !== null) {
    nodes.set(path.nextStart, { startsHere: `Step ${path.nextNumber} starts here` });
    for (const edge of deck.edges) {
      if (edge.from === path.nextStart && !edges.has(edge.id)) mark(edge.id, 'candidate');
    }
  }
  if (hoverEdgeId !== null) {
    const edge = deck.edges.find((e) => e.id === hoverEdgeId);
    const valid = edge !== undefined && (path.nextStart === null || edge.from === path.nextStart);
    if (valid) mark(hoverEdgeId, 'preview');
  }
  if (session.invalid !== null) mark(session.invalid.edgeId, 'invalid');
  return { edges, nodes };
}
