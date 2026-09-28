import type { Theme } from '../../theme/theme-store';

import type { PaletteCommand } from './palette-results';

export interface CommandContext {
  navigate: (to: string) => void;
  openRules: () => void;
  exportDeck: () => void;
  theme: {
    value: Theme | 'system';
    resolved: Theme;
    setTheme: (theme: Theme) => void;
    shortcut?: string;
  };
  focusModeAvailable: boolean;
  /** Canvas-first shell commands (018), on the canvas screen only. */
  shell?: {
    /** Something is selected, so "Open details" has something to show. */
    canOpenDetails: boolean;
    openDetails: () => void;
    jsonShown: boolean;
    toggleJson: () => void;
    hideUi: () => void;
  };
}

export function buildCommands({
  navigate,
  openRules,
  exportDeck,
  theme,
  focusModeAvailable,
  shell,
}: CommandContext): readonly PaletteCommand[] {
  const commands: PaletteCommand[] = [
    { id: 'export', title: 'Export deck…', run: exportDeck },
    {
      id: 'toggle-dark-mode',
      title: 'Toggle dark mode',
      aliases: ['theme', 'dark', 'switch theme'],
      ...(theme.shortcut === undefined ? {} : { shortcut: theme.shortcut }),
      run: () => {
        theme.setTheme(theme.resolved === 'dark' ? 'light' : 'dark');
      },
    },
    {
      id: 'open-rules',
      title: 'Open rule editor',
      aliases: ['rules', 'open rules'],
      run: openRules,
    },
    {
      id: 'go-to-library',
      title: 'Go to library',
      run: () => {
        navigate('/');
      },
    },
    {
      id: 'new-deck',
      title: 'New deck',
      run: () => {
        navigate('/deck/new');
      },
    },
  ];

  if (shell !== undefined) {
    if (shell.canOpenDetails) {
      commands.push({
        id: 'open-details',
        title: 'Open details',
        aliases: ['inspector', 'details', 'properties'],
        run: shell.openDetails,
      });
    }
    commands.push(
      {
        id: 'toggle-json',
        title: shell.jsonShown ? 'Hide JSON' : 'Show JSON',
        aliases: ['json', 'code'],
        run: shell.toggleJson,
      },
      { id: 'hide-ui', title: 'Hide UI', aliases: ['present', 'hide controls'], run: shell.hideUi },
    );
  }

  if (focusModeAvailable) {
    // TODO(M4): wire focus mode when 010 lands.
    commands.splice(2, 0, {
      id: 'toggle-focus-mode',
      title: 'Toggle focus mode',
      run: () => undefined,
    });
  }

  return commands;
}
