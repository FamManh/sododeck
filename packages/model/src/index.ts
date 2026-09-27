export {
  ARRAY_COLLECTIONS,
  COLLECTIONS,
  createDeck,
  fromJSON,
  getObject,
  getRule,
  serializeDeck,
  toJSON,
  type Collection,
  type DeckDoc,
  type ObjectOf,
  type ObjectRef,
  type Scope,
} from './deck';
export { DeckEditError, DeckValidationError, type DeckEditErrorCode } from './errors';
export { createEditor, type DeckEditor, type EditorOptions } from './editor';
export { observeDeck, type DeckChange, type ObjectChange } from './observe';
export type { NewObject, NewRule, NewStep, Patch } from './ops/types';
