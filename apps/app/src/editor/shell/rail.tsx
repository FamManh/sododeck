import type { Severity } from '@sododeck/model';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import {
  Focus,
  Group,
  Hand,
  ListTree,
  MousePointer2,
  Plus,
  Search,
  Spline,
  StickyNote,
  Table2,
  TriangleAlert,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { forwardRef, type ComponentProps } from 'react';

import { isFlowMode, useUiStore, type Tool } from '../../state/ui-store';
import { modeOf, useRunAction } from '../actions/use-action-context';
import { groupableCount } from '../editing/group-from-selection';
import { useProblems } from '../problems/use-problems';
import type { FlyoutId } from './shell-prefs';
import { flyoutElementId, railButtonId } from './shell-ids';
import { Island } from './island';
import { shortcutLabel, type ShortcutId } from './shortcuts';

/** Rail tooltips wait a little longer than the app default (DESIGN.md "Left rail"). */
const RAIL_TOOLTIP_DELAY = 400;

const GROUP_DISABLED = 'Select two or more components';

type RailButtonProps = Omit<ComponentProps<'button'>, 'aria-label'> & {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: number;
  /** Badge colour (047): clay while an error is listed, amber otherwise. */
  badgeSeverity?: Severity;
};

/** A 38×38 rail button (DESIGN.md "Rail button"): Orange Soft while active or open. */
export const RailButton = forwardRef<HTMLButtonElement, RailButtonProps>(function RailButton(
  { label, icon: Icon, active = false, badge, badgeSeverity = 'warning', className, ...props },
  ref,
) {
  const disabled = props['aria-disabled'] === true;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={badge === undefined ? label : `${label}, ${String(badge)}`}
      className={cn(
        'relative flex size-9.5 shrink-0 cursor-pointer items-center justify-center rounded-row text-ink-secondary transition-colors hover:bg-surface-2 active:bg-surface-3',
        active && 'bg-primary-soft text-primary-ink hover:bg-primary-soft',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
        focusRing,
        className,
      )}
      {...props}
    >
      <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4.5" />
      {badge !== undefined && (
        <span
          aria-hidden
          data-severity={badgeSeverity}
          className={cn(
            'absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-medium ring-2 ring-surface',
            badgeSeverity === 'error'
              ? 'bg-clay-soft text-clay-ink'
              : 'bg-amber-soft text-amber-ink',
          )}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
});

function RailTip({
  label,
  shortcut,
  hint,
  children,
}: {
  label: string;
  shortcut?: ShortcutId;
  hint?: string;
  children: React.ReactElement;
}) {
  return (
    <Tooltip delayDuration={RAIL_TOOLTIP_DELAY}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {hint ?? label}
        {shortcut !== undefined && (
          <span className="ml-2 font-mono opacity-70">{shortcutLabel(shortcut)}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

const PANELS: readonly { id: FlyoutId; label: string; icon: LucideIcon; shortcut?: ShortcutId }[] =
  [
    { id: 'outline', label: 'Outline', icon: ListTree, shortcut: 'outline' },
    { id: 'flows', label: 'Flows & features', icon: Workflow, shortcut: 'flows' },
    { id: 'rules', label: 'Rules', icon: Table2 },
  ];

function RailDivider() {
  return <span aria-hidden className="my-1 h-px w-5.5 shrink-0 bg-hairline" />;
}

/**
 * The left rail (018 FR-012–FR-020, contract "Rail"): tools (Select / Hand toggle, Focus (054), Add component, Sticky note,
 * Group, Connector), then the panels opened as flyouts (Outline, Flows & features, Rules),
 * Search and Problems. Group (016) groups the selection, like ⌘G; with fewer than two items it
 * stays visible, disabled, with the reason.
 */
export function Rail() {
  const tool = useUiStore((s) => s.tool);
  const setTool = useUiStore((s) => s.setTool);
  const flyout = useUiStore((s) => s.flyout);
  const openFlyout = useUiStore((s) => s.openFlyout);
  const openPalette = useUiStore((s) => s.openPalette);
  const checked = useProblems();
  const problems = checked?.total ?? 0;
  const problemSeverity: Severity = (checked?.errors ?? 0) > 0 ? 'error' : 'warning';
  const focusMode = useUiStore((s) => s.focusMode);
  const setFocusMode = useUiStore((s) => s.setFocusMode);
  // Focus dims the canvas, which a flow already does with its own highlight.
  const focusDisabled = useUiStore((s) => s.flowSession !== null || isFlowMode(s));
  const runAction = useRunAction();
  const canGroup = useUiStore(
    (s) =>
      groupableCount(s.selection) >= 2 &&
      s.selection.edges.length === 0 &&
      s.selection.stickies.length === 0 &&
      modeOf(s) === 'edit',
  );

  const panelButton = (id: FlyoutId, label: string, icon: LucideIcon, shortcut?: ShortcutId) => (
    <RailTip key={id} label={label} {...(shortcut === undefined ? {} : { shortcut })}>
      <RailButton
        id={railButtonId(id)}
        label={label}
        icon={icon}
        active={flyout === id}
        aria-expanded={flyout === id}
        aria-controls={flyout === id ? flyoutElementId(id) : undefined}
        {...(id === 'problems' && problems > 0
          ? { badge: problems, badgeSeverity: problemSeverity }
          : {})}
        onClick={() => {
          openFlyout(id);
        }}
      />
    </RailTip>
  );

  const toolButton = (value: Tool, label: string, icon: LucideIcon, shortcut: ShortcutId) => (
    <RailTip key={value} label={label} shortcut={shortcut}>
      <RailButton
        id={railButtonId(value)}
        label={label}
        icon={icon}
        active={tool === value}
        aria-pressed={tool === value}
        onClick={() => {
          setTool(value);
        }}
      />
    </RailTip>
  );

  // Select and Hand share one button (§g-57): it shows the current mode and a click switches.
  // From Sticky or Connector it goes back to Select first.
  const handMode = tool === 'hand';
  const pointerLabel = handMode ? 'Hand' : 'Select';
  const pointerButton = (
    <RailTip key="pointer" label={pointerLabel} shortcut={handMode ? 'hand' : 'select'}>
      <RailButton
        id={railButtonId('select')}
        label={pointerLabel}
        icon={handMode ? Hand : MousePointer2}
        active={tool === 'select' || handMode}
        aria-pressed={tool === 'select' || handMode}
        onClick={() => {
          setTool(tool === 'select' ? 'hand' : 'select');
        }}
      />
    </RailTip>
  );

  const focusButton = (
    <RailTip
      key="focus"
      label="Focus"
      {...(focusDisabled ? {} : { shortcut: 'focus-mode' as const })}
      hint={
        focusDisabled
          ? 'Focus: not available while a flow is shown'
          : 'Focus: dim all but the hovered or selected card and its neighbours'
      }
    >
      <RailButton
        id={railButtonId('focus')}
        label="Focus"
        icon={Focus}
        active={focusMode}
        aria-pressed={focusMode}
        {...(focusDisabled ? { 'aria-disabled': true } : {})}
        onClick={() => {
          if (!focusDisabled) setFocusMode(!focusMode);
        }}
      />
    </RailTip>
  );

  return (
    <Island region="rail" label="Canvas tools" orientation="vertical" className="relative">
      {pointerButton}
      {focusButton}
      {panelButton('palette', 'Add component', Plus, 'add-component')}
      {toolButton('sticky', 'Sticky note', StickyNote, 'sticky')}
      <RailTip label="Group" shortcut="group" {...(canGroup ? {} : { hint: GROUP_DISABLED })}>
        <RailButton
          id={railButtonId('group')}
          label="Group"
          icon={Group}
          {...(canGroup ? {} : { 'aria-disabled': true })}
          onClick={(event) => {
            event.preventDefault();
            // The same action as ⌘G and the menus (016 FR-010).
            if (canGroup) runAction('group.create');
          }}
        />
      </RailTip>
      {toolButton('connector', 'Connector', Spline, 'connector')}
      <RailDivider />
      {PANELS.map((entry) => panelButton(entry.id, entry.label, entry.icon, entry.shortcut))}
      <RailTip label="Search" shortcut="search">
        <RailButton
          id={railButtonId('search')}
          label="Search"
          icon={Search}
          aria-haspopup="dialog"
          onClick={(event) => {
            openPalette(event.currentTarget);
          }}
        />
      </RailTip>
      <RailDivider />
      {panelButton('problems', 'Problems', TriangleAlert, 'problems')}
    </Island>
  );
}
