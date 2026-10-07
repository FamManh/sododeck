import {
  parseEditorMessage,
  parseHostMessage,
  type EditorMessage,
  type HostMessage,
} from './messages';

export interface Transport<Out, In> {
  send(message: Out): void;
  listen(handler: (message: In) => void): () => void;
}

/** One direction of the in-memory pair: handlers get a clone, in a microtask. */
function channel<T>() {
  const handlers = new Set<(m: T) => void>();
  return {
    post(message: T) {
      const copy = structuredClone(message);
      queueMicrotask(() => {
        for (const h of [...handlers]) h(copy);
      });
    },
    listen(handler: (m: T) => void) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}

/** In-memory pair for tests: delivery is asynchronous (microtask) and by structured clone. */
export function memoryTransportPair(): {
  editor: Transport<EditorMessage, HostMessage>;
  host: Transport<HostMessage, EditorMessage>;
} {
  const toHost = channel<EditorMessage>();
  const toEditor = channel<HostMessage>();
  return {
    editor: {
      send: (m) => {
        toHost.post(m);
      },
      listen: (h) => toEditor.listen(h),
    },
    host: {
      send: (m) => {
        toEditor.post(m);
      },
      listen: (h) => toHost.listen(h),
    },
  };
}

/**
 * Editor side: posts to the parent window, accepts only `event.source === parent` and pins the
 * target origin to the origin of the first valid `init` (before it only `ready` goes out).
 */
export function parentWindowTransport(win: Window = window): Transport<EditorMessage, HostMessage> {
  let origin: string | null = null;
  return {
    send(message) {
      if (origin === null) {
        if (message.type !== 'ready') {
          console.warn(`Dropped "${message.type}": the host has not sent init yet.`);
          return;
        }
        win.parent.postMessage(message, '*');
        return;
      }
      win.parent.postMessage(message, origin);
    },
    listen(handler) {
      const onMessage = (event: Event) => {
        const e = event as MessageEvent;
        if (e.source !== win.parent) return;
        const message = parseHostMessage(e.data);
        if (message === null) {
          console.warn('Ignored a message the editor does not understand.');
          return;
        }
        if (origin === null && message.type === 'init') origin = e.origin;
        handler(message);
      };
      win.addEventListener('message', onMessage);
      return () => {
        win.removeEventListener('message', onMessage);
      };
    },
  };
}

/** Host side: posts to an iframe's window, accepts only `event.source === frame.contentWindow`. */
export function frameTransport(
  frame: HTMLIFrameElement,
  origin: string,
): Transport<HostMessage, EditorMessage> {
  return {
    send(message) {
      frame.contentWindow?.postMessage(message, origin);
    },
    listen(handler) {
      const onMessage = (event: MessageEvent) => {
        if (event.source === null || event.source !== frame.contentWindow) return;
        const message = parseEditorMessage(event.data);
        if (message === null) {
          console.warn('Ignored a message the host does not understand.');
          return;
        }
        handler(message);
      };
      window.addEventListener('message', onMessage);
      return () => {
        window.removeEventListener('message', onMessage);
      };
    },
  };
}
