import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Fragment, useEffect, useRef } from 'react';

import { useUiStore, type ContextMenuState } from '../../state/ui-store';
import { actionsFor } from '../actions/actions-for';
import { ACTIONS } from '../actions/index';
import type { ActionContext, ResolvedAction } from '../actions/types';
import { useActionContext } from '../actions/use-action-context';
import { focusCanvas } from '../canvas-actions';
import { shortcutLabel } from '../shell/shortcuts';

/** "Actions for <target>" (contract "Context menu"). */
function menuName(ctx: ActionContext): string {
  const { nodes, edges, groups, stickies } = ctx.selection;
  switch (ctx.target.kind) {
    case 'canvas':
      return 'Actions for canvas';
    case 'component':
      return `Actions for ${ctx.deck.nodes.find((n) => n.id === nodes[0])?.title ?? 'component'}`;
    case 'components':
      return `Actions for ${String(nodes.length)} components`;
    case 'connection': {
      const edge = ctx.deck.edges.find((e) => e.id === edges[0]);
      return `Actions for connection${edge?.label === undefined ? '' : ` ${edge.label}`}`;
    }
    case 'group':
      return `Actions for group ${ctx.deck.groups.find((g) => g.id === groups[0])?.title ?? ''}`;
    case 'sticky':
      return stickies.length === 1
        ? 'Actions for note'
        : `Actions for ${String(stickies.length)} notes`;
    case 'mixed':
      return `Actions for ${String(nodes.length + edges.length + groups.length + stickies.length)} items`;
  }
}

const hintOf = (action: ResolvedAction) =>
  action.shortcut === undefined ? action.hint : shortcutLabel(action.shortcut);

function Item({ action }: { action: ResolvedAction }) {
  const Icon = action.icon;
  const hint = hintOf(action);
  const icon = Icon === undefined ? null : <Icon aria-hidden />;
  const tooltip = action.disabled ?? action.description;
  if (action.children !== undefined) {
    const checked = action.children.find((child) => child.checked);
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          {icon}
          {action.label}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent aria-label={action.label}>
          {action.radio ? (
            <DropdownMenuRadioGroup
              value={checked?.id ?? ''}
              onValueChange={(id) => {
                action.children?.find((child) => child.id === id)?.run();
              }}
            >
              {action.children.map((child) => (
                <DropdownMenuRadioItem key={child.id} value={child.id}>
                  {child.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          ) : (
            action.children.map((child) => <Item key={child.id} action={child} />)
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }
  return (
    <DropdownMenuItem
      disabled={action.disabled !== null}
      destructive={action.destructive}
      {...(hint === undefined ? {} : { shortcut: hint })}
      {...(tooltip === undefined ? {} : { title: tooltip, 'aria-description': tooltip })}
      onSelect={() => {
        action.run();
      }}
    >
      {icon}
      {action.label}
    </DropdownMenuItem>
  );
}

function MenuBody({ menu }: { menu: ContextMenuState }) {
  const ctx = useActionContext(menu.target, menu.point);
  const sections = actionsFor(ACTIONS, ctx, 'menu');
  const content = useRef<HTMLDivElement>(null);

  // Opened from a key or a button: the first enabled item takes focus (FR-035).
  useEffect(() => {
    if (menu.via === 'pointer') return;
    const timer = setTimeout(() => {
      content.current
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')
        ?.focus();
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [menu]);

  return (
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) useUiStore.getState().closeContextMenu();
      }}
    >
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none fixed size-0"
          style={{ left: menu.point.x, top: menu.point.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={content}
        aria-label={menuName(ctx)}
        // Radix names the menu after its trigger, here an empty anchor: use the label instead.
        aria-labelledby={undefined}
        align="start"
        sideOffset={0}
        collisionPadding={8}
        className="shadow-menu"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const ui = useUiStore.getState();
          // The chosen action opened a title field (Rename, Add component), a popover (Edit
          // label), a note (Add sticky) or the delete dialog: focus belongs there.
          if (ui.titleEdit !== null) {
            const field = document.querySelector<HTMLInputElement>('[data-slot="inline-edit"]');
            field?.focus();
            if (!ui.titleEdit.isNew) field?.select();
            return;
          }
          if (ui.popover !== null || ui.pendingDelete !== null || ui.stickyEditing !== null) return;
          // Back to the card, connection, group or button the menu was opened from.
          const back = menu.returnFocus;
          if (back?.isConnected === true) back.focus({ preventScroll: true });
          else focusCanvas();
        }}
      >
        {sections.map((section, index) => (
          <Fragment key={section.id}>
            {index > 0 && <DropdownMenuSeparator />}
            {section.actions.map((action) => (
              <Item key={action.id} action={action} />
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The canvas context menu (019 US5, R7): one controlled menu anchored at `ui.contextMenu.point`,
 * for right-click, ⇧F10 / the ContextMenu key and the toolbar's "More actions". Its items are the
 * action list's `menu` actions for the target and mode, in sections.
 */
export function CanvasMenu() {
  const menu = useUiStore((s) => s.contextMenu);
  return menu === null ? null : (
    <MenuBody key={`${String(menu.point.x)}:${String(menu.point.y)}`} menu={menu} />
  );
}
