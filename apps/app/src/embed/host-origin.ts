/**
 * Yjs transaction origin of a deck file the host sent (`init`, `external-change`; 067). Such an
 * update came from outside: it is never sent back to the host and never an undo step.
 */
export const hostOrigin: object = Object.freeze({ provider: 'sododeck-host' });
