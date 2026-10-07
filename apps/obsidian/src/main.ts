/**
 * The Sododeck plugin for Obsidian (070): registers the deck view for `.sododeck` files and, by a
 * view swap on the front matter marker, for `.sododeck.md` notes. Glue only.
 */
import { Plugin, TFolder } from 'obsidian';

import { createNewDeck } from './commands';
import { DeckView, SOURCE_STATE_KEY, VIEW_TYPE } from './deck-view';
import { deckViewOf, registerSwap } from './md-swap';
import { SettingsHub } from './obsidian-ports';
import { readSettings, type SododeckSettings } from './settings';
import { SododeckSettingTab } from './settings-tab';

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
      name: 'New Sododeck',
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
