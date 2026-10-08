/**
 * The custom editor (R1): VS Code's open, save, save as, revert and backup, forwarded to the
 * VS Code-free modules. Glue only; the decisions live in `document-ops`, `save-as`, `disk-sync`
 * and `host-session`.
 */
import * as vscode from 'vscode';

import type { EditorMessage, HostMessage, Transport } from '@sododeck/host-protocol';

import type { DeckDocument } from './deck-document';
import { DiskSync } from './disk-sync';
import { describeProblems } from './file-codec';
import { backupDocument, openDocument, revertDocument, saveDocument } from './document-ops';
import { HostSession } from './host-session';
import type { Ports } from './ports';
import { saveDocumentAs } from './save-as';
import { buildWebviewPage, makeNonce, messagePage } from './webview-html';

/**
 * Two view types, one provider: VS Code takes `priority` per contribution, and a note must be an
 * option (R3) while `.sododeck` stays the default.
 */
export const VIEW_TYPE = 'sododeck.canvas';
export const NOTE_VIEW_TYPE = 'sododeck.note';

class DeckHandle implements vscode.CustomDocument {
  session: HostSession | null = null;
  sync: DiskSync | null = null;

  constructor(
    readonly uri: vscode.Uri,
    readonly doc: DeckDocument,
  ) {}

  dispose(): void {
    this.sync?.dispose();
    this.session?.dispose();
  }
}

export class DeckEditorProvider implements vscode.CustomEditorProvider<DeckHandle> {
  private readonly changed = new vscode.EventEmitter<
    vscode.CustomDocumentContentChangeEvent<DeckHandle>
  >();
  readonly onDidChangeCustomDocument = this.changed.event;
  private readonly handles = new Set<DeckHandle>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly ports: Ports,
  ) {
    context.subscriptions.push(
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) this.recheckAll();
      }),
      vscode.workspace.onDidRenameFiles((event) => {
        for (const { oldUri, newUri } of event.files) {
          for (const handle of this.handles) {
            if (handle.doc.loc !== oldUri.toString()) continue;
            handle.doc.loc = newUri.toString();
            handle.sync?.watch();
          }
        }
      }),
    );
  }

  private recheckAll(): void {
    for (const handle of this.handles) void handle.sync?.recheck();
  }

  async openCustomDocument(
    uri: vscode.Uri,
    context: vscode.CustomDocumentOpenContext,
  ): Promise<DeckHandle> {
    const doc = await openDocument(this.ports.files, uri.toString(), context.backupId);
    const handle = new DeckHandle(uri, doc);
    this.handles.add(handle);
    handle.sync = new DiskSync({
      doc,
      ports: this.ports,
      session: () => handle.session,
      onContentChange: () => {
        this.changed.fire({ document: handle });
      },
      // R3 / spike S1: VS Code clears the changed mark on revert. Unverified against a real
      // editor; if it fails the mark stays until the next save, and the canvas already matches.
      clearMark: async () => {
        try {
          await vscode.commands.executeCommand('workbench.action.files.revert', uri);
        } catch {
          // Fallback of R3: leave the mark.
        }
      },
    });
    handle.sync.watch();
    return handle;
  }

  async resolveCustomEditor(handle: DeckHandle, panel: vscode.WebviewPanel): Promise<void> {
    const { webview } = panel;
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    webview.options = { enableScripts: true, localResourceRoots: [media] };

    if (handle.doc.problems !== null) {
      // FR-012: an unreadable note is explained and left alone; no canvas, no session.
      webview.html = messagePage(describeProblems(handle.doc.problems), webview.cspSource);
      this.ports.ui.offerOpenAsText(handle.doc.loc);
      return;
    }

    if (handle.session !== null) {
      // FR-027: one canvas per file.
      webview.html = messagePage('This deck is already open in another tab.', webview.cspSource);
      return;
    }

    const embedFolder = vscode.Uri.joinPath(media, 'embed');
    const embedHtml = new TextDecoder().decode(
      await vscode.workspace.fs.readFile(vscode.Uri.joinPath(embedFolder, 'embed.html')),
    );
    webview.html = buildWebviewPage({
      embedHtml,
      toWebviewUri: (rel) =>
        webview.asWebviewUri(vscode.Uri.joinPath(embedFolder, ...rel.split('/'))).toString(),
      shimUri: webview.asWebviewUri(vscode.Uri.joinPath(media, 'webview-shim.js')).toString(),
      workersUri: webview.asWebviewUri(vscode.Uri.joinPath(media, 'workers.js')).toString(),
      cspSource: webview.cspSource,
      nonce: makeNonce(),
    });

    const transport: Transport<HostMessage, EditorMessage> = {
      send: (message) => {
        void webview.postMessage(message);
      },
      listen: (handler) => {
        const sub = webview.onDidReceiveMessage((message: EditorMessage) => {
          handler(message);
        });
        return () => {
          sub.dispose();
        };
      },
    };
    const session = new HostSession({
      doc: handle.doc,
      transport,
      ports: this.ports,
      onContentChange: () => {
        this.changed.fire({ document: handle });
      },
    });
    handle.session = session;

    panel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible) void handle.sync?.recheck();
    });
    panel.onDidDispose(() => {
      session.dispose();
      if (handle.session === session) handle.session = null;
    });
  }

  async saveCustomDocument(handle: DeckHandle): Promise<void> {
    await saveDocument(this.ports.files, handle.doc, handle.session);
  }

  async saveCustomDocumentAs(handle: DeckHandle, destination: vscode.Uri): Promise<void> {
    await saveDocumentAs(handle.doc, handle.session, destination.toString(), this.ports);
  }

  async revertCustomDocument(handle: DeckHandle): Promise<void> {
    await revertDocument(this.ports.files, handle.doc, handle.session);
  }

  async backupCustomDocument(
    handle: DeckHandle,
    context: vscode.CustomDocumentBackupContext,
  ): Promise<vscode.CustomDocumentBackup> {
    await backupDocument(this.ports.files, handle.doc, context.destination.toString());
    return {
      id: context.destination.toString(),
      delete: () => {
        void vscode.workspace.fs.delete(context.destination);
      },
    };
  }
}
