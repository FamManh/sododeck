import { useToast } from '@sododeck/ui/components/toast';
import { useEffect } from 'react';

import { useEmbedStore } from './embed-store';

/** Toasts the embed raises itself, inside the editor's toast provider (067 US4). */
export function EmbedToasts() {
  const { toast } = useToast();
  const notice = useEmbedStore((s) => s.pictureNotice);
  useEffect(() => {
    if (notice !== null) toast({ message: `Picture kept inside the deck file: ${notice.reason}` });
  }, [notice, toast]);
  return null;
}
