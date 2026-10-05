/**
 * The deck editor: the one way surfaces change a deck. It owns only session state (constitution
 * I): a transaction origin, a Y.UndoManager, the gesture depth, the last edited object and the id
 * generator. Undo covers only this editor's own transactions (research R5).
 */
import type {
  ColorRef,
  DbCheck,
  DbColumn,
  DbIndex,
  Dialect,
  EdgeShape,
  FieldKind,
  Id,
  PackId,
  RelationshipDisplay,
  TableDisplay,
  TypeId,
} from '@sododeck/schema';
import * as Y from 'yjs';

import type {
  Branch,
  Frame,
  Rule,
  SododeckFile,
  Size,
  Step,
  Sticky,
  StickyColor,
  Touch,
  ViewType,
} from '@sododeck/schema';

import { defaultNewId, makeIdAllocator } from './ids';
import { getObject } from './deck';
import { DeckEditError } from './errors';
import type { CropRect, Point } from './geometry';
import { rootTypes, type Collection, type DeckDoc, type ObjectOf } from './layout';
import { observeDeck, type DeckChange } from './observe';
import { hasDanglingViewRefs, repairViewRefs } from './repair';
import {
  addBranch,
  appendStep,
  restoreFlowStructure,
  updateBranch,
  type FlowCheckpoint,
  type NewBranch,
} from './ops/branches';
import {
  removeBranch,
  removeColumn,
  removeEnum,
  removeEnumValue,
  removeObject,
  removeRule,
  removeStep,
  removeTablePart,
  type RemovalResult,
} from './ops/cascade';
import {
  addPart,
  movePart,
  updatePart,
  type NewDbCheck,
  type NewDbColumn,
  type NewDbIndex,
} from './ops/db-tables';
import {
  addEnum,
  addEnumValue,
  moveEnum,
  moveEnumValue,
  setBlockSqlExport,
  setDialect,
  updateEnum,
  updateEnumValue,
  type EnumPatch,
  type EnumValuePatch,
  type NewDbEnum,
  type NewDbEnumValue,
} from './ops/db-enums';
import { setGroupingMode } from './ops/deck-grouping';
import { setRelationshipDisplay, setTableDisplay } from './ops/table-display';
import type { GroupingMode } from './read';
import { addObject, reorderObject, updateObject } from './ops/collections';
import { fillGroupFrames, setGroupFrames } from './ops/frames';
import { pasteFragment, type PasteOptions, type PastedIds } from './ops/paste';
import { groupSelection, type GroupSelection } from './ops/group-selection';
import { setEdgeLabelAt } from './ops/edge-label';
import { setEdgeShape, setEdgeStyle, type EdgeStylePatch } from './ops/edge-style';
import { setCardSize, setEdgeRoute, type EdgeRoutePatch } from './ops/shape';
import type { Fragment } from './fragment';
import { editorOrigins, type EditContext } from './ops/context';
import { updateMeta } from './ops/meta';
import { setStyle, type StyleChannel, type StyleTargets } from './ops/style';
import { addSwatch, removeSwatch } from './ops/swatches';
import { setPackOn } from './ops/packs';
import {
  addField,
  addOption,
  changeFieldKind,
  deleteField,
  deleteOption,
  moveField,
  moveOption,
  setValues,
  updateField,
  updateOption,
  type FieldPatch,
  type NewField,
  type NewFieldOption,
  type OptionPatch,
} from './ops/fields';
import { setNodeDisplay, type NodeDisplay } from './ops/node-display';
import { setNodeIcon } from './ops/node-icon';
import { setLocked, type LockCollection } from './ops/node-lock';
import {
  addImages,
  moveImage,
  setImageCrop,
  setImageFlip,
  setImageGroup,
  setImageSize,
  setImageText,
  type ImageText,
  type NewImage,
} from './ops/images';
import { restack, type StackTargets } from './ops/stacking';
import { setTableOwner } from './ops/db-owner';
import {
  addTouch,
  removeTouch,
  setTouchAccess,
  type TouchAccess,
  type TouchKey,
} from './ops/touches';
import { deleteTag, renameTag, setTagColor, type TagChange } from './ops/tags';
import {
  addRule,
  addRuleColumn,
  addRuleRow,
  moveRuleColumn,
  moveRuleRow,
  removeRuleColumn,
  removeRuleRow,
  renameRuleColumn,
  setRuleCell,
  updateRule,
} from './ops/rules';
import { attachRule, detachRule, setRuleInputs, type RuleHost } from './ops/rule-links';
import { addStep, moveStep, updateStep } from './ops/steps';
import {
  addSticky,
  deleteStickyIfPresent,
  freeLegacyStickies,
  moveSticky,
  setStickyAlign,
  setStickyColour,
  setStickyFont,
  setStickySize,
  setStickyTags,
  type StickyAlign,
  type StickyFontSize,
} from './ops/stickies';
import type { NewObject, NewRule, NewStep, Patch } from './ops/types';
import {
  addView,
  moveInView,
  removeView,
  setCollapsed,
  setPinned,
  updateView,
  type ViewSettingsPatch,
} from './ops/views';

export interface BatchOptions {
  /** A merge run: batches with the same key are one undo step (see `DeckEditor.batch`). */
  merge?: string;
}

export interface EditorOptions {
  /** Typing-burst window in ms: edits to one object closer than this are one undo step. */
  captureTimeout?: number;
  /** Id generator, e.g. deterministic ids in tests. Collisions with existing ids are retried. */
  newId?: (prefix: string) => Id;
  /**
   * Repair view entries that name nothing after a change that is not this editor's own
   * (default `true`). Runs with the untracked origin: saved and synced, never an undo step.
   */
  repair?: boolean;
}

/**
 * Typed, validated edit operations. Every method validates first and throws `DeckEditError`
 * without writing anything; after any successful call the deck exports a valid file.
 */
export interface DeckEditor {
  readonly doc: DeckDoc;

  /** Sets or clears (`null`) the deck's name, description, tags and custom colour swatches. */
  updateMeta(patch: Patch<Pick<SododeckFile, 'name' | 'description' | 'tags' | 'swatches'>>): void;

