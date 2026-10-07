import { parentWindowTransport } from '@sododeck/host-protocol';
import { TooltipProvider } from '@sododeck/ui/components/tooltip';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../index.css';
import { EmbedApp } from './embed-app';

// No initTheme (the host owns the scheme), no library, no telemetry: the embed has none of them.
const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root');
const transport = parentWindowTransport();
createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <EmbedApp transport={transport} />
    </TooltipProvider>
  </StrictMode>,
);
