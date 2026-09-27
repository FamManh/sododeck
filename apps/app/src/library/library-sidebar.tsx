import { Button } from '@sododeck/ui/components/button';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { Clock, Folder, FolderPlus, LayoutGrid, Sparkles, type LucideIcon } from 'lucide-react';
import { useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';

import type { DeckRecord, FolderRecord } from '../storage/library-db';
import { folderNameMessage } from '../storage/folder-names';
import { renameFolderInline } from './library-actions';
import { useLibraryStore } from './library-store';
import { folderSection, type LibrarySection } from './library-view';
import { FolderContextMenu, FolderMenuButton } from './folder-menu';
import { RecentList } from './recent-list';
import { RenameField } from './rename-field';
import type { LibraryCommands } from './use-library-commands';

function NavItem({
  icon: Icon,
  label,
  count,
  current,
  onSelect,
  onKeyDown,
  action,
  className,
  ...props
}: Omit<ComponentProps<'li'>, 'onKeyDown'> & {
  icon: LucideIcon;
  label: ReactNode;
  count: number;
  current: boolean;
  onSelect: () => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  action?: ReactNode;
}) {
  return (
    <li
      {...props}
      className={cn(
        'group/row relative flex h-9 items-center rounded-row',
        current ? 'bg-primary-soft text-primary-ink' : 'text-ink hover:bg-surface-2',
        className,
      )}
    >
      <button
        type="button"
        aria-current={current ? 'page' : undefined}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        className={cn(
          'flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-row pr-1 pl-2 text-left text-body',
          current && 'font-medium',
          focusRing,
        )}
      >
        <Icon aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span
          className={cn(
            'shrink-0 pr-1 text-caption tabular-nums',
            // The row's ⋯ button takes the count's place on hover and focus.
            action !== undefined &&
              'group-focus-within/row:invisible group-hover/row:invisible group-has-[[aria-expanded=true]]/row:invisible',
            current ? 'text-primary-ink' : 'text-ink-secondary',
          )}
        >
          {count}
        </span>
      </button>
      {action !== undefined && <span className="absolute right-0.5">{action}</span>}
    </li>
  );
}

function FolderItem({
  folder,
  count,
  current,
  commands,
}: {
  folder: FolderRecord;
  count: number;
  current: boolean;
  commands: LibraryCommands;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const renaming = useLibraryStore((s) => s.renamingId === folder.id);
  const store = () => useLibraryStore.getState();

  if (renaming) {
    return (
      <li className="px-1 py-0.5">
        <RenameField
          initial={folder.name}
          label="Folder name"
          onSubmit={async (name) => {
            const error = await renameFolderInline(commands.ctx, folder.id, name);
            return error === null ? null : folderNameMessage(error, name);
          }}
          onDone={() => {
            store().setRenaming(null);
          }}
        />
      </li>
    );
  }
  return (
    <FolderContextMenu folder={folder} deckCount={count}>
      <NavItem
        icon={Folder}
        label={folder.name}
        count={count}
        current={current}
        onSelect={() => {
          store().setSection(folderSection(folder.id));
        }}
        onKeyDown={(event) => {
          if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
            event.preventDefault();
            setMenuOpen(true);
          } else if (event.key === 'F2') {
            event.preventDefault();
            store().setRenaming(folder.id);
          } else if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            store().requestDelete({
              kind: 'folder',
              id: folder.id,
              name: folder.name,
              deckCount: count,
            });
          }
        }}
        action={
          <FolderMenuButton
            folder={folder}
            deckCount={count}
            open={menuOpen}
            onOpenChange={setMenuOpen}
          />
        }
      />
    </FolderContextMenu>
  );
}

/** The library sidebar (design 01, 74–79): sections, folders, recent decks, storage card. */
export function LibrarySidebar({
  decks,
  recent,
  folders,
  section,
  commands,
  onNewFolder,
  storageCard,
}: {
  decks: readonly DeckRecord[];
  recent: readonly DeckRecord[];
  folders: readonly FolderRecord[];
  section: LibrarySection;
  commands: LibraryCommands | null;
  onNewFolder: () => void;
  storageCard: ReactNode;
}) {
  const setSection = useLibraryStore((s) => s.setSection);
  const counts = new Map<string, number>();
  for (const deck of decks) {
    if (deck.folderId !== null) counts.set(deck.folderId, (counts.get(deck.folderId) ?? 0) + 1);
  }

  return (
    <nav
      aria-label="Library"
      className="flex min-h-0 flex-col gap-5 overflow-y-auto border-r border-hairline bg-surface p-3"
    >
      <ul className="flex flex-col gap-0.5">
        <NavItem
          icon={LayoutGrid}
          label="All decks"
          count={decks.length}
          current={section === 'all'}
          onSelect={() => {
            setSection('all');
          }}
        />
        <NavItem
          icon={Clock}
          label="Recent"
          count={recent.length}
          current={section === 'recent'}
          onSelect={() => {
            setSection('recent');
          }}
        />
        <NavItem
          icon={Sparkles}
          label="Samples"
          count={0}
          current={section === 'samples'}
          onSelect={() => {
            setSection('samples');
          }}
        />
      </ul>
      <section aria-labelledby="library-folders-heading" className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between pl-2">
          <h2 id="library-folders-heading" className="text-micro text-ink-secondary uppercase">
            Folders
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New folder"
            onClick={onNewFolder}
            disabled={!commands}
          >
            <FolderPlus />
          </Button>
        </div>
        <ul className="flex flex-col gap-0.5">
          {commands &&
            folders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                count={counts.get(folder.id) ?? 0}
                current={section === folderSection(folder.id)}
                commands={commands}
              />
            ))}
        </ul>
      </section>
      <RecentList decks={recent} />
      <div className="mt-auto">{storageCard}</div>
    </nav>
  );
}