  /** Adds an object and returns its id (generated unless `data.id` is given). */
  add<C extends Collection>(c: C, data: NewObject<C>): Id;
  /** Changes fields; `null` clears an optional field. Move = `position`, regroup = `group`. */
  update<C extends Collection>(c: C, id: Id, patch: Patch<ObjectOf<C>>): void;
  /** Deletes an object with the cascade in data-model.md, as one change and one undo step. */
  remove(c: Collection, id: Id): RemovalResult;
  /** Moves an object to `toIndex` in its collection (clamped). */
  reorder(c: Collection, id: Id, toIndex: number): void;

  /** Adds a step at `index` (default: last). */
  addStep(flowId: Id, data: NewStep, index?: number): Id;
  updateStep(flowId: Id, stepId: Id, patch: Patch<Step>): void;
  /** Deletes one step. */
  removeStep(flowId: Id, stepId: Id): RemovalResult;
  /**
   * Moves a step to `toIndex` in `flow.steps`. Refused (`invalid`) when it would leave the step's
   * path or put a main-path step after the branch step.
   */
  moveStep(flowId: Id, stepId: Id, toIndex: number): void;
  /** Appends a step at the end of a path (main when `branchId` is null), keeping normal order. */
  appendStep(flowId: Id, branchId: Id | null, data: NewStep): Id;

  /**
   * Adds a branch after main-path step `afterStepId`, optionally with its first step (ADR 0008).
   * Following main-path steps first become alternative "a" when the flow has no branches yet.
   * One undo step. Returns the new branch id and its first step id (or null).
   */
  addBranch(flowId: Id, afterStepId: Id, data: NewBranch): { branchId: Id; stepId: Id | null };
  updateBranch(flowId: Id, branchId: Id, patch: Patch<Branch>): void;
  /** Deletes a branch and its steps. */
  removeBranch(flowId: Id, branchId: Id): RemovalResult;
  /**
   * Restores a flow's steps and branches to a checkpoint from `captureFlowStructure`; objects that
   * still exist keep their current text fields. One undo step.
   */
  restoreFlowStructure(flowId: Id, checkpoint: FlowCheckpoint): void;

  /** Adds a decision table; `hitPolicy` defaults to `first`, columns and rows to none. */
  addRule(data: NewRule): Id;
  updateRule(id: Id, patch: Patch<Omit<Rule, 'inputs' | 'outputs' | 'rows'>>): void;
  /** Deletes a rule, detaching it from every node and step and dropping its sample inputs. */
  removeRule(id: Id): RemovalResult;
  /** Adds a column at `index` (default: last), with an empty cell in every row. */
  addRuleColumn(ruleId: Id, side: 'inputs' | 'outputs', label: string, index?: number): Id;
  renameRuleColumn(ruleId: Id, columnId: Id, label: string): void;
  /** Moves a column within its side, moving its cell in every row. */
  moveRuleColumn(ruleId: Id, columnId: Id, toIndex: number): void;
  /** Removes a column, its cells, and (for inputs) the matching sample inputs on steps. */
  removeRuleColumn(ruleId: Id, columnId: Id): RemovalResult;
  /** Adds a row at `index` (default: last); missing cells are `''`. */
  addRuleRow(ruleId: Id, cells?: { when?: string[]; then?: string[] }, index?: number): Id;
  setRuleCell(ruleId: Id, rowId: Id, columnId: Id, value: string): void;
  moveRuleRow(ruleId: Id, rowId: Id, toIndex: number): void;
  removeRuleRow(ruleId: Id, rowId: Id): void;

  /**
   * Appends `ruleId` to a node's or step's rules (008). Throws `missing-reference` (no such rule
   * or host) or `invalid` (already attached). One undo step.
   */
  attachRule(host: RuleHost, ruleId: Id): void;
  /**
   * Removes `ruleId` from the host's rules (the field goes when empty); on a step its sample
   * inputs for that rule go in the same transaction. No-op when not attached.
   */
  detachRule(host: RuleHost, ruleId: Id): void;
  /**
   * Replaces a step's sample inputs for one attached rule: empty values are dropped, the rule's
   * key goes when nothing is left. A typing burst is one undo step. Throws `missing-reference`
   * when the rule is not attached or a key is not one of its input columns.
   */
  setRuleInputs(flowId: Id, stepId: Id, ruleId: Id, values: Readonly<Record<Id, string>>): void;

  /**
   * Adds a note and opens a draft: text edits to it (through `update('stickies', id, …)`) merge
   * into the same undo step regardless of how long typing takes. Throws `invalid` if a draft is
   * already open. Returns the new id.
   */
  beginStickyDraft(sticky: Omit<Sticky, 'id'>): Id;
  /**
   * Ends the open draft. Blank text (or a note removed by another tab) removes the note and, when
   * nothing else was recorded meanwhile, drops the draft's undo step entirely, so it leaves no
   * undo or redo entry. Otherwise the note is removed as a normal step. Returns `'kept'` or
   * `'discarded'`. Throws `invalid` when `id` is not the open draft.
   */
  endStickyDraft(id: Id): 'kept' | 'discarded';
  /** Moves a note to an absolute canvas point. `locked` for a locked note. */
  moveSticky(id: Id, point: Point): void;
  /**
   * Makes every note still pinned with the legacy `anchor` free at the point it was shown at
   * (ADR 0041), for a deck stored before pinning was removed. Untracked: never an undo step.
   * Returns the ids changed; writes nothing when there are none.
   */
  freeLegacyStickies(): Id[];
  /**
   * Sets a note's size, clamped to `STICKY_MIN_SIZE` (053); `null` goes back to the default. One
   * undo step, merged with an open gesture (a resize drag). `locked` for a locked note.
   */
  setStickySize(id: Id, size: Size | null): void;
  /** Fixes the text size of every listed note; `null` is Auto (053). One undo step. */
  setStickyFont(ids: readonly Id[], fontSize: StickyFontSize | null): void;
  /** Aligns the text of every listed note; `null` is the default, centred (053). One undo step. */
  setStickyAlign(ids: readonly Id[], align: StickyAlign | null): void;
  /** Recolours every listed note (053). One undo step. */
  setStickyColour(ids: readonly Id[], colour: StickyColor): void;
  /**
   * Sets a note's tags (053): trimmed, case kept, repeats dropped ignoring case, at most 10; an
   * empty list removes the key. Tags are the deck's tags, so colours and renames reach them.
   */
  setStickyTags(id: Id, tags: readonly string[]): void;

