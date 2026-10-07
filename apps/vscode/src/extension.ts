import * as vscode from 'vscode';

import { newDeck, openInWeb } from './commands';
import { DeckEditorProvider, VIEW_TYPE } from './deck-editor-provider';
import { activeDeck, createPorts, openAsText } from './vscode-ports';

export function activate(context: vscode.ExtensionContext): void {
  const ports = createPorts();
  const provider = new DeckEditorProvider(context, ports);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: false },
      supportsMultipleEditorsPerDocument: false,
    }),
    vscode.commands.registerCommand('sododeck.newDeck', (folder?: vscode.Uri) =>
      newDeck(ports, folder?.toString()),
    ),
    vscode.commands.registerCommand('sododeck.openInWeb', () =>
      openInWeb(ports, activeDeck()?.toString()),
    ),
    vscode.commands.registerCommand('sododeck.openAsText', async () => {
      const deck = activeDeck();
      if (deck !== undefined) await openAsText(deck.toString());
    }),
  );
}

export function deactivate(): void {}
