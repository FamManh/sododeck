import { Button } from '@sododeck/ui/components/button';
import { X } from 'lucide-react';
import { useContext } from 'react';

import { DrawerCloseContext } from './drawer-close-context';

/** "Close details" in an inspector header, only inside the drawer. */
export function DrawerCloseButton() {
  const close = useContext(DrawerCloseContext);
  if (close === null) return null;
  return (
    <Button variant="ghost" size="icon" aria-label="Close details" onClick={close}>
      <X />
    </Button>
  );
}
