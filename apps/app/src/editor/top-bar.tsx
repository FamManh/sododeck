import { Button } from '@sododeck/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { Download, Moon, Sun } from 'lucide-react';

import { useThemeStore } from '../theme/theme-store';
import { Wordmark } from './wordmark';

export function TopBar({ deckName }: { deckName: string }) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <header className="flex items-center gap-4 border-b border-hairline bg-surface px-4">
      <Wordmark />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-body text-ink-muted">
        <span>Local</span>
        <span aria-hidden>/</span>
        <span className="text-ink">{deckName}</span>
      </nav>
      <div className="flex-1" />
      {/* TODO(M1): real autosave status ("Saving…" → "Saved in this browser"). */}
      <span className="text-caption text-ink-muted">Demo · not saved</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
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
      <Button variant="primary" disabled>
        <Download />
        Export
      </Button>
    </header>
  );
}
