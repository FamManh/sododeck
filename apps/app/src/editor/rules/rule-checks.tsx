import { ruleChecks } from '@sododeck/model';
import type { Rule } from '@sododeck/schema';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Check, Info, TriangleAlert } from 'lucide-react';

import { HIT_POLICIES } from './rule-text';

/** CHECKS (FR-027): the catch-all check and one line explaining the hit policy. */
export function RuleChecks({ rule }: { rule: Rule }) {
  const { catchAll } = ruleChecks(rule);
  const policy = HIT_POLICIES.find((p) => p.value === rule.hitPolicy);
  return (
    <section aria-label="Checks" className="flex flex-col gap-2 px-4 py-4">
      <h2 className="text-micro text-ink-muted uppercase">Checks</h2>
      <ul className="flex flex-col gap-2 text-body-sm">
        {catchAll ? (
          <li className="flex items-start gap-2">
            <Check
              aria-hidden
              strokeWidth={ICON_STROKE_WIDTH}
              className="mt-0.5 size-4 shrink-0 text-success-ink"
            />
            Has a catch-all row
          </li>
        ) : (
          <li className="flex items-start gap-2">
            <TriangleAlert
              aria-hidden
              strokeWidth={ICON_STROKE_WIDTH}
              className="mt-0.5 size-4 shrink-0 text-amber-ink"
            />
            No catch-all row — some inputs match nothing
          </li>
        )}
        {policy !== undefined && (
          <li className="flex items-start gap-2">
            <Info
              aria-hidden
              strokeWidth={ICON_STROKE_WIDTH}
              className="mt-0.5 size-4 shrink-0 text-ink-secondary"
            />
            {policy.explain}
          </li>
        )}
      </ul>
    </section>
  );
}
