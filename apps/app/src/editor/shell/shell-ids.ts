import type { FlyoutId } from './shell-prefs';

/** Element ids that tie a rail button to its flyout (aria-controls, focus return). */
export const railButtonId = (id: string) => `rail-${id}`;
export const flyoutElementId = (id: FlyoutId) => `flyout-${id}`;
