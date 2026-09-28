import type { Id } from '@sododeck/schema';
import { Switch } from '@sododeck/ui/components/switch';
import { useId } from 'react';

import { useUiStore } from '../../state/ui-store';
import { pinAnnouncement, pinState, type PinState } from './pin-state';
import { useViewActions, useViewState } from './use-current-view';

/** How many of `nodeIds` are pinned in the current view. */
function usePinState(nodeIds: readonly Id[]): PinState {
  return pinState(nodeIds, useViewState().render.pinned);
}

/** Pins every one of `nodeIds` unless all are pinned, then unpins them: one undo step. */
function useTogglePins(nodeIds: readonly Id[], state: PinState) {
  const actions = useViewActions();
  return () => {
    const pin = state !== 'all';
    actions.pin(nodeIds, pin);
    useUiStore.getState().announce(pinAnnouncement(pin, nodeIds.length));
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
