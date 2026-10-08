/**
 * The ports over the real VS Code API. One of the three files that import `vscode` (the glue);
 * nothing here decides anything, it only forwards. Covered by the quickstart, not by unit tests.
 */
import { promises as nodeFs } from 'node:fs';
import { posix } from 'node:path';

import * as vscode from 'vscode';

import { isDeckMarkdown } from '@sododeck/model';

import { shouldSwapToCanvas } from './note-swap';
import type { Disposable, FilePort, Loc, Ports, SettingsPort, UiPort } from './ports';
import { schemeOfKind } from './theme';

const uriOf = (loc: Loc): vscode.Uri => vscode.Uri.parse(loc);
const caseInsensitive = process.platform === 'win32' || process.platform === 'darwin';

const files: FilePort = {
  caseInsensitive,
  read: async (loc) => vscode.workspace.fs.readFile(uriOf(loc)),
  size: async (loc) => (await vscode.workspace.fs.stat(uriOf(loc))).size,
  write: async (loc, bytes) => {
    await vscode.workspace.fs.writeFile(uriOf(loc), bytes);
  },
  mkdir: async (loc) => {
    await vscode.workspace.fs.createDirectory(uriOf(loc));
  },
  exists: async (loc) => {
    try {
      await vscode.workspace.fs.stat(uriOf(loc));
      return true;
    } catch {
      return false;
    }
  },
  rename: async (from, to) => {
    await vscode.workspace.fs.rename(uriOf(from), uriOf(to), { overwrite: true });
  },
  remove: async (loc) => {
    await vscode.workspace.fs.delete(uriOf(loc));
  },
  isSymlink: async (loc) => {
    const uri = uriOf(loc);
    if (uri.scheme !== 'file') return false;
    try {
      return (await nodeFs.lstat(uri.fsPath)).isSymbolicLink();
    } catch {
      return false;
    }
  },
  realpath: async (loc) => {
    const uri = uriOf(loc);
    if (uri.scheme !== 'file') return loc;
    try {
      return vscode.Uri.file(await nodeFs.realpath(uri.fsPath)).toString();
    } catch {
      return loc;
    }
  },
  scheme: (loc) => uriOf(loc).scheme,
  dirname: (loc) => vscode.Uri.joinPath(uriOf(loc), '..').toString(),
  basename: (loc) => posix.basename(uriOf(loc).path),
  join: (loc, rel) => vscode.Uri.joinPath(uriOf(loc), ...rel.split('/')).toString(),
};

function disposable(d: vscode.Disposable): Disposable {
  return { dispose: () => void d.dispose() };
}

const settings: SettingsPort = {
  picturesStorage: (deck) => {
    const value = vscode.workspace
      .getConfiguration('sododeck', uriOf(deck))
      .get<string>('pictures.storage');
    return value === 'file' ? 'file' : 'embed';
  },
  onChange: (handler) =>
    disposable(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('sododeck.pictures.storage')) handler();
      }),
    ),
};

const VIEW_TYPES = new Set(['sododeck.canvas', 'sododeck.note']);

/** The URI of the deck shown in the active tab, if it is one of ours. */
export function activeDeck(): vscode.Uri | undefined {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  return input instanceof vscode.TabInputCustom && VIEW_TYPES.has(input.viewType)
    ? input.uri
    : undefined;
}

/** Files the user sent to the text editor in this session; the note swap leaves them alone. */
const chosenText = new Set<string>();

export async function openAsText(deck: Loc): Promise<void> {
  chosenText.add(deck);
  await vscode.commands.executeCommand('vscode.openWith', uriOf(deck), 'default');
}

/**
 * Turns a `*.sododeck.md` that opened as text into the canvas (R3, spike S1). The decision is
 * `shouldSwapToCanvas`; this only watches editors, reopens, and closes the text tab.
 */
export function registerNoteSwap(noteViewType: string): vscode.Disposable {
  const swapping = new Set<string>();
  return vscode.window.onDidChangeVisibleTextEditors((editors) => {
    for (const editor of editors) {
      const { document } = editor;
      const key = document.uri.toString();
      if (document.uri.scheme === 'untitled' || swapping.has(key)) continue;
      const swap = shouldSwapToCanvas({
        fileName: posix.basename(document.uri.path),
        hasMarker: isDeckMarkdown(document.getText()),
        chosenText: chosenText.has(key),
      });
      if (!swap) continue;
      swapping.add(key);
      void (async () => {
        try {
          await vscode.commands.executeCommand('vscode.openWith', document.uri, noteViewType, {
            viewColumn: editor.viewColumn,
          });
          const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);
          const textTab = tabs.find(
            (tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === key,
          );
          if (textTab !== undefined) await vscode.window.tabGroups.close(textTab);
        } finally {
          swapping.delete(key);
        }
      })();
    }
  });
}

const ui: UiPort = {
  notify: (message) => void vscode.window.showInformationMessage(message),
  warn: (message) => void vscode.window.showWarningMessage(message),
  offerOpenAsText: (deck) => {
    void vscode.window
      .showWarningMessage(
        'This file is not a valid Sododeck deck. The canvas shows what is wrong and will not change the file.',
        'Open as text',
      )
      .then((choice) => (choice === undefined ? undefined : openAsText(deck)));
  },
  statusMessage: (message) => void vscode.window.setStatusBarMessage(message, 4000),
  showSaveDialog: async (name, folder) => {
    const start = folder === undefined ? undefined : vscode.Uri.joinPath(uriOf(folder), name);
    const chosen = await vscode.window.showSaveDialog(
      start === undefined ? { saveLabel: 'Save' } : { defaultUri: start, saveLabel: 'Save' },
    );
    return chosen?.toString();
  },
  openExternal: async (url) => {
    await vscode.env.openExternal(vscode.Uri.parse(url));
  },
  openUri: async (loc) => {
    await vscode.commands.executeCommand('vscode.open', uriOf(loc));
  },
  revealInOs: async (loc) => {
    await vscode.commands.executeCommand('revealFileInOS', uriOf(loc));
  },
};

export function createPorts(): Ports {
  return {
    files,
    settings,
    ui,
    watch: {
      watch: (loc, onEvent) => {
        const uri = uriOf(loc);
        const watcher = vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(vscode.Uri.joinPath(uri, '..'), posix.basename(uri.path)),
        );
        const subs = [
          watcher.onDidChange(onEvent),
          watcher.onDidCreate(onEvent),
          watcher.onDidDelete(onEvent),
          watcher,
        ];
        return {
          dispose: () => {
            for (const s of subs) s.dispose();
          },
        };
      },
    },
    theme: {
      scheme: () => schemeOfKind(vscode.window.activeColorTheme.kind),
      onChange: (handler) => disposable(vscode.window.onDidChangeActiveColorTheme(handler)),
    },
    trust: {
      isTrusted: () => vscode.workspace.isTrusted,
      onDidGrant: (handler) => disposable(vscode.workspace.onDidGrantWorkspaceTrust(handler)),
    },
    workspace: {
      folders: () => (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.toString()),
    },
    clock: {
      setTimeout: (fn, ms) => {
        const timer = setTimeout(fn, ms);
        return () => {
          clearTimeout(timer);
        };
      },
    },
  };
}
