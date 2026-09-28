/**
 * Choice-list options for the selection toolbar's popovers (019 R6), from the same shared-value
 * derivation as the bulk inspector (`bulkView`, 008), so "Mixed" and partial tags match it.
 */
import type { Node, SododeckFile } from '@sododeck/schema';
import type { ChoiceOption } from '@sododeck/ui/components/choice-list';

import type { Shared } from '../inspector/derive';

/** Marks the shared value as selected; with mixed values nothing is. */
export function choiceState(
  shared: Shared<string>,
  options: readonly { value: string; label: string }[],
): ChoiceOption[] {
  return options.map((option) =>
    !shared.mixed && shared.value === option.value
      ? { ...option, state: 'selected' as const }
      : { ...option },
  );
}

/**
 * Tags of the selection first (on all: selected; on some: partial, "n of N"), then the deck's
 * other tags.
 */
export function tagChoices(nodes: readonly Node[], deckTags: readonly string[]): ChoiceOption[] {
  const counts = new Map<string, number>();
  for (const node of nodes)
    for (const tag of node.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const total = nodes.length;
  return [
    ...[...counts].map(([tag, count]): ChoiceOption =>
      count === total
        ? { value: tag, label: tag, state: 'selected' }
        : {
            value: tag,
            label: tag,
            state: 'partial',
            count: `${String(count)} of ${String(total)}`,
          },
    ),
    ...deckTags.filter((tag) => !counts.has(tag)).map((tag) => ({ value: tag, label: tag })),
  ];
}

/** Distinct owners or technologies in the deck, sorted case-insensitively. */
export function deckValues(deck: SododeckFile, field: 'owner' | 'tech'): string[] {
  const values = new Set<string>();
  for (const node of deck.nodes) {
    const value = node[field];
    if (value !== undefined && value !== '') values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
