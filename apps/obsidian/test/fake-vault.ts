import type { Ports, VaultEvent, VaultFilePort } from '../src/ports';
import { basename, dirname } from '../src/vault-guard';

type Entry = { text: string } | { bytes: Uint8Array };

export type AttachmentLocation = 'root' | 'same-folder' | { folder: string };

/**
 * An in-memory vault with the behaviour the host depends on (070 T013): events with a controllable
 * order, the app's link resolution (full path, folder-relative, shortest unique name), the
 * attachment path from the user's settings with numbered de-duplication, and the "update internal
 * links on rename" switch that rewrites `[[link]]` text in notes. It is the oracle for the tests.
 */
export class FakeVault implements VaultFilePort {
  private readonly files = new Map<string, Entry>();
  private readonly handlers = new Set<(event: VaultEvent) => void>();
  /** Every vault call, in order: tests assert nothing outside the vault is ever touched. */
  readonly calls: string[] = [];
  attachments: AttachmentLocation = 'root';
  updateLinksOnRename = true;
  /** When set, `writeText` waits for `releaseWrites()` before it lands (a write in flight). */
  holdWrites = false;
  failWrites: string | null = null;
  private held: (() => void)[] = [];

  /** Seeds a file without emitting an event. */
  seed(path: string, content: string | Uint8Array): void {
    this.files.set(path, typeof content === 'string' ? { text: content } : { bytes: content });
  }

  text(path: string): string {
    const entry = this.files.get(path);
    if (entry === undefined || !('text' in entry)) throw new Error(`no text file ${path}`);
    return entry.text;
  }

  paths(): string[] {
    return [...this.files.keys()].sort();
  }

  private emit(event: VaultEvent): void {
    for (const handler of [...this.handlers]) handler(event);
  }

