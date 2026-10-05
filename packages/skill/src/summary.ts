/**
 * A short outline of a deck (027 FR-017, data-model "Deck summary"): what an agent reads before
 * editing a deck instead of the whole file. Pure.
 */
import { analyzeFlow, type ProblemReport } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

export interface SummaryStep {
  id: string;
  /** Display number from the app's flow analysis: `3`, or `4a` on alternative "a". */
  number: string;
  from: string;
  to: string;
  branch?: string;
  rules?: string[];
}

export interface DeckSummary {
  report: 'sododeck-summary';
  reportVersion: 1;
  name: string;
  totals: {
    cards: number;
    groups: number;
    connectors: number;
    flows: number;
    rules: number;
    views: number;
    notes: number;
  };
  levels: { parent: string | null; cards: number }[];
  groups: { id: string; title: string; cards: string[] }[];
  connectors: { id: string; from: string; to: string; label?: string }[];
  flows: { id: string; title: string; steps: SummaryStep[] }[];
  rules: { id: string; title: string; usedBy: string[] }[];
  problems: { error: number; warning: number };
}

export function summarizeDeck(file: SododeckFile, problems: ProblemReport): DeckSummary {
  const levels = new Map<string | null, number>();
  for (const node of file.nodes)
    levels.set(node.parent ?? null, (levels.get(node.parent ?? null) ?? 0) + 1);

  const groups = file.groups.map((group) => ({
    id: group.id,
    title: group.title,
    cards: file.nodes.filter((node) => node.group === group.id).map((node) => node.id),
  }));
  const ungrouped = file.nodes.filter((node) => node.group === undefined).map((node) => node.id);
  if (ungrouped.length > 0) groups.push({ id: '', title: '(no group)', cards: ungrouped });

  const edges = new Map(file.edges.map((edge) => [edge.id, edge]));
  const flows = file.flows.map((flow) => {
    const analysis = analyzeFlow(flow, file.edges);
    return {
      id: flow.id,
      title: flow.title,
      steps: flow.steps.map((step) => {
        const edge = edges.get(step.edge);
        const info = analysis.byStepId.get(step.id);
        return {
          id: step.id,
          number: info?.number ?? '?',
          from: info?.from ?? edge?.from ?? '?',
          to: info?.to ?? edge?.to ?? '?',
          ...(step.branch === undefined ? {} : { branch: step.branch }),
          ...(step.rules === undefined || step.rules.length === 0 ? {} : { rules: step.rules }),
        };
      }),
    };
  });

  const rules = Object.entries(file.rules).map(([id, rule]) => ({
    id,
    title: rule.title,
    usedBy: [
      ...file.nodes.filter((node) => node.rules?.includes(id)).map((node) => node.id),
      ...file.flows.flatMap((flow) =>
        flow.steps
          .filter((step) => step.rules?.includes(id))
          .map((step) => `${flow.id}/${step.id}`),
      ),
    ],
  }));

  return {
    report: 'sododeck-summary',
    reportVersion: 1,
    name: file.name ?? 'Untitled deck',
    totals: {
      cards: file.nodes.length,
      groups: file.groups.length,
      connectors: file.edges.length,
      flows: file.flows.length,
      rules: Object.keys(file.rules).length,
      views: file.views.length,
      notes: file.stickies.length,
    },
    levels: [...levels].map(([parent, cards]) => ({ parent, cards })),
    groups,
    connectors: file.edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      ...(edge.label === undefined ? {} : { label: edge.label }),
    })),
    flows,
    rules,
    problems: { error: problems.counts.error, warning: problems.counts.warning },
  };
}
