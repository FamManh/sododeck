/**
 * A parsed flowchart as a deck file without positions (contracts/mermaid-mapping.md): ids are
 * generated, Mermaid keys only join links here. Positions and group frames come from the layout
 * step (`layout-input.ts`).
 */
import { NEW_DECK_PACKS } from '@sododeck/model';
import {
  emptySododeckFile,
  type Edge,
  type Group,
  type Id,
  type Node,
  type SododeckFile,
} from '@sododeck/schema';

import type { ImportReport } from './import-report';
import { createImportIds, type ImportIds } from './new-ids';
import type { ParsedFlowchart } from './parse-flowchart';
import { defaultSize, SHAPE_TYPE } from './shape-map';

export const DEFAULT_DECK_NAME = 'Imported diagram';

export interface ImportedDeck {
  file: SododeckFile;
  report: ImportReport;
}

export function flowchartToDeck(
  parsed: ParsedFlowchart,
  ids: ImportIds = createImportIds(),
): ImportedDeck {
  const groupIds = new Map<string, Id>(parsed.subgraphs.map((g) => [g.key, ids.next('group')]));
  const nodeIds = new Map<string, Id>(parsed.nodes.map((n) => [n.key, ids.next('node')]));
  // A link may end on a subgraph id: the connection then ends on the group frame.
  const endOf = (key: string): Id | undefined => nodeIds.get(key) ?? groupIds.get(key);

  const groups: Group[] = parsed.subgraphs.map((g) => {
    const parent = g.parent === undefined ? undefined : groupIds.get(g.parent);
    return {
      id: groupIds.get(g.key) ?? '',
      title: g.label,
      ...(parent === undefined ? {} : { parent }),
    };
  });

  const nodes: Node[] = parsed.nodes.map((n) => {
    const type = SHAPE_TYPE[n.shape];
    const group = parsed.groupOf[n.key];
    const groupId = group === undefined ? undefined : groupIds.get(group);
    return {
      id: nodeIds.get(n.key) ?? '',
      type,
      title: n.label,
      size: { ...defaultSize(type) },
      ...(groupId === undefined ? {} : { group: groupId }),
    };
  });

  const edges: Edge[] = [];
  for (const link of parsed.links) {
    const from = endOf(link.from);
    const to = endOf(link.to);
    if (from === undefined || to === undefined) continue;
    const style: NonNullable<Edge['style']> = {};
    if (link.dash !== 'solid') style.dash = link.dash;
    if (link.width === 'thick') style.width = 3;
    edges.push({
      id: ids.next('edge'),
      from,
      to,
      ...(link.label === undefined ? {} : { label: link.label }),
      ...(link.arrow === 'normal' ? {} : { direction: link.arrow }),
      ...(Object.keys(style).length === 0 ? {} : { style }),
    });
  }

  const file: SododeckFile = {
    ...emptySododeckFile(),
    name: parsed.title ?? DEFAULT_DECK_NAME,
    packs: [...NEW_DECK_PACKS],
    nodes,
    groups,
    edges,
  };
  return {
    file,
    report: {
      kind: 'flowchart',
      counts: {
        components: nodes.length,
        connections: edges.length,
        groups: groups.length,
        steps: 0,
      },
      skipped: parsed.skipped,
      notes: [],
    },
  };
}
