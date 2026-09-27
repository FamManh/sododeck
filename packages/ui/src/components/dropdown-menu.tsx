import { Check, ChevronRight } from 'lucide-react';
import { DropdownMenu as MenuPrimitive } from 'radix-ui';
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

function DropdownMenu(props: React.ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(props: React.ComponentProps<typeof MenuPrimitive.Trigger>) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="dropdown-menu-content"
        className={cn(menuContentClass, className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

type DropdownMenuItemProps = React.ComponentProps<typeof MenuPrimitive.Item> & {
  /** Clay text and icon, for Delete… */
  destructive?: boolean;
  /** Keyboard hint at the trailing edge, e.g. "F2" or "⌘D". Decorative. */
  shortcut?: string;
};

function DropdownMenuItem({
  className,
  destructive,
  shortcut,
  children,
  ...props
}: DropdownMenuItemProps) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
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

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn(menuSeparatorClass, className)}
      {...props}
    />
  );
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn(menuLabelClass, className)}
      {...props}
    />
  );
}

function DropdownMenuSub(props: React.ComponentProps<typeof MenuPrimitive.Sub>) {
  return <MenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

/** Opens its sub-menu on hover, Enter or ArrowRight; the chevron marks it. */
function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubTrigger>) {
  return (
    <MenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={cn(menuItemClass, className)}
      {...props}
    >
      {children}
      <ChevronRight aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="ml-auto" />
    </MenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.SubContent
        data-slot="dropdown-menu-sub-content"
        className={cn(menuContentClass, className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuRadioGroup(props: React.ComponentProps<typeof MenuPrimitive.RadioGroup>) {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

/** The checked item also shows a check icon, so the choice is not color-only. */
function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
