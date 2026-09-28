import {
  analyzeFlow,
  searchDeck,
  type Range,
  type SearchIndex,
  type SearchKind,
} from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import type { CommandDialogItem } from '@sododeck/ui/components/command-dialog';

import { normalizeText } from '@sododeck/model';

import { kindLabel } from '../kind-label';
import { HIT_POLICIES } from '../rules/rule-text';

export interface PaletteCommand {
  id: string;
  title: string;
  aliases?: readonly string[];
  shortcut?: string;
  run: () => void;
}

export type PaletteResultKind = SearchKind | 'command';

export interface PaletteResult extends CommandDialogItem {
  kind: PaletteResultKind;
  flowId?: string;
  run?: () => void;
}

function queryWords(query: string): string[] {
  return normalizeText(query)
    .slice(0, 200)
    .split(/\s+/u)
    .filter((word) => word !== '');
}

function commandMatches(command: PaletteCommand, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const haystack = normalizeText([command.title, ...(command.aliases ?? [])].join(' '));
  return words.every((word) => haystack.includes(word));
}

function titleRanges(title: string, words: readonly string[]): readonly Range[] {
  const normalized = normalizeText(title);
  if (words.length === 0) return [];
  const ranges: Range[] = [];
  for (const word of words) {
    const at = normalized.indexOf(word);
    if (at === -1) continue;
    ranges.push({ start: at, end: at + word.length });
  }
  return ranges.sort((a, b) => a.start - b.start);
}

function rulePolicyLabel(hitPolicy: string): string {
  return HIT_POLICIES.find((policy) => policy.value === hitPolicy)?.label ?? hitPolicy;
}

function metaFor(deck: SododeckFile, kind: SearchKind, id: string, flowId?: string): string {
  switch (kind) {
    case 'node': {
      const node = deck.nodes.find((entry) => entry.id === id);
      const group = deck.groups.find((entry) => entry.id === node?.group)?.title;
      return group === undefined
        ? kindLabel(node?.type ?? '')
        : `${kindLabel(node?.type ?? '')} · ${group}`;
    }
    case 'edge': {
      const edge = deck.edges.find((entry) => entry.id === id);
      const from = deck.nodes.find((entry) => entry.id === edge?.from)?.title ?? edge?.from ?? '?';
      const to = deck.nodes.find((entry) => entry.id === edge?.to)?.title ?? edge?.to ?? '?';
      return `Connection · ${from} → ${to}`;
    }
    case 'flow': {
      const flow = deck.flows.find((entry) => entry.id === id);
      return `Flow · ${String(flow?.steps.length ?? 0)} steps`;
    }
    case 'step': {
      const flow = deck.flows.find((entry) => entry.id === flowId);
      const analysis = flow === undefined ? null : analyzeFlow(flow, deck.edges);
      const pathStep = analysis?.byStepId.get(id);
      return flow === undefined || pathStep === undefined
        ? 'Step'
        : `Step ${pathStep.number} · ${flow.title}`;
    }
    case 'rule': {
      const rule = deck.rules[id];
      return `Rule · ${rule === undefined ? '' : rulePolicyLabel(rule.hitPolicy)}`.trim();
    }
    case 'sticky':
      return 'Note';
  }
}

function flowItems(deck: SododeckFile): readonly PaletteResult[] {
  return deck.flows.map((flow) => ({
    kind: 'flow',
    id: flow.id,
    title: flow.title,
    meta: `Flow · ${String(flow.steps.length)} steps`,
    titleRanges: [],
  }));
}

export function buildPaletteResults({
  deck,
  searchIndex,
  query,
  commands,
  limit = 50,
  hidden,
}: {
  deck: SododeckFile;
  searchIndex: SearchIndex;
  query: string;
  commands: readonly PaletteCommand[];
  limit?: number;
  /** Components the current view hides: still listed, marked in text (011 FR-016). */
  hidden?: ReadonlySet<string>;
}): { items: readonly PaletteResult[]; total: number; overflowText?: string } {
  const words = queryWords(query);
  const items =
    words.length === 0
      ? [
          ...commands.map<PaletteResult>((command) => ({
            kind: 'command',
            id: command.id,
            title: command.title,
            meta: 'Command',
            titleRanges: [],
            ...(command.shortcut === undefined ? {} : { shortcut: command.shortcut }),
            run: command.run,
          })),
          ...flowItems(deck),
        ]
      : [
          ...commands
            .filter((command) => commandMatches(command, words))
            .map<PaletteResult>((command) => ({
              kind: 'command',
              id: command.id,
              title: command.title,
              meta: 'Command',
              titleRanges: titleRanges(command.title, words),
              ...(command.shortcut === undefined ? {} : { shortcut: command.shortcut }),
              run: command.run,
            })),
          ...searchDeck(searchIndex, query, { limit: Number.MAX_SAFE_INTEGER }).results.map(
            (result) => ({
              kind: result.kind,
              id: result.id,
              ...(result.flowId === undefined ? {} : { flowId: result.flowId }),
              title: result.title,
              meta:
                result.kind === 'node' && hidden?.has(result.id) === true
                  ? `${metaFor(deck, result.kind, result.id, result.flowId)} · Hidden in this view`
                  : metaFor(deck, result.kind, result.id, result.flowId),
              titleRanges: result.titleRanges,
              ...(result.snippet === undefined
                ? {}
                : { snippet: { text: result.snippet.text, ranges: result.snippet.ranges } }),
            }),
          ),
        ];
  const total = items.length;
  const limited = items.slice(0, limit);
  return {
    items: limited,
    total,
    ...(total > limit ? { overflowText: `Showing ${String(limit)} of ${String(total)}` } : {}),
  };
}
