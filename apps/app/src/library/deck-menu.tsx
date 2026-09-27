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
import { cn } from '@sododeck/ui/lib/utils';
import {
  Copy,
  Download,
  Ellipsis,
  Folder,
  FolderInput,
  Inbox,
  Pencil,
  SquareArrowOutUpRight,
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { isApplePlatform } from '../lib/features';
import type { DeckRecord, FolderRecord } from '../storage/library-db';
import { useLibraryStore } from './library-store';
import { contextKit, dropdownKit, type MenuKit } from './menu-kit';
import type { LibraryCommands } from './use-library-commands';

const UNFILED = 'unfiled';

interface DeckMenuProps {
  deck: DeckRecord;
  folders: readonly FolderRecord[];
  commands: LibraryCommands;
}

/** The deck menu (FR-016, design 76–77), shared by the ⋯ button and right-click. */
function DeckMenuItems({ deck, folders, commands, kit }: DeckMenuProps & { kit: MenuKit }) {
  const { Item, Sub, SubTrigger, SubContent, RadioGroup, RadioItem, Separator } = kit;
  const apple = isApplePlatform();
  return (
    <>
      <Item
        shortcut="↵"
        onSelect={() => {
          commands.open(deck);
        }}
      >
        <SquareArrowOutUpRight />
        Open
      </Item>
      <Item
        shortcut="F2"
        onSelect={() => {
          commands.startRename(deck);
        }}
      >
        <Pencil />
        Rename
      </Item>
      <Item
        shortcut={apple ? '⌘D' : 'Ctrl+D'}
        onSelect={() => {
          void commands.duplicate(deck);
        }}
      >
        <Copy />
        Duplicate
      </Item>
      <Sub>
        <SubTrigger>
          <FolderInput />
          Move to folder
        </SubTrigger>
        <SubContent>
          <RadioGroup
            value={deck.folderId ?? UNFILED}
            onValueChange={(value) => {
              void commands.move(deck, value === UNFILED ? null : value);
            }}
          >
            <RadioItem value={UNFILED}>
              <Inbox />
              Unfiled
            </RadioItem>
            {folders.map((folder) => (
              <RadioItem key={folder.id} value={folder.id}>
                <Folder />
                {folder.name}
              </RadioItem>
            ))}
          </RadioGroup>
        </SubContent>
      </Sub>
      <Item
        onSelect={() => {
          void commands.exportDeck(deck);
        }}
      >
        <Download />
        Export .sododeck.json
      </Item>
      <Separator />
      <Item
        destructive
        shortcut={apple ? '⌫' : 'Del'}
        onSelect={() => {
          commands.requestDelete(deck);
        }}
      >
        <Trash2 />
        Delete…
      </Item>
    </>
  );
}

/** Keeps focus in the inline name field when Rename closed the menu. */
function keepRenameFocus(deckId: string) {
  return (event: Event) => {
    if (useLibraryStore.getState().renamingId === deckId) event.preventDefault();
  };
}

/** The ⋯ button and its menu. `open` is controlled so Shift+F10 on the card can open it. */
export function DeckMenuButton({
  open,
  onOpenChange,
  className,
  ...props
}: DeckMenuProps & { open: boolean; onOpenChange: (open: boolean) => void; className?: string }) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`More actions for ${props.deck.name}`}
          className={cn('bg-surface', className)}
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={keepRenameFocus(props.deck.id)}>
        <DeckMenuItems {...props} kit={dropdownKit} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Right-click anywhere on a card or row opens the same menu. */
export function DeckContextMenu({ children, ...props }: DeckMenuProps & { children: ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={keepRenameFocus(props.deck.id)}>
        <DeckMenuItems {...props} kit={contextKit} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
