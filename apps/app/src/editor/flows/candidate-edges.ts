/**
 * Keyboard candidates while recording (FR-015, research R8): every edge for the first step, then
 * the next start node's outgoing edges. Reading order: source node top to bottom, then left to
 * right, then the target node the same way. Pure.
 */
import type { FlowAnalysis } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import type { SessionTarget } from '../../state/ui-store';
import { displayPosition, groupBounds, type Point } from '../canvas-geometry';
import { sessionPath } from './session-path';

const byReading = (a: Point, b: Point) => a.y - b.y || a.x - b.x;

export function candidateEdges(
  deck: SododeckFile,
  analysis: FlowAnalysis | null,
  target: SessionTarget,
): string[] {
  const positions = new Map(deck.nodes.map((n, i) => [n.id, displayPosition(n, i)]));
  // A group end reads from its frame's top-left corner (050 R6).
  if (deck.groups.length > 0) {
    for (const [id, frame] of groupBounds(deck)) {
      if (!positions.has(id)) positions.set(id, { x: frame.x, y: frame.y });
    }
  }
  const { nextStart } = sessionPath(analysis, target);
  return deck.edges
    .filter(
      (e) =>
        positions.has(e.from) &&
        positions.has(e.to) &&
        (nextStart === null || e.from === nextStart),
    )
    .map((e, index) => ({ e, index }))
    .sort((a, b) => {
      const from = byReading(
        positions.get(a.e.from) ?? { x: 0, y: 0 },
        positions.get(b.e.from) ?? { x: 0, y: 0 },
      );
      if (from !== 0) return from;
      const to = byReading(
        positions.get(a.e.to) ?? { x: 0, y: 0 },
        positions.get(b.e.to) ?? { x: 0, y: 0 },
      );
      return to || a.index - b.index;
    })
    .map(({ e }) => e.id);
}
