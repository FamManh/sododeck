import { createContext } from 'react';

import type { ProblemsStore } from './problems-store';

export const ProblemsContext = createContext<ProblemsStore | null>(null);
