/** Connector ends (029, DESIGN.md --sd-deck-edge-knob / -arrow). */
export const KNOB_RADIUS = 3.5;
export const ARROW_LENGTH = 9;
export const ARROW_WIDTH = 10;

/** Crow's foot ends (042, DESIGN.md "Crow's foot and ports"). */
export const CROW_LEN = 12;
export const CROW_SPREAD = 6;
export const CROW_BAR = 16;
export const CROW_RING = 4;
/** Bar distance from the card edge per end; a ring sits further out. */
export const CROW_BAR_AT = { one: 10, 'zero-one': 8, 'one-many': 16 } as const;
export const CROW_RING_AT = { 'zero-one': 17, 'zero-many': 20 } as const;
/** Straight stub a relationship leaves its row on (curved, elbow): past the farthest ring. */
export const REL_STUB = 24;
/** 1 / n text marks sit this far along the end and across it. */
export const CARD_TEXT_ALONG = 8;
export const CARD_TEXT_ACROSS = 8;
