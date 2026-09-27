/**
 * Where a rule is used (008 FR-019, FR-028): the steps (numbered as the flow shows them) and the
 * components that reference it. Pure and derived; never stored.
 */
import type { Id, SododeckFile } from '@sododeck/schema';

import { analyzeFlow } from '../flow-paths';

export interface RuleUsage {
  /** In flow order, then path order (main path first, then each branch). */
  steps: readonly {
    flowId: Id;
    stepId: Id;
    /** Display number from `analyzeFlow` (`4`, `4a`). */
    number: string;
    from: Id | null;
    to: Id | null;
    broken: boolean;
  }[];
  /** In deck order. */
  nodes: readonly Id[];
}

export function ruleUsage(file: SododeckFile, ruleId: Id): RuleUsage {
  const steps: RuleUsage['steps'][number][] = [];
  for (const flow of file.flows) {
    if (!flow.steps.some((s) => s.rules?.includes(ruleId) === true)) continue;
    const analysis = analyzeFlow(flow, file.edges);
    const paths = [analysis.main, ...analysis.branches.map((b) => b.steps)];
    for (const path of paths) {
      for (const { step, number, from, to, broken } of path) {
        if (step.rules?.includes(ruleId) === true) {
          steps.push({ flowId: flow.id, stepId: step.id, number, from, to, broken });
        }
      }
    }
  }
  const nodes = file.nodes.filter((n) => n.rules?.includes(ruleId) === true).map((n) => n.id);
  return { steps, nodes };
}
