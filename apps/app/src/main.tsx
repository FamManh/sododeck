import './index.css';

import { TooltipProvider } from '@sododeck/ui/components/tooltip';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { router } from './app/router';
import { readEnv } from './lib/env';
import { initTelemetry } from './telemetry';
import { initTheme } from './theme/theme-store';

initTheme();
void initTelemetry(readEnv());

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing from index.html');

createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  </StrictMode>,
);
