/**
 * The deck view (070 R1): a `TextFileView` that shows the editor in a sandboxed frame and runs a
 * `HostSession` for the open file. Glue: file load, unload and rename come from the base class;
 * every protocol decision is the session's.
 */
import { TextFileView, type TFile, type WorkspaceLeaf } from 'obsidian';
import page from 'embed:single';

import { createFrame, type Frame } from './frame';
import { HostSession } from './host-session';
import { clock, notice, themeOf, vaultFiles, type SettingsHub } from './obsidian-ports';
import type { Ports } from './ports';

export const VIEW_TYPE = 'sododeck';

/** Opens the same file in the plain Markdown view and keeps the leaf there (US1: the escape). */
export const SOURCE_STATE_KEY = 'sododeckSource';

/** Timings in the developer console (`[sododeck]`), to see where opening a deck spends its time. */
function mark(label: string, since: number): void {
  console.debug(`[sododeck] ${label}: ${String(Math.round(performance.now() - since))} ms`);
}

export class DeckView extends TextFileView {
  private openedAt = 0;
  private frame: Frame | undefined;
  private session: HostSession | undefined;
  private errorEl: HTMLElement | undefined;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly settings: SettingsHub,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  override getDisplayText(): string {
    return this.file?.name.replace(/\.sododeck(?:\.md)?$/i, '') ?? 'Sododeck';
  }

  override getIcon(): string {
    return 'layout-dashboard';
  }

  getViewData(): string {
    return this.data;
  }

  setViewData(data: string, clear: boolean): void {
    if (clear) this.teardown();
    this.data = data;
    if (this.session === undefined) this.start(data);
    // The app reloads the file after any change to it; the session compares by content, so our
    // own writes and edits outside the owned region come back as nothing.
    else this.session.onFileText(data);
  }

  clear(): void {
    this.teardown();
    this.data = '';
  }

  private start(fileText: string): void {
    const file = this.file;
    if (file === null) return;
    this.openedAt = performance.now();
    this.contentEl.addClass('sododeck-view');
    const frame = createFrame(this.contentEl, page);
    mark('frame created', this.openedAt);
    this.frame = frame;
    const ports: Ports = {
      files: vaultFiles(this.app, (path, text) => this.writeOwn(path, text)),
      theme: themeOf(this.app),
      settings: this.settings,
      clock,
      ui: {
        notice,
        showErrorPane: (problems) => {
          this.showErrors(problems);
        },
      },
    };
    const sent = frame.transport.send.bind(frame.transport);
    const received = frame.transport.listen.bind(frame.transport);
    frame.transport.send = (message) => {
      if (message.type === 'init') mark('init sent', this.openedAt);
      sent(message);
    };
    frame.transport.listen = (handler) =>
      received((message) => {
        if (message.type === 'ready') mark('canvas ready', this.openedAt);
        handler(message);
      });
    this.session = new HostSession({
      path: file.path,
      fileText,
      transport: frame.transport,
      ports,
    });
    // `visibilitychange` and the app's quit: a phone may be backgrounded between two edits.
    const hide = (): void => {
      if (this.containerEl.ownerDocument.visibilityState === 'hidden') void this.session?.flush();
    };
    this.registerDomEvent(this.containerEl.ownerDocument, 'visibilitychange', hide);
    this.registerEvent(this.app.workspace.on('quit', () => void this.session?.flush()));
  }

  /** Writes the deck through the view, so the app's bookkeeping for the open file stays in step. */
  private async writeOwn(path: string, text: string): Promise<void> {
    if (this.file === null || this.file.path !== path) {
      throw new Error(`File not found: ${path}`);
    }
    this.data = text;
    await this.save();
  }

  private showErrors(problems: readonly { message: string; fix: string }[]): void {
    this.errorEl?.remove();
    this.errorEl = undefined;
    if (this.frame !== undefined)
      this.frame.element.style.display = problems.length > 0 ? 'none' : '';
    if (problems.length === 0) return;
    const el = this.contentEl.createDiv({ cls: 'sododeck-error' });
    el.createEl('h3', { text: 'This deck cannot be shown' });
    for (const problem of problems) {
      el.createEl('p', { text: problem.message });
      el.createEl('p', { text: problem.fix, cls: 'mod-muted' });
    }
    const button = el.createEl('button', { text: 'Open as Markdown' });
    button.addEventListener('click', () => {
      void this.openAsMarkdown();
    });
    this.errorEl = el;
  }

  async openAsMarkdown(): Promise<void> {
    const file = this.file;
    if (file === null) return;
    await this.leaf.setViewState({
      type: 'markdown',
      state: { file: file.path, [SOURCE_STATE_KEY]: true },
    });
  }

  override async onUnloadFile(_file: TFile): Promise<void> {
    await this.session?.close();
    this.teardown();
  }

  override async onClose(): Promise<void> {
    await this.session?.close();
    this.teardown();
  }

  private teardown(): void {
    this.session?.dispose();
    this.session = undefined;
    this.frame?.destroy();
    this.frame = undefined;
    this.errorEl?.remove();
    this.errorEl = undefined;
  }
}
