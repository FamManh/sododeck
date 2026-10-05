import type { Selection } from '../../state/ui-store';
import {
  COLLAPSED_NODE_PREFIX,
  GROUP_NODE_PREFIX,
  IMAGE_NODE_PREFIX,
  STICKY_NODE_PREFIX,
} from '../deck-to-flow';
import type { ScreenRect } from './toolbar-placement';

const byId = (kind: 'node' | 'edge', id: string) =>
  document.querySelector(`.react-flow__${kind}[data-id="${CSS.escape(id)}"]`);

/**
 * The screen rectangle around the selected components, connections, groups and notes (019 R5): the
 * union of their elements' `getBoundingClientRect()`, the drawer's pattern. `null` when none is
 * rendered or laid out (off-scope, or no layout in tests).
 */
export function selectionScreenRect(selection: Selection): ScreenRect | null {
  const elements = [
    ...selection.nodes.map((id) => byId('node', id)),
    ...selection.edges.map((id) => byId('edge', id)),
    ...selection.stickies.map((id) => byId('node', `${STICKY_NODE_PREFIX}${id}`)),
    ...selection.images.map((id) => byId('node', `${IMAGE_NODE_PREFIX}${id}`)),
    ...selection.groups.map(
      (id) =>
        byId('node', `${GROUP_NODE_PREFIX}${id}`) ?? byId('node', `${COLLAPSED_NODE_PREFIX}${id}`),
    ),
  ];
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const element of elements) {
    if (element === null) continue;
    const r = element.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  return left === Infinity ? null : { x: left, y: top, width: right - left, height: bottom - top };
}