  /**
   * Adds pictures as images (055), on top of the stacking order, in the given order, as one undo
   * step. A picture id the deck does not know yet gets its `meta.assets` entry once. The caller has
   * already written the bytes to the blob store. Returns the new ids (`img-…`). `invalid` for a
   * size under 32 px, an unknown type or a bad picture id; `missing-reference` for a group that
   * does not exist; nothing is written then.
   */
  addImages(images: readonly NewImage[]): Id[];
  /** Moves an image to a canvas point (055). `locked` for a locked image. Merges in a gesture. */
  moveImage(id: Id, point: Point): void;
  /** Sets an image's size, clamped to 32 px a side (055). `locked` for a locked image. */
  setImageSize(id: Id, size: Size): void;
  /** Sets alt text and caption; `null` or `''` removes the key. Allowed on a locked image. */
  setImageText(id: Id, text: ImageText): void;
  /** Puts an image in a group, or takes it out with `null` (055). `locked` for a locked image. */
  setImageGroup(id: Id, group: Id | null): void;
  /**
   * Crops an image to `crop` (fractions of the picture, unflipped), or shows the whole picture with
   * `null` (057). Writes crop, size and position in one undo step, keeping the picture's on-canvas
   * scale and the still-visible part in place. A whole-picture crop is stored as none; nothing
   * changing writes nothing. `locked` for a locked image; `invalid` for a crop past the picture
   * or under 32 canvas px a side; `missing-reference` when the picture's size is not stored.
   */
  setImageCrop(id: Id, crop: CropRect | null): void;
  /**
   * Mirrors every listed image on `axis` (`on`) or puts it back (057), in one undo step; unflipping
   * removes the key. `locked` when any is locked, `not-found` for an unknown id, nothing written.
   */
  setImageFlip(ids: readonly Id[], axis: 'x' | 'y', on: boolean): void;
  /**
   * Stacking over cards and images together (055): brings the listed items to the front or back,
   * or one step forward or backward past the next unlisted item. One undo step; unknown ids are
   * skipped; `locked` for a locked image. Ranks are written only when the deck uses them, and
   * `nodes` is kept in the cards' stacking order.
   */
  bringToFront(targets: StackTargets): void;
  sendToBack(targets: StackTargets): void;
  bringForward(targets: StackTargets): void;
  sendBackward(targets: StackTargets): void;

  /**
   * Moves nodes in a view (011, FR-020/021). In the base view (the first) this writes
   * `node.position` and drops that view's own entry for the node; in other views it writes
   * `view.positions`. Unknown node ids are skipped. Merges inside a gesture or batch.
   * A deck without stored views first stores the presets, outside undo history (FR-001).
   */
  moveInView(viewId: Id, positions: Readonly<Record<Id, Point>>): void;
  /** Pins or unpins nodes in one view (FR-022). One undo step; `missing-reference` for unknown nodes. */
  setPinned(viewId: Id, nodeIds: readonly Id[], pinned: boolean): void;
  /**
   * Changes a view's title and settings; `undefined` or `[]` removes a field. Blank titles and
   * bad kinds are `invalid`; unknown groups or features are `missing-reference`. A title typing
   * burst is one undo step.
   */
  updateView(viewId: Id, patch: ViewSettingsPatch): void;
  /** Appends a view ("Custom <n>", type `custom`, by default) and returns its id. */
  addView(data?: { title?: string; type?: ViewType }): Id;
  /** Deletes a view; the last one is refused (`invalid`). Undo restores every field. */
  removeView(viewId: Id): RemovalResult;
  /**
   * Collapses or expands a group in a view (FR-050). Saved and synced (reported as `local`),
   * but never an undo step: `canUndo()` does not change and undo never touches it.
   */
  setCollapsed(viewId: Id, groupId: Id, collapsed: boolean): void;

  /**
   * Writes frames for groups that have none (016): `base` on the groups, `perView` into stored
   * views' `groupFrames`. Existing frames are kept. Untracked: never an undo step (research R2).
   */
  fillGroupFrames(
    base: ReadonlyMap<Id, Frame>,
    perView?: ReadonlyMap<Id, ReadonlyMap<Id, Frame>>,
  ): void;
  /**
   * Sets group frames in a view (016, R4): `group.position` / `group.size` in the base view,
   * `view.groupFrames` in others (the first write there copies the base frames, untracked).
   * Unknown groups are skipped; non-finite or non-positive values are `invalid`. Merges inside a
   * gesture or batch.
   */
  setGroupFrames(viewId: Id, frames: Readonly<Record<Id, Frame>>): void;
  /**
   * Pastes a clipboard fragment (016, R10) as one undo step: new ids, references remapped inside
   * the fragment, top-level nodes and groups into `parent`, unknown rule ids dropped, positions and
   * frames moved by `offset` (and written into a non-base `viewId` too). Returns the new ids in
   * fragment order. `missing-reference` for an unknown parent, `invalid` for a bad object.
   */
  pasteFragment(fragment: Fragment, options: PasteOptions): PastedIds;
  /**
   * Groups nodes and groups (016, R11) as one undo step: a new group titled `title` in `parent`,
   * with its base frame and per-view frames; the nodes' `group` and the groups' `parent` point to
   * it. Returns its id. `missing-reference` for unknown ids, `invalid` for a blank title or a
   * parent inside the selected groups.
   */
  groupSelection(selection: GroupSelection): Id;

