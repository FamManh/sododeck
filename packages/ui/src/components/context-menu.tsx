import { Check, ChevronRight } from 'lucide-react';
import { ContextMenu as MenuPrimitive } from 'radix-ui';
import type * as React from 'react';

import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import {
  menuContentClass,
  menuItemClass,
  menuItemDestructiveClass,
  menuLabelClass,
  menuSeparatorClass,
  menuShortcutClass,
} from '@sododeck/ui/lib/menu';
import { cn } from '@sododeck/ui/lib/utils';

function ContextMenu(props: React.ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger(props: React.ComponentProps<typeof MenuPrimitive.Trigger>) {
  return <MenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />;
}

function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(menuContentClass, className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

type ContextMenuItemProps = React.ComponentProps<typeof MenuPrimitive.Item> & {
  /** Clay text and icon, for Delete… */
  destructive?: boolean;
  /** Keyboard hint at the trailing edge, e.g. "F2" or "⌘D". Decorative. */
  shortcut?: string;
};

function ContextMenuItem({
  className,
  destructive,
  shortcut,
  children,
  ...props
}: ContextMenuItemProps) {
  return (
    <MenuPrimitive.Item
      data-slot="context-menu-item"
      className={cn(menuItemClass, destructive && menuItemDestructiveClass, className)}
      {...props}
    >
      {children}
      {shortcut && (
        <kbd aria-hidden className={cn(menuShortcutClass, 'font-sans')}>
          {shortcut}
        </kbd>
      )}
    </MenuPrimitive.Item>
  );
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn(menuSeparatorClass, className)}
      {...props}
    />
  );
}

function ContextMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      data-slot="context-menu-label"
      className={cn(menuLabelClass, className)}
      {...props}
    />
  );
}

function ContextMenuSub(props: React.ComponentProps<typeof MenuPrimitive.Sub>) {
  return <MenuPrimitive.Sub data-slot="context-menu-sub" {...props} />;
}

/** Opens its sub-menu on hover, Enter or ArrowRight; the chevron marks it. */
function ContextMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubTrigger>) {
  return (
    <MenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      className={cn(menuItemClass, className)}
      {...props}
    >
      {children}
      <ChevronRight aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="ml-auto" />
    </MenuPrimitive.SubTrigger>
  );
}

function ContextMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.SubContent
        data-slot="context-menu-sub-content"
        className={cn(menuContentClass, className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

function ContextMenuRadioGroup(props: React.ComponentProps<typeof MenuPrimitive.RadioGroup>) {
  return <MenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />;
}

/** The checked item also shows a check icon, so the choice is not color-only. */
function ContextMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      className={cn(menuItemClass, 'pr-8', className)}
      {...props}
    >
      {children}
      <MenuPrimitive.ItemIndicator className="absolute right-2.5 flex items-center">
        <Check aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="text-primary-ink!" />
      </MenuPrimitive.ItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

export {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
};
