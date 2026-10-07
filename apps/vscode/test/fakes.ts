/* eslint-disable @typescript-eslint/require-await -- the fakes implement async ports over memory */
import type {
  ClockPort,
  Disposable,
  FilePort,
  Loc,
  Ports,
  PicturesStorage,
  Scheme,
  UiPort,
} from '../src/ports';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const text = (bytes: Uint8Array): string => decoder.decode(bytes);

/** Resolves `..` lexically in a `scheme:///a/b` style location. */
function normalize(loc: Loc): Loc {
  const match = /^([a-z][a-z0-9+.-]*:\/\/)(.*)$/i.exec(loc);
  const prefix = match?.[1] ?? '';
  const rest = match?.[2] ?? loc;
  const out: string[] = [];
  for (const part of rest.split('/')) {
    if (part === '..') out.pop();
    else if (part !== '.') out.push(part);
  }
  return prefix + out.join('/');
}

/** In-memory file system with links, failures and a write log. */
export class FakeFiles implements FilePort {
  readonly data = new Map<Loc, Uint8Array>();
  readonly links = new Map<Loc, Loc>();
  readonly folders = new Set<Loc>();
  readonly writes: { loc: Loc; text: string }[] = [];
  readonly renames: { from: Loc; to: Loc }[] = [];
  failWrites = new Set<Loc>();
  failRenames = false;
  caseInsensitive = false;

  set(loc: Loc, content: string | Uint8Array): void {
    this.data.set(normalize(loc), typeof content === 'string' ? encoder.encode(content) : content);
  }

  get(loc: Loc): string | undefined {
    const bytes = this.data.get(normalize(loc));
    return bytes === undefined ? undefined : text(bytes);
  }

  /** The location with links followed on every folder level. */
  private resolve(loc: Loc): Loc {
    const match = /^([a-z][a-z0-9+.-]*:\/\/)(.*)$/i.exec(normalize(loc));
    const prefix = match?.[1] ?? '';
    const parts = (match?.[2] ?? loc).split('/');
    let current = prefix;
    for (const [i, part] of parts.entries()) {
      current = i === 0 ? prefix + part : `${current}/${part}`;
      for (let hops = 0; hops < 20; hops++) {
        const target = this.links.get(current);
        if (target === undefined) break;
        current = normalize(target);
      }
    }
    return current;
  }

  async read(loc: Loc): Promise<Uint8Array> {
    const bytes = this.data.get(this.resolve(loc));
    if (bytes === undefined) throw new Error(`ENOENT ${loc}`);
    return bytes.slice();
  }

  async size(loc: Loc): Promise<number> {
    const bytes = this.data.get(this.resolve(loc));
    if (bytes === undefined) throw new Error(`ENOENT ${loc}`);
    return bytes.length;
  }

  async write(loc: Loc, bytes: Uint8Array): Promise<void> {
    const target = this.resolve(loc);
    if (this.failWrites.has(target) || this.failWrites.has(normalize(loc))) {
      throw new Error(`EACCES ${loc}`);
    }
    this.data.set(target, bytes.slice());
    this.writes.push({ loc: normalize(loc), text: text(bytes) });
  }

  async mkdir(loc: Loc): Promise<void> {
    this.folders.add(normalize(loc));
  }

  async exists(loc: Loc): Promise<boolean> {
    const target = this.resolve(loc);
    if (this.data.has(target) || this.folders.has(target)) return true;
    return [...this.data.keys(), ...this.folders].some((key) => key.startsWith(`${target}/`));
  }

  async rename(from: Loc, to: Loc): Promise<void> {
    if (this.failRenames) throw new Error('EXDEV');
    const bytes = this.data.get(normalize(from));
    if (bytes === undefined) throw new Error(`ENOENT ${from}`);
    this.data.delete(normalize(from));
    this.data.set(normalize(to), bytes);
    this.renames.push({ from: normalize(from), to: normalize(to) });
  }

  async remove(loc: Loc): Promise<void> {
    this.data.delete(normalize(loc));
  }

  async isSymlink(loc: Loc): Promise<boolean> {
    return this.links.has(normalize(loc));
  }

  async realpath(loc: Loc): Promise<Loc> {
    const real = this.resolve(loc);
    return this.caseInsensitive ? real.toLowerCase() : real;
  }

  scheme(loc: Loc): string {
    return /^([a-z][a-z0-9+.-]*):/i.exec(loc)?.[1]?.toLowerCase() ?? 'file';
  }

