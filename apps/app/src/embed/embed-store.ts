import type { ProblemEntry } from '@sododeck/model/report-json';
import type { Capabilities } from '@sododeck/host-protocol';
import { create } from 'zustand';

/**
 * UI-only state of the embedded editor (067 data model): where the hand-over with the host stands.
 * The deck itself lives in the Yjs document; nothing of it is kept here.
 */
export type EmbedPhase = 'waiting' | 'slow' | 'fatal' | 'open' | 'blocked';

/** Which side must be updated after a protocol version mismatch. */
export type FatalSide = 'editor' | 'host';

const NO_CAPABILITIES: Capabilities = { openLinks: false, exportFiles: false, pictures: false };

interface EmbedState {
  phase: EmbedPhase;
  fatal: { side: FatalSide } | null;
  /** From the file the editor refused; shown while `blocked`. */
  problems: ProblemEntry[];
  capabilities: Capabilities;
  /** The host refused or never answered a `change`; cleared by the next ok. */
  hostError: string | null;
  reset: () => void;
  /** No `init` after the waiting time. Only changes `waiting`. */
  slow: () => void;
  /** A protocol version mismatch: nothing opens until an `init` with the right version. */
  failed: (side: FatalSide) => void;
  /** A valid file is open (first `init`, or a valid outside file after a refused one). */
  opened: () => void;
  /** An invalid file was refused: the editor is read-only (or has no deck yet). */
  blocked: (problems: ProblemEntry[]) => void;
  setCapabilities: (capabilities: Capabilities) => void;
  setHostError: (reason: string | null) => void;
}

export const useEmbedStore = create<EmbedState>()((set) => ({
  phase: 'waiting',
  fatal: null,
  problems: [],
  capabilities: NO_CAPABILITIES,
  hostError: null,
  reset: () => {
    set({
      phase: 'waiting',
      fatal: null,
      problems: [],
      capabilities: NO_CAPABILITIES,
      hostError: null,
    });
  },
  slow: () => {
    set((s) => (s.phase === 'waiting' ? { phase: 'slow' } : s));
  },
  failed: (side) => {
    set({ phase: 'fatal', fatal: { side } });
  },
  opened: () => {
    set({ phase: 'open', fatal: null, problems: [] });
  },
  blocked: (problems) => {
    set({ phase: 'blocked', fatal: null, problems });
  },
  setCapabilities: (capabilities) => {
    set({ capabilities });
  },
  setHostError: (hostError) => {
    set({ hostError });
  },
}));
