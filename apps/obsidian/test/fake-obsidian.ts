/**
 * A minimal stand-in for the `obsidian` module, enough for the glue tests (070 T023): the real
 * package ships types only. Only what the glue touches is here.
 */
export const notices: string[] = [];

export class Notice {
  constructor(message: string) {
    notices.push(message);
  }
  hide(): void {}
}

export class TFile {
  extension: string;
  name: string;
  parent: TFolder | null = null;
  constructor(public path: string) {
    this.name = path.slice(path.lastIndexOf('/') + 1);
    this.extension = this.name.slice(this.name.lastIndexOf('.') + 1);
  }
}

export class TFolder {
  constructor(public path: string) {}
  isRoot(): boolean {
    return this.path === '/' || this.path === '';
  }
}

export class Plugin {
  constructor(public app: unknown) {}
  registerEvent(): void {}
  registerView(): void {}
  registerExtensions(): void {}
  addCommand(): void {}
  addSettingTab(): void {}
  loadData(): Promise<unknown> {
    return Promise.resolve(null);
  }
  saveData(): Promise<void> {
    return Promise.resolve();
  }
}

export class PluginSettingTab {
  containerEl = document.createElement('div');
  constructor(
    public app: unknown,
    public plugin: unknown,
  ) {}
}

export class Setting {
  constructor(public el: HTMLElement) {}
  setName(): this {
    return this;
  }
  setDesc(): this {
    return this;
  }
  addDropdown(): this {
    return this;
  }
}

type Handler = (...args: never[]) => unknown;

export class FakeApp {
  files = new Map<string, string>();
  handlers = new Map<string, Set<Handler>>();
  modifies: { path: string; text: string }[] = [];

  vault = {
    getFileByPath: (path: string): TFile | null => (this.files.has(path) ? new TFile(path) : null),
    getFolderByPath: (): null => null,
    read: (file: TFile): Promise<string> => Promise.resolve(this.files.get(file.path) ?? ''),
    cachedRead: (file: TFile): Promise<string> => Promise.resolve(this.files.get(file.path) ?? ''),
    modify: (file: TFile, text: string): Promise<void> => {
      this.modifies.push({ path: file.path, text });
      this.files.set(file.path, text);
      this.fire('modify', new TFile(file.path));
      return Promise.resolve();
    },
    on: (name: string, handler: Handler): { name: string; handler: Handler } => {
      const set = this.handlers.get(name) ?? new Set<Handler>();
      set.add(handler);
      this.handlers.set(name, set);
      return { name, handler };
    },
    offref: (ref: { name: string; handler: Handler }): void => {
      this.handlers.get(ref.name)?.delete(ref.handler);
    },
  };

  workspace = {
    on: (name: string, handler: Handler): { name: string; handler: Handler } => ({ name, handler }),
    offref: (): void => {},
  };

  metadataCache = {
    getFirstLinkpathDest: (): null => null,
    fileToLinktext: (file: TFile): string => file.name,
    getFileCache: (): null => null,
  };

  fileManager = {
    getAvailablePathForAttachment: (name: string): Promise<string> => Promise.resolve(name),
  };

  fire(name: string, ...args: unknown[]): void {
    for (const h of [...(this.handlers.get(name) ?? [])]) (h as (...a: unknown[]) => void)(...args);
  }
}

function extendElements(): void {
  if (typeof HTMLElement === 'undefined') return;
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.addClass = function (this: HTMLElement, c: string) {
    this.classList.add(c);
  };
  proto.createDiv = function (this: HTMLElement, o?: { cls?: string }) {
    const el = document.createElement('div');
    if (o?.cls) el.className = o.cls;
    this.append(el);
    return el;
  };
  proto.createEl = function (this: HTMLElement, tag: string, o?: { text?: string; cls?: string }) {
    const el = document.createElement(tag);
    if (o?.text) el.textContent = o.text;
    if (o?.cls) el.className = o.cls;
    this.append(el);
    return el;
  };
  proto.empty = function (this: HTMLElement) {
    this.replaceChildren();
  };
}
extendElements();

export class TextFileView {
  data = '';
  file: TFile | null = null;
  containerEl = document.createElement('div');
  contentEl = this.containerEl.createDiv();
  leaf: unknown;
  constructor(leaf: { app?: unknown } & Record<string, unknown>) {
    this.leaf = leaf;
    document.body.append(this.containerEl);
  }
  get app(): FakeApp {
    return (this.leaf as { app: FakeApp }).app;
  }
  async save(): Promise<void> {
    if (this.file === null) return;
    await this.app.vault.modify(this.file, this.getViewData());
  }
  getViewData(): string {
    return this.data;
  }
  registerDomEvent(el: EventTarget, type: string, fn: EventListener): void {
    el.addEventListener(type, fn);
  }
  registerEvent(): void {}
  async onUnloadFile(): Promise<void> {}
  async onClose(): Promise<void> {}
}

export function normalizePath(path: string): string {
  return path;
}
