import { fieldsOfNode, type ResolvedField } from '@sododeck/model';
import type { Node, SododeckFile } from '@sododeck/schema';

/** Values the same on every card read as one; absent and "" both mean empty. */
export function sameValue(a: unknown, b: unknown): boolean {
  const empty = (v: unknown) => v === undefined || v === null || v === '';
  if (empty(a) || empty(b)) return empty(a) && empty(b);
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The fields every selected card lists, in the first card's order. */
export function sharedFields(deck: SododeckFile, nodes: readonly Node[]): ResolvedField[] {
  const [first, ...rest] = nodes;
  if (first === undefined) return [];
  const others = rest.map((node) => new Set(fieldsOfNode(deck, node).map((f) => f.id)));
  return fieldsOfNode(deck, first).filter((field) => others.every((ids) => ids.has(field.id)));
}
