import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { Download, FileText, HardDrive } from 'lucide-react';

import { useSaveControls } from './save-context';
import { useExportDeck } from './use-export-deck';

const WHERE = {
  stored: 'Stored in this browser',
  demo: 'Demo deck · not stored',
  memory: "Not stored: this browser doesn't keep decks",
  host: 'Stored by the program that opened this deck',
} as const;

/** The deck inspector's STORAGE section (FR-034, design 10). */
export function DeckInspectorStorage() {
  const { mode } = useSaveControls();
  const exportDeck = useExportDeck();
  const exportMarkdown = useExportDeck('markdown');
  // The host's file is the store, and it decides where exports go (067).
  if (mode === 'host') return null;
  return (
    <PanelSection label="Storage">
      <p className="flex items-center gap-2 text-body-sm">
        <HardDrive aria-hidden strokeWidth={1.5} className="size-4 shrink-0 text-ink-secondary" />
        {WHERE[mode]}
      </p>
      <Button size="sm" className="self-start" onClick={exportDeck}>
        <Download />
        Export .sododeck
      </Button>
      <Button size="sm" className="self-start" onClick={exportMarkdown}>
        <FileText />
        Export .sododeck.md
      </Button>
    </PanelSection>
  );
}
