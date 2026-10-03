import { Button } from '@sododeck/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { cn } from '@sododeck/ui/lib/utils';
import { Focus, Search, Tag } from 'lucide-react';
import { useRef, type ReactNode } from 'react';

import { isFlowMode, useUiStore } from '../../state/ui-store';
import { Island } from './island';
import { shortcutLabel } from './shortcuts';

/** An icon button with its name and shortcut in a tooltip (the island shows no labels, §g-60). */
function ToolButton({
  label,
  tip,
  pressed,
  disabled,
  buttonRef,
  children,
  onClick,
  ...props
}: {
  label: string;
  tip: string;
  pressed?: boolean;
  disabled?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
  children: ReactNode;
  onClick: () => void;
  'aria-haspopup'?: 'dialog';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={buttonRef}
          variant="ghost"
          size="icon"
          aria-label={label}
          {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
          {...(disabled === true ? { 'aria-disabled': true } : {})}
          className={cn(
            pressed === true && 'bg-primary-soft text-primary-ink hover:bg-primary-soft',
            disabled === true && 'opacity-50',
          )}
          onClick={() => {
            if (disabled !== true) onClick();
          }}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The tools island, top-right (018 FR-011, design 86; trimmed in §g-60): Jump to (⌘K), Labels
 * and Focus, icon-only with tooltips. Export, theme and keyboard shortcuts live in the deck menu;
 * the flow-notes display lives in the step player.
 */
export function ToolsIsland() {
  const openPalette = useUiStore((s) => s.openPalette);
  const labelsOn = useUiStore((s) => s.labelsOn);
  const setLabelsOn = useUiStore((s) => s.setLabelsOn);
  const focusMode = useUiStore((s) => s.focusMode);
  const setFocusMode = useUiStore((s) => s.setFocusMode);
  const focusDisabled = useUiStore((s) => s.flowSession !== null || isFlowMode(s));
  const jumpRef = useRef<HTMLButtonElement>(null);
  const jumpShortcut = shortcutLabel('search');

  return (
    <Island region="tools" label="Tools" className="top-3 right-3">
      <ToolButton
        buttonRef={jumpRef}
        label={`Jump to… (${jumpShortcut})`}
        tip={`Jump to… ${jumpShortcut}`}
        aria-haspopup="dialog"
        onClick={() => {
          openPalette(jumpRef.current);
        }}
      >
        <Search />
      </ToolButton>
      <ToolButton
        label="Labels"
        tip="Show connector labels"
        pressed={labelsOn}
        onClick={() => {
          setLabelsOn(!labelsOn);
        }}
      >
        <Tag />
      </ToolButton>
      <ToolButton
        label="Focus"
        tip={
          focusDisabled
            ? 'Focus: not available while a flow is shown'
            : 'Focus: dim all but the selection and its neighbours · F'
        }
        pressed={focusMode}
        disabled={focusDisabled}
        onClick={() => {
          setFocusMode(!focusMode);
        }}
      >
        <Focus />
      </ToolButton>
    </Island>
  );
}
