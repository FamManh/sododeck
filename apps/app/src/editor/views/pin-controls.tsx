import type { Id } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Switch } from '@sododeck/ui/components/switch';
import { Pin } from 'lucide-react';
import { useId } from 'react';

import { useUiStore } from '../../state/ui-store';
import { useViewActions, useViewState } from './use-current-view';

/** How many of `nodeIds` are pinned in the current view. */
function usePinState(nodeIds: readonly Id[]): 'none' | 'some' | 'all' {
  const pinned = useViewState().render.pinned;
  const count = nodeIds.filter((id) => pinned.has(id)).length;
  return count === 0 ? 'none' : count === nodeIds.length ? 'all' : 'some';
}

/** Pins every one of `nodeIds` unless all are pinned, then unpins them: one undo step. */
function useTogglePins(nodeIds: readonly Id[], state: 'none' | 'some' | 'all') {
  const actions = useViewActions();
  return () => {
    const pin = state !== 'all';
    actions.pin(nodeIds, pin);
    const n = nodeIds.length;
    useUiStore
      .getState()
      .announce(
        `${pin ? 'Pinned' : 'Unpinned'} ${n === 1 ? 'component' : `${String(n)} components`}`,
      );
  };
}

/**
 * "Pin position" in the inspector (011 FR-023): pinned components keep their place when Tidy
 * layout runs in this view. A mixed selection says so in text; toggling then pins them all.
 */
export function PinSwitch({ nodeIds }: { nodeIds: readonly Id[] }) {
  const id = useId();
  const state = usePinState(nodeIds);
  const toggle = useTogglePins(nodeIds, state);
  const description =
    state === 'some'
      ? 'Some of the selected components are pinned in this view'
      : 'Tidy layout leaves pinned components in place, in this view only';
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <label htmlFor={id} className="text-body text-ink">
          Pin position
        </label>
        <span id={`${id}-description`} className="text-caption text-ink-secondary">
          {description}
        </span>
      </div>
      <Switch
        id={id}
        checked={state === 'all'}
        aria-describedby={`${id}-description`}
        onCheckedChange={toggle}
      />
    </div>
  );
}

/** Canvas toolbar Pin / Unpin toggle for the selected components (011 FR-023). */
export function PinToggle() {
  const nodeIds = useUiStore((s) => s.selection.nodes);
  const state = usePinState(nodeIds);
  const toggle = useTogglePins(nodeIds, state);
  if (nodeIds.length === 0) return null;
  const pressed = state === 'all';
  return (
    <Button
      variant="toggle"
      pressed={pressed}
      className="shadow-rest"
      title={pressed ? 'Unpin the selected components' : 'Pin the selected components'}
      onClick={toggle}
    >
      <Pin />
      {pressed ? 'Unpin' : 'Pin'}
    </Button>
  );
}
