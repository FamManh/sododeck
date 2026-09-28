import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { cn } from '@sododeck/ui/lib/utils';
import { Download, Focus, Moon, Search, StickyNote, Sun, Tag } from 'lucide-react';
import { useRef, type ReactNode } from 'react';

import { isFlowMode, useUiStore } from '../../state/ui-store';
import { useThemeStore } from '../../theme/theme-store';
import { useExportDeck } from '../use-export-deck';
import { Island, IslandDivider } from './island';
import { shortcutLabel } from './shortcuts';

/** A tooltip only in the compact islands, where the button has no visible label. */
function Tip({ show, text, children }: { show: boolean; text: string; children: ReactNode }) {
  if (!show) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

/** Labels / Focus: the toggle button with its label, or an icon-only toggle when compact. */
function IslandToggle({
  compact,
  label,
  pressed,
  icon,
  ...props
}: {
  compact: boolean;
  label: string;
  pressed: boolean;
  icon: ReactNode;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  if (!compact) {
    return (
      <Button variant="toggle" pressed={pressed} className="border-transparent" {...props}>
        {icon}
        {label}
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={pressed}
      className={cn(pressed && 'bg-primary-soft text-primary-ink hover:bg-primary-soft')}
      {...props}
    >
      {icon}
    </Button>
  );
}

/**
 * The tools island, top-right (018 FR-011, design 86): Jump to (⌘K), Labels, sticky visibility
 * (§g-46), Focus, theme and Export. In a narrow window (116) the labels drop and the buttons keep
 * their accessible names.
 */
export function ToolsIsland({ compact = false }: { compact?: boolean }) {
  const openPalette = useUiStore((s) => s.openPalette);
  const labelsOn = useUiStore((s) => s.labelsOn);
  const setLabelsOn = useUiStore((s) => s.setLabelsOn);
  const notesDisplay = useUiStore((s) => s.notesDisplay);
  const setNotesDisplay = useUiStore((s) => s.setNotesDisplay);
  const focusMode = useUiStore((s) => s.focusMode);
  const setFocusMode = useUiStore((s) => s.setFocusMode);
  const focusDisabled = useUiStore((s) => s.flowSession !== null || isFlowMode(s));
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const exportDeck = useExportDeck();
  const jumpRef = useRef<HTMLButtonElement>(null);
  const jumpShortcut = shortcutLabel('search');

  return (
    <Island region="tools" label="Tools" className="top-3 right-3">
      <Tip show={compact} text={`Jump to… ${jumpShortcut}`}>
        <Button
          ref={jumpRef}
          variant="ghost"
          aria-label={`Jump to… (${jumpShortcut})`}
          aria-haspopup="dialog"
          className={cn(
            'gap-2 rounded-input bg-surface-2 text-ink-secondary hover:bg-surface-3',
            compact ? 'size-8.5 px-0' : 'w-44 justify-start px-2.5',
          )}
          onClick={() => {
            openPalette(jumpRef.current);
          }}
        >
          <Search />
          {!compact && (
            <>
              <span className="flex-1 text-left text-body">Jump to…</span>
              <kbd aria-hidden className="font-sans text-caption text-ink-secondary">
                {jumpShortcut}
              </kbd>
            </>
          )}
        </Button>
      </Tip>
      <Tip show={compact} text="Labels">
        <IslandToggle
          compact={compact}
          label="Labels"
          pressed={labelsOn}
          icon={<Tag />}
          onClick={() => {
            setLabelsOn(!labelsOn);
          }}
        />
      </Tip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            aria-haspopup="menu"
            aria-label={`Notes: ${notesDisplay}`}
            title="Notes during flows"
            className={cn(compact && 'size-8.5 px-0')}
          >
            <StickyNote />
            {!compact && 'Notes'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          aria-label="Notes during flows"
          aria-labelledby={undefined}
          align="end"
        >
          <DropdownMenuRadioGroup
            value={notesDisplay}
            onValueChange={(value) => {
              if (value === 'dimmed' || value === 'shown' || value === 'hidden') {
                setNotesDisplay(value);
              }
            }}
          >
            <DropdownMenuRadioItem value="dimmed">Dimmed</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="shown">Shown</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="hidden">Hidden</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tip show={compact} text="Focus · F">
        <IslandToggle
          compact={compact}
          label="Focus"
          pressed={focusMode}
          disabled={focusDisabled}
          title={focusDisabled ? 'Not available while a flow is shown' : 'Focus · F'}
          icon={<Focus />}
          onClick={() => {
            if (!focusDisabled) setFocusMode(!focusMode);
          }}
        />
      </Tip>
      <IslandDivider />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Switch to ${nextTheme} theme`}
            onClick={() => {
              setTheme(nextTheme);
            }}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Switch to {nextTheme} theme</TooltipContent>
      </Tooltip>
      <Button
        variant="primary"
        aria-label={compact ? 'Export' : undefined}
        className={cn(compact && 'size-8.5 px-0')}
        onClick={exportDeck}
      >
        <Download />
        {!compact && 'Export'}
      </Button>
    </Island>
  );
}
