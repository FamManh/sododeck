import type { FlowAnalysis } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Popover, PopoverAnchor, PopoverContent } from '@sododeck/ui/components/popover';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Ban, GitBranch } from 'lucide-react';
import { useId, useRef } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore, type FlowSession, type InvalidClick } from '../../state/ui-store';
import { anchorRect } from '../canvas-actions';
import { startBranch } from './flow-session';
import { invalidText } from './invalid-text';

/**
 * Non-modal popover on a refused edge (design 43): why, "Add as branch from step k" when the edge
 * leaves the end of step k and a branch is allowed there (FR-011), and "Got it".
 */
export function InvalidEdgePopover({
  deck,
  analysis,
}: {
  deck: SododeckFile;
  analysis: FlowAnalysis | null;
}) {
  const session = useUiStore((s) => s.flowSession);
  const invalid = session?.invalid ?? null;
  if (session === null || invalid === null) return null;
  // Keyed by edge: a new refused edge re-anchors the popover.
  return (
    <InvalidEdgeContent
      key={invalid.edgeId}
      deck={deck}
      analysis={analysis}
      session={session}
      invalid={invalid}
    />
  );
}

function InvalidEdgeContent({
  deck,
  analysis,
  session,
  invalid,
}: {
  deck: SododeckFile;
  analysis: FlowAnalysis | null;
  session: FlowSession;
  invalid: InvalidClick;
}) {
  const editor = useEditor();
  const setInvalid = useUiStore((s) => s.setInvalid);
  const titleId = useId();
  const virtualRef = useRef({ getBoundingClientRect: () => anchorRect(invalid.edgeId) });
  const text = invalidText(deck, analysis, session, invalid);
  const branchNumber =
    invalid.branchFromStep === null
      ? null
      : (analysis?.byStepId.get(invalid.branchFromStep)?.number ?? null);

  return (
    <Popover
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) setInvalid(null);
      }}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        aria-labelledby={titleId}
        side="bottom"
        align="center"
        className="w-80"
        // Non-modal: keep focus where it is, so recording continues with the next click.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <div className="flex items-start gap-2.5">
          <Ban
            aria-hidden
            strokeWidth={ICON_STROKE_WIDTH}
            className="mt-0.5 size-4 shrink-0 text-clay-ink"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <span id={titleId} className="text-title-sm">
              {text.title}
            </span>
            <span className="text-body-sm text-ink-secondary">{text.body}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {invalid.branchFromStep !== null && branchNumber !== null && (
            <Button
              size="sm"
              onClick={() => {
                if (invalid.branchFromStep !== null) {
                  startBranch(editor, invalid.branchFromStep, invalid.edgeId);
                }
              }}
            >
              <GitBranch />
              Add as branch from step {branchNumber}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setInvalid(null);
            }}
          >
            Got it
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