  dirname(loc: Loc): Loc {
    const i = loc.lastIndexOf('/');
    return i < 0 ? loc : loc.slice(0, i);
  }

  basename(loc: Loc): string {
    return loc.slice(loc.lastIndexOf('/') + 1);
  }

  join(loc: Loc, rel: string): Loc {
    return normalize(`${loc}/${rel}`);
  }
}

export class FakeClock implements ClockPort {
  now = 0;
  private timers: { at: number; fn: () => void; id: number }[] = [];
  private next = 0;

  setTimeout(fn: () => void, ms: number): () => void {
    const id = this.next++;
    this.timers.push({ at: this.now + ms, fn, id });
    return () => {
      this.timers = this.timers.filter((t) => t.id !== id);
    };
  }

  /** Moves time forward, running due timers in order. */
  advance(ms: number): void {
    const end = this.now + ms;
    for (;;) {
      const due = this.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id);
      const first = due[0];
      if (first === undefined) break;
      this.timers = this.timers.filter((t) => t.id !== first.id);
      this.now = first.at;
      first.fn();
    }
    this.now = end;
  }

  get pending(): number {
    return this.timers.length;
  }
}

class Emitter implements Disposable {
  private handlers = new Set<() => void>();
  on(handler: () => void): Disposable {
    this.handlers.add(handler);
    return { dispose: () => this.handlers.delete(handler) };
  }
  fire(): void {
    for (const h of [...this.handlers]) h();
  }
  dispose(): void {
    this.handlers.clear();
  }
}

export class FakeUi implements UiPort {
  notices: string[] = [];
  warnings: string[] = [];
  openAsText: Loc[] = [];
  status: string[] = [];
  external: string[] = [];
  opened: Loc[] = [];
  revealed: Loc[] = [];
  saveDialogs: { name: string; folder: Loc | undefined }[] = [];
  saveChoice: Loc | undefined;

  notify(message: string): void {
    this.notices.push(message);
  }
  warn(message: string): void {
    this.warnings.push(message);
  }
  offerOpenAsText(deck: Loc): void {
    this.openAsText.push(deck);
  }
  statusMessage(message: string): void {
    this.status.push(message);
  }
  async showSaveDialog(name: string, folder: Loc | undefined): Promise<Loc | undefined> {
    this.saveDialogs.push({ name, folder });
    return this.saveChoice;
  }
  async openExternal(url: string): Promise<void> {
    this.external.push(url);
  }
  async openUri(loc: Loc): Promise<void> {
    this.opened.push(loc);
  }
  async revealInOs(loc: Loc): Promise<void> {
    this.revealed.push(loc);
  }
}

export interface Fakes extends Ports {
  files: FakeFiles;
  clock: FakeClock;
  ui: FakeUi;
  /** Controls. */
  control: {
    scheme: Scheme;
    storage: PicturesStorage;
    trusted: boolean;
    folders: Loc[];
    fireTheme(): void;
    fireSettings(): void;
    fireGrant(): void;
    fireFile(loc: Loc): void;
  };
}

export function makeFakes(over: Partial<Fakes['control']> = {}): Fakes {
  const files = new FakeFiles();
  const clock = new FakeClock();
  const ui = new FakeUi();
  const theme = new Emitter();
  const settings = new Emitter();
  const grant = new Emitter();
  const watchers = new Map<Loc, Set<() => void>>();
  const control: Fakes['control'] = {
    scheme: 'light',
    storage: 'embed',
    trusted: true,
    folders: ['file:///ws'],
    fireTheme: () => {
      theme.fire();
    },
    fireSettings: () => {
      settings.fire();
    },
    fireGrant: () => {
      grant.fire();
    },
    fireFile: (loc) => {
      for (const h of [...(watchers.get(loc) ?? [])]) h();
    },
    ...over,
  };
  return {
    files,
    clock,
    ui,
    control,
    watch: {
      watch(loc, onEvent) {
        const set = watchers.get(loc) ?? new Set<() => void>();
        set.add(onEvent);
        watchers.set(loc, set);
        return { dispose: () => set.delete(onEvent) };
      },
    },
    theme: { scheme: () => control.scheme, onChange: (h) => theme.on(h) },
    settings: { picturesStorage: () => control.storage, onChange: (h) => settings.on(h) },
    trust: { isTrusted: () => control.trusted, onDidGrant: (h) => grant.on(h) },
    workspace: { folders: () => control.folders },
  };
}