  /**
   * Sets or clears (`null`) a card's stored size (017). Does not clamp: the schema only requires
   * positive `width` / `height`; the app clamps and reports out-of-range sizes as a problem. One
   * undo step, joining an open gesture.
   */
  setCardSize(nodeId: Id, size: Size | null): void;
  /**
   * Card or shape form of every listed node (031): one undo step; `null`, or the type's own
   * family, removes `display`. Throws `invalid` / `not-found` before any write.
   */
  setNodeDisplay(nodeIds: readonly Id[], display: NodeDisplay | null): void;
  /**
   * Locks (`true`) or unlocks every listed object of `collection` (default `nodes`; 043, 053): one
   * undo step. Locking writes `locked: true`; unlocking removes the key (`false` is not valid in
   * the file). Unknown ids are ignored, and nothing changing writes nothing. The app enforces what
   * a locked node blocks; the model itself refuses (`locked`) to move, resize or delete a locked
   * sticky and to reconnect, reshape, restyle or delete a locked connector.
   */
  setLocked(ids: readonly Id[], locked: boolean, collection?: LockCollection): void;
  /**
   * Moves a table into a database card, or out of any card with `null` (049): sets or clears
   * `node.parent` in one undo step. `invalid` when the node is not a table or the card is not a
   * `database` card; `not-found` for unknown ids. Columns, relationships and touches are kept.
   */
  setTableOwner(tableId: Id, cardId: Id | null): void;
  /**
   * Appends a table or column touch to a step (049). `invalid` for a pair the step already lists
   * or a bad access, `missing-reference` for a column not in that table. One undo step.
   */
  addTouch(flowId: Id, stepId: Id, touch: Touch): void;
  /** Sets one touch of a step to read or write; `not-found` when the step does not list it. */
  setTouchAccess(flowId: Id, stepId: Id, key: TouchKey, access: TouchAccess): void;
  /** Removes one touch of a step (the field goes when empty); `not-found` when not listed. */
  removeTouch(flowId: Id, stepId: Id, key: TouchKey): void;
  /**
   * Icon reference of every listed node (038): one undo step; `null` removes the key. Any
   * non-empty text is stored as given. Throws `invalid` / `not-found` before any write.
   */
  setNodeIcon(nodeIds: readonly Id[], icon: string | null): void;
  /**
   * Merges `patch` into an edge's stored route (017), or clears it entirely (`null`). A `null`
   * key removes it, `offset: 0` is dropped, and `route` itself is removed once no key is left. One
   * undo step, joining an open gesture.
   */
  setEdgeRoute(edgeId: Id, patch: EdgeRoutePatch | null): void;
  /**
   * Sets the label position of an edge (022) as a fraction 0 to 1 of the drawn line; `null` or
   * 0.5 removes it. `invalid` outside 0 to 1. One undo step, joining an open gesture.
   */
  setEdgeLabelAt(edgeId: Id, at: number | null): void;
  /**
   * Writes only the keys in `patch` (`shape`, `dash`, `width`, `color`, `animated`) to every
   * listed edge as one undo step (022). `null` or a default value removes the key (and `style`
   * when empty). Validates every id and value before writing.
   */
  setEdgeStyle(edgeIds: readonly Id[], patch: EdgeStylePatch): void;
  /**
   * Sets the line type of every listed edge as one undo step (029). Validates every id and the
   * shape before writing (`not-found` / `invalid`). Never changes an edge's `route`.
   */
  setEdgeShape(edgeIds: readonly Id[], shape: EdgeShape): void;
  /**
   * Sets or clears (`value === null`) one style channel (`fill` or `stroke`) on every target node
   * and group as one undo step (020, R2). Unknown ids are skipped; empty targets do nothing.
   * `invalid` when `value` is not a valid `ColorRef`.
   */
  setStyle(targets: StyleTargets, channel: StyleChannel, value: string | null): void;
  /**
   * Adds a custom hex colour to the deck's swatches (020, R3): normalizes to lowercase
   * `#rrggbb`, is a no-op on a duplicate. `invalid` for a malformed hex or past the 12-colour cap.
   */
  addSwatch(hex: string): void;
  /**
   * Removes a custom hex colour from the deck's swatches (020, R3). Does nothing when absent;
   * never touches any node or group's stored `style`.
   */
  removeSwatch(hex: string): void;
  /**
   * Turns a card-type pack on or off (030): `meta.packs`, one undo step, no change when the pack
   * is already as asked. A deck that stores no packs gets Architecture written first. `invalid`
   * (nothing written) for a malformed id or when it would turn off the last pack on.
   */
  setPackOn(packId: PackId, on: boolean): void;
  /**
   * Sets or clears (`null`) the colour of a tag for the whole deck (033): `meta.tagColors`, keyed
   * by the tag's existing spelling (a new key keeps the case given). One undo step; no change
   * event when nothing changes. `invalid` for an empty tag or a colour that is not a card colour
   * name or `#rrggbb`.
   */
  setTagColor(tag: string, color: ColorRef | null): void;
  /**
   * Renames a tag everywhere (033): cards, connections, flows, steps, the deck's tags, every view's
   * hidden tags and the colour entry, as one undo step. A new name that another tag already has
   * merges onto that tag's spelling and colour; the same name in another case only respells.
   * Repeats inside a list are dropped (first position kept). `invalid` for an empty name; no change
   * event when nothing changes.
   */
  renameTag(from: string, to: string): TagChange;
  /**
   * Deletes a tag everywhere (033): from every carrier and every view's hidden tags, and drops its
   * colour entry, as one undo step. An absent tag returns zero counts and writes nothing.
   */
  deleteTag(tag: string): TagChange;

  /**
   * Adds a typed field (032) at the end of the deck's field list (or after `after`) and returns
   * its id; options without ids get new ones. `invalid` for an empty name, a name another field
   * of one of its types already has (ignoring case), or a definition the format refuses (S12).
   */
  addField(field: NewField, opts?: { after?: Id }): Id;
  /**
   * Renames a field, changes its types (never to none), its on-card choice or its unit (`null`
   * clears). Built-ins accept only `onCard`. Changing a code default materialises its type's
   * defaults first (R1); a name typing burst is one undo step.
   */
  updateField(id: Id, patch: FieldPatch): void;
  /** Moves a field before `beforeId` (or last) in `typeId`'s list; stores the type's code fields. */
  moveField(id: Id, beforeId: Id | null, typeId: TypeId): void;
  /** Deletes a field and every value it holds (one undo step). `invalid` for built-ins. */
  deleteField(id: Id): void;
  /** Adds an option to a select or status field and returns its id. */
  addOption(fieldId: Id, option: NewFieldOption, opts?: { after?: Id }): Id;
  /** Renames, recolours (`null` clears) or changes the status icon of an option. */
  updateOption(fieldId: Id, optionId: Id, patch: OptionPatch): void;
  moveOption(fieldId: Id, optionId: Id, beforeId: Id | null): void;
  /** Deletes an option and clears the values using it (one undo step). */
  deleteOption(fieldId: Id, optionId: Id): void;
  /** Changes a field's kind, converting or clearing values (R6, one undo step). Not built-ins. */
  changeFieldKind(id: Id, kind: FieldKind): void;
  /**
   * Sets (`null` clears) one field's value on every listed card as one undo step. Validated
   * against the field; person values take the deck's spelling; built-ins write tech / host /
   * owner. Never materialises definitions.
   */
  setValues(nodeIds: readonly Id[], fieldId: Id, value: unknown): void;

