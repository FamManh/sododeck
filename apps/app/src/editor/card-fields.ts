/**
 * What a card shows of its typed fields (032, research R5): the header status, the chip shelf
 * (select, status, person, date, date range), the label–value rows (text, number, link, progress)
 * and the count of fields holding a value that stay in the drawer ("+N fields"). Pure; memoised
 * per node and field list, so 500 cards of one type share the work.
 *
 * Also the geometry of the fields block (`fieldBlock`), measured like the tag block (029 R7), so
 * `cardLayout`, the canvas and the export agree without reading the DOM.
 */
import {
  fieldsOfNode,
  hasValue,
  valueOf,
  validateValue,
  type ResolvedField,
} from '@sododeck/model';
import type { ColorRef, FieldKind, Node, SododeckFile, StatusIcon } from '@sododeck/schema';

import { textMeasurer } from './card-tags';
import type { TextMeasurer } from './export/text-measure';
import { optionOf, personInitials, valueText } from './fields/field-format';

type FieldDeck = Pick<SododeckFile, 'fields' | 'fieldDefaults'>;
type ChipKind = 'select' | 'status' | 'person' | 'date' | 'dateRange';
type RowKind = 'text' | 'number' | 'link' | 'progress';

/** One chip of the shelf (or the header status). */
export interface FieldChip {
  fieldId: string;
  kind: ChipKind;
  /** "<field>: <value>", the accessible name and tooltip. */
  name: string;
  /** What the chip reads ("In progress", "Lan", "14 Oct", "6–17 Oct"). */
  text: string;
  /** Select / status: the option's colour (absent = slate). Person / date chips follow the card. */
  color?: ColorRef | undefined;
  /** Status only. */
  icon?: StatusIcon | undefined;
  /** Person only: the avatar's letters. */
  initials?: string | undefined;
}

/** One label–value row. */
export interface FieldRow {
  fieldId: string;
  kind: RowKind;
  label: string;
  /** The value as text ("24 h", "82 %", the link label or address). */
  text: string;
  /** Progress: 0–100, clamped. */
  progress?: number | undefined;
  /** Link: the address, opened only on click. */
  href?: string | undefined;
}

export interface CardFieldView {
  /** The first on-card status field with a value: drawn in the header's status slot. */
  header: FieldChip | undefined;
  chips: readonly FieldChip[];
  rows: readonly FieldRow[];
  /** Fields of the card holding a value that are not shown on it ("+N fields"). */
  hidden: number;
}

export const EMPTY_FIELD_VIEW: CardFieldView = {
  header: undefined,
  chips: [],
  rows: [],
  hidden: 0,
};

