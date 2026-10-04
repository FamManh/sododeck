import type { Problem } from '@sododeck/model';
import { Button } from '@sododeck/ui/components/button';
import { Popover, PopoverAnchor, PopoverContent } from '@sododeck/ui/components/popover';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { anchorRect, canvasElement, focusCanvas, nodeElement } from '../canvas-actions';
import { rowKey } from '../relationships/row-key';
import { focusRowSoon } from '../table/row-focus';
import { fixLockedReason, useApplyFix } from './apply-fix';
import { SeverityIcon } from './severity-icon';
import { useProblems } from './use-problems';

/**
 * Where the popover points: the faulty row, else the table header, else the relationship's label
 * point, else the canvas (047 R7). Measured on demand, so a row drawn a frame later is found.
 */
function anchorOf(problem: Problem): DOMRect {
  const { column, target } = problem;
  if (column !== undefined) {
    const row = canvasElement()?.querySelector(
      `[data-row="${CSS.escape(rowKey(column.tableId, column.columnId))}"]`,
    );
    const rect = (row ?? nodeElement(column.tableId))?.getBoundingClientRect();
    if (rect !== undefined) return rect;
  }
  if (target.type === 'node')
    return nodeElement(target.id)?.getBoundingClientRect() ?? anchorRect('');
  if (target.type === 'nodes') {
    const [first] = target.ids;
    return (
      (first === undefined ? null : nodeElement(first))?.getBoundingClientRect() ?? anchorRect('')
    );
  }
  if (target.type === 'edges') return anchorRect(target.ids[0] ?? '');
  return anchorRect('');
}

/**
 * The fix popover of a visited schema problem (047, design 144): severity, title, detail and the
 * fix buttons, the first one filled. Esc or an outside click closes it and returns focus to the
 * row; it closes by itself once the problem is gone. Renders nothing while none is open.
 */
export function ProblemFixPopover() {
  const popover = useUiStore((s) => s.problemPopover);
  const setPopover = useUiStore((s) => s.setProblemPopover);
  const problems = useProblems();
  const problem = popover === null ? undefined : problems?.list.find((p) => p.key === popover.key);
  const gone = popover !== null && problems !== null && problem === undefined;
  useEffect(() => {
    if (gone) setPopover(null);
  }, [gone, setPopover]);
  if (problem === undefined) return null;
  return <PopoverFor key={problem.key} problem={problem} />;
}

function PopoverFor({ problem }: { problem: Problem }) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const setPopover = useUiStore((s) => s.setProblemPopover);
  const applyFix = useApplyFix();
  // A fix that opens a drawer or an editor owns the focus afterwards.
  const chose = useRef(false);
  // The row may be drawn a frame after the popover opens: measure again then.
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setFrame(1);
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, []);
  const virtualRef = useMemo(
    () => ({ current: { getBoundingClientRect: () => anchorOf(problem) } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `frame` re-creates the anchor
    [problem, frame],
  );
  const fixes = problem.fixes ?? [];
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) setPopover(null);
      }}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        aria-label={problem.title}
        side="bottom"
        align="start"
        sideOffset={8}
        className="w-80 gap-2"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (chose.current) return;
          if (problem.column === undefined) focusCanvas();
          else focusRowSoon(problem.column);
        }}
      >
        <div className="flex items-start gap-2">
          <SeverityIcon severity={problem.severity} className="mt-0.5" />
          <div className="flex min-w-0 flex-col">
            <span className="text-title-sm text-ink">{problem.title}</span>
            <span className="text-body-sm text-ink-secondary">{problem.detail}</span>
          </div>
        </div>
        {fixes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {fixes.map((fix, index) => {
              const locked = fixLockedReason(deck, fix) !== null;
              return (
                <Button
                  key={fix.kind}
                  size="sm"
                  variant={index === 0 ? 'primary' : 'secondary'}
                  disabled={locked}
                  onClick={() => {
                    chose.current = true;
                    applyFix(problem, fix);
                    setPopover(null);
                  }}
                >
                  {locked ? 'Locked · unlock to fix' : fix.label}
                </Button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
