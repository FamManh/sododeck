/**
 * What the host logic needs from Obsidian, as plain interfaces (070 plan: structure decision). The
 * logic modules import only this file, never `obsidian`, so Vitest drives them with the fakes in
 * `test/`. `obsidian-ports.ts` is the one implementation over the real API.
 *
 * Paths are vault paths: `/`-separated, relative to the vault root, no leading slash.
 */

export type VaultEvent =
  | { kind: 'create' | 'modify' | 'delete'; path: string }
  | { kind: 'rename'; path: string; oldPath: string };

export interface VaultFilePort {
  /** Rejects when the file does not exist. */
  readText(path: string): Promise<string>;
  /** Replaces the text of an existing file; rejects when it is gone (a deleted deck is never recreated). */
  writeText(path: string, text: string): Promise<void>;
  readBinary(path: string): Promise<Uint8Array>;
  /** Creates a new file (and its folder); rejects when one exists. */
  createBinary(path: string, bytes: Uint8Array): Promise<void>;
  exists(path: string): boolean;
  /** The app's own link resolution (full path, folder-relative, shortest unique name); null when none matches. */
  resolveLink(linkText: string, fromPath: string): string | null;
  /** Where the user's attachment settings put a new file called `name` for a note at `fromPath`; never an existing file. */
  availablePath(name: string, fromPath: string): Promise<string>;
  /** The link text the app would write for `path` in a note at `fromPath` (no brackets). */
  linkTextFor(path: string, fromPath: string): string;
  onChange(handler: (event: VaultEvent) => void): () => void;
}

export type Scheme = 'light' | 'dark';

export interface ThemePort {
  scheme(): Scheme;
  onChange(handler: () => void): () => void;
}

export type PictureStorage = 'attachments' | 'embedded';

export interface SettingsPort {
  pictureStorage(): PictureStorage;
  onChange(handler: () => void): () => void;
}

export interface UiPort {
  notice(message: string): void;
  /** The deck file cannot be read: show why instead of the canvas, with an "Open as Markdown" action. */
  showErrorPane(problems: readonly { message: string; fix: string }[]): void;
}

export interface ClockPort {
  /** Runs `fn` once after `ms`; the returned function cancels it. */
  setTimeout(fn: () => void, ms: number): () => void;
}

export interface Ports {
  files: VaultFilePort;
  theme: ThemePort;
  settings: SettingsPort;
  ui: UiPort;
  clock: ClockPort;
}