  /** Sets the deck's SQL dialect (040); `null` or `'generic'` removes the key (absent = Generic). */
  setDialect(dialect: Dialect | null): void;
  /** Turns "block SQL export with errors" (052) on or off; off removes the key. */
  setBlockSqlExport(on: boolean): void;
  /**
   * Sets how the deck groups its tables (048): `'schema'` groups by schema name, `'group'` or
   * `null` removes the key (By group). One undo step; `invalid` for any other value.
   */
  setGroupingMode(mode: GroupingMode | null): void;
  /**
   * Patches the deck's table display (041): `detail` (`null` = Auto) and the hide flags (`true`
   * hides; `false` or `null` removes the flag). One undo step; nothing happens when nothing changes.
   */
  setTableDisplay(patch: Patch<TableDisplay>): void;
  /**
   * Patches the deck's relationship display (042): `hideEnds` (`true` draws plain ends; `false` or
   * `null` removes it), `labels` (`null` = follow the Labels tool), `notation` (`null` = crow's
   * foot). The object leaves the file when empty. One undo step; nothing happens when nothing
   * changes; bad keys or values are `invalid` with nothing written.
   */
  setRelationshipDisplay(patch: Patch<RelationshipDisplay>): void;
  /**
   * Adds a column at `index` of a table (default: last) and returns its id (generated unless
   * given; a given id must be free among the deck's columns, indexes, checks, enums and values).
   * Flags are written `true` or left out. `invalid` for a node that is not a `db-table`.
   */
  addColumn(tableId: Id, data: NewDbColumn, index?: number): Id;
  /**
   * Changes a column; `null` clears an optional key and `false` removes a flag. `enumRef` must
   * name an enum; `default` and `defaultExpr` are never both set (switch with `null` for the old).
   */
  updateColumn(tableId: Id, columnId: Id, patch: Patch<DbColumn>): void;
  /** Moves a column to `toIndex` of its table (clamped): one order key change. */
  moveColumn(tableId: Id, columnId: Id, toIndex: number): void;
  /**
   * Removes a column with its cascade: dropped from its table's indexes (an emptied index goes),
   * and from relationships (an end of one column removes the edge; a composite end loses the pair).
   */
  removeColumn(tableId: Id, columnId: Id): RemovalResult;
  /** Adds an index (parts: column ids of the table or `{ expr }`) and returns its id. */
  addIndex(tableId: Id, data: NewDbIndex, index?: number): Id;
  updateIndex(tableId: Id, indexId: Id, patch: Patch<DbIndex>): void;
  moveIndex(tableId: Id, indexId: Id, toIndex: number): void;
  removeIndex(tableId: Id, indexId: Id): RemovalResult;
  /** Adds a table-level check constraint and returns its id. */
  addCheck(tableId: Id, data: NewDbCheck, index?: number): Id;
  updateCheck(tableId: Id, checkId: Id, patch: Patch<DbCheck>): void;
  moveCheck(tableId: Id, checkId: Id, toIndex: number): void;
  removeCheck(tableId: Id, checkId: Id): RemovalResult;
  /** Adds an enum (values optional, ids generated where missing) and returns its id. */
  addEnum(data: NewDbEnum, index?: number): Id;
  /** Renames an enum or sets its schema, note or colour (041); values change through value ops. */
  updateEnum(enumId: Id, patch: EnumPatch): void;
  moveEnum(enumId: Id, toIndex: number): void;
  /** Removes an enum and clears `enumRef` on every column naming it (types are kept). */
  removeEnum(enumId: Id): RemovalResult;
  addEnumValue(enumId: Id, data: NewDbEnumValue, index?: number): Id;
  updateEnumValue(enumId: Id, valueId: Id, patch: EnumValuePatch): void;
  moveEnumValue(enumId: Id, valueId: Id, toIndex: number): void;
  removeEnumValue(enumId: Id, valueId: Id): RemovalResult;

  /**
   * Runs `fn` as one transaction: one change event, one undo step (never merged with typing).
   * Nested batches flatten. Each operation inside still validates before it writes, but Yjs cannot
   * roll back: if `fn` throws halfway, the edits made before the throw stay applied.
   *
   * With `options.merge` (046), batches that repeat the same key join one undo step however far
   * apart they are, until another tracked write, `undo`, `redo` or `stopCapturing` ends the run.
   */
  batch<T>(fn: () => T, options?: BatchOptions): T;
  /** Ends the current undo step: the next edit (or merged batch) starts a new one. */
  stopCapturing(): void;
  /**
   * Marks the start of a gesture (a drag, a multi-step form change): every edit until the
   * matching `endGesture` is one undo step, however long it takes. Calls nest and are counted.
   */
  beginGesture(): void;
  /** @throws Error when there is no open gesture. */
  endGesture(): void;
  /**
   * Ends the open gesture (all nesting levels) and undoes it, leaving no undo or redo entry: the
   * undo and redo stacks are as before `beginGesture` (016, R14; Esc during a drag).
   * @throws Error when there is no open gesture.
   */
  cancelGesture(): void;
  /** Undoes this editor's last step. Returns false when there is nothing to undo. */
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Calls `listener` when undo or redo availability changes. Returns an unsubscribe function. */
  onHistoryChange(listener: () => void): () => void;
  /** Detaches the undo history from the document. */
  destroy(): void;
}

