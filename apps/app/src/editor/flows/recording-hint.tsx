import type { SododeckFile } from '@sododeck/schema';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { CornerDownRight, MousePointerClick } from 'lucide-react';

import type { FlowSession } from '../../state/ui-store';
import { recordingHint } from './recording-hint-text';

const LEGEND = [
  ['⌥↑↓', 'Move focused step'],
  ['⌫', 'Remove focused step'],
  ['B', 'Add branch to focused step'],
  ['Tab', 'Next candidate edge'],
  ['↵', 'Use focused edge'],
] as const;

/** The dashed hint card and the keyboard legend of a session (designs 41–45). */
export function RecordingHint({ deck, session }: { deck: SododeckFile; session: FlowSession }) {
  const text = recordingHint(deck, session);
  const branchStart = text.startsWith('Click an edge');
  const Icon = branchStart ? MousePointerClick : CornerDownRight;
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 rounded-card border border-dashed border-primary bg-primary-soft px-3 py-2 text-body-sm text-primary-ink">
        <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="mt-0.5 size-4 shrink-0" />
        {text}
      </p>
      <dl
        aria-label="Keyboard"
        className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5"
      >
        {LEGEND.map(([key, action]) => (
          <div key={key} className="contents">
            <dt>
              <kbd className="rounded-segment border border-border bg-surface px-1.5 font-sans text-caption text-ink-secondary">
                {key}
              </kbd>
            </dt>
            <dd className="text-body-sm text-ink-secondary">{action}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
