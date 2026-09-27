import { stickyCanvasPosition } from '@sododeck/model';
import { MarkdownView } from '@sododeck/ui/components/markdown-view';
import { Textarea } from '@sododeck/ui/components/textarea';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import type { NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, Pin, StickyNote } from 'lucide-react';
import { memo } from 'react';

import { useEditor } from '../../model/use-editor';
import { readDeck } from '../../model/use-deck-snapshot';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { useLiveField } from '../fields/use-live-field';
import type { StickyFlowNode } from '../deck-to-flow';
import { finishDraft, notesAreReadOnly } from './sticky-actions';
import { stickyTintClass } from './sticky-tint';

function stickyName(data: StickyFlowNode['data']): string {
  const label = data.label === 'Empty note' ? 'empty' : data.label;
  const parts = [`Note: ${label}`];
  if (data.pinnedToTitle !== null) parts.push(`pinned to ${data.pinnedToTitle}`);
  if (data.collapsed) parts.push('collapsed');
  return parts.join(', ');
}

export const StickyNode = memo(function StickyNode({
  id,
  data,
  selected,
}: NodeProps<StickyFlowNode>) {
  const editor = useEditor();
  const editing = useUiStore((state) => state.stickyEditing === data.stickyId);
  const setStickyEditing = useUiStore((state) => state.setStickyEditing);
  const flowMode = useUiStore((state) => isFlowMode(state));
  const readOnly = notesAreReadOnly();
  const field = useLiveField({
    label: 'Note text',
    value: data.text,
    onWrite: (text) => {
      editor.update('stickies', data.stickyId, { text });
    },
    multiline: true,
  });

  const finishEditing = () => {
    finishDraft(editor, data.stickyId);
    setStickyEditing(null);
  };

  const openEditing = () => {
    if (flowMode || readOnly) return;
    setStickyEditing(data.stickyId);
  };

  const collapsed = data.collapsed;
  const toggleLabel = collapsed ? 'Expand note' : 'Collapse note';

  return (
    <div
      data-testid="sticky-node"
      data-node-id={id}
      role="group"
      aria-roledescription="note"
      aria-label={stickyName(data)}
      aria-selected={selected}
      tabIndex={0}
      onDoubleClick={openEditing}
      onKeyDown={(event) => {
        if (flowMode || readOnly) return;
        if (event.altKey && event.code === 'KeyC') {
          event.preventDefault();
          editor.update('stickies', data.stickyId, { collapsed: collapsed ? null : true });
          useUiStore.getState().announce(collapsed ? 'Note expanded' : 'Note collapsed');
          return;
        }
        const move =
          event.key === 'ArrowUp'
            ? { x: 0, y: -(event.shiftKey ? 32 : 8) }
            : event.key === 'ArrowDown'
              ? { x: 0, y: event.shiftKey ? 32 : 8 }
              : event.key === 'ArrowLeft'
                ? { x: -(event.shiftKey ? 32 : 8), y: 0 }
                : event.key === 'ArrowRight'
                  ? { x: event.shiftKey ? 32 : 8, y: 0 }
                  : null;
        if (move !== null) {
          event.preventDefault();
          const sticky = readDeck(editor.doc).stickies.find((entry) => entry.id === data.stickyId);
          if (sticky === undefined) return;
          const point = stickyCanvasPosition(readDeck(editor.doc), sticky).point;
          editor.moveSticky(data.stickyId, { x: point.x + move.x, y: point.y + move.y });
          return;
        }
        if (event.key === 'Enter' || event.key === 'F2') {
          event.preventDefault();
          openEditing();
        }
      }}
      className={cn(
        'flex w-[180px] flex-col gap-2 rounded-node border px-3 py-2 shadow-rest',
        stickyTintClass(data.color),
        focusRing,
        selected && 'ring-1 ring-primary shadow-selection',
      )}
    >
      <div className="flex items-start gap-2">
        <StickyNote
          aria-hidden
          strokeWidth={ICON_STROKE_WIDTH}
          className="mt-0.5 size-4 shrink-0"
        />
        <div className="min-w-0 flex-1">
          {editing ? (
            <Textarea
              autoFocus
              aria-label="Note text"
              value={field.value}
              onChange={(event) => {
                field.onChange(event.target.value);
              }}
              onFocus={field.onFocus}
              onBlur={() => {
                field.onBlur();
                finishEditing();
              }}
              onKeyDown={(event) => {
                field.onKeyDown(event);
                if (
                  event.key === 'Escape' ||
                  (event.key === 'Enter' && (event.metaKey || event.ctrlKey))
                ) {
                  finishEditing();
                }
              }}
              className="nodrag nowheel min-h-16 bg-transparent px-0 py-0"
            />
          ) : collapsed ? (
            <p className="truncate text-body-sm font-medium">{data.label}</p>
          ) : (
            <MarkdownView text={data.text} className="gap-1 text-body-sm" />
          )}
        </div>
        {!flowMode && (
          <button
            type="button"
            aria-label={toggleLabel}
            aria-expanded={collapsed ? 'false' : 'true'}
            className={cn(
              'nodrag nowheel rounded-segment p-1 text-ink-secondary transition-colors hover:bg-surface-2',
              focusRing,
            )}
            onClick={() => {
              if (readOnly) return;
              editor.update('stickies', data.stickyId, { collapsed: collapsed ? null : true });
            }}
          >
            {collapsed ? (
              <ChevronRight aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
            ) : (
              <ChevronDown aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
            )}
          </button>
        )}
      </div>

      {data.pinnedToTitle !== null && (
        <div className="flex items-center gap-1 text-caption text-ink-secondary">
          <Pin aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5 shrink-0" />
          <span>{`Pinned to ${data.pinnedToTitle}`}</span>
        </div>
      )}
    </div>
  );
});
