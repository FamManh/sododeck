import { Ellipsis } from 'lucide-react';

import type { Action } from './types';

/**
 * Actions shared by several targets (019 R8). `more` is the toolbar's "More actions": the toolbar
 * opens the context menu under the button itself, so it has no `run`.
 */
export const COMMON_ACTIONS: readonly Action[] = [
  {
    id: 'more',
    label: 'More actions',
    icon: Ellipsis,
    shortcut: 'context-menu',
    section: 'danger',
    where: { toolbar: ['component', 'components', 'connection', 'group', 'mixed'] },
  },
];
