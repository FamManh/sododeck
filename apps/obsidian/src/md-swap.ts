/**
 * Telling a deck note from any other note, and swapping its view (070 R2). A note is an ordinary
 * Markdown file to the app, so the Markdown view opens first and this module turns it into the deck
 * view when the front matter carries the marker. A leaf the user sent to the Markdown view on
 * purpose (`sododeckSource`) is left alone; removing the marker returns the leaf to Markdown.
 */
import { isDeckMarkdown } from '@sododeck/model';
import { WorkspaceLeaf, type Plugin, type TFile, type ViewState } from 'obsidian';

import { DeckView, SOURCE_STATE_KEY, VIEW_TYPE } from './deck-view';

export interface SwapFacts {
  viewType: string;
  /** The file's extension, or null for a leaf with no file. */
  extension: string | null;
  hasMarker: boolean;
  leafState: Record<string, unknown>;
}

/** A Markdown view of a deck note becomes the deck view, unless the user chose the Markdown view. */
export function shouldSwap(f: SwapFacts): boolean {
  return (
    f.viewType === 'markdown' &&
    f.extension === 'md' &&
    f.hasMarker &&
    f.leafState[SOURCE_STATE_KEY] !== true
  );
}

/** A deck view of a note that lost its marker is a Markdown view again. */
export function shouldSwapBack(
  f: Pick<SwapFacts, 'viewType' | 'extension' | 'hasMarker'>,
): boolean {
  return f.viewType === VIEW_TYPE && f.extension === 'md' && !f.hasMarker;
}

/**
 * The view state to open instead of `state` (pure): a Markdown view of a deck note becomes the deck
 * view *before* the leaf is created, so the Markdown view is never drawn (no flash).
 */
export function redirectViewState(
  state: ViewState,
  hasMarker: (path: string) => boolean,
): ViewState {
  if (state.type !== 'markdown') return state;
  const inner = sourceFlag(state.state);
  const file = inner.file;
  if (typeof file !== 'string' || !file.toLowerCase().endsWith('.md')) return state;
  if (inner[SOURCE_STATE_KEY] === true || !hasMarker(file)) return state;
  return { ...state, type: VIEW_TYPE };
}

export function sourceFlag(state: unknown): Record<string, unknown> {
  return typeof state === 'object' && state !== null ? (state as Record<string, unknown>) : {};
}

/** The marker from the metadata cache; a file the cache has not seen yet is read (S5). */
async function hasMarker(plugin: Plugin, file: TFile): Promise<boolean> {
  const cache = plugin.app.metadataCache.getFileCache(file);
  if (cache !== null) return cache.frontmatter?.['sododeck-plugin'] === 'parsed';
  return isDeckMarkdown(await plugin.app.vault.cachedRead(file));
}

/** Wraps `WorkspaceLeaf.setViewState` so deck notes open straight in the deck view; undone on unload. */
function patchSetViewState(plugin: Plugin): void {
  const proto = WorkspaceLeaf.prototype;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- called back with the leaf as `this`
  const original = proto.setViewState;
  const hasMarkerSync = (path: string): boolean => {
    const file = plugin.app.vault.getFileByPath(path);
    if (file === null) return false;
    return (
      plugin.app.metadataCache.getFileCache(file)?.frontmatter?.['sododeck-plugin'] === 'parsed'
    );
  };
  proto.setViewState = function (this: WorkspaceLeaf, state: ViewState, eState?: unknown) {
    return original.call(this, redirectViewState(state, hasMarkerSync), eState);
  };
  plugin.register(() => {
    proto.setViewState = original;
  });
}

export function registerSwap(plugin: Plugin): void {
  const { workspace } = plugin.app;
  patchSetViewState(plugin);

  const check = async (leaf: WorkspaceLeaf): Promise<void> => {
    const view = leaf.view;
    const file = (view as { file?: TFile | null }).file ?? null;
    if (file === null || file.extension !== 'md') return;
    const type = view.getViewType();
    if (type !== 'markdown' && type !== VIEW_TYPE) return;
    const marked = await hasMarker(plugin, file);
    const facts: SwapFacts = {
      viewType: type,
      extension: file.extension,
      hasMarker: marked,
      leafState: sourceFlag(leaf.getViewState().state),
    };
    if (shouldSwap(facts)) {
      await leaf.setViewState({ type: VIEW_TYPE, state: { file: file.path }, active: false });
    } else if (shouldSwapBack(facts)) {
      await leaf.setViewState({ type: 'markdown', state: { file: file.path }, active: false });
    }
  };

  const checkAll = (): void => {
    workspace.iterateAllLeaves((leaf) => {
      void check(leaf);
    });
  };

  plugin.registerEvent(workspace.on('file-open', checkAll));
  plugin.registerEvent(workspace.on('active-leaf-change', checkAll));
  plugin.registerEvent(workspace.on('layout-change', checkAll));
  // The marker can arrive after the view (a note just created or delivered by a sync).
  plugin.registerEvent(plugin.app.metadataCache.on('changed', checkAll));
  workspace.onLayoutReady(checkAll);
}

export function deckViewOf(leaf: WorkspaceLeaf | null): DeckView | null {
  return leaf?.view instanceof DeckView ? leaf.view : null;
}
