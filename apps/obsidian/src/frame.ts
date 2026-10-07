/**
 * The sandboxed frame that shows the editor (070 contracts/obsidian-host.md, "The frame"). Glue over
 * the DOM; the only code that creates the `iframe`.
 *
 * `sandbox="allow-scripts"` gives the page an opaque origin: no access to the app's storage, DOM or
 * cookies. The page's own Content-Security-Policy forbids the network. Messages are accepted only
 * from this frame's window and only when they parse as editor messages (067 rule 3).
 */
import {
  parseEditorMessage,
  type EditorMessage,
  type HostMessage,
  type Transport,
} from '@sododeck/host-protocol';

export interface Frame {
  transport: Transport<HostMessage, EditorMessage>;
  element: HTMLIFrameElement;
  destroy(): void;
}

export function createFrame(container: HTMLElement, html: string): Frame {
  const element = container.ownerDocument.createElement('iframe');
  element.className = 'sododeck-frame';
  element.title = 'Sododeck canvas';
  element.setAttribute('sandbox', 'allow-scripts');
  element.srcdoc = html;
  container.append(element);

  const win = container.ownerDocument.defaultView;
  const listeners = new Set<(event: Event) => void>();
  const transport: Transport<HostMessage, EditorMessage> = {
    send(message) {
      // The frame's origin is opaque, so no more specific target origin exists.
      element.contentWindow?.postMessage(message, '*');
    },
    listen(handler) {
      const onMessage = (event: Event): void => {
        const e = event as MessageEvent;
        if (e.source === null || e.source !== element.contentWindow) return;
        const message = parseEditorMessage(e.data);
        if (message === null) return;
        handler(message);
      };
      listeners.add(onMessage);
      win?.addEventListener('message', onMessage);
      return () => {
        listeners.delete(onMessage);
        win?.removeEventListener('message', onMessage);
      };
    },
  };
  return {
    transport,
    element,
    destroy() {
      for (const l of listeners) win?.removeEventListener('message', l);
      listeners.clear();
      element.remove();
    },
  };
}
