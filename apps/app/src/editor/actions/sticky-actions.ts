import type { Sticky } from '@sododeck/schema';
import { AlignJustify, Bold, ChevronsUpDown, Link, Lock, Tags, Type } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { STICKY_NODE_PREFIX } from '../deck-to-flow';
import { oneStep } from '../fields/one-step';
import { FIXED_FONT_SIZES } from '../stickies/fit-font-size';
import { linkRange, toggleBold, type MarkdownEdit } from '../stickies/sticky-markdown';
import { stickyColourName, stickySwatch } from '../stickies/sticky-tint';
import type { Action, ActionContext } from './types';

/**
 * The note toolbar's buttons (053 US3, contract "Sticky toolbar"): each acts on every selected
 * note and is one undo step. Menu items for notes stay the common ones (Copy JSON, Delete).
 */

const stickiesOf = (ctx: ActionContext): Sticky[] => {
  const ids = new Set(ctx.selection.stickies);
  return ctx.deck.stickies.filter((sticky) => ids.has(sticky.id));
};

const announce = (text: string) => {
  useUiStore.getState().announce(text);
};

const notes = (count: number) => (count === 1 ? 'note' : `${String(count)} notes`);

/** The value every note shares, or `mixed` when they differ (the toolbar then says "Mixed"). */
function shared<T>(values: readonly T[]): { mixed: boolean; value: T | undefined } {
  const [first] = values;
  const same = values.every((value) => value === first);
  return { mixed: !same, value: same ? first : undefined };
}

type Align = NonNullable<Sticky['align']>;
const ALIGN_ORDER: readonly Align[] = ['left', 'center', 'right'];
const alignOf = (sticky: Sticky): Align => sticky.align ?? 'center';
const alignText = (align: Align) => (align === 'center' ? 'centre' : align);
const colourOf = (sticky: Sticky) => sticky.color ?? 'amber';

/** The textarea of the note being edited, when it is one of the selected ones. */
function openField(ctx: ActionContext): HTMLTextAreaElement | null {
  const editing = useUiStore.getState().stickyEditing;
  if (editing === null || !ctx.selection.stickies.includes(editing)) return null;
  return document.querySelector<HTMLTextAreaElement>(
    `[data-node-id="${STICKY_NODE_PREFIX}${editing}"] textarea`,
  );
}

/**
 * Writes an edit into the textarea through its own `input` event, so the field's live draft, its
 * gesture and the undo step work exactly as when typing. The selection is restored afterwards.
 */
function writeIntoField(field: HTMLTextAreaElement, edit: MarkdownEdit): void {
  // The prototype's setter, not `field.value =`: React tracks the element's own value property and
  // would swallow the change as "nothing new".
  // eslint-disable-next-line @typescript-eslint/unbound-method -- called with `.call` below
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (set === undefined) return;
  set.call(field, edit.text);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.setSelectionRange(edit.start, edit.end);
}

const isBold = (text: string) => text.length > 4 && text.startsWith('**') && text.endsWith('**');

/**
 * Bold or Link (053 R11): the textarea's selection while the note is being edited, the whole
 * text otherwise. Notes with no text are left alone.
 */
function formatText(ctx: ActionContext, kind: 'bold' | 'link'): void {
  const apply = (text: string, start: number, end: number) =>
    kind === 'bold' ? toggleBold(text, start, end) : linkRange(text, start, end);
  const field = openField(ctx);
  if (field !== null) {
    const whole = field.selectionStart === field.selectionEnd;
    const edit = apply(
      field.value,
      whole ? 0 : field.selectionStart,
      whole ? field.value.length : field.selectionEnd,
    );
    if (edit.text !== field.value) writeIntoField(field, edit);
    return;
  }
  const targets = stickiesOf(ctx);
  // Several notes: bold only the ones that are not yet, unless all are (then unbold all).
  const skipBold = kind === 'bold' && !targets.every((sticky) => isBold(sticky.text));
  oneStep(ctx.editor, () => {
    for (const sticky of targets) {
      if (skipBold && isBold(sticky.text)) continue;
      const edit = apply(sticky.text, 0, sticky.text.length);
      if (edit.text !== sticky.text) ctx.editor.update('stickies', sticky.id, { text: edit.text });
    }
  });
  announce(kind === 'bold' ? `Bold toggled on ${notes(targets.length)}` : 'Link added');
}

const every = (ctx: ActionContext, test: (sticky: Sticky) => boolean) => {
  const targets = stickiesOf(ctx);
  return targets.length > 0 && targets.every(test);
};
const allLocked = (ctx: ActionContext) => every(ctx, (sticky) => sticky.locked === true);
const allCollapsed = (ctx: ActionContext) => every(ctx, (sticky) => sticky.collapsed === true);

