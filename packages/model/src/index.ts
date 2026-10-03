export { createDeck, fromJSON, getObject, getRule, serializeDeck, toJSON } from './deck';
export {
  ARRAY_COLLECTIONS,
  COLLECTIONS,
  isLegacyLayout,
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
export {
  checkDeck,
  PROBLEM_KINDS,
  type DeckProblems,
  type Problem,
  type ProblemKind,
  type ProblemTarget,
} from './problems';
export type { RemovalResult } from './ops/cascade';
export type { StyleChannel, StyleTargets } from './ops/style';
export { MAX_SWATCHES } from './ops/swatches';
export { sameTag, tagKey } from './tags';
export type { ViewSettingsPatch } from './ops/views';
export { edgeShape, type EdgeShape } from './edge-shape';
export type { EdgeRoutePatch } from './ops/shape';
export type { PastedIds, PasteOptions } from './ops/paste';
export type { GroupSelection } from './ops/group-selection';
export {
  baseViewId,
  CUSTOM_VIEW_DEFAULTS,
  nextCustomTitle,
  PRESET_VIEW_IDS,
  resolveViews,
  VIEW_PRESETS,
} from './views';
export type { NewObject, NewRule, NewStep, Patch } from './ops/types';
export {
  captureFlowStructure,
  flowStructureChanged,
  type FlowCheckpoint,
  type NewBranch,
} from './ops/branches';
export { createDeckSnapshot, type DeckSnapshot } from './snapshot';
export {
  fragmentOrigin,
  parseFragment,
  serializeFragment,
  toFragment,
  type Fragment,
  type FragmentSelection,
} from './fragment';
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
  fitGroupFrames,
  frameOf,
  NODE_GRID,
  STICKY_DEFAULT_OFFSET,
  nodeCanvasPosition,
  stickyCanvasPosition,
  stickyLabel,
  viewNodePosition,
  viewPosition,
  type FitOptions,
  type Point,
  type StickyPlacement,
} from './geometry';
export { buildSearchIndex } from './search/index';
export {
  searchDeck,
  type Range,
  type SearchEntry,
  type SearchField,
  type SearchFieldValue,
  type SearchIndex,
  type SearchKind,
  type SearchResult,
} from './search/search';
export { normalizeText } from './search/normalize';