const CHIP_KINDS = new Set<FieldKind>(['select', 'status', 'person', 'date', 'dateRange']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function chipOf(field: ResolvedField, value: unknown, text: string): FieldChip {
  const chip: FieldChip = {
    fieldId: field.id,
    kind: field.kind as ChipKind,
    name: `${field.name}: ${text}`,
    text,
  };
  if (field.kind === 'select' || field.kind === 'status') {
    const option = optionOf(field, value);
    chip.color = option?.color;
    if (field.kind === 'status') chip.icon = option?.icon ?? 'circle';
  }
  if (field.kind === 'person') chip.initials = personInitials(text);
  return chip;
}

function rowOf(field: ResolvedField, value: unknown, text: string): FieldRow {
  const row: FieldRow = { fieldId: field.id, kind: field.kind as RowKind, label: field.name, text };
  if (field.kind === 'progress' && typeof value === 'number') {
    row.progress = Math.min(100, Math.max(0, value));
  }
  if (field.kind === 'link' && isRecord(value) && typeof value.url === 'string') {
    row.href = value.url;
  }
  return row;
}

function build(fields: readonly ResolvedField[], node: Node): CardFieldView {
  let header: FieldChip | undefined;
  const chips: FieldChip[] = [];
  const rows: FieldRow[] = [];
  let hidden = 0;
  for (const field of fields) {
    const value = valueOf(node, field.id);
    if (!hasValue(value)) continue;
    // A value that does not fit its field (a dangling option, progress 140) is kept but not drawn
    // (FR-017); progress outside 0–100 is the exception: drawn clamped and reported.
    const fits =
      validateValue(field, value) === null ||
      (field.kind === 'progress' && typeof value === 'number');
    const text = fits ? valueText(field, value) : undefined;
    if (text === undefined) continue;
    if (field.onCard !== true) {
      // Built-ins off the card are not "more fields": Tech already reads as the subtitle and a
      // deck saved before 032 must look exactly as before (US4 AS4).
      if (field.source !== 'built-in') hidden++;
      continue;
    }
    if (CHIP_KINDS.has(field.kind)) {
      const chip = chipOf(field, value, text);
      if (header === undefined && field.kind === 'status') header = chip;
      else chips.push(chip);
    } else {
      rows.push(rowOf(field, value, text));
    }
  }
  if (header === undefined && chips.length === 0 && rows.length === 0 && hidden === 0) {
    return EMPTY_FIELD_VIEW;
  }
  return { header, chips, rows, hidden };
}

const viewCache = new WeakMap<
  Node,
  { fields: readonly ResolvedField[]; view: CardFieldView; year: number }
>();

/** What `node` shows of its fields, given the deck's field definitions. */
export function cardFieldView(deck: FieldDeck, node: Node): CardFieldView {
  // No value at all (the common case): nothing to show and nothing hidden.
  if (
    node.values === undefined &&
    node.tech === undefined &&
    node.host === undefined &&
    node.owner === undefined
  ) {
    return EMPTY_FIELD_VIEW;
  }
  const fields = fieldsOfNode(deck, node);
  const year = new Date().getFullYear();
  const cached = viewCache.get(node);
  if (cached?.fields === fields && cached.year === year) return cached.view;
  const view = build(fields, node);
  viewCache.set(node, { fields, view, year });
  return view;
}

/** Equal views draw the same (cache checks in `deck-to-flow.ts`). */
export function sameFieldView(a: CardFieldView, b: CardFieldView): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

// ——— Field definitions the canvas geometry reads (see `canvas-geometry.ts` `cardLayoutOf`) ———

let currentDeck: FieldDeck = {};

/**
 * The deck whose field definitions size the cards (032). Card sizes are read in many places that
 * hold only a node (edges, group frames, drags); `viewStateOf` sets this for the deck it derives,
 * so every one of them sizes the fields block the canvas draws. One deck is open per tab.
 */
export function setCardFieldDeck(deck: FieldDeck): void {
  currentDeck = deck;
}

/** `node`'s field view from the deck set by `setCardFieldDeck`. */
export function currentFieldView(node: Node): CardFieldView {
  return cardFieldView(currentDeck, node);
}

// ——— Block geometry ———

/** The field chip (DESIGN.md `--sd-deck-chip`): 21 tall, padding 0 8 0 7, Geist 11.5 / 500. */
export const FIELD_CHIP = {
  height: 21,
  gap: 4,
  paddingLeft: 7,
  paddingRight: 8,
  /** Icon (12) or avatar (16) plus the 4 px before the text. */
  icon: 12,
  avatar: 16,
  iconGap: 4,
  font: "500 11.5px 'Geist Variable', system-ui, sans-serif",
  slack: 2,
} as const;

export const FIELD_BLOCK = {
  rowHeight: 19,
  pillHeight: 20,
  /** Between the shelf, the rows and the pill. */
  gap: 8,
  cardPaddingX: 13,
  pillFont: "500 11px 'Geist Variable', system-ui, sans-serif",
} as const;

/** Where a chip sits on the shelf: `row` from 0, `x` from the block's left edge. */
export interface FieldChipBox {
  chip: FieldChip;
  row: number;
  x: number;
  width: number;
}

function leadingWidth(chip: FieldChip): number {
  if (chip.kind === 'person') return FIELD_CHIP.avatar + FIELD_CHIP.iconGap;
  if (chip.kind === 'select') return 0;
  return FIELD_CHIP.icon + FIELD_CHIP.iconGap;
}

/** The chip's natural width, capped at the card's inner width. */
export function fieldChipWidth(chip: FieldChip, innerWidth: number, measure: TextMeasurer): number {
  const natural =
    FIELD_CHIP.paddingLeft +
    leadingWidth(chip) +
    measure(chip.text, FIELD_CHIP.font) +
    FIELD_CHIP.paddingRight +
    FIELD_CHIP.slack;
  return Math.min(innerWidth, natural);
}

/** Wraps the shelf across `innerWidth` px, gap 4, like the tag block. */
export function fieldChipBoxes(
  chips: readonly FieldChip[],
  innerWidth: number,
  measure: TextMeasurer,
): FieldChipBox[] {
  const boxes: FieldChipBox[] = [];
  let row = -1;
  let used = 0;
  for (const chip of chips) {
    const width = fieldChipWidth(chip, innerWidth, measure);
    if (row < 0 || used + FIELD_CHIP.gap + width > innerWidth) {
      row += 1;
      boxes.push({ chip, row, x: 0, width });
    } else {
      boxes.push({ chip, row, x: used + FIELD_CHIP.gap, width });
    }
    used = (boxes.at(-1)?.x ?? 0) + width;
  }
  return boxes;
}

/** The fields block of a `cardWidth` px card; 0 tall when it shows nothing. */
export interface FieldBlock {
  height: number;
  chipRows: number;
  /** Top of the rows and of the pill inside the block. */
  rowsTop: number;
  pillTop: number;
}

export const NO_FIELD_BLOCK: FieldBlock = { height: 0, chipRows: 0, rowsTop: 0, pillTop: 0 };

/**
 * Blocks measured with the default text measurer, per view and card width. Views keep their
 * identity per node (`cardFieldView`), and hit tests (marquee, edges, group frames) size every
 * card on each pointer move, so measuring chip text again each time is what this saves.
 */
const blockCache = new WeakMap<CardFieldView, Map<number, FieldBlock>>();

/** Shelf, rows and pill stacked 8 px apart (frame 124); the gap above the block is the card's. */
export function fieldBlock(
  view: CardFieldView,
  cardWidth: number,
  measure?: TextMeasurer,
): FieldBlock {
  if (view.chips.length === 0 && view.rows.length === 0 && view.hidden === 0) {
    return NO_FIELD_BLOCK;
  }
  if (measure !== undefined) return measureBlock(view, cardWidth, measure);
  let byWidth = blockCache.get(view);
  if (byWidth === undefined) {
    byWidth = new Map();
    blockCache.set(view, byWidth);
  }
  let block = byWidth.get(cardWidth);
  if (block === undefined) {
    block = measureBlock(view, cardWidth, textMeasurer());
    byWidth.set(cardWidth, block);
  }
  return block;
}

function measureBlock(view: CardFieldView, cardWidth: number, measure: TextMeasurer): FieldBlock {
  const inner = cardWidth - 2 * FIELD_BLOCK.cardPaddingX;
  const last = fieldChipBoxes(view.chips, inner, measure).at(-1);
  const chipRows = last === undefined ? 0 : last.row + 1;
  let height = chipRows === 0 ? 0 : chipRows * FIELD_CHIP.height + (chipRows - 1) * FIELD_CHIP.gap;
  const gapIfAny = () => (height > 0 ? FIELD_BLOCK.gap : 0);
  let rowsTop = height;
  if (view.rows.length > 0) {
    rowsTop = height + gapIfAny();
    height = rowsTop + view.rows.length * FIELD_BLOCK.rowHeight;
  }
  let pillTop = height;
  if (view.hidden > 0) {
    pillTop = height + gapIfAny();
    height = pillTop + FIELD_BLOCK.pillHeight;
  }
  return { height, chipRows, rowsTop, pillTop };
}

/** "+3 fields" / "+1 field". */
export function hiddenLabel(count: number): string {
  return `+${String(count)} ${count === 1 ? 'field' : 'fields'}`;
}

/** The pill's accessible name: "3 more fields". */
export function hiddenName(count: number): string {
  return `${String(count)} more ${count === 1 ? 'field' : 'fields'}`;
}
