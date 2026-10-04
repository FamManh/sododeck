import { ruleUsage } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ArrowRight, Route } from 'lucide-react';
import { useNavigate } from 'react-router';

import { cardIconRef, iconProp } from '../card-icon';
import { NodeTypeTile } from '../shapes/shape-tile';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { openFlow } from '../flows/flow-mode';
import { canvasPath } from './rules-path';

const rowClass = cn(
  'flex w-full cursor-pointer items-center gap-2.5 rounded-card bg-surface-2 px-3 py-2 text-left hover:bg-surface-3',
  focusRing,
);

/**
 * USED IN (FR-028): every step using the rule ("<flow> · Step n · <from> → <to>", or "Connection
 * deleted") and every component. An entry goes back to the canvas with that step or component.
 */
export function UsedIn({
  deck,
  deckId,
  ruleId,
}: {
  deck: SododeckFile;
  deckId: string | undefined;
  ruleId: Id;
}) {
  const navigate = useNavigate();
  const editor = useEditor();
  const usage = ruleUsage(deck, ruleId);
  const title = (id: Id | null) => deck.nodes.find((n) => n.id === id)?.title ?? id ?? '';
  const empty = usage.steps.length === 0 && usage.nodes.length === 0;

  return (
    <section aria-label="Used in" className="flex flex-col gap-2 px-4 py-4">
      <h2 className="text-micro text-ink-muted uppercase">Used in</h2>
      {empty ? (
        <p className="text-body-sm text-ink-secondary">Not used yet</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {usage.steps.map((s) => {
            const flow = deck.flows.find((f) => f.id === s.flowId);
            const route = s.broken ? 'Connection deleted' : `${title(s.from)} → ${title(s.to)}`;
            return (
              <li key={`${s.flowId}:${s.stepId}`}>
                <button
                  type="button"
                  className={rowClass}
                  onClick={() => {
                    void navigate(canvasPath(deckId));
                    openFlow(editor, s.flowId, s.stepId);
                  }}
                >
                  <Route
                    aria-hidden
                    strokeWidth={ICON_STROKE_WIDTH}
                    className="size-4 shrink-0 text-primary-ink"
                  />
                  <span className="min-w-0 flex-1 text-body-sm">
                    {flow?.title ?? s.flowId} · Step {s.number} · {route}
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-secondary" />
                </button>
              </li>
            );
          })}
          {usage.nodes.map((id) => {
            const node = deck.nodes.find((n) => n.id === id);
            return (
              <li key={id}>
                <button
                  type="button"
                  className={rowClass}
                  onClick={() => {
                    void navigate(canvasPath(deckId));
                    useUiStore.getState().select({ nodes: [id] });
                  }}
                >
                  {node !== undefined && (
                    <NodeTypeTile
                      type={node.type}
                      size={22}
                      decorative
                      {...iconProp(cardIconRef(node))}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-body-sm">{title(id)}</span>
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-secondary" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
