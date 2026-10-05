/**
 * A parsed sequence diagram as a deck: participants in a row, one connection per ordered pair, and
 * one flow whose steps follow the messages (research R4). Positions are set here, so no layout
 * call is needed.
 */
import { NEW_DECK_PACKS } from '@sododeck/model';
import {
  emptySododeckFile,
  type Edge,
  type Id,
  type Node,
  type SododeckFile,
  type Step,
} from '@sododeck/schema';

import { DEFAULT_DECK_NAME, type ImportedDeck } from './flowchart-to-deck';
import { createImportIds, type ImportIds } from './new-ids';
import type { ParsedSequence } from './parse-sequence';
import { defaultSize } from './shape-map';

export const DEFAULT_FLOW_TITLE = 'Imported sequence';
/** The `component` card's width (`DECK_CARD_WIDTH`; a test keeps them equal). */
export const COMPONENT_WIDTH = 184;
export const ROW_GAP = 80;

export function sequenceToDeck(
  parsed: ParsedSequence,
  ids: ImportIds = createImportIds(),
): ImportedDeck {
  const nodeIds = new Map<string, Id>();
  let x = 0;
  const nodes: Node[] = parsed.participants.map((p) => {
    const id = ids.next('node');
    nodeIds.set(p.key, id);
    const type = p.actor ? 'actor' : 'component';
    const width = p.actor ? defaultSize('actor').width : COMPONENT_WIDTH;
    const node: Node = {
      id,
      type,
      title: p.label,
      position: { x, y: 0 },
      ...(p.actor ? { size: { ...defaultSize('actor') } } : {}),
    };
    x += width + ROW_GAP;
    return node;
  });

  const labelOf = new Map(parsed.participants.map((p) => [p.key, p.label]));
  const pairs = new Map<
    string,
    { id: Id; from: Id; to: Id; labels: Set<string>; dashed: boolean }
  >();
  const steps: Step[] = [];
  for (const message of parsed.messages) {
    const from = nodeIds.get(message.from) ?? '';
    const to = nodeIds.get(message.to) ?? '';
    const pairKey = `${from}\u0000${to}`;
    let pair = pairs.get(pairKey);
    if (pair === undefined) {
      pair = { id: ids.next('edge'), from, to, labels: new Set(), dashed: true };
      pairs.set(pairKey, pair);
    }
    pair.labels.add(message.label);
    pair.dashed &&= message.dashed;
    const title =
      message.label === ''
        ? `${labelOf.get(message.from) ?? message.from} → ${labelOf.get(message.to) ?? message.to}`
        : message.label;
    steps.push({
      id: ids.next('step'),
      edge: pair.id,
      title,
      ...(message.block === undefined ? {} : { notes: message.block }),
    });
  }

  const edges: Edge[] = [...pairs.values()].map((pair) => {
    const [only] = pair.labels;
    return {
      id: pair.id,
      from: pair.from,
      to: pair.to,
      // The edge carries a label only when every message on it says the same thing.
      ...(pair.labels.size === 1 && only !== undefined && only !== '' ? { label: only } : {}),
      ...(pair.dashed ? { style: { dash: 'dashed' as const } } : {}),
    };
  });

  const file: SododeckFile = {
    ...emptySododeckFile(),
    name: parsed.title ?? DEFAULT_DECK_NAME,
    packs: [...NEW_DECK_PACKS],
    nodes,
    edges,
    flows: [{ id: ids.next('flow'), title: parsed.title ?? DEFAULT_FLOW_TITLE, steps }],
  };
  return {
    file,
    report: {
      kind: 'sequence',
      counts: {
        components: nodes.length,
        connections: edges.length,
        groups: 0,
        steps: steps.length,
      },
      skipped: parsed.skipped,
      notes: parsed.flattened ? ['Branching in sequence blocks was flattened'] : [],
    },
  };
}
