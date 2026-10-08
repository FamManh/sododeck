import { PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';

import type { PictureStorage } from './ports';
import { PICTURE_STORAGE_LABELS } from './settings';

export interface SettingsOwner extends Plugin {
  settings: { pictureStorage: PictureStorage };
  saveSettings(): Promise<void>;
}

export class SododeckSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly owner: SettingsOwner,
  ) {
    super(app, owner);
  }

  override display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName('Save new pictures')
      .setDesc(
        'Where pictures you add to a deck go. Files in the attachment folder stay linked when you move them; only deck notes (.sododeck.md) can do this.',
      )
      .addDropdown((dropdown) => {
        for (const [value, label] of Object.entries(PICTURE_STORAGE_LABELS)) {
          dropdown.addOption(value, label);
        }
        dropdown.setValue(this.owner.settings.pictureStorage).onChange(async (value) => {
          this.owner.settings.pictureStorage = value === 'embedded' ? 'embedded' : 'attachments';
          await this.owner.saveSettings();
        });
      });
  }
}
