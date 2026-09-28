import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import {
  Group,
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

import { useUiStore, type Tool } from '../../state/ui-store';
import { useProblems } from '../problems/use-problems';
import type { FlyoutId } from './shell-prefs';
import { flyoutElementId, railButtonId } from './shell-ids';
import { Island } from './island';
import { shortcutLabel, type ShortcutId } from './shortcuts';

/** Rail tooltips wait a little longer than the app default (DESIGN.md "Left rail"). */
const RAIL_TOOLTIP_DELAY = 400;

type RailButtonProps = Omit<ComponentProps<'button'>, 'aria-label'> & {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: number;
};

/** A 38×38 rail button (DESIGN.md "Rail button"): Orange Soft while active or open. */
export const RailButton = forwardRef<HTMLButtonElement, RailButtonProps>(function RailButton(
  { label, icon: Icon, active = false, badge, className, ...props },
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
          className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-soft px-1 text-[10px] leading-none font-medium text-amber-ink ring-2 ring-surface"
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

const TOOLS: readonly { tool: Tool; label: string; icon: LucideIcon; shortcut: ShortcutId }[] = [
  { tool: 'select', label: 'Select', icon: MousePointer2, shortcut: 'select' },
];

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
 * The left rail (018 FR-012–FR-020, contract "Rail"): tools (Select, Add component, Sticky note,
 * Group, Connector), then the panels opened as flyouts (Outline, Flows & features, Rules),
 * Search and Problems. Group waits for 016 ("group from selection"), so it is shown disabled with
 * the reason (founder-approved exception, plan Complexity Tracking).
 */
export function Rail() {
  const tool = useUiStore((s) => s.tool);
  const setTool = useUiStore((s) => s.setTool);
  const flyout = useUiStore((s) => s.flyout);
  const openFlyout = useUiStore((s) => s.openFlyout);
  const openPalette = useUiStore((s) => s.openPalette);
  const problems = useProblems()?.total ?? 0;

  const panelButton = (id: FlyoutId, label: string, icon: LucideIcon, shortcut?: ShortcutId) => (
    <RailTip key={id} label={label} {...(shortcut === undefined ? {} : { shortcut })}>
      <RailButton
        id={railButtonId(id)}
        label={label}
        icon={icon}
        active={flyout === id}
        aria-expanded={flyout === id}
        aria-controls={flyout === id ? flyoutElementId(id) : undefined}
        {...(id === 'problems' && problems > 0 ? { badge: problems } : {})}
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

  return (
    <Island region="rail" label="Canvas tools" orientation="vertical" className="relative">
      {TOOLS.map((entry) => toolButton(entry.tool, entry.label, entry.icon, entry.shortcut))}
      {panelButton('palette', 'Add component', Plus, 'add-component')}
      {toolButton('sticky', 'Sticky note', StickyNote, 'sticky')}
      <RailTip label="Group" shortcut="group" hint="Group from selection — coming soon">
        <RailButton
          id={railButtonId('group')}
          label="Group"
          icon={Group}
          aria-disabled
          onClick={(event) => {
            event.preventDefault();
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
