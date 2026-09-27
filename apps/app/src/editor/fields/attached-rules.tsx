import type { RuleHost } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ArrowRight, CircleAlert, Table2, Unlink } from 'lucide-react';

import { useEditor } from '../../model/use-editor';
import { useRuleNav } from '../rules/rule-nav';
import { AttachRulePopover } from './attach-rule-popover';
import { RuleCard } from './rule-card';
import { useDetach } from './use-detach';

/**
 * A step's ATTACHED RULES (rule cards) or a component's RULES (rows that open the rule editor),
 * each with Attach (FR-029–FR-032). A reference to a rule that no longer exists shows as
 * "Missing rule <id>" with Detach, never dropped silently.
 */
export function AttachedRules({
  deck,
  host,
  ruleIds,
  inputs,
}: {
  deck: SododeckFile;
  host: RuleHost;
  ruleIds: readonly Id[] | undefined;
  /** A step's sample inputs, by rule id. */
  inputs?: Readonly<Record<Id, Readonly<Record<Id, string>>>>;
}) {
  const editor = useEditor();
  const nav = useRuleNav();
  const detach = useDetach();
  const ids = ruleIds ?? [];
  const onStep = host.kind === 'step';
  const heading = onStep ? `Attached rules ${String(ids.length)}` : 'Rules';

  return (
    <PanelSection aria-label={onStep ? 'Attached rules' : 'Rules'}>
      <div className="flex items-center justify-between">
        <h3 className="text-micro text-ink-muted uppercase">{heading}</h3>
        <AttachRulePopover deck={deck} host={host} attached={ids} />
      </div>
      {ids.length === 0 && onStep && (
        <p className="text-body-sm text-ink-secondary">No decision table on this step.</p>
      )}
      {ids.length > 0 && (
        <ul aria-label="Attached rules" className="flex flex-col gap-2">
          {ids.map((id) => {
            const rule = deck.rules[id];
            if (rule === undefined) {
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-card bg-clay-soft px-3 py-2 text-clay-ink"
                >
                  <CircleAlert
                    aria-hidden
                    strokeWidth={ICON_STROKE_WIDTH}
                    className="size-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate text-body-sm">Missing rule {id}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Detach ${id}`}
                    onClick={() => {
                      detach(id, () => {
                        editor.detachRule(host, id);
                      });
                    }}
                  >
                    Detach
                  </Button>
                </li>
              );
            }
            if (host.kind === 'step') {
              return (
                <li key={id}>
                  <RuleCard
                    flowId={host.flowId}
                    stepId={host.stepId}
                    ruleId={id}
                    rule={rule}
                    inputs={inputs?.[id]}
                  />
                </li>
              );
            }
            return (
              <li key={id} className="flex items-center gap-1 rounded-card bg-amber-soft pr-1">
                <button
                  type="button"
                  onClick={() => {
                    nav?.openRules(id);
                  }}
                  className={cn(
                    'flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-card px-3 py-2 text-left text-amber-ink',
                    focusRing,
                  )}
                >
                  <Table2 aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-body">{rule.title}</span>
                  <ArrowRight aria-hidden className="size-4 shrink-0" />
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Detach ${rule.title}`}
                  onClick={() => {
                    detach(rule.title, () => {
                      editor.detachRule(host, id);
                    });
                  }}
                >
                  <Unlink />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </PanelSection>
  );
}
