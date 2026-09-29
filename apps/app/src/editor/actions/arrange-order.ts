/**
 * Draw order (019 FR-037): components later in `deck.nodes` are drawn on top. Bringing to front
 * moves ids to the end, sending to back moves them to the start; their relative order is kept.
 */
export function arrangeOrder(
  nodeIds: readonly string[],
  moved: readonly string[],
  direction: 'front' | 'back',
): string[] {
  const set = new Set(moved);
  const picked = nodeIds.filter((id) => set.has(id));
  const rest = nodeIds.filter((id) => !set.has(id));
  return direction === 'front' ? [...rest, ...picked] : [...picked, ...rest];
}

/** The `reorder(id, index)` moves, applied in order, that turn `from` into `to`. */
export function reorderSteps(
  from: readonly string[],
  to: readonly string[],
): { id: string; index: number }[] {
  const current = [...from];
  const steps: { id: string; index: number }[] = [];
  to.forEach((id, index) => {
    if (current[index] === id) return;
    current.splice(current.indexOf(id), 1);
    current.splice(index, 0, id);
    steps.push({ id, index });
  });
  return steps;
}
