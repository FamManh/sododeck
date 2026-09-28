import {
  SECTIONS,
  type Action,
  type ActionContext,
  type ResolvedAction,
  type ResolvedSection,
  type Surface,
} from './types';

const DEFAULT_MODES = ['edit'] as const;

const labelOf = (action: Action, ctx: ActionContext) =>
  typeof action.label === 'function' ? action.label(ctx) : action.label;

/** Whether `action` is offered for this target and mode on `surface` (any surface when omitted). */
function offered(action: Action, ctx: ActionContext, surface?: Surface): boolean {
  const kinds =
    surface === undefined
      ? [...(action.where.menu ?? []), ...(action.where.toolbar ?? [])]
      : (action.where[surface] ?? []);
  return (
    kinds.includes(ctx.target.kind) &&
    (action.modes ?? DEFAULT_MODES).includes(ctx.mode) &&
    (action.applies?.(ctx) ?? true)
  );
}

function resolve(action: Action, ctx: ActionContext): ResolvedAction {
  const children = action.children?.(ctx).map((child) => resolve(child, ctx));
  return {
    id: action.id,
    label: labelOf(action, ctx),
    ...(action.icon === undefined ? {} : { icon: action.icon }),
    ...(action.shortcut === undefined ? {} : { shortcut: action.shortcut }),
    ...(action.description === undefined ? {} : { description: action.description }),
    ...(action.field === undefined ? {} : { field: action.field }),
    ...(children === undefined ? {} : { children }),
    destructive: action.destructive === true,
    disabled: action.disabledReason?.(ctx) ?? null,
    radio: action.radio === true,
    checked: action.checked?.(ctx) ?? false,
    run: () => {
      action.run?.(ctx);
    },
  };
}

/**
 * The actions that apply to the context's target and mode on a surface, in menu sections (019
 * R1): section order from `SECTIONS`, list order inside a section, empty sections dropped.
 */
export function actionsFor(
  list: readonly Action[],
  ctx: ActionContext,
  surface: Surface,
): ResolvedSection[] {
  const applicable = list.filter((action) => offered(action, ctx, surface));
  return SECTIONS.flatMap((id) => {
    const actions = applicable.filter((a) => a.section === id).map((a) => resolve(a, ctx));
    return actions.length === 0 ? [] : [{ id, actions }];
  });
}

export function findAction(list: readonly Action[], id: string): Action | undefined {
  return list.find((action) => action.id === id);
}

/**
 * Runs an action from a key (FR-039): only where a menu or the toolbar would offer it, enabled,
 * for this target and mode. Returns whether it ran.
 */
export function runAction(list: readonly Action[], id: string, ctx: ActionContext): boolean {
  const action = findAction(list, id);
  if (action?.run === undefined || !offered(action, ctx)) return false;
  if ((action.disabledReason?.(ctx) ?? null) !== null) return false;
  action.run(ctx);
  return true;
}
