import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { useToast } from '@sododeck/ui/components/toast';
import {
  Braces,
  ClipboardList,
  Database,
  Download,
  FileCode2,
  FileUp,
  Keyboard,
  LibraryBig,
  Menu,
  Moon,
  Settings2,
  Sun,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  ImportProblemsDialog,
  type ImportProblemsRequest,
} from '../../library/import-problems-dialog';
import { importDeckFile, importedMessage, problemCount } from '../../library/library-actions';
import { LibraryClientError } from '../../storage/library-client';
import { importMessage } from '../../library/use-import-files';
import { useUiStore } from '../../state/ui-store';
import { useThemeStore } from '../../theme/theme-store';
import { getLibraryClient } from '../../storage/library-client';
import { getLibraryDb } from '../../storage/library-db-instance';
import { shortcutLabel } from './shortcuts';

/**
 * The deck island's ≡ menu (018 FR-007, contract "Deck island"): the library, import, schema
 * import (044) and its last report, export, deck settings (the drawer on the deck) and the JSON
 * overlay, and the DBML / SQL drawer (054). Import adds the file to the
 * library as a new deck, as the library's own Import does; the open deck is not replaced.
 */
export function DeckMenu() {
  const navigate = useNavigate();
  const openExport = useUiStore((s) => s.openExport);
  const openImport = useUiStore((s) => s.openImport);
  const hasReport = useUiStore((s) => s.importReport !== null);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const jsonShown = useUiStore((s) => s.jsonShown);
  const codeOpen = useUiStore((s) => s.jsonPanel.codeDrawer.open);
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<ImportProblemsRequest | null>(null);

  const importFile = async (files: FileList | null) => {
    const [file] = files ?? [];
    if (files === null || files.length === 0 || file === undefined) return;
    if (files.length > 1) {
      toast({ message: 'Import one file at a time.' });
      return;
    }
    const db = await getLibraryDb();
    if (db === null) {
      toast({ message: 'This browser cannot keep decks, so nothing was imported.' });
      return;
    }
    try {
      const { deckId, name, report } = await importDeckFile(
        { db, client: getLibraryClient() },
        await file.text(),
        null,
        file.name,
      );
      toast({
        message: importedMessage(name, problemCount(report), ' into the library'),
        // A deck that opened with problems offers them (062 US2); a clean one, the library.
        action:
          report === null
            ? {
                label: 'Open library',
                onAction: () => {
                  void navigate('/');
                },
              }
            : {
                label: 'Show',
                onAction: () => {
                  setProblems({ mode: 'opened', name, deckId, report });
                },
              },
      });
    } catch (error) {
      if (error instanceof LibraryClientError && error.report !== undefined) {
        setProblems({ mode: 'refused', name: file.name, report: error.report });
        return;
      }
      toast({ message: importMessage(error) });
    }
  };

  return (
    <>
      <ImportProblemsDialog
        request={problems}
        onClose={() => {
          setProblems(null);
        }}
        onOpenDeck={(deckId) => {
          setProblems(null);
          void navigate(`/deck/${deckId}`);
        }}
      />
      <input
        ref={input}
        type="file"
        accept=".sododeck,.json,application/json"
        hidden
        data-testid="deck-menu-import"
        onChange={(event) => {
          void importFile(event.target.files);
          event.target.value = '';
        }}
      />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={menuTrigger}
            variant="ghost"
            size="icon"
            aria-label="Deck menu"
            aria-haspopup="menu"
          >
            <Menu />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent aria-label="Deck menu" aria-labelledby={undefined} align="start">
          <DropdownMenuItem
            onSelect={() => {
              void navigate('/');
            }}
          >
            <LibraryBig />
            All decks
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              input.current?.click();
            }}
          >
            <FileUp />
            Import…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              openImport(menuTrigger.current);
            }}
          >
            <FileCode2 />
            Import SQL or DBML…
          </DropdownMenuItem>
          {hasReport && (
            <DropdownMenuItem
              onSelect={() => {
                useUiStore.getState().openFlyout('import-report');
              }}
            >
              <ClipboardList />
              Last import report
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              openExport(menuTrigger.current);
            }}
          >
            <Download />
            Export…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              useUiStore.getState().openDrawer('deck');
            }}
          >
            <Settings2 />
            Deck settings
          </DropdownMenuItem>
          <DropdownMenuItem
            shortcut={shortcutLabel('json')}
            onSelect={() => {
              useUiStore.getState().toggleJsonShown();
            }}
          >
            <Braces />
            {jsonShown ? 'Hide JSON' : 'Show JSON'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              useUiStore.getState().toggleCodeDrawer();
            }}
          >
            <Database />
            {codeOpen ? 'Hide DBML / SQL' : 'Show DBML / SQL'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Set once and forgotten, so they live here rather than in the tools (§g-60). */}
          <DropdownMenuItem
            onSelect={() => {
              setTheme(theme === 'dark' ? 'light' : 'dark');
            }}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </DropdownMenuItem>
          <DropdownMenuItem
            shortcut={shortcutLabel('help')}
            onSelect={() => {
              useUiStore.getState().setHelpOpen(true);
            }}
          >
            <Keyboard />
            Keyboard shortcuts
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
