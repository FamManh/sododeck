import { endpointOf, stickyLabel } from '@sododeck/model';
import { Swatch } from '@sododeck/ui/components/swatch-grid';
import {
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
  ToolbarText,
} from '@sododeck/ui/components/toolbar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { IconGlyph } from '@sododeck/ui/components/icon-glyph';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { ChevronDown, Layers } from 'lucide-react';
import { useStore } from '@xyflow/react';
import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
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
import { focusSelectedObject, markLeftToolbar, QUICK_TOOLBAR_ATTR } from './toolbar-focus';
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
      // Either end may be a group (050 R6).
      const title = (id: string | undefined) =>
        id === undefined ? undefined : endpointOf(ctx.deck, id)?.title;
      const label = edge?.label ?? `${title(edge?.from) ?? ''} → ${title(edge?.to) ?? ''}`;
      return `Selection: connection ${label}`;
    }
    case 'connections':
      return `Selection: ${String(edges.length)} connections`;
    case 'sticky': {
      const note = ctx.deck.stickies.find((entry) => entry.id === stickies[0]);
      return `Selection: note ${note === undefined ? '' : (stickyLabel(note.text) ?? 'empty')}`.trimEnd();
    }
    case 'stickies':
      return `Selection: ${String(stickies.length)} notes`;
    case 'group':
      return `Selection: group ${ctx.deck.groups.find((g) => g.id === groups[0])?.title ?? ''}`;
    default:
      return `Selection: ${String(nodes.length + edges.length + groups.length + stickies.length)} items`;
  }
}

const tooltipText = (action: ResolvedAction) => {
  const keys = action.shortcut === undefined ? '' : shortcutLabel(action.shortcut);
  const text = keys === '' ? action.label : `${action.label} · ${keys}`;
  const withNote = action.note === undefined ? text : `${text} · ${action.note}`;
  // Why it can't run, or what it does (054: Spread ends evenly explains itself).
  const detail = action.disabled ?? action.description;
  return detail === undefined ? withNote : `${withNote} · ${detail}`;
};

function withTooltip(action: ResolvedAction, button: ReactElement) {
  return (
    <Tooltip>
      {/* A disabled button takes no pointer events, so its reason would never show: the tooltip
          hangs on a wrapper instead (054). */}
      <TooltipTrigger asChild>
        {action.disabled === null ? button : <span className="inline-flex">{button}</span>}
      </TooltipTrigger>
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
  const value = action.field === undefined && !action.radio ? null : valueText(action.label);
  const content = (
    <>
      {action.swatch !== undefined && (
        <Swatch swatch={action.swatch ?? 'var(--color-border)'} className="size-4" />
      )}
      {action.glyph === 'mixed' && <Layers aria-hidden />}
      {action.glyph !== undefined && action.glyph !== 'mixed' && (
        <IconGlyph icon={action.glyph} size={16} strokeWidth={ICON_STROKE_WIDTH} />
      )}
      {action.swatch === undefined && Icon !== undefined && <Icon aria-hidden />}
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
  if (action.children !== undefined) {
    // A submenu button (Align ▸, 016): the same items as the canvas menu's submenu.
    const children = action.children;
    return (
      <DropdownMenu>
        {withTooltip(
          action,
          <DropdownMenuTrigger asChild disabled={action.disabled !== null}>
            <ToolbarButton aria-label={action.label} aria-haspopup="menu">
              {Icon !== undefined && <Icon aria-hidden />}
              {action.radio ? (
                value !== null && <span className="max-w-28 truncate">{value}</span>
              ) : (
                <span>{action.label}</span>
              )}
              <ChevronDown aria-hidden className="size-3.5" />
            </ToolbarButton>
          </DropdownMenuTrigger>,
        )}
        <DropdownMenuContent aria-label={action.label}>
          {action.radio ? (
            <DropdownMenuRadioGroup
              value={children.find((child) => child.checked)?.id ?? ''}
              onValueChange={(id) => {
                children.find((child) => child.id === id)?.run();
              }}
            >
              {children.map((child) => (
                <DropdownMenuRadioItem key={child.id} value={child.id}>
                  {child.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          ) : (
            children.map((child) => (
              <Fragment key={child.id}>
                {child.separatorBefore && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  disabled={child.disabled !== null}
                  {...(child.shortcut === undefined
                    ? {}
                    : { shortcut: shortcutLabel(child.shortcut) })}
                  {...(child.disabled === null ? {} : { title: child.disabled })}
                  onSelect={() => {
                    child.run();
                  }}
                >
                  {child.label}
                </DropdownMenuItem>
              </Fragment>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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
      {...(action.disabled === null ? {} : { 'aria-description': action.disabled })}
      {...(action.keepFocus
        ? {
            onMouseDown: (event: MouseEvent<HTMLButtonElement>) => {
              // The text field being edited keeps focus and its selection.
              event.preventDefault();
            },
          }
        : {})}
      onClick={() => {
        action.run();
      }}
    >
      {content}
      {(Icon === undefined || action.toolbarText) && <span>{action.label}</span>}
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
      if (event.key === 'Tab') markLeftToolbar();
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
