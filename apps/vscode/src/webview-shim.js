/* global acquireVsCodeApi */
// Two small jobs so the embedded editor runs unchanged inside a webview (R4, R5):
// 1. present the webview's channel to the editor as its parent window;
// 2. let it start workers from the extension's own files. A webview page cannot construct a
//    worker from the resource origin, so the script is read from there and run from a blob.
// No message is read, changed or stored. Loaded first, before the editor's script.

// Self-contained on purpose: its source text is also put in front of every worker it starts, so
// workers that start workers (the layout engine) get the same treatment. Do not close over names.
function installWorkerLoader(scope) {
  var Native = scope.Worker;
  if (typeof Native !== 'function') return;
  function Wrapped(url, options) {
    var target = new scope.URL(String(url), scope.location.href);
    var same =
      target.protocol === 'blob:' ||
      target.protocol === 'data:' ||
      target.protocol + '//' + target.host === scope.location.protocol + '//' + scope.location.host;
    if (same) return new Native(url, options);
    var request = new scope.XMLHttpRequest();
    request.open('GET', target.href, false);
    request.send();
    if (request.status !== 200 && request.status !== 0) {
      throw new Error('Could not load the worker script ' + target.href);
    }
    // `import.meta.url` of a blob script is the blob; the script means its own real location.
    var body = request.responseText.split('import.meta.url').join(JSON.stringify(target.href));
    var source = '(' + installWorkerLoader.toString() + ')(self);\n' + body;
    var blob = new scope.Blob([source], { type: 'text/javascript' });
    return new Native(scope.URL.createObjectURL(blob), options);
  }
  Wrapped.prototype = Native.prototype;
  scope.Worker = Wrapped;
}

(function () {
  const vscode = acquireVsCodeApi();
  const fakeParent = {
    postMessage: function (message) {
      vscode.postMessage(message);
    },
  };
  Object.defineProperty(window, 'parent', { value: fakeParent, configurable: true });
  installWorkerLoader(window);

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
