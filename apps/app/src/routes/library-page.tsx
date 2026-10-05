import { Banner } from '@sododeck/ui/components/banner';
import { Button } from '@sododeck/ui/components/button';
import { SearchField } from '@sododeck/ui/components/search-field';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { ToastProvider, Toaster } from '@sododeck/ui/components/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { LayoutGrid, List, Moon, Plus, Sun } from 'lucide-react';
import { Suspense, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { Wordmark } from '../editor/wordmark';
import { ConfirmLibraryDelete } from '../library/confirm-library-delete';
import { DeckGrid } from '../library/deck-grid';
import { ImportButton } from '../library/import-button';
import { ImportMermaidButton } from '../library/import-mermaid-button';
import { ImportMermaidDialog, type MermaidDialogRequest } from '../library/import-mermaid-dialog';
import {
  ImportProblemsDialog,
  type ImportProblemsRequest,
} from '../library/import-problems-dialog';
import { useFileDrop, useImportFiles } from '../library/use-import-files';
import { LibrarySidebar } from '../library/library-sidebar';
import { useLibraryStore } from '../library/library-store';
import {
  deckCountLabel,
  folderSection,
  recentDecks,
  sectionFolderId,
  sectionTitle,
  selectDecks,
} from '../library/library-view';
import { NewFolderDialog } from '../library/new-folder-dialog';
import { useLibraryCommands } from '../library/use-library-commands';
import { liveDecks, liveFolders } from '../storage/library-db';
import { LibraryDbProvider } from '../storage/library-db-context';
import { useLibraryDb } from '../storage/library-db-instance';
import { useLiveQuery } from '../storage/use-live-query';
import { useThemeStore } from '../theme/theme-store';

function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          aria-label={`Switch to ${nextTheme} theme`}
          onClick={() => {
            setTheme(nextTheme);
          }}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Switch to {nextTheme} theme</TooltipContent>
    </Tooltip>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-deck-card border-[1.5px] border-dashed border-border p-8 text-center text-body text-ink-secondary">
      {children}
    </div>
  );
}

