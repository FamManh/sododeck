import { Captions, Accessibility } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import type { Action } from './types';

/**
 * The toolbar of one image (055): alt text and caption open a small popover each; stacking, lock
 * and delete come from the shared actions. Both texts stay editable on a locked image.
 */
export const IMAGE_ACTIONS: readonly Action[] = [
  {
    id: 'image.alt',
    label: 'Alt text',
    icon: Accessibility,
    section: 'edit',
    field: 'imageAlt',
    where: { toolbar: ['image'] },
    run: () => {
      useUiStore.getState().openToolbarField('imageAlt');
    },
  },
  {
    id: 'image.caption',
    label: 'Caption',
    icon: Captions,
    section: 'edit',
    field: 'imageCaption',
    where: { toolbar: ['image'] },
    run: () => {
      useUiStore.getState().openToolbarField('imageCaption');
    },
  },
];
