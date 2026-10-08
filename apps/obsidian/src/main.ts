/**
 * The Sododeck plugin for Obsidian (070): registers the deck view for `.sododeck` files and, by a
 * view swap on the front matter marker, for `.sododeck.md` notes. Glue only.
 */
import { Notice, Plugin, SuggestModal, TFolder, type App } from 'obsidian';

import { copyAsSododeck, createNewDeck, deckJsonFiles } from './commands';
import { DeckView, SOURCE_STATE_KEY, VIEW_TYPE } from './deck-view';
import { deckViewOf, registerSwap } from './md-swap';
import { SettingsHub } from './obsidian-ports';
import { readSettings, type SododeckSettings } from './settings';
import { SododeckSettingTab } from './settings-tab';

/** Picker over the vault's `.sododeck.json` files (Obsidian's own file list hides `.json`). */
class DeckJsonModal extends SuggestModal<string> {
  constructor(
    app: App,
    private readonly paths: string[],
    private readonly onPick: (path: string) => void,
  ) {
    super(app);
    this.setPlaceholder('Choose a .sododeck.json file to copy');
  }

  override getSuggestions(query: string): string[] {
    const q = query.toLowerCase();
    return this.paths.filter((p) => p.toLowerCase().includes(q));
  }

  override renderSuggestion(path: string, el: HTMLElement): void {
    el.setText(path);
  }

  override onChooseSuggestion(path: string): void {
    this.onPick(path);
  }
}

export default class SododeckPlugin extends Plugin {
  override settings: SododeckSettings = readSettings(undefined);
  private readonly hub = new SettingsHub(() => this.settings.pictureStorage);

  override async onload(): Promise<void> {
    this.settings = readSettings(await this.loadData());
    this.registerView(VIEW_TYPE, (leaf) => new DeckView(leaf, this.hub));
    this.registerExtensions(['sododeck'], VIEW_TYPE);
    this.addSettingTab(new SododeckSettingTab(this.app, this));
    registerSwap(this);

    this.addCommand({
      id: 'new-deck',
      name: 'New deck',
      callback: () => {
        const active = this.app.workspace.getActiveFile();
        void this.newDeck(active?.parent?.path === '/' ? '' : (active?.parent?.path ?? ''));
      },
    });
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFolder)) return;
        menu.addItem((item) => {
          item
            .setTitle('New Sododeck')
            .setIcon('layout-dashboard')
            .onClick(() => {
              void this.newDeck(file.isRoot() ? '' : file.path);
            });
        });
      }),
    );
    this.addCommand({
      id: 'copy-json-as-deck',
      name: 'Copy JSON deck as a deck file',
      callback: () => {
        const paths = deckJsonFiles(this.app.vault.getFiles().map((f) => f.path));
        if (paths.length === 0) {
          new Notice('No .sododeck.json files in this vault.');
          return;
        }
        new DeckJsonModal(this.app, paths, (path) => {
          void this.copyDeck(path);
        }).open();
      },
    });
    this.addCommand({
      id: 'open-as-markdown',
      name: 'Open this deck as Markdown',
      checkCallback: (checking) => {
        const view = deckViewOf(this.app.workspace.getMostRecentLeaf());
        if (view === null || view.file?.extension !== 'md') return false;
        if (!checking) void view.openAsMarkdown();
        return true;
      },
    });
    this.addCommand({
      id: 'open-as-canvas',
      name: 'Open this deck as canvas',
      checkCallback: (checking) => {
        const leaf = this.app.workspace.getMostRecentLeaf();
        const file = this.app.workspace.getActiveFile();
        if (leaf === null || file === null || leaf.view.getViewType() !== 'markdown') return false;
        if (
          this.app.metadataCache.getFileCache(file)?.frontmatter?.['sododeck-plugin'] !== 'parsed'
        ) {
          return false;
        }
        if (!checking) {
          void leaf.setViewState({ type: VIEW_TYPE, state: { file: file.path } });
        }
        return true;
      },
    });
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.hub.notify();
  }

  private async copyDeck(source: string): Promise<void> {
    const result = await copyAsSododeck(
      {
        readText: (p) => this.app.vault.adapter.read(p),
        exists: (p) => this.app.vault.getFileByPath(p) !== null,
        createText: async (p, text) => {
          await this.app.vault.create(p, text);
        },
      },
      source,
    );
    if (!result.ok) {
      new Notice(`Could not copy: ${result.reason}.`);
      return;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE, state: { file: result.path }, active: true });
  }

  private async newDeck(folder: string): Promise<void> {
    const path = await createNewDeck(
      {
        exists: (p) => this.app.vault.getFileByPath(p) !== null,
        createText: async (p, text) => {
          await this.app.vault.create(p, text);
        },
      },
      folder,
    );
    const leaf = this.app.workspace.getLeaf(true);
    // Straight to the deck view: the marker may not be in the metadata cache yet (S5).
    await leaf.setViewState({ type: VIEW_TYPE, state: { file: path }, active: true });
  }
}

export { SOURCE_STATE_KEY };
