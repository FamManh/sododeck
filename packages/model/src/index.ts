export { createDeck, fromJSON, getObject, getRule, serializeDeck, toJSON } from './deck';
export {
  ARRAY_COLLECTIONS,
  COLLECTIONS,
  type Collection,
  type DeckDoc,
  type ObjectOf,
  type ObjectRef,
  type Scope,
} from './layout';
export { DeckEditError, DeckValidationError, type DeckEditErrorCode } from './errors';
export { createEditor, type DeckEditor, type EditorOptions } from './editor';
export { observeDeck, type DeckChange, type ObjectChange } from './observe';
export { checkIntegrity, type IntegrityProblem } from './integrity';
export type { RemovalResult } from './ops/cascade';
export type { NewObject, NewRule, NewStep, Patch } from './ops/types';
export {
  captureFlowStructure,
  flowStructureChanged,
  type FlowCheckpoint,
  type NewBranch,
} from './ops/branches';
export { createDeckSnapshot, type DeckSnapshot } from './snapshot';
export { previewRemoval, removeTarget, type RemovalTarget } from './preview';
export {
  serializeEntries,
  serializeEntry,
  type Entry,
  type EntryCollection,
} from './serialize-entry';
export {
  analyzeFlow,
  branchLetter,
  type BranchPath,
  type FlowAnalysis,
  type FlowProblem,
  type PathStep,
} from './flow-paths';
export { matchCell, parseCell, type Cell, type CompareOp } from './rules/cells';
export { evaluateRule, ruleChecks, type Evaluation, type RuleChecks } from './rules/evaluate';
export { ruleUsage, type RuleUsage } from './rules/usage';
export type { RuleHost } from './ops/rule-links';
export {
  NODE_GRID,
  STICKY_DEFAULT_OFFSET,
  nodeCanvasPosition,
  stickyCanvasPosition,
  stickyLabel,
  type Point,
  type StickyPlacement,
} from './geometry';
