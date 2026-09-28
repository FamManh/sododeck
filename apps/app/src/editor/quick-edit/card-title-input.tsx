import { InlineEdit } from '@sododeck/ui/components/inline-edit';
import { cn } from '@sododeck/ui/lib/utils';
import { useReactFlow } from '@xyflow/react';
import { useEffect, useRef } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore, type TitleEdit } from '../../state/ui-store';
import { addComponent } from '../canvas-actions';
import { displayPosition } from '../canvas-geometry';
import { COLLAPSED_NODE_PREFIX, GROUP_NODE_PREFIX } from '../deck-to-flow';
import { panToClear } from '../shell/shell-geometry';
import { scopeOf, visibleGraph } from '../visible-graph';
import { collapsedOf, readViewState } from '../views/use-current-view';
import { commitTitle, nextTitleTarget, readingOrder } from './title-edit';

/** Where a new card goes after ⌘⏎: one 24 px step down and right of the one just named (R3). */
const NEXT_STEP = 24;

/** The canvas element of the object whose title is edited (a card, a group label). */
function cardElement(edit: TitleEdit): HTMLElement | null {
  const ids =
    edit.target === 'node'
      ? [edit.id]
      : [`${GROUP_NODE_PREFIX}${edit.id}`, `${COLLAPSED_NODE_PREFIX}${edit.id}`];
  for (const id of ids) {
    const element = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
    if (element !== null) return element;
  }
  return null;
}

/** The id the canvas's roving focus uses for the edited object. */
function focusIdOf(edit: TitleEdit): string {
  if (edit.target === 'node') return edit.id;
  const collapsed = document.querySelector(
    `[data-node-id="${CSS.escape(`${COLLAPSED_NODE_PREFIX}${edit.id}`)}"]`,
  );
  return `${collapsed === null ? GROUP_NODE_PREFIX : COLLAPSED_NODE_PREFIX}${edit.id}`;
}

/**
 * Pans a card that starts title edit under the drawer or an open flyout back into view (018's
 * drawer rule, spec edge case "Card behind an island").
 */
function useRevealWhileEditing(edit: TitleEdit) {
  const { getViewport, setViewport } = useReactFlow();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const card = cardElement(edit)?.getBoundingClientRect();
      if (card === undefined || card.width === 0) return;
      const right = document.querySelector('[data-region="drawer"]')?.getBoundingClientRect().left;
      const left = document.querySelector('[data-flyout]')?.getBoundingClientRect().right;
      const dx = panToClear(
        { x: card.left, y: card.top, width: card.width, height: card.height },
        {
          ...(right === undefined || right === 0 ? {} : { right }),
          ...(left === undefined || left === 0 ? {} : { left }),
        },
      );
      if (dx === 0) return;
      const viewport = getViewport();
      void setViewport({ ...viewport, x: viewport.x + dx });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
    // Once per edit session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit.id]);
}

/**
 * The title of a card or group label while it is edited in place (019 R2, contract "Inline title
 * edit"). The only copy of the text is the input's draft; the document is written once, on commit,
 * as one undo step. Enter or a click outside commits, Esc cancels, Tab / ⇧Tab commit and move to
 * the next / previous card, and on a new card ⌘⏎ commits and adds another of the same kind.
 */
export function CardTitleInput({
  edit,
  title,
  className,
}: {
  edit: TitleEdit;
  /** The committed title, from the document. */
  title: string;
  className?: string;
}) {
  const editor = useEditor();
  // Set once the edit is committed or cancelled: a later blur (focus moving back to the card or
  // on to the next one) must not write again.
  const done = useRef(false);
  useRevealWhileEditing(edit);

  const commit = (draft: string) => {
    if (done.current) return;
    done.current = true;
    if (commitTitle(editor, edit.target, edit.id, draft, title) === 'renamed') {
      useUiStore.getState().announce(`Renamed to ${draft.trim()}`);
    }
  };
  const end = () => {
    const ui = useUiStore.getState();
    if (ui.titleEdit?.id === edit.id) ui.endTitleEdit();
  };
  const backToCard = () => {
    end();
    useUiStore.getState().focus(focusIdOf(edit));
    cardElement(edit)?.focus({ preventScroll: true });
  };

  const moveTo = (dir: 1 | -1): boolean => {
    const view = readViewState(editor.doc);
    const ui = useUiStore.getState();
    const graph = visibleGraph(view.deck, scopeOf(ui.drill), collapsedOf(editor.doc));
    const next = nextTitleTarget(readingOrder(view.deck, graph.nodes), edit.id, dir);
    if (next === null) return false;
    ui.select({ nodes: [next] });
    ui.focus(next);
    ui.startTitleEdit({ target: 'node', id: next, isNew: false });
    return true;
  };

  const addAnother = () => {
    const kind = edit.kind;
    if (kind === undefined) return;
    const deck = readViewState(editor.doc).deck;
    const index = deck.nodes.findIndex((node) => node.id === edit.id);
    const node = deck.nodes[index];
    if (node === undefined) return;
    const at = displayPosition(node, index);
    end();
    addComponent(editor, kind, { x: at.x + NEXT_STEP, y: at.y + NEXT_STEP }, { edit: true });
  };

  return (
    <InlineEdit
      label={edit.target === 'node' ? 'Component title' : 'Group title'}
      value={title}
      autoFocus
      startEmpty={edit.isNew}
      {...(edit.isNew ? { placeholder: 'Name this component' } : {})}
      onCommit={commit}
      onKeyDown={(event, draft) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && edit.isNew) {
          event.preventDefault();
          commit(draft);
          addAnother();
          return true;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          commit(draft);
          backToCard();
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          done.current = true;
          backToCard();
          return true;
        }
        if (event.key === 'Tab' && edit.target === 'node') {
          event.preventDefault();
          commit(draft);
          if (!moveTo(event.shiftKey ? -1 : 1)) backToCard();
          return true;
        }
        return false;
      }}
      onBlur={(event) => {
        commit(event.currentTarget.value);
        end();
      }}
      // Clicks and drags inside the field edit text; they must not select or move the card.
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
      }}
      // A quiet field inside the card (design 96–97): the card's own ring marks it, so the
      // input shows a light fill and the caret instead of a second focus outline.
      className={cn(
        'nodrag nopan h-6 w-full rounded-row border-transparent bg-surface-2 px-1 text-body-sm font-medium hover:border-transparent focus:border-transparent focus-visible:outline-none',
        className,
      )}
    />
  );
}
