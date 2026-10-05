/**
 * The shared action list (019 R1, ADR 0015): one plain object per editing command, rendered by the
 * context menu and the selection toolbar and run by the new keys, so a menu item is enabled
 * exactly when its shortcut works (FR-039). Later features add modules to `ACTIONS` (FR-040).
 */
import type { DeckEditor } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';
import type { ResolvedIcon } from '@sododeck/ui/icon-sets';
import type { LucideIcon } from 'lucide-react';

import type { MenuTarget, Selection, ToolbarFieldId } from '../../state/ui-store';
import type { ShortcutId } from '../shell/shortcuts';
import type { DrawnEdge, DrawnNode } from '../editing/spread-view';
import type { ViewState } from '../views/view-state';

/** `keys`: offered only through its shortcut, never listed in a menu or toolbar. */
export type Surface = 'menu' | 'toolbar' | 'keys';

/** `viewOnly`: the narrow-window editor (< 1024 px); see `use-action-context.ts`. */
export type Mode = 'edit' | 'flow' | 'session' | 'viewOnly';

export type TargetKind = MenuTarget['kind'];

/** Menu sections, in the order they are shown, separated by a rule. */
export const SECTIONS = ['open', 'edit', 'clipboard', 'arrange', 'view', 'danger'] as const;
export type Section = (typeof SECTIONS)[number];

/** The React Flow calls some actions need; absent in pure tests. */
export interface CanvasApi {
  fitView: (options?: { padding?: number }) => unknown;
  screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number };
  getViewport: () => { x: number; y: number; zoom: number };
  /** What the canvas draws now (050 US7: spread ends reads the drawn boxes and sides). */
  getNodes?: () => readonly DrawnNode[];
  getEdges?: () => readonly DrawnEdge[];
}

export interface ActionContext {
  editor: DeckEditor;
  /** The real snapshot (not view-projected). */
  deck: SododeckFile;
  /** The current view as the canvas draws it (pins, collapsed groups, visible graph input). */
  view: ViewState;
  target: MenuTarget;
  /** The ids the action acts on: the target's, or nothing for the canvas. */
  selection: Selection;
  mode: Mode;
  /** Screen point the menu was opened at (canvas actions add there). */
  point: { x: number; y: number } | null;
  /** Direct children count of each visible component in the current scope (drill-in). */
  childCount: ReadonlyMap<Id, number>;
  canvas: CanvasApi | null;
  /** Shows a toast (Copy JSON). */
  toast: (message: string) => void;
  /** Shows the Undo toast (043: a deleted column); absent in pure tests, which then announce. */
  undoToast?: (message: string) => void;
}

type Dynamic<T> = T | ((ctx: ActionContext) => T);

export interface Action {
  /** Unique, e.g. `title.rename`. */
  id: string;
  label: Dynamic<string>;
  /** The toolbar's name when it differs, e.g. "Protocol: HTTP" for the menu's "Protocol". */
  toolbarLabel?: Dynamic<string>;
  icon?: LucideIcon;
  /** A CSS colour value shown as a mini swatch instead of `icon` (`null` = no colour; 020). */
  swatch?: Dynamic<string | null>;
  /** The icon the toolbar button draws (038): the icon the selected cards share, or `'mixed'`. */
  glyph?: (ctx: ActionContext) => ResolvedIcon | 'mixed';
  /** A sentence added to the toolbar button's tooltip when it applies (038: unavailable icon). */
  note?: (ctx: ActionContext) => string | null;
  /** A key from `SHORTCUTS` shown as the hint (menu) or in the tooltip (toolbar). */
  shortcut?: ShortcutId;
  /** A literal key hint when no `SHORTCUTS` entry fits one item (e.g. "2" in Add component ▸). */
  hint?: string;
  section: Section;
  /** Where the action is offered, and for which targets. */
  where: Partial<Record<Surface, readonly TargetKind[]>>;
  /** Default `['edit']`; Open details, Copy JSON and Fit add the others. */
  modes?: readonly Mode[];
  /** Extra conditions (e.g. the component has children). */
  applies?: (ctx: ActionContext) => boolean;
  /** Shown as a tooltip; the item stays visible but disabled. */
  disabledReason?: (ctx: ActionContext) => string | null;
  /** A tooltip for an enabled item (e.g. "Members move to the parent level"). */
  description?: string;
  destructive?: boolean;
  /** In the toolbar: the label shows next to the icon (Group, Align; screen 99). */
  toolbarText?: boolean;
  /** In a submenu: a rule before this item (Align ▸, 016). */
  separatorBefore?: boolean;
  /** Submenu items. With `radio`, the children are one choice each and `checked` marks one. */
  children?: (ctx: ActionContext) => readonly Action[];
  radio?: boolean;
  checked?: (ctx: ActionContext) => boolean;
  /** The toolbar popover this action opens (toolbar field buttons). */
  field?: ToolbarFieldId;
  /**
   * A toolbar button that must not take focus from a text field being edited (053: Bold and Link
   * act on the note's selection, which a blur would end together with the edit).
   */
  keepFocus?: boolean;
  /** Every document write is exactly one undo step (`oneStep` / `editor.batch`). */
  run?: (ctx: ActionContext) => void;
}

export interface ResolvedAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  swatch?: string | null;
  glyph?: ResolvedIcon | 'mixed';
  note?: string;
  shortcut?: ShortcutId;
  hint?: string;
  description?: string;
  destructive: boolean;
  /** Why it can't run now, or `null` when it can. */
  disabled: string | null;
  field?: ToolbarFieldId;
  keepFocus: boolean;
  radio: boolean;
  checked: boolean;
  separatorBefore: boolean;
  toolbarText: boolean;
  children?: readonly ResolvedAction[];
  run: () => void;
}

export interface ResolvedSection {
  id: Section;
  actions: readonly ResolvedAction[];
}
