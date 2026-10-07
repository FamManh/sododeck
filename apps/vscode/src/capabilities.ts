import type { Capabilities } from '@sododeck/host-protocol';

import type { PicturesStorage } from './ports';

export interface CapabilityInputs {
  setting: PicturesStorage;
  /** The deck has no file yet (a new unsaved deck). */
  untitled: boolean;
  trusted: boolean;
  /** The deck's folder accepts new files. */
  writable: boolean;
}

/**
 * What this host declares to the editor (067). Links and exports are always handled here, so
 * they are always declared; picture files need the setting, a saved deck, a trusted workspace and
 * a writable folder (Q1, Q3, FR-016, FR-026). An untitled deck stays embedded for good (US4-8).
 */
export function computeCapabilities(input: CapabilityInputs): Capabilities {
  return {
    openLinks: true,
    exportFiles: true,
    pictures: input.setting === 'file' && !input.untitled && input.trusted && input.writable,
  };
}
