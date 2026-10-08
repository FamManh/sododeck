/**
 * Stands in for `@monaco-editor/loader` in the embed build. The real loader can inject a
 * `<script>` that fetches Monaco from a CDN; here Monaco is already bundled and handed over with
 * `loader.config({ monaco })` (see `editor/monaco-setup.ts`), so none of that is needed. Hosts that
 * review code (Obsidian) reject dynamic script injection even when the path is never taken.
 *
 * Covers only what `@monaco-editor/react` calls: `config`, `init` (a cancelable promise) and
 * `__getMonacoInstance`.
 */
interface Cancelable<T> extends Promise<T> {
  cancel(): void;
}

let instance: unknown = null;

export default {
  config(options: { monaco?: unknown }): void {
    if (options.monaco !== undefined) instance = options.monaco;
  },
  init(): Cancelable<unknown> {
    const ready: Promise<unknown> =
      instance === null
        ? Promise.reject(new Error('Monaco was not configured: call loader.config({ monaco }).'))
        : Promise.resolve(instance);
    return Object.assign(ready, { cancel: () => undefined });
  },
  __getMonacoInstance(): unknown {
    return instance;
  },
};
