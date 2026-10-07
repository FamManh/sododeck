/**
 * The ports over the real Obsidian API (070 plan: glue). The only place, with `deck-view.ts`,
 * `md-swap.ts`, `commands.ts`, `settings-tab.ts` and `main.ts`, that imports `obsidian`. Thin on
 * purpose: every decision lives in the pure modules these feed.
 */
import { Notice, type App, type EventRef, type TFile } from 'obsidian';

import type {
  ClockPort,
  PictureStorage,
  Scheme,
  SettingsPort,
  ThemePort,
  VaultEvent,
  VaultFilePort,
} from './ports';
import { dirname } from './vault-guard';

function bufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Files of the vault. `own` handles writes to the deck the view shows: the view sets its data and
 * saves (so the app's own bookkeeping for the open file stays in step); any other path is not
 * written by the plugin at all.
 */
export function vaultFiles(
  app: App,
  own: (path: string, text: string) => Promise<void>,
): VaultFilePort {
  const fileAt = (path: string): TFile => {
    const file = app.vault.getFileByPath(path);
    if (file === null) throw new Error(`File not found: ${path}`);
    return file;
  };
  return {
    readText: (path) => app.vault.read(fileAt(path)),
    writeText: (path, text) => own(path, text),
    readBinary: async (path) => new Uint8Array(await app.vault.readBinary(fileAt(path))),
    async createBinary(path, bytes) {
      const folder = dirname(path);
      if (folder !== '' && app.vault.getFolderByPath(folder) === null) {
        await app.vault.createFolder(folder);
      }
      await app.vault.createBinary(path, bufferOf(bytes));
    },
    exists: (path) => app.vault.getFileByPath(path) !== null,
    resolveLink: (linkText, fromPath) =>
      app.metadataCache.getFirstLinkpathDest(linkText, fromPath)?.path ?? null,
    availablePath: (name, fromPath) =>
      app.fileManager.getAvailablePathForAttachment(name, fromPath),
    linkTextFor: (path, fromPath) => {
      const file = app.vault.getFileByPath(path);
      return file === null ? path : app.metadataCache.fileToLinktext(file, fromPath, false);
    },
    onChange(handler) {
      const refs: EventRef[] = [];
      const emit = (event: VaultEvent): void => {
        handler(event);
      };
      refs.push(
        app.vault.on('modify', (f) => {
          emit({ kind: 'modify', path: f.path });
        }),
        app.vault.on('create', (f) => {
          emit({ kind: 'create', path: f.path });
        }),
        app.vault.on('delete', (f) => {
          emit({ kind: 'delete', path: f.path });
        }),
        app.vault.on('rename', (f, oldPath) => {
          emit({ kind: 'rename', path: f.path, oldPath });
        }),
      );
      return () => {
        for (const ref of refs) app.vault.offref(ref);
      };
    },
  };
}

/** Light or dark from the app's own theme class; the "system" theme setting ends up as one of the two. */
export function themeOf(app: App): ThemePort {
  const scheme = (): Scheme => (document.body.classList.contains('theme-dark') ? 'dark' : 'light');
  return {
    scheme,
    onChange(handler) {
      const ref = app.workspace.on('css-change', () => {
        handler();
      });
      return () => {
        app.workspace.offref(ref);
      };
    },
  };
}

/** The plugin's settings as a port; `notify` is called by the plugin when the setting changes. */
export class SettingsHub implements SettingsPort {
  private readonly handlers = new Set<() => void>();
  constructor(private current: () => PictureStorage) {}

  pictureStorage(): PictureStorage {
    return this.current();
  }

  onChange(handler: () => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  notify(): void {
    for (const handler of [...this.handlers]) handler();
  }
}

export const clock: ClockPort = {
  setTimeout(fn, ms) {
    const id = window.setTimeout(fn, ms);
    return () => {
      window.clearTimeout(id);
    };
  },
};

export function notice(message: string): void {
  new Notice(message);
}
