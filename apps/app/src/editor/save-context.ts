import { createContext, useContext } from 'react';

/**
 * How the open deck is kept: in the library, or not at all (demo, blocked storage), or by the
 * host program that embeds the editor (`host`, 067: the host's file is the store, so the editor
 * shows no save state).
 */
export type SaveMode = 'stored' | 'demo' | 'memory' | 'host';

export interface SaveControls {
  mode: SaveMode;
  /** Writes pending edits now (⌘S, Retry). Resolves when the write settled. */
  flush: () => Promise<void>;
  /** Records a single-deck export in the library (FR-027). */
  markExported: () => void;
}

const DEMO: SaveControls = {
  mode: 'demo',
  flush: () => Promise.resolve(),
  markExported: () => undefined,
};

/** Provided by the editor page; the demo deck (and component tests) get the no-op default. */
export const SaveContext = createContext<SaveControls>(DEMO);

export function useSaveControls(): SaveControls {
  return useContext(SaveContext);
}
