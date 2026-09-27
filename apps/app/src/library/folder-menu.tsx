import { Button } from '@sododeck/ui/components/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@sododeck/ui/components/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import type { FolderRecord } from '../storage/library-db';
import { useLibraryStore } from './library-store';
import { contextKit, dropdownKit, type MenuKit } from '../lib/menu-kit';

export interface FolderMenuProps {
  folder: FolderRecord;
  deckCount: number;
}

/** Rename and Delete folder… — no "Export folder" in this version (§g-33, FR-026). */
function FolderMenuItems({ folder, deckCount, kit }: FolderMenuProps & { kit: MenuKit }) {
  const { Item, Separator } = kit;
  const store = () => useLibraryStore.getState();
  return (
    <>
      <Item
        shortcut="F2"
        onSelect={() => {
          store().setRenaming(folder.id);
        }}
      >
        <Pencil />
        Rename
      </Item>
      <Separator />
      <Item
        destructive
        onSelect={() => {
          store().requestDelete({ kind: 'folder', id: folder.id, name: folder.name, deckCount });
        }}
      >
        <Trash2 />
        Delete folder…
      </Item>
    </>
  );
}

const keepRenameFocus = (id: string) => (event: Event) => {
  if (useLibraryStore.getState().renamingId === id) event.preventDefault();
};

export function FolderMenuButton({
  open,
  onOpenChange,
  ...props
}: FolderMenuProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`More actions for folder ${props.folder.name}`}
          className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onCloseAutoFocus={keepRenameFocus(props.folder.id)}>
        <FolderMenuItems {...props} kit={dropdownKit} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FolderContextMenu({
  children,
  ...props
}: FolderMenuProps & { children: ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={keepRenameFocus(props.folder.id)}>
        <FolderMenuItems {...props} kit={contextKit} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
