import { createContext, useContext } from 'react';

/** How the open deck is kept: in the library, or not at all (demo, blocked storage). */
export type SaveMode = 'stored' | 'demo' | 'memory';

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
