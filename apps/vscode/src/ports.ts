/**
 * What the host logic needs from VS Code, as plain interfaces (069 plan: structure decision). The
 * logic modules import only this file, never `vscode`, so Vitest drives them with the fakes in
 * `test/fakes.ts`. `vscode-ports.ts` is the one implementation over the real API.
 */

/** A file or folder location: a URI string. Only `FilePort` knows how to take it apart. */
export type Loc = string;

export interface Disposable {
  dispose(): void;
}

export interface FilePort {
  /** Rejects when the file does not exist or cannot be read. */
  read(loc: Loc): Promise<Uint8Array>;
  write(loc: Loc, bytes: Uint8Array): Promise<void>;
  /** Creates the folder and any missing parents; fine when it exists. */
  mkdir(loc: Loc): Promise<void>;
  exists(loc: Loc): Promise<boolean>;
  rename(from: Loc, to: Loc): Promise<void>;
  remove(loc: Loc): Promise<void>;
  isSymlink(loc: Loc): Promise<boolean>;
  /** The real location with links resolved; the location itself when the scheme has no links. */
  realpath(loc: Loc): Promise<Loc>;
  scheme(loc: Loc): string;
  dirname(loc: Loc): Loc;
  basename(loc: Loc): string;
  /** `rel` uses `/` and may start with `..` segments; resolved lexically. */
  join(loc: Loc, rel: string): Loc;
}

export interface WatchPort {
  /** Calls `onEvent` after the file is created, changed or deleted. */
  watch(loc: Loc, onEvent: () => void): Disposable;
}

export type Scheme = 'light' | 'dark';

export interface ThemePort {
  scheme(): Scheme;
  onChange(handler: () => void): Disposable;
}

export type PicturesStorage = 'embed' | 'file';

export interface SettingsPort {
  picturesStorage(deck: Loc): PicturesStorage;
  onChange(handler: () => void): Disposable;
}

export interface TrustPort {
  isTrusted(): boolean;
  onDidGrant(handler: () => void): Disposable;
}

export interface WorkspacePort {
  /** The workspace folders, as locations. */
  folders(): Loc[];
}

export interface UiPort {
  notify(message: string): void;
  warn(message: string): void;
  /** One-time "this file has problems" notice with an "Open as text" button. */
  offerOpenAsText(deck: Loc): void;
  statusMessage(message: string): void;
  /** The user's choice, or undefined when cancelled. */
  showSaveDialog(suggestedName: string, folder: Loc | undefined): Promise<Loc | undefined>;
  openExternal(url: string): Promise<void>;
  openUri(loc: Loc): Promise<void>;
}

export interface ClockPort {
  /** Runs `fn` once after `ms`; the returned function cancels it. */
  setTimeout(fn: () => void, ms: number): () => void;
}

export interface Ports {
  files: FilePort;
  watch: WatchPort;
  theme: ThemePort;
  settings: SettingsPort;
  trust: TrustPort;
  workspace: WorkspacePort;
  ui: UiPort;
  clock: ClockPort;
}
