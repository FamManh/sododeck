import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { Download, HardDrive } from 'lucide-react';

import { useSaveControls } from './save-context';
import { useExportDeck } from './use-export-deck';

const WHERE = {
  stored: 'Stored in this browser',
  demo: 'Demo deck · not stored',
  memory: "Not stored: this browser doesn't keep decks",
} as const;

/** The deck inspector's STORAGE section (FR-034, design 10). */
export function DeckInspectorStorage() {
  const { mode } = useSaveControls();
  const exportDeck = useExportDeck();
  return (
    <PanelSection label="Storage">
      <p className="flex items-center gap-2 text-body-sm">
        <HardDrive aria-hidden strokeWidth={1.5} className="size-4 shrink-0 text-ink-secondary" />
        {WHERE[mode]}
      </p>
      <Button size="sm" className="self-start" onClick={exportDeck}>
        <Download />
        Export .sododeck.json
      </Button>
    </PanelSection>
  );
}