export function createEditor(doc: DeckDoc, options: EditorOptions = {}): DeckEditor {
  const origin = { editor: 'sododeck' };
  editorOrigins.add(origin);
  // Second origin for view state that is saved and synced but never undone (collapse, preset
  // materialization; research R5). Registered as local, deliberately not in `trackedOrigins`.
  const untrackedOrigin = { editor: 'sododeck', untracked: true };
  editorOrigins.add(untrackedOrigin);

  const undoManager = new Y.UndoManager(rootTypes(doc), {
    trackedOrigins: new Set([origin]),
    captureTimeout: options.captureTimeout ?? 500,
  });

  const ids = makeIdAllocator(doc, options.newId ?? defaultNewId, origin);

  // Undo grouping (research R5). Yjs merges tracked transactions closer than `captureTimeout`;
  // `stopCapturing()` forces the next one into a new step.
  let lastKey: string | undefined;
  let gestureDepth = 0;
  let transactDepth = 0;
  let savedTimeout = undoManager.captureTimeout;

  // A gesture holds back the redo stack instead of clearing it (Yjs clears it on the first new
  // edit), so `cancelGesture` can put it back. The held items stay protected from garbage
  // collection until the gesture ends normally, when they are cleared for real (016, R14).
  type StackItem = (typeof undoManager.redoStack)[number];
  const clearStacks = undoManager.clear.bind(undoManager);
  let heldRedo: StackItem[] = [];
  let gestureUndoLength = 0;
  undoManager.clear = (clearUndoStack = true, clearRedoStack = true) => {
    if (gestureDepth > 0 && !clearUndoStack && clearRedoStack) {
      heldRedo = [...heldRedo, ...undoManager.redoStack];
      undoManager.redoStack = [];
      return;
    }
    clearStacks(clearUndoStack, clearRedoStack);
  };
  /** Clears these redo items for real (lets Yjs collect what they kept alive). */
  const dropRedo = (items: StackItem[]) => {
    if (items.length === 0) return;
    const current = undoManager.redoStack;
    undoManager.redoStack = items;
    clearStacks(false, true);
    undoManager.redoStack = current;
  };
  const closeGesture = () => {
    gestureDepth = 0;
    undoManager.captureTimeout = savedTimeout;
    undoManager.stopCapturing();
    lastKey = undefined;
  };

  // History-change notification (also used by the sticky draft, which can change availability
  // without a Yjs event: popping a stack item manually fires none).
  let lastAvailability = [undoManager.canUndo(), undoManager.canRedo()].join();
  const historyListeners = new Set<() => void>();
  const checkHistoryChange = () => {
    const now = [undoManager.canUndo(), undoManager.canRedo()].join();
    if (now !== lastAvailability) {
      lastAvailability = now;
      for (const listener of historyListeners) listener();
    }
  };
  for (const event of ['stack-item-added', 'stack-item-popped', 'stack-cleared'] as const) {
    undoManager.on(event, checkHistoryChange);
  }

  // Sticky draft (research R5, ADR 0010): a note created by a drop or "N" whose text edits merge
  // into one undo step "however long it takes", by keying on `stickies:<id>` and lifting the
  // capture timeout while the draft is open (see ops/stickies.ts). `draftStackLength` is the undo
  // stack's length just before the draft's own add, so ending the draft can tell whether its item
  // is still the only thing pushed since (nothing else merged into it or landed on top of it).
  let draftId: Id | null = null;
  let draftStackLength = 0;
  let draftSavedTimeout = undoManager.captureTimeout;

  const ctx: EditContext = {
    doc,
    transact: (fn, key, merge = false) => {
      // An operation inside a batch joins the batch's transaction: only the outermost call decides
      // the undo step (046: a nested call must not end a merge run).
      if (transactDepth > 0) return fn();
      // Inside a gesture everything merges; outside, a new object or a structural edit starts a
      // new step. Yjs flattens nested transactions into the outermost one (batches).
      const continuing = key !== undefined && key === lastKey;
      if (gestureDepth === 0 && !continuing) undoManager.stopCapturing();
      lastKey = key;
      // A merge run ignores the capture window for this transaction only (046 R2): applies are
      // further apart than `captureTimeout`, yet one typing burst is one undo step.
      const held = undoManager.captureTimeout;
      if (merge && continuing && gestureDepth === 0) undoManager.captureTimeout = Infinity;
      let result: ReturnType<typeof fn> | undefined;
      transactDepth++;
      try {
        doc.transact(() => {
          result = fn();
        }, origin);
      } finally {
        transactDepth--;
        undoManager.captureTimeout = held;
      }
      return result as ReturnType<typeof fn>;
    },
    transactUntracked: (fn) => {
      let result: ReturnType<typeof fn> | undefined;
      doc.transact(() => {
        result = fn();
      }, untrackedOrigin);
      return result as ReturnType<typeof fn>;
    },
    allocate: (prefix, reserved) => ids.allocate(prefix, reserved),
    reserve: (list) => {
      ids.reserve(list);
    },
  };

  // Check and repair on receive (036 R9): after a change from elsewhere that removed a component
  // or group, or added or changed a view, drop view entries that now name nothing. The repair is
  // this editor's own (untracked) transaction, so it never triggers another round.
  const touchesViewRefs = ({ changes }: DeckChange) =>
    changes.some(
      (c) =>
        (c.scope === 'views' && c.child === undefined && c.kind !== 'removed') ||
        ((c.scope === 'nodes' || c.scope === 'groups') && c.kind === 'removed'),
    );
  const stopRepair =
    options.repair === false
      ? undefined
      : observeDeck(doc, (change) => {
          if (change.origin !== 'remote' || !touchesViewRefs(change)) return;
          if (!hasDanglingViewRefs(doc)) return;
          ctx.transactUntracked(() => repairViewRefs(doc));
        });

  return {
    doc,
    updateMeta: (patch) => {
      updateMeta(ctx, patch);
    },
    add: (c, data) => addObject(ctx, c, data),
    update: (c, id, patch) => {
      updateObject(ctx, c, id, patch);
    },
    remove: (c, id) => removeObject(ctx, c, id),
    reorder: (c, id, toIndex) => {
      reorderObject(ctx, c, id, toIndex);
    },
    addStep: (flowId, data, index) => addStep(ctx, flowId, data, index),
    updateStep: (flowId, stepId, patch) => {
      updateStep(ctx, flowId, stepId, patch);
    },
    removeStep: (flowId, stepId) => removeStep(ctx, flowId, stepId),
    moveStep: (flowId, stepId, toIndex) => {
      moveStep(ctx, flowId, stepId, toIndex);
    },
    appendStep: (flowId, branchId, data) => appendStep(ctx, flowId, branchId, data),
    addBranch: (flowId, afterStepId, data) => addBranch(ctx, flowId, afterStepId, data),
    updateBranch: (flowId, branchId, patch) => {
      updateBranch(ctx, flowId, branchId, patch);
    },
    removeBranch: (flowId, branchId) => removeBranch(ctx, flowId, branchId),
    restoreFlowStructure: (flowId, checkpoint) => {
      restoreFlowStructure(ctx, flowId, checkpoint);
    },
    addRule: (data) => addRule(ctx, data),
    updateRule: (id, patch) => {
      updateRule(ctx, id, patch);
    },
    removeRule: (id) => removeRule(ctx, id),
    addRuleColumn: (ruleId, side, label, index) => addRuleColumn(ctx, ruleId, side, label, index),
    renameRuleColumn: (ruleId, columnId, label) => {
      renameRuleColumn(ctx, ruleId, columnId, label);
    },
    moveRuleColumn: (ruleId, columnId, toIndex) => {
      moveRuleColumn(ctx, ruleId, columnId, toIndex);
    },
    removeRuleColumn: (ruleId, columnId) => removeRuleColumn(ctx, ruleId, columnId),
    addRuleRow: (ruleId, cells, index) => addRuleRow(ctx, ruleId, cells, index),
    setRuleCell: (ruleId, rowId, columnId, value) => {
      setRuleCell(ctx, ruleId, rowId, columnId, value);
    },
    moveRuleRow: (ruleId, rowId, toIndex) => {
      moveRuleRow(ctx, ruleId, rowId, toIndex);
    },
    removeRuleRow: (ruleId, rowId) => {
      removeRuleRow(ctx, ruleId, rowId);
    },
    attachRule: (host, ruleId) => {
      attachRule(ctx, host, ruleId);
    },
    detachRule: (host, ruleId) => {
      detachRule(ctx, host, ruleId);
    },
    setRuleInputs: (flowId, stepId, ruleId, values) => {
      setRuleInputs(ctx, flowId, stepId, ruleId, values);
    },
    beginStickyDraft: (data) => {
      if (draftId !== null) {
        throw new DeckEditError('invalid', [
          { path: '', message: 'A sticky draft is already open.' },
        ]);
      }
      draftStackLength = undoManager.undoStack.length;
      const id = addSticky(ctx, data);
      draftId = id;
      draftSavedTimeout = undoManager.captureTimeout;
      undoManager.captureTimeout = Infinity;
      checkHistoryChange();
      return id;
    },
    endStickyDraft: (id) => {
      if (draftId !== id) {
        throw new DeckEditError('invalid', [
          { path: '', message: 'No sticky draft is open for this note.' },
        ]);
      }
      const current = getObject(doc, 'stickies', id)?.text;
      const blank = current === undefined || current.trim() === '';
      if (blank) {
        if (current !== undefined) deleteStickyIfPresent(ctx, id);
        // Still exactly our item (nothing else merged in or landed on top): drop it, so the
        // draft leaves no undo or redo entry at all.
        if (undoManager.undoStack.length === draftStackLength + 1) {
          undoManager.undoStack.pop();
        }
      }
      undoManager.captureTimeout = draftSavedTimeout;
      undoManager.stopCapturing();
      lastKey = undefined;
      draftId = null;
      checkHistoryChange();
      return blank ? 'discarded' : 'kept';
    },
    freeLegacyStickies: () => freeLegacyStickies(ctx),
    setStickySize: (id, size) => {
      setStickySize(ctx, id, size);
    },
    setStickyFont: (ids, fontSize) => {
      setStickyFont(ctx, ids, fontSize);
    },
    setStickyAlign: (ids, align) => {
      setStickyAlign(ctx, ids, align);
    },
    setStickyColour: (ids, colour) => {
      setStickyColour(ctx, ids, colour);
    },
    setStickyTags: (id, tags) => {
      setStickyTags(ctx, id, tags);
    },
    moveSticky: (id, point) => {
      moveSticky(ctx, id, point);
    },
    addImages: (images) => addImages(ctx, images),
    moveImage: (id, point) => {
      moveImage(ctx, id, point);
    },
    setImageSize: (id, size) => {
      setImageSize(ctx, id, size);
    },
    setImageText: (id, text) => {
      setImageText(ctx, id, text);
    },
    setImageGroup: (id, group) => {
      setImageGroup(ctx, id, group);
    },
    setImageCrop: (id, crop) => {
      setImageCrop(ctx, id, crop);
    },
    setImageFlip: (ids, axis, on) => {
      setImageFlip(ctx, ids, axis, on);
    },
    bringToFront: (targets) => {
      restack(ctx, targets, 'front');
    },
    sendToBack: (targets) => {
      restack(ctx, targets, 'back');
    },
    bringForward: (targets) => {
      restack(ctx, targets, 'forward');
    },
    sendBackward: (targets) => {
      restack(ctx, targets, 'backward');
    },
    moveInView: (viewId, positions) => {
      moveInView(ctx, viewId, positions);
    },
    setPinned: (viewId, nodeIds, pinned) => {
      setPinned(ctx, viewId, nodeIds, pinned);
    },
    updateView: (viewId, patch) => {
      updateView(ctx, viewId, patch);
    },
    addView: (data) => addView(ctx, data),
    removeView: (viewId) => removeView(ctx, viewId),
    setCollapsed: (viewId, groupId, collapsed) => {
      setCollapsed(ctx, viewId, groupId, collapsed);
    },
    fillGroupFrames: (base, perView) => {
      fillGroupFrames(ctx, base, perView);
    },
    setGroupFrames: (viewId, frames) => {
      setGroupFrames(ctx, viewId, frames);
    },
    pasteFragment: (fragment, options) => pasteFragment(ctx, fragment, options),
    groupSelection: (selection) => groupSelection(ctx, selection),
    setNodeDisplay: (nodeIds, display) => {
      setNodeDisplay(ctx, nodeIds, display);
    },
    setLocked: (ids, locked, collection = 'nodes') => {
      setLocked(ctx, collection, ids, locked);
    },
    setTableOwner: (tableId, cardId) => {
      setTableOwner(ctx, tableId, cardId);
    },
    addTouch: (flowId, stepId, touch) => {
      addTouch(ctx, flowId, stepId, touch);
    },
    setTouchAccess: (flowId, stepId, key, access) => {
      setTouchAccess(ctx, flowId, stepId, key, access);
    },
    removeTouch: (flowId, stepId, key) => {
      removeTouch(ctx, flowId, stepId, key);
    },
    setNodeIcon: (nodeIds, icon) => {
      setNodeIcon(ctx, nodeIds, icon);
    },
    setCardSize: (nodeId, size) => {
      setCardSize(ctx, nodeId, size);
    },
    setEdgeRoute: (edgeId, patch) => {
      setEdgeRoute(ctx, edgeId, patch);
    },
    setEdgeStyle: (edgeIds, patch) => {
      setEdgeStyle(ctx, edgeIds, patch);
    },
    setEdgeLabelAt: (edgeId, at) => {
      setEdgeLabelAt(ctx, edgeId, at);
    },
    setEdgeShape: (edgeIds, shape) => {
      setEdgeShape(ctx, edgeIds, shape);
    },
    setStyle: (targets, channel, value) => {
      setStyle(ctx, targets, channel, value);
    },
    addSwatch: (hex) => {
      addSwatch(ctx, hex);
    },
    setPackOn: (packId, on) => {
      setPackOn(ctx, packId, on);
    },
    setTagColor: (tag, color) => {
      setTagColor(ctx, tag, color);
    },
    renameTag: (from, to) => renameTag(ctx, from, to),
    deleteTag: (tag) => deleteTag(ctx, tag),
    removeSwatch: (hex) => {
      removeSwatch(ctx, hex);
    },
    addField: (field, opts) => addField(ctx, field, opts),
    updateField: (id, patch) => {
      updateField(ctx, id, patch);
    },
    moveField: (id, beforeId, typeId) => {
      moveField(ctx, id, beforeId, typeId);
    },
    deleteField: (id) => {
      deleteField(ctx, id);
    },
    addOption: (fieldId, option, opts) => addOption(ctx, fieldId, option, opts),
    updateOption: (fieldId, optionId, patch) => {
      updateOption(ctx, fieldId, optionId, patch);
    },
    moveOption: (fieldId, optionId, beforeId) => {
      moveOption(ctx, fieldId, optionId, beforeId);
    },
    deleteOption: (fieldId, optionId) => {
      deleteOption(ctx, fieldId, optionId);
    },
    changeFieldKind: (id, kind) => {
      changeFieldKind(ctx, id, kind);
    },
    setValues: (nodeIds, fieldId, value) => {
      setValues(ctx, nodeIds, fieldId, value);
    },
    setGroupingMode: (mode) => {
      setGroupingMode(ctx, mode);
    },
    setDialect: (dialect) => {
      setDialect(ctx, dialect);
    },
    setBlockSqlExport: (on) => {
      setBlockSqlExport(ctx, on);
    },
    setTableDisplay: (patch) => {
      setTableDisplay(ctx, patch);
    },
    setRelationshipDisplay: (patch) => {
      setRelationshipDisplay(ctx, patch);
    },
    addColumn: (tableId, data, index) => addPart(ctx, tableId, 'columns', data, index),
    updateColumn: (tableId, columnId, patch) => {
      updatePart(ctx, tableId, 'columns', columnId, patch);
    },
    moveColumn: (tableId, columnId, toIndex) => {
      movePart(ctx, tableId, 'columns', columnId, toIndex);
    },
    removeColumn: (tableId, columnId) => removeColumn(ctx, tableId, columnId),
    addIndex: (tableId, data, index) => addPart(ctx, tableId, 'indexes', data, index),
    updateIndex: (tableId, indexId, patch) => {
      updatePart(ctx, tableId, 'indexes', indexId, patch);
    },
    moveIndex: (tableId, indexId, toIndex) => {
      movePart(ctx, tableId, 'indexes', indexId, toIndex);
    },
    removeIndex: (tableId, indexId) => removeTablePart(ctx, tableId, 'indexes', indexId),
    addCheck: (tableId, data, index) => addPart(ctx, tableId, 'checks', data, index),
    updateCheck: (tableId, checkId, patch) => {
      updatePart(ctx, tableId, 'checks', checkId, patch);
    },
    moveCheck: (tableId, checkId, toIndex) => {
      movePart(ctx, tableId, 'checks', checkId, toIndex);
    },
    removeCheck: (tableId, checkId) => removeTablePart(ctx, tableId, 'checks', checkId),
    addEnum: (data, index) => addEnum(ctx, data, index),
    updateEnum: (enumId, patch) => {
      updateEnum(ctx, enumId, patch);
    },
    moveEnum: (enumId, toIndex) => {
      moveEnum(ctx, enumId, toIndex);
    },
    removeEnum: (enumId) => removeEnum(ctx, enumId),
    addEnumValue: (enumId, data, index) => addEnumValue(ctx, enumId, data, index),
    updateEnumValue: (enumId, valueId, patch) => {
      updateEnumValue(ctx, enumId, valueId, patch);
    },
    moveEnumValue: (enumId, valueId, toIndex) => {
      moveEnumValue(ctx, enumId, valueId, toIndex);
    },
    removeEnumValue: (enumId, valueId) => removeEnumValue(ctx, enumId, valueId),
    batch: (fn, options) =>
      options?.merge === undefined
        ? ctx.transact(fn)
        : ctx.transact(fn, `merge:${options.merge}`, true),
    stopCapturing: () => {
      undoManager.stopCapturing();
      lastKey = undefined;
    },
    beginGesture: () => {
      if (gestureDepth++ === 0) {
        undoManager.stopCapturing();
        savedTimeout = undoManager.captureTimeout;
        undoManager.captureTimeout = Infinity;
        gestureUndoLength = undoManager.undoStack.length;
        heldRedo = [];
      }
    },
    endGesture: () => {
      if (gestureDepth === 0) throw new Error('endGesture() called without beginGesture().');
      if (--gestureDepth === 0) {
        closeGesture();
        dropRedo(heldRedo);
        heldRedo = [];
      }
    },
    cancelGesture: () => {
      if (gestureDepth === 0) throw new Error('cancelGesture() called without beginGesture().');
      closeGesture();
      const undone: StackItem[] = [];
      while (undoManager.undoStack.length > gestureUndoLength) {
        undoManager.undo();
        const item = undoManager.redoStack.pop();
        if (item !== undefined) undone.push(item);
      }
      dropRedo(undone);
      undoManager.redoStack = heldRedo;
      heldRedo = [];
      checkHistoryChange();
    },
    undo: () => {
      lastKey = undefined;
      undoManager.stopCapturing();
      return undoManager.undo() !== null;
    },
    redo: () => {
      lastKey = undefined;
      undoManager.stopCapturing();
      return undoManager.redo() !== null;
    },
    canUndo: () => undoManager.canUndo(),
    canRedo: () => undoManager.canRedo(),
    onHistoryChange: (listener) => {
      historyListeners.add(listener);
      return () => {
        historyListeners.delete(listener);
      };
    },
    destroy: () => {
      stopRepair?.();
      for (const event of ['stack-item-added', 'stack-item-popped', 'stack-cleared'] as const) {
        undoManager.off(event, checkHistoryChange);
      }
      undoManager.destroy();
      ids.destroy();
      editorOrigins.delete(origin);
      editorOrigins.delete(untrackedOrigin);
    },
  };
}
