import * as vscode from 'vscode';

import { copyAsSododeck, newDeck, newNote, openInWeb } from './commands';
import { DeckEditorProvider, NOTE_VIEW_TYPE, VIEW_TYPE } from './deck-editor-provider';
import { activeDeck, createPorts, openAsText, registerNoteSwap } from './vscode-ports';

export function activate(context: vscode.ExtensionContext): void {
  const ports = createPorts();
  const provider = new DeckEditorProvider(context, ports);
  const editorOptions = {
    webviewOptions: { retainContextWhenHidden: false },
    supportsMultipleEditorsPerDocument: false,
  };
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, editorOptions),
    vscode.window.registerCustomEditorProvider(NOTE_VIEW_TYPE, provider, editorOptions),
    registerNoteSwap(NOTE_VIEW_TYPE),
    vscode.commands.registerCommand('sododeck.newNote', (folder?: vscode.Uri) =>
      newNote(ports, folder?.toString()),
    ),
    vscode.commands.registerCommand('sododeck.copyAsSododeck', (source?: vscode.Uri) =>
      source === undefined ? undefined : copyAsSododeck(ports, source.toString()),
    ),
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
