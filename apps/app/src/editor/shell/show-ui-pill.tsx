import { Button } from '@sododeck/ui/components/button';
import { Eye } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { useSaveStatusStore } from '../../storage/save-status';
import { shortcutLabel } from './shortcuts';

/**
 * The only chrome left under Hide UI (018 FR-034, design 94): bottom-right, "Show UI" with its
 * shortcut. A save error while hidden adds an alert mark to it (and to its name).
 */
export function ShowUiPill() {
  const setHideUi = useUiStore((s) => s.setHideUi);
  const announce = useUiStore((s) => s.announce);
  const failed = useSaveStatusStore((s) => s.status.kind === 'error');
  return (
    <Button
      data-region="show-ui"
      aria-label={failed ? "Show UI, couldn't save" : 'Show UI'}
      className="pointer-events-auto absolute right-3 bottom-3 h-8.5 rounded-full shadow-float"
      onClick={() => {
        setHideUi(false);
        announce('Interface shown');
      }}
    >
      <Eye />
      Show UI
      <kbd aria-hidden className="font-mono text-caption text-ink-secondary">
        {shortcutLabel('hide-ui')}
      </kbd>
      {failed && <span aria-hidden className="size-2 rounded-full bg-clay-ink" />}
    </Button>
  );
}
