/* global acquireVsCodeApi */
// Presents the webview's own channel to the embedded editor as its parent window (R4), so the
// editor's `parentWindowTransport` runs unchanged. Nothing else happens here: no message is
// read, changed or stored. Loaded first, before the editor's script.
(function () {
  const vscode = acquireVsCodeApi();
  const fakeParent = {
    postMessage: function (message) {
      vscode.postMessage(message);
    },
  };
  Object.defineProperty(window, 'parent', { value: fakeParent, configurable: true });

  const own = new WeakSet();
  // Capture phase and first: a message from the extension host arrives with the VS Code frame
  // as its source, which the editor would refuse. Stop it and re-dispatch it from "the parent".
  window.addEventListener(
    'message',
    function (event) {
      if (own.has(event)) return;
      event.stopImmediatePropagation();
      // `source` only accepts a window or a port in the constructor, so it is set afterwards.
      const relayed = new MessageEvent('message', { data: event.data, origin: event.origin });
      Object.defineProperty(relayed, 'source', { value: fakeParent });
      own.add(relayed);
      window.dispatchEvent(relayed);
    },
    true,
  );
})();
