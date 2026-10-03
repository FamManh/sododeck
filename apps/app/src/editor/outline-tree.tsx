import type { SododeckFile } from '@sododeck/schema';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { useReactFlow } from '@xyflow/react';
import { ArrowLeft, ChevronRight, SquareDashed } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { NodeTypeTile } from './shapes/shape-tile';
import { useUiStore } from '../state/ui-store';
import { buildOutline, visibleItems, type VisibleItem } from './outline';
import { describeChannel, type CardLook } from './style/card-style';
import { scopeOf } from './visible-graph';
import { currentViewCrumb } from './views/view-title';

/**
 * Outline tab (design 02/58, FR-024): a `tree` of groups and components. Arrow keys move and
 * expand/collapse; Enter or click on a component selects it and brings it into view.
 */
export function OutlineTree({ deck }: { deck: SododeckFile }) {
  const collapsed = useUiStore((s) => s.outlineCollapsed);
  const drill = useUiStore((s) => s.drill);
  const toggleGroup = useUiStore((s) => s.toggleOutlineGroup);
  const selectedNodes = useUiStore((s) => s.selection.nodes);
  const { fitView, getZoom } = useReactFlow();
  const scope = useMemo(() => scopeOf(drill), [drill]);
  const currentViewId = useUiStore((s) => s.currentViewId);
  const rootTitle = currentViewCrumb(deck.views, currentViewId);
  const tree = useMemo(() => buildOutline(deck, scope, rootTitle), [deck, scope, rootTitle]);
  const items = useMemo(() => visibleItems(tree, collapsed), [tree, collapsed]);
  const selected = useMemo(() => new Set(selectedNodes), [selectedNodes]);
  // Which row holds the tree's single Tab stop (UI-only).
  const [activeId, setActiveId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const active =
    items.find((v) => v.item.id === activeId) ??
    items.find((v) => v.item.type === 'node' && selected.has(v.item.id)) ??
    items[0];

  const focusRow = (id: string) => {
    setActiveId(id);
    listRef.current?.querySelector<HTMLElement>(`[data-outline-id="${CSS.escape(id)}"]`)?.focus();
  };

  const choose = ({ item }: VisibleItem) => {
    setActiveId(item.id);
    if (item.type === 'up') {
      useUiStore.getState().drillUp(Math.max(0, useUiStore.getState().drill.length - 1));
      return;
    }
    if (item.type === 'group') {
      toggleGroup(item.id);
      return;
    }
    const ui = useUiStore.getState();
    ui.select({ nodes: [item.id] });
    ui.focus(item.id);
    void fitView({ nodes: [{ id: item.id }], duration: 0, maxZoom: Math.max(getZoom(), 1) });
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const current = items[index];
    if (!current) return;
    const { item, parentId } = current;
    const move = (to: number) => {
      const target = items[to];
      if (target) focusRow(target.item.id);
    };
    switch (event.key) {
      case 'ArrowDown':
        move(index + 1);
        break;
      case 'ArrowUp':
        move(index - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(items.length - 1);
        break;
      case 'ArrowRight':
        if (item.type !== 'group') return;
        if (collapsed.has(item.id)) toggleGroup(item.id);
        else if (item.children.length > 0) move(index + 1);
        break;
      case 'ArrowLeft':
        if (item.type === 'group' && !collapsed.has(item.id)) toggleGroup(item.id);
        else if (parentId !== null) focusRow(parentId);
        break;
      case 'Enter':
      case ' ':
        choose(current);
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  if (items.length === 0) {
    return <p className="px-2 text-caption text-ink-secondary">No components yet.</p>;
  }

  return (
    <ul ref={listRef} role="tree" aria-label="Components" className="-mx-2 flex flex-col">
      {items.map((visible, index) => {
        const { item, level } = visible;
        const isGroup = item.type === 'group';
        const isUp = item.type === 'up';
        const isSelected = item.type === 'node' && selected.has(item.id);
        const expanded = isGroup ? !collapsed.has(item.id) : undefined;
        const look = item.type === 'up' ? undefined : item.look;
        const colourDescription = [
          look?.fillRef !== undefined ? describeChannel('fill', look.fillRef) : null,
          look?.strokeRef !== undefined ? describeChannel('stroke', look.strokeRef) : null,
        ]
          .filter((part): part is string => part !== null)
          .join(', ');
        return (
          <li
            key={item.id}
            role="treeitem"
            data-outline-id={item.id}
            aria-level={level}
            aria-expanded={expanded}
            aria-selected={isGroup ? undefined : isSelected}
            aria-description={colourDescription === '' ? undefined : colourDescription}
            tabIndex={item.id === active?.item.id ? 0 : -1}
            onClick={() => {
              choose(visible);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
            style={{ paddingLeft: 8 + (level - 1) * 14 }}
            className={cn(
              'flex h-8 cursor-pointer items-center gap-2 rounded-row pr-2 text-body-sm text-ink hover:bg-surface-2',
              focusRing,
              isSelected && 'bg-primary-soft font-semibold text-primary-ink hover:bg-primary-soft',
            )}
          >
            {isUp ? (
              <>
                <ArrowLeft
                  aria-hidden
                  strokeWidth={ICON_STROKE_WIDTH}
                  className="size-4 shrink-0 text-ink-secondary"
                />
                <span className="min-w-0 flex-1 truncate">Up to {item.title}</span>
              </>
            ) : isGroup ? (
              <>
                <ChevronRight
                  aria-hidden
                  strokeWidth={ICON_STROKE_WIDTH}
                  className={cn(
                    'size-4 shrink-0 text-ink-secondary transition-transform',
                    expanded && 'rotate-90',
                  )}
                />
                <SquareDashed
                  aria-hidden
                  strokeWidth={ICON_STROKE_WIDTH}
                  className="size-4 shrink-0 text-ink-secondary"
                />
                {look !== undefined && <ColourMark look={look} />}
                <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                <span className="text-caption text-ink-secondary">{item.count}</span>
              </>
            ) : (
              <>
                <NodeTypeTile type={item.kind} size={22} decorative />
                {look !== undefined && <ColourMark look={look} />}
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** An 8 px colour mark (FR-035): the fill, or a stroke-only ring when there is no fill. */
function ColourMark({ look }: { look: CardLook }) {
  return (
    <span
      aria-hidden
      className={cn(
        'size-2 shrink-0 rounded-full',
        look.fill === undefined && look.stroke !== undefined && 'border-2 border-(--card-stroke)',
      )}
      style={{
        ...(look.fill === undefined ? {} : { backgroundColor: look.fill }),
        ...(look.stroke === undefined ? {} : { '--card-stroke': look.stroke }),
      }}
    />
  );
}