export const STICKY_ACTIONS: readonly Action[] = [
  {
    id: 'sticky.textSize',
    label: 'Text size',
    toolbarLabel: (ctx) => {
      const size = shared(stickiesOf(ctx).map((sticky) => sticky.fontSize));
      return `Text size: ${size.mixed ? 'Mixed' : size.value === undefined ? 'Auto' : String(size.value)}`;
    },
    icon: Type,
    section: 'edit',
    where: { toolbar: ['sticky'] },
    radio: true,
    children: () =>
      [undefined, ...FIXED_FONT_SIZES].map((size) => ({
        id: `sticky.textSize.${size === undefined ? 'auto' : String(size)}`,
        label: size === undefined ? 'Auto' : String(size),
        section: 'edit' as const,
        where: {},
        checked: (ctx: ActionContext) => every(ctx, (sticky) => sticky.fontSize === size),
        run: (ctx: ActionContext) => {
          const ids = stickiesOf(ctx).map((sticky) => sticky.id);
          oneStep(ctx.editor, () => {
            ctx.editor.setStickyFont(ids, size ?? null);
          });
          announce(size === undefined ? 'Text size automatic' : `Text size ${String(size)}`);
        },
      })),
  },
  {
    id: 'sticky.bold',
    label: 'Bold',
    icon: Bold,
    section: 'edit',
    where: { toolbar: ['sticky'] },
    keepFocus: true,
    run: (ctx) => {
      formatText(ctx, 'bold');
    },
  },
  {
    id: 'sticky.align',
    label: 'Align',
    toolbarLabel: (ctx) => {
      const align = shared(stickiesOf(ctx).map(alignOf));
      return `Align: ${align.value === undefined ? 'Mixed' : alignText(align.value)}`;
    },
    icon: AlignJustify,
    section: 'edit',
    where: { toolbar: ['sticky'] },
    run: (ctx) => {
      // Cycles left, centre, right; a mixed selection starts again from the left.
      const current = shared(stickiesOf(ctx).map(alignOf)).value;
      const index = current === undefined ? -1 : ALIGN_ORDER.indexOf(current);
      const next = ALIGN_ORDER[(index + 1) % ALIGN_ORDER.length] ?? 'left';
      const ids = stickiesOf(ctx).map((sticky) => sticky.id);
      oneStep(ctx.editor, () => {
        ctx.editor.setStickyAlign(ids, next === 'center' ? null : next);
      });
      announce(`Text aligned ${alignText(next)}`);
    },
  },
  {
    id: 'sticky.link',
    label: 'Link',
    icon: Link,
    section: 'edit',
    where: { toolbar: ['sticky'] },
    keepFocus: true,
    run: (ctx) => {
      formatText(ctx, 'link');
    },
  },
  {
    id: 'sticky.colour',
    label: 'Note colour',
    toolbarLabel: (ctx) => {
      const colour = shared(stickiesOf(ctx).map(colourOf));
      return `Note colour: ${colour.mixed ? 'Mixed' : stickyColourName(colour.value)}`;
    },
    swatch: (ctx) => {
      const colour = shared(stickiesOf(ctx).map(colourOf));
      return colour.mixed ? null : stickySwatch(colour.value).swatch;
    },
    section: 'edit',
    field: 'stickyColour',
    where: { toolbar: ['sticky'] },
    run: () => {
      useUiStore.getState().openToolbarField('stickyColour');
    },
  },
  {
    id: 'sticky.tags',
    label: 'Tags',
    icon: Tags,
    section: 'edit',
    field: 'tags',
    where: { toolbar: ['sticky'] },
    run: () => {
      useUiStore.getState().openToolbarField('tags');
    },
  },
  {
    id: 'sticky.collapse',
    label: (ctx) => (allCollapsed(ctx) ? 'Expand' : 'Collapse'),
    icon: ChevronsUpDown,
    section: 'view',
    where: { toolbar: ['sticky'] },
    run: (ctx) => {
      const collapse = !allCollapsed(ctx);
      const ids = stickiesOf(ctx).map((sticky) => sticky.id);
      oneStep(ctx.editor, () => {
        for (const id of ids) {
          ctx.editor.update('stickies', id, { collapsed: collapse ? true : null });
        }
      });
      announce(`${notes(ids.length)} ${collapse ? 'collapsed' : 'expanded'}`);
    },
  },
  {
    id: 'sticky.lock',
    label: (ctx) => (allLocked(ctx) ? 'Unlock' : 'Lock'),
    icon: Lock,
    shortcut: 'lock',
    section: 'view',
    where: { toolbar: ['sticky'] },
    checked: allLocked,
    run: (ctx) => {
      const lock = !allLocked(ctx);
      const ids = stickiesOf(ctx).map((sticky) => sticky.id);
      oneStep(ctx.editor, () => {
        ctx.editor.setLocked(ids, lock, 'stickies');
      });
      announce(`${lock ? 'Locked' : 'Unlocked'} ${notes(ids.length)}`);
    },
  },
];
