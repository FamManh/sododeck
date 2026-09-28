import {
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
  ToolbarText,
} from '@sododeck/ui/components/toolbar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { useStore } from '@xyflow/react';
import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';

import { isFlowMode, useUiStore, type Selection } from '../../state/ui-store';
import { canvasElement } from '../canvas-actions';
import { actionsFor } from '../actions/actions-for';
import { ACTIONS } from '../actions/index';
import type { ActionContext, ResolvedAction } from '../actions/types';
import { targetOf, useActionContext } from '../actions/use-action-context';
import { shortcutLabel } from '../shell/shortcuts';
import { FieldPopover } from './field-popover';
import { selectionScreenRect } from './selection-rect';
import { focusSelectedObject, QUICK_TOOLBAR_ATTR } from './toolbar-focus';
import { toolbarPlacement } from './toolbar-placement';
import { toolbarVariant, type ToolbarVariant } from './toolbar-variant';

/** Whether the toolbar shows for this UI state (019 FR-026). */
function useToolbarShown(): boolean {
  return useUiStore(
    (s) =>
      toolbarVariant(s.selection) !== 'none' &&
      s.canvasGesture === null &&
      s.titleEdit === null &&
      !isFlowMode(s) &&
      s.flowSession === null &&
      !s.hideUi,
  );
}

function toolbarName(variant: ToolbarVariant, ctx: ActionContext): string {
  const { nodes, edges, groups, stickies } = ctx.selection;
  switch (variant) {
    case 'component':
      return `Selection: ${ctx.deck.nodes.find((n) => n.id === nodes[0])?.title ?? ''}`;
    case 'components':
      return `Selection: ${String(nodes.length)} components`;
    case 'connection': {
      const edge = ctx.deck.edges.find((e) => e.id === edges[0]);
      const title = (id: string | undefined) => ctx.deck.nodes.find((n) => n.id === id)?.title;
      const label = edge?.label ?? `${title(edge?.from) ?? ''} → ${title(edge?.to) ?? ''}`;
      return `Selection: connection ${label}`;
    }
    case 'group':
      return `Selection: group ${ctx.deck.groups.find((g) => g.id === groups[0])?.title ?? ''}`;
    default:
      return `Selection: ${String(nodes.length + edges.length + groups.length + stickies.length)} items`;
  }
}

const tooltipText = (action: ResolvedAction) => {
  const keys = action.shortcut === undefined ? '' : shortcutLabel(action.shortcut);
  return keys === '' ? action.label : `${action.label} · ${keys}`;
};

function withTooltip(action: ResolvedAction, button: ReactElement) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{tooltipText(action)}</TooltipContent>
    </Tooltip>
  );
}

/** Short visible text of a field button: the value part of "Owner: Payments team". */
const valueText = (label: string) => {
  const index = label.indexOf(': ');
  return index < 0 ? null : label.slice(index + 2);
};

function ActionButton({ action, selection }: { action: ResolvedAction; selection: Selection }) {
  const menuOpen = useUiStore((s) => s.contextMenu?.via === 'toolbar');
  const Icon = action.icon;
  const value = action.field === undefined ? null : valueText(action.label);
  const content = (
    <>
      {Icon !== undefined && <Icon aria-hidden />}
      {value !== null && <span className="max-w-28 truncate">{value}</span>}
    </>
  );

  if (action.field !== undefined) {
    const field = action.field;
    return (
      <FieldPopover field={field} tooltip={tooltipText(action)}>
        <ToolbarButton aria-label={action.label} aria-haspopup="dialog">
          {content}
        </ToolbarButton>
      </FieldPopover>
    );
  }
  if (action.id === 'more') {
    return withTooltip(
      action,
      <ToolbarButton
        aria-label={action.label}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        data-state={menuOpen ? 'open' : 'closed'}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          useUiStore.getState().openContextMenu({
            target: targetOf(selection),
            point: { x: rect.left, y: rect.bottom + 6 },
            via: 'toolbar',
            returnFocus: event.currentTarget,
          });
        }}
      >
        {content}
      </ToolbarButton>,
    );
  }
  return withTooltip(
    action,
    <ToolbarButton
      aria-label={action.label}
      disabled={action.disabled !== null}
      onClick={() => {
        action.run();
      }}
    >
      {content}
      {Icon === undefined && action.label}
    </ToolbarButton>,
  );
}

const HIDDEN = { x: 0, y: 0, measured: false };

function ToolbarBody() {
  const ctx = useActionContext();
  const variant = toolbarVariant(ctx.selection);
  const sections = actionsFor(ACTIONS, ctx, 'toolbar');
  const ref = useRef<HTMLDivElement>(null);
  // Re-measured on every render: the selection, the deck and the viewport (programmatic moves;
  // user pans and drags hide the toolbar instead) all re-render it.
  const transform = useStore((s) => s.transform);
  const [position, setPosition] = useState(HIDDEN);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const rect = selectionScreenRect(ctx.selection);
    const canvas = canvasElement()?.getBoundingClientRect();
    const fallback = {
      x: (canvas?.left ?? 0) + (canvas?.width ?? window.innerWidth) / 2,
      y: (canvas?.top ?? 0) + 120,
      width: 0,
      height: 0,
    };
    const next = toolbarPlacement(
      rect ?? fallback,
      { width: element.offsetWidth, height: element.offsetHeight || 44 },
      { width: window.innerWidth },
    );
    setPosition((current) =>
      current.measured && current.x === next.x && current.y === next.y
        ? current
        : { x: next.x, y: next.y, measured: true },
    );
  }, [ctx, transform]);

  const count =
    ctx.selection.nodes.length +
    ctx.selection.edges.length +
    ctx.selection.groups.length +
    ctx.selection.stickies.length;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Keys from a popover or menu bubble here through the React tree; they are theirs.
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    if (event.key === 'Escape' || (event.key === 'Tab' && !event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      focusSelectedObject();
    }
  };

  return (
    <div
      ref={ref}
      {...{ [QUICK_TOOLBAR_ATTR]: '' }}
      className="pointer-events-auto fixed z-20"
      style={{
        left: position.x,
        top: position.y,
        visibility: position.measured ? 'visible' : 'hidden',
      }}
    >
      <Toolbar aria-label={toolbarName(variant, ctx)} onKeyDown={onKeyDown}>
        {(variant === 'components' || variant === 'mixed') && (
          <ToolbarText>{count} selected</ToolbarText>
        )}
        {sections.map((section, index) => (
          <Fragment key={section.id}>
            {(index > 0 || variant === 'components' || variant === 'mixed') && <ToolbarSeparator />}
            {section.actions.map((action) => (
              <ActionButton key={action.id} action={action} selection={ctx.selection} />
            ))}
          </Fragment>
        ))}
      </Toolbar>
    </div>
  );
}

/**
 * The selection toolbar (019 US3, contract "Selection toolbar"): one island above the selection,
 * flipped below near the top islands and kept inside the window. Its buttons come from the
 * action list (`surface: 'toolbar'`). Hidden during a pan, zoom or drag, a title edit, flow mode,
 * a session and Hide UI; nothing is measured or rendered while hidden.
 */
export function SelectionToolbar() {
  return useToolbarShown() ? <ToolbarBody /> : null;
}
