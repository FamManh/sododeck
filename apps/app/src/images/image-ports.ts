import { createContext, useContext } from 'react';

import type { IngestPorts } from './ingest';
import { getImageClient } from './shared-image-client';

/** Overrides the picture worker (tests); `null` uses the page's shared client. */
export const ImagePortsContext = createContext<IngestPorts | null>(null);

/** The ports `ingestImage` runs on: the provided ones, else the picture worker (055). */
export function useImagePorts(): IngestPorts {
  return useContext(ImagePortsContext) ?? getImageClient();
}
