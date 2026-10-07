import { createContext, useContext } from 'react';

import { openLink } from '../lib/links';
import { downloadBlob } from '../storage/download';

/**
 * What the editor can ask of the program around it (067 R8). The web app does these itself (the
 * default); an embed sends them to its host, or gets `null` for what the host cannot do, and the
 * control that needs it is not shown.
 */
export interface EmbedHostValue {
  /** Opens a link (`http`, `https` or relative); `null`: the host cannot. */
  openLink: ((href: string) => void) | null;
  /** Saves a file the user exported; `null`: the host cannot. */
  saveFile: ((name: string, blob: Blob) => void) | null;
}

// Arrow wrappers, not the functions themselves: tests replace the module exports.
const WEB: EmbedHostValue = {
  openLink: (href) => {
    openLink(href);
  },
  saveFile: (name, blob) => {
    downloadBlob(name, blob);
  },
};

export const EmbedHostContext = createContext<EmbedHostValue>(WEB);

export function useOpenLink(): ((href: string) => void) | null {
  return useContext(EmbedHostContext).openLink;
}

export function useSaveFile(): ((name: string, blob: Blob) => void) | null {
  return useContext(EmbedHostContext).saveFile;
}
