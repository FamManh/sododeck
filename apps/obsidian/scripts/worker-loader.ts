/**
 * Starts the embed's workers inside a sandboxed `srcdoc` frame (070 R3). The frame has no file URL
 * to start a worker from, and a script cannot be fetched (the policy allows no network), so the
 * build puts every worker's source into `window.__sododeckWorkers` (by file name) and this wrapper
 * starts a worker from a blob made of that source. Same idea as the VS Code host's shim.
 *
 * `WORKER_LOADER_SOURCE` is self-contained on purpose: its text is also put in front of every
 * worker it starts, so workers that start workers (the layout engine) get the same treatment.
 */
export const WORKER_LOADER_SOURCE = `function installWorkerLoader(scope) {
  var Native = scope.Worker;
  if (typeof Native !== 'function') return;
  function Wrapped(url, options) {
    var target = new scope.URL(String(url), scope.location.href);
    // A worker the page already made from a blob or data URL needs no help.
    if (target.protocol === 'blob:' || target.protocol === 'data:') return new Native(url, options);
    var name = decodeURIComponent(target.pathname.split('/').pop());
    var sources = scope.__sododeckWorkers || {};
    if (typeof sources[name] !== 'string') {
      throw new Error('Could not find the worker script ' + name);
    }
    var nested = {};
    for (var key in sources) {
      if (key !== name && sources[name].indexOf(key) !== -1) nested[key] = sources[key];
    }
    var source =
      '(' + installWorkerLoader.toString() + ')(self);\\n' +
      'self.__sododeckWorkers = ' + JSON.stringify(nested) + ';\\n' +
      sources[name];
    var blob = new scope.Blob([source], { type: 'text/javascript' });
    // The sources are classic scripts (bundled as such), and a module worker cannot start from a
    // blob inside a sandboxed frame, so the worker is always classic.
    var classic = {};
    for (var option in options || {}) if (option !== 'type') classic[option] = options[option];
    return new Native(scope.URL.createObjectURL(blob), classic);
  }
  Wrapped.prototype = Native.prototype;
  scope.Worker = Wrapped;
}`;

/** The base every `new URL(file, import.meta.url)` resolves against inside the bundle. */
export const FAKE_BASE = 'https://sododeck.invalid/assets/';
