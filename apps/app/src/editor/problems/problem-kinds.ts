import type { ProblemKind } from '@sododeck/model';
import {
  Columns3,
  Copy,
  KeyRound,
  Link2Off,
  ListX,
  Maximize2,
  Package,
  Shapes,
  Split,
  Table2,
  Unplug,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export const problemCountLabel = (count: number) =>
  count === 1 ? '1 problem' : `${String(count)} problems`;

/** Icon of a problem row, by kind (design 60). */
export const PROBLEM_ICONS: Record<ProblemKind, LucideIcon> = {
  'duplicate-connection': Copy,
  'step-without-connection': Unplug,
  'broken-chain': Workflow,
  'incomplete-flow': Workflow,
  'overlapping-conditions': Split,
  'missing-rule': Table2,
  'rule-without-catch-all': Table2,
  'invalid-rule-cells': Table2,
  'broken-reference': Link2Off,
  'card-size-out-of-range': Maximize2,
  'unknown-card-type': Shapes,
  'unknown-pack': Package,
  'field-value-dangling': ListX,
  'db-dangling-reference': Columns3,
  'db-composite-mismatch': KeyRound,
};
