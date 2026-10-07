import type { Theme } from '../../theme/theme-store';

import type { PaletteCommand } from './palette-results';

export interface CommandContext {
  navigate: (to: string) => void;
  openRules: () => void;
  openExport: () => void;
  theme: {
    value: Theme | 'system';
    resolved: Theme;
    setTheme: (theme: Theme) => void;
    shortcut?: string;
  };
  focusModeAvailable: boolean;
  /** The deck library exists (the web app); an embed has none. Default true. */
  library?: boolean;
  /** The user picks the theme (the web app); an embed's host owns it. Default true. */
  themeSwitch?: boolean;
  /** Canvas-first shell commands (018), on the canvas screen only. */
  shell?: {
    /** Something is selected, so "Open details" has something to show. */
    canOpenDetails: boolean;
    openDetails: () => void;
    jsonShown: boolean;
    toggleJson: () => void;
    /** The DBML / SQL drawer (054). */
    codeOpen: boolean;
    toggleCode: () => void;
    hideUi: () => void;
    /** Opens Import Mermaid (into this deck by default). */
    importMermaid: () => void;
    /** Spreads the selection's connector ends (050 US7); absent when it cannot run now. */
    spreadEnds?: () => void;
  };
}

export function buildCommands({
  navigate,
  openRules,
  openExport,
  theme,
  focusModeAvailable,
  library = true,
  themeSwitch = true,
  shell,
}: CommandContext): readonly PaletteCommand[] {
  const commands: PaletteCommand[] = [
    { id: 'export', title: 'Export deck…', run: openExport },
    ...(themeSwitch
      ? [
          {
            id: 'toggle-dark-mode',
            title: 'Toggle dark mode',
            aliases: ['theme', 'dark', 'switch theme'],
            ...(theme.shortcut === undefined ? {} : { shortcut: theme.shortcut }),
            run: () => {
              theme.setTheme(theme.resolved === 'dark' ? 'light' : 'dark');
            },
          },
        ]
      : []),
    {
      id: 'open-rules',
      title: 'Open rule editor',
      aliases: ['rules', 'open rules'],
      run: openRules,
    },
    ...(library
      ? [
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
        ]
      : []),
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
      {
        id: 'toggle-code',
        title: shell.codeOpen ? 'Close DBML / SQL' : 'Open DBML / SQL',
        aliases: ['dbml', 'sql', 'schema', 'code'],
        run: shell.toggleCode,
      },
      { id: 'hide-ui', title: 'Hide UI', aliases: ['present', 'hide controls'], run: shell.hideUi },
      {
        id: 'import-mermaid',
        title: 'Import Mermaid…',
        aliases: ['mermaid', 'flowchart', 'sequence diagram', 'import'],
        run: shell.importMermaid,
      },
    );
    if (shell.spreadEnds !== undefined) {
      commands.push({
        id: 'spread-ends',
        title: 'Spread connector ends evenly',
        aliases: ['distribute ends', 'spread ends'],
        run: shell.spreadEnds,
      });
    }
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