function Library() {
  const db = useLibraryDb();
  const commands = useLibraryCommands();
  const decks = useLiveQuery(() => (db ? liveDecks(db) : Promise.resolve([])), [db]);
  const folders = useLiveQuery(() => (db ? liveFolders(db) : Promise.resolve([])), [db]);
  const { section: storedSection, search, viewMode } = useLibraryStore();
  const store = useLibraryStore.getState;
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [mermaid, setMermaid] = useState<MermaidDialogRequest | null>(null);
  const [problems, setProblems] = useState<ImportProblemsRequest | null>(null);
  const navigate = useNavigate();
  const openMermaid = (text: string, autoRun: boolean) => {
    const opener = document.activeElement;
    setMermaid((previous) => ({ key: (previous?.key ?? 0) + 1, text, autoRun, opener }));
  };

  const allDecks = decks ?? [];
  const allFolders = folders ?? [];
  // A folder deleted in another tab falls back to All decks.
  const folderId = sectionFolderId(storedSection);
  const section =
    folderId !== null && folders !== undefined && !allFolders.some((f) => f.id === folderId)
      ? 'all'
      : storedSection;
  const currentFolder = sectionFolderId(section);

  const shown = selectDecks(allDecks, { section, search });
  const inSection = selectDecks(allDecks, { section, search: '' });
  const recent = recentDecks(allDecks);
  const newDeckHref = currentFolder === null ? '/deck/new' : `/deck/new?folder=${currentFolder}`;
  const onMermaid = (text: string) => {
    openMermaid(text, true);
  };
  const importFiles = useImportFiles(commands, currentFolder, {
    onMermaid,
    onProblems: setProblems,
  });
  const drop = useFileDrop((files) => {
    void importFiles(files);
  });
  const loading = decks === undefined || folders === undefined;

  const content = (() => {
    if (loading) return null;
    if (section === 'samples') {
      return (
        <EmptyState>
          <p>Sample decks are coming soon.</p>
          <Button asChild>
            <Link to="/deck/demo">Open demo deck</Link>
          </Button>
        </EmptyState>
      );
    }
    if (section === 'recent' && inSection.length === 0) {
      return (
        <EmptyState>
          <p>Decks you open will appear here.</p>
        </EmptyState>
      );
    }
    if (search.trim() !== '' && shown.length === 0) {
      return (
        <p className="py-10 text-center text-body text-ink-secondary">{`No decks match "${search.trim()}".`}</p>
      );
    }
    return (
      <DeckGrid
        decks={shown}
        folders={allFolders}
        commands={commands}
        viewMode={viewMode}
        newDeckHref={section === 'recent' || search.trim() !== '' ? null : newDeckHref}
      />
    );
  })();

  return (
    <div className="grid h-dvh grid-rows-[64px_minmax(0,1fr)] bg-app">
      <header className="flex items-center gap-4 border-b border-hairline bg-surface px-4">
        <div className="w-58 shrink-0">
          <Wordmark />
        </div>
        <div className="flex flex-1 justify-center">
          <SearchField
            label="Search decks"
            placeholder="Search decks"
            className="max-w-xl"
            value={search}
            onChange={(event) => {
              store().setSearch(event.target.value);
            }}
            onClear={() => {
              store().setSearch('');
            }}
          />
        </div>
        <ThemeToggle />
        <ImportMermaidButton
          commands={commands}
          onOpen={() => {
            openMermaid('', false);
          }}
        />
        <ImportButton
          commands={commands}
          folderId={currentFolder}
          onMermaid={onMermaid}
          onProblems={setProblems}
        />
        <Button asChild variant="primary">
          <Link to={newDeckHref}>
            <Plus />
            New deck
          </Link>
        </Button>
      </header>
      <div className="grid min-h-0 grid-cols-[236px_minmax(0,1fr)]">
        <LibrarySidebar
          decks={allDecks}
          recent={recent}
          folders={allFolders}
          section={section}
          commands={commands}
          onNewFolder={() => {
            setNewFolderOpen(true);
          }}
        />
        <main {...drop} className="flex min-h-0 flex-col gap-6 overflow-y-auto px-10 py-8">
          {!db && (
            <Banner tone="error">
              {"Decks can't be kept in this browser (storage is blocked)."} You can still create a
              deck and export it before you close the tab.
            </Banner>
          )}
          <div className="flex items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="truncate text-display">{sectionTitle(section, allFolders)}</h1>
              <p className="text-body text-ink-secondary">{deckCountLabel(inSection.length)}</p>
            </div>
            <SegmentedControl
              aria-label="View"
              value={viewMode}
              onValueChange={(value) => {
                store().setViewMode(value === 'list' ? 'list' : 'grid');
              }}
            >
              <SegmentedControlItem value="grid" aria-label="Grid">
                <LayoutGrid />
              </SegmentedControlItem>
              <SegmentedControlItem value="list" aria-label="List">
                <List />
              </SegmentedControlItem>
            </SegmentedControl>
          </div>
          {content}
        </main>
      </div>
      {db && (
        <NewFolderDialog
          db={db}
          open={newFolderOpen}
          onOpenChange={setNewFolderOpen}
          onCreated={(folder) => {
            store().setSection(folderSection(folder.id));
          }}
        />
      )}
      <ImportMermaidDialog
        commands={commands}
        folderId={currentFolder}
        request={mermaid}
        onClose={() => {
          setMermaid(null);
        }}
      />
      <ImportProblemsDialog
        request={problems}
        onClose={() => {
          setProblems(null);
        }}
        onOpenDeck={(deckId) => {
          void navigate(`/deck/${deckId}`);
        }}
      />
      {commands && <ConfirmLibraryDelete commands={commands} />}
    </div>
  );
}

/**
 * The deck library (design 01, 07–09, 72–81): every deck stored in this browser, with folders,
 * Recent, Samples, search and grid/list. It reads only library records (Dexie `liveQuery`, so
 * other tabs' changes show up live) and never loads Yjs or the model; operations on deck content
 * run in the library worker.
 */
export function LibraryPage() {
  return (
    <ToastProvider>
      {/* The database opens in a few ms, usually before this route renders. */}
      <Suspense fallback={null}>
        <LibraryDbProvider>
          <Library />
        </LibraryDbProvider>
      </Suspense>
      <Toaster />
    </ToastProvider>
  );
}
