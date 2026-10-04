export { createDeck, fromJSON, getObject, getRule, serializeDeck, toJSON } from './deck';
export {
  ARRAY_COLLECTIONS,
  COLLECTIONS,
  isLegacyLayout,
  type Collection,
  type DeckDoc,
  type ObjectOf,
  type ChildKind,
  type ObjectRef,
  type Scope,
} from './layout';
export { deckDialect } from './dialect';
export {
  relationshipDisplayOf,
  tableDisplayOf,
  type DeckTableDetail,
  type ResolvedRelationshipDisplay,
  type ResolvedTableDisplay,
} from './table-display';
export type { NewDbCheck, NewDbColumn, NewDbIndex } from './ops/db-tables';
export type { EnumPatch, EnumValuePatch, NewDbEnum, NewDbEnumValue } from './ops/db-enums';
export { DeckEditError, DeckValidationError, type DeckEditErrorCode } from './errors';
export {
  CARD_TYPES,
  cardType,
  CATEGORIES,
  deckPacks,
  drawnShapeType,
  effectiveFamily,
  hasTwoForms,
  isDbTable,
  isKnownPack,
  isKnownType,
  LEGACY_PACKS,
  NEW_DECK_PACKS,
  PACK_DISPLAY_ORDER,
  PACKS,
  packTypeCount,
  SHAPE_TYPE_IDS,
  shapeGeometryOf,
  STATUS_OPTIONS,
  typeName,
  typesOfPacks,
  type CardType,
  type Category,
  type CategoryInfo,
  type Family,
  type FormNode,
  type Geometry,
  type Pack,
  type PackTool,
  type PackId,
  type TypeId,
} from './card-types';
export { createEditor, type DeckEditor, type EditorOptions } from './editor';
export { observeDeck, type DeckChange, type ObjectChange } from './observe';
export { checkIntegrity, type IntegrityProblem } from './integrity';
export { endpointOf, endpointTitle, type Endpoint, type EndpointKind } from './endpoint';
export {
  checkDeck,
  PROBLEM_KINDS,
  type DeckProblems,
  type Problem,
  type ProblemFix,
  type ProblemKind,
  type ProblemTarget,
} from './problems';
export type { RemovalResult } from './ops/cascade';
export type { StyleChannel, StyleTargets } from './ops/style';
export { MAX_SWATCHES } from './ops/swatches';
export { sameTag, tagKey } from './tags';
export type { TagChange } from './ops/tags';
export type { ViewSettingsPatch } from './ops/views';
export {
  edgeLineStyle,
  edgeShape,
  type Dash,
  type EdgeLineStyle,
  type EdgeShape,
  type Width,
} from './edge-shape';
export type { EdgeStylePatch } from './ops/edge-style';
export type { EdgeRoutePatch } from './ops/shape';
export type { NodeDisplay } from './ops/node-display';
export { isLocked } from './ops/node-lock';
export { iconUsage, type IconUsage } from './icons';
export { copyName } from './ops/paste';
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
  type FragmentOptions,
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
export {
  appliesTo,
  BUILT_IN_FIELDS,
  canonicalPerson,
  fieldsOfNode,
  fieldsOfType,
  fieldUsage,
  findField,
  hasValue,
  isBuiltInField,
  isDefaultField,
  personKey,
  personSuggestions,
  usesCodeDefaults,
  valueOf,
  type BuiltInFieldId,
  type FieldSource,
  type ResolvedField,
} from './fields';
export {
  clearedByKindChange,
  convertValue,
  FIELD_KINDS,
  isDateString,
  isLinkUrl,
  planKindChange,
  validateValue,
  type KindChangePlan,
} from './field-values';
export type { FieldPatch, NewField, NewFieldOption, OptionPatch } from './ops/fields';
