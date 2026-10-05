import { buildSearchIndex } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it, vi } from 'vitest';

import { buildPaletteResults } from './palette-results';
import { buildCommands } from './commands';

function context() {
  return {
    navigate: vi.fn(),
    openRules: vi.fn(),
    openExport: vi.fn(),
    theme: {
      value: 'light' as const,
      resolved: 'light' as const,
      setTheme: vi.fn(),
      shortcut: '⇧⌘L',
    },
    focusModeAvailable: false,
  };
}

describe('buildCommands', () => {
  it('returns the expected labels in order', () => {
    const commands = buildCommands(context());
    expect(commands.map((command) => command.title)).toEqual([
      'Export deck…',
      'Toggle dark mode',
      'Open rule editor',
      'Go to library',
      'New deck',
    ]);
  });

  it('runs the export action, opens rules, and navigates to the library or a new deck', () => {
    const ctx = context();
    const commands = buildCommands(ctx);

    commands[0]?.run();
    commands[2]?.run();
    commands[3]?.run();
    commands[4]?.run();

    expect(ctx.openExport).toHaveBeenCalledOnce();
    expect(ctx.openRules).toHaveBeenCalledOnce();
    expect(ctx.navigate).toHaveBeenCalledWith('/');
    expect(ctx.navigate).toHaveBeenCalledWith('/deck/new');
  });

  it('adds the canvas-first shell commands on the canvas (018)', () => {
    const shell = {
      canOpenDetails: true,
      openDetails: vi.fn(),
      jsonShown: false,
      toggleJson: vi.fn(),
      codeOpen: false,
      toggleCode: vi.fn(),
      hideUi: vi.fn(),
      importMermaid: vi.fn(),
    };
    const commands = buildCommands({ ...context(), shell });
    const byTitle = (title: string) => commands.find((command) => command.title === title);
    byTitle('Open details')?.run();
    byTitle('Show JSON')?.run();
    byTitle('Open DBML / SQL')?.run();
    byTitle('Hide UI')?.run();
    byTitle('Import Mermaid…')?.run();
    expect(shell.importMermaid).toHaveBeenCalledOnce();
    expect(shell.openDetails).toHaveBeenCalledOnce();
    expect(shell.toggleJson).toHaveBeenCalledOnce();
    expect(shell.toggleCode).toHaveBeenCalledOnce();
    expect(shell.hideUi).toHaveBeenCalledOnce();

    const idle = buildCommands({
      ...context(),
      shell: { ...shell, canOpenDetails: false, jsonShown: true, codeOpen: true },
    });
    expect(idle.map((command) => command.title)).not.toContain('Open details');
    expect(idle.map((command) => command.title)).toContain('Hide JSON');
    expect(idle.map((command) => command.title)).toContain('Close DBML / SQL');
    expect(idle.map((command) => command.title)).not.toContain('Open DBML / SQL');
  });

  it('toggles the resolved theme, including from system mode', () => {
    const ctx = context();
    buildCommands(ctx)[1]?.run();
    expect(ctx.theme.setTheme).toHaveBeenCalledWith('dark');

    const system = {
      ...context(),
      theme: {
        value: 'system' as const,
        resolved: 'dark' as const,
        setTheme: vi.fn(),
        shortcut: '⇧⌘L',
      },
    };
    buildCommands(system)[1]?.run();
    expect(system.theme.setTheme).toHaveBeenCalledWith('light');
  });

  it('omits focus mode while it is unavailable', () => {
    const commands = buildCommands(context());
    expect(commands.some((command) => command.title === 'Toggle focus mode')).toBe(false);
  });

  it('uses aliases for theme, dark and rules queries, and preserves a shortcut when present', () => {
    const deck = emptySododeckFile();
    const searchIndex = buildSearchIndex(deck);
    const commands = buildCommands(context());

    expect(
      buildPaletteResults({ deck, searchIndex, query: 'theme', commands }).items[0]?.title,
    ).toBe('Toggle dark mode');
    expect(
      buildPaletteResults({ deck, searchIndex, query: 'dark', commands }).items[0]?.title,
    ).toBe('Toggle dark mode');
    expect(
      buildPaletteResults({ deck, searchIndex, query: 'rules', commands }).items[0]?.title,
    ).toBe('Open rule editor');
    expect(commands[1]?.shortcut).toBe('⇧⌘L');
  });

  it('offers "Spread connector ends evenly" only when it can run, found by "distribute ends"', () => {
    const shell = {
      canOpenDetails: false,
      openDetails: vi.fn(),
      jsonShown: false,
      toggleJson: vi.fn(),
      codeOpen: false,
      toggleCode: vi.fn(),
      hideUi: vi.fn(),
      importMermaid: vi.fn(),
    };
    const title = 'Spread connector ends evenly';
    expect(buildCommands({ ...context(), shell }).map((c) => c.title)).not.toContain(title);

    const spreadEnds = vi.fn();
    const commands = buildCommands({ ...context(), shell: { ...shell, spreadEnds } });
    const deck = emptySododeckFile();
    const searchIndex = buildSearchIndex(deck);
    const found = buildPaletteResults({ deck, searchIndex, query: 'distribute ends', commands })
      .items[0];
    expect(found?.title).toBe(title);
    commands.find((c) => c.title === title)?.run();
    expect(spreadEnds).toHaveBeenCalledOnce();
  });
});