  onChange(handler: (event: VaultEvent) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  // --- what happens from outside (another tool, a sync, the user) ---

  /** Someone else writes the file: the content changes and a `modify` event follows. */
  externalWrite(path: string, text: string): void {
    this.seed(path, text);
    this.emit({ kind: 'modify', path });
  }

  externalCreate(path: string, content: string | Uint8Array): void {
    this.seed(path, content);
    this.emit({ kind: 'create', path });
  }

  externalDelete(path: string): void {
    this.files.delete(path);
    this.emit({ kind: 'delete', path });
  }

  /** Moves or renames a file, like the app does: links in notes are rewritten when the switch is on. */
  externalRename(oldPath: string, path: string): void {
    const entry = this.files.get(oldPath);
    if (entry === undefined) throw new Error(`no file ${oldPath}`);
    this.files.delete(oldPath);
    this.files.set(path, entry);
    this.emit({ kind: 'rename', path, oldPath });
    if (!this.updateLinksOnRename) return;
    const from = basename(oldPath);
    const to = this.linkTextFor(path, path);
    for (const [other, e] of [...this.files]) {
      if (!('text' in e) || e.text.indexOf(`[[`) < 0) continue;
      const rewritten = e.text
        .split(`[[${oldPath}]]`)
        .join(`[[${to}]]`)
        .split(`[[${from}]]`)
        .join(`[[${to}]]`);
      if (rewritten !== e.text) this.externalWrite(other, rewritten);
    }
  }

  // --- the port ---

  readText(path: string): Promise<string> {
    this.calls.push(`readText ${path}`);
    const entry = this.files.get(path);
    return entry !== undefined && 'text' in entry
      ? Promise.resolve(entry.text)
      : Promise.reject(new Error(`File not found: ${path}`));
  }

  async writeText(path: string, text: string): Promise<void> {
    this.calls.push(`writeText ${path}`);
    if (this.failWrites !== null) throw new Error(this.failWrites);
    if (this.holdWrites) await new Promise<void>((resolve) => this.held.push(resolve));
    if (!this.files.has(path)) throw new Error(`File not found: ${path}`);
    this.seed(path, text);
    this.emit({ kind: 'modify', path });
  }

  releaseWrites(): void {
    const waiting = this.held;
    this.held = [];
    for (const resolve of waiting) resolve();
  }

  get writesWaiting(): number {
    return this.held.length;
  }

  readBinary(path: string): Promise<Uint8Array> {
    this.calls.push(`readBinary ${path}`);
    const entry = this.files.get(path);
    return entry !== undefined && 'bytes' in entry
      ? Promise.resolve(entry.bytes)
      : Promise.reject(new Error(`File not found: ${path}`));
  }

  createBinary(path: string, bytes: Uint8Array): Promise<void> {
    this.calls.push(`createBinary ${path}`);
    if (this.files.has(path)) return Promise.reject(new Error(`File already exists: ${path}`));
    this.seed(path, bytes);
    this.emit({ kind: 'create', path });
    return Promise.resolve();
  }

  exists(path: string): boolean {
    this.calls.push(`exists ${path}`);
    return this.files.has(path);
  }

  resolveLink(linkText: string, fromPath: string): string | null {
    this.calls.push(`resolveLink ${linkText}`);
    if (this.files.has(linkText)) return linkText;
    const relative = joinLoose(dirname(fromPath), linkText);
    if (relative !== null && this.files.has(relative)) return relative;
    const matches = [...this.files.keys()].filter(
      (p) => p === linkText || p.endsWith(`/${linkText}`),
    );
    return matches.sort()[0] ?? null;
  }

  availablePath(name: string, fromPath: string): Promise<string> {
    const folder =
      this.attachments === 'root'
        ? ''
        : this.attachments === 'same-folder'
          ? dirname(fromPath)
          : this.attachments.folder;
    const dot = name.lastIndexOf('.');
    const stem = dot < 0 ? name : name.slice(0, dot);
    const ext = dot < 0 ? '' : name.slice(dot);
    for (let n = 0; n < 1000; n++) {
      const file = n === 0 ? name : `${stem} ${String(n)}${ext}`;
      const path = folder === '' ? file : `${folder}/${file}`;
      if (!this.files.has(path)) return Promise.resolve(path);
    }
    return Promise.reject(new Error('no free name'));
  }

  linkTextFor(path: string, _fromPath: string): string {
    const name = basename(path);
    const sameName = [...this.files.keys()].filter((p) => basename(p) === name);
    return sameName.length <= 1 ? name : path;
  }
}

function joinLoose(folder: string, rel: string): string | null {
  const parts = folder === '' ? [] : folder.split('/');
  for (const segment of rel.split('/')) {
    if (segment === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else if (segment !== '.') {
      parts.push(segment);
    }
  }
  return parts.join('/');
}

/** A clock the test moves by hand. */
export class FakeClock {
  now = 0;
  private timers: { at: number; fn: () => void; id: number }[] = [];
  private next = 0;

  setTimeout = (fn: () => void, ms: number): (() => void) => {
    const id = this.next++;
    this.timers.push({ at: this.now + ms, fn, id });
    return () => {
      this.timers = this.timers.filter((t) => t.id !== id);
    };
  };

  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      const due = this.timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (due === undefined) break;
      this.timers = this.timers.filter((t) => t.id !== due.id);
      this.now = due.at;
      due.fn();
    }
    this.now = target;
  }
}

export interface Fakes {
  ports: Ports;
  vault: FakeVault;
  clock: FakeClock;
  notices: string[];
  errorPanes: { message: string; fix: string }[][];
  setScheme(scheme: 'light' | 'dark'): void;
  setPictureStorage(value: 'attachments' | 'embedded'): void;
}

export function fakes(): Fakes {
  const vault = new FakeVault();
  const clock = new FakeClock();
  const notices: string[] = [];
  const errorPanes: { message: string; fix: string }[][] = [];
  let scheme: 'light' | 'dark' = 'light';
  let storage: 'attachments' | 'embedded' = 'attachments';
  const themeHandlers = new Set<() => void>();
  const settingsHandlers = new Set<() => void>();
  const ports: Ports = {
    files: vault,
    clock,
    theme: {
      scheme: () => scheme,
      onChange: (h) => {
        themeHandlers.add(h);
        return () => themeHandlers.delete(h);
      },
    },
    settings: {
      pictureStorage: () => storage,
      onChange: (h) => {
        settingsHandlers.add(h);
        return () => settingsHandlers.delete(h);
      },
    },
    ui: {
      notice: (m) => notices.push(m),
      showErrorPane: (p) => errorPanes.push([...p]),
    },
  };
  return {
    ports,
    vault,
    clock,
    notices,
    errorPanes,
    setScheme(next) {
      scheme = next;
      for (const h of [...themeHandlers]) h();
    },
    setPictureStorage(next) {
      storage = next;
      for (const h of [...settingsHandlers]) h();
    },
  };
}
