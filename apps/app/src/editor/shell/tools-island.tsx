import { Button } from '@sododeck/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { cn } from '@sododeck/ui/lib/utils';
import { Search, Settings2, Tag } from 'lucide-react';
import { useRef, type ReactNode } from 'react';

import { useUiStore } from '../../state/ui-store';
import { Island } from './island';
import { shortcutLabel } from './shortcuts';
import { ToolsMoreMenu } from './tools-more-menu';

/** An icon button with its name and shortcut in a tooltip (the island shows no labels, §g-60). */
function ToolButton({
  label,
  tip,
  pressed,
  buttonRef,
  children,
  onClick,
  ...props
}: {
  label: string;
  tip: string;
  pressed?: boolean;
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
          className={cn(
            pressed === true && 'bg-primary-soft text-primary-ink hover:bg-primary-soft',
          )}
          onClick={onClick}
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
 * The tools island, top-right (018 FR-011, design 86; trimmed in §g-60): Deck settings, Jump to
 * (⌘K), Labels and ⋯ More (imports into this deck: Mermaid, SQL or DBML), icon-only with
 * tooltips (054: Deck settings added, Focus moved to the rail).
 * Export, theme and keyboard shortcuts live in the deck menu, which keeps its Deck settings entry;
 * the flow-notes display lives in the step player.
 */
export function ToolsIsland() {
  const openPalette = useUiStore((s) => s.openPalette);
  const labelsOn = useUiStore((s) => s.labelsOn);
  const setLabelsOn = useUiStore((s) => s.setLabelsOn);
  const deckSettingsOpen = useUiStore((s) => s.drawer.open && s.drawer.mode === 'deck');
  const openDrawer = useUiStore((s) => s.openDrawer);
  const closeDrawer = useUiStore((s) => s.closeDrawer);
  const jumpRef = useRef<HTMLButtonElement>(null);
  const jumpShortcut = shortcutLabel('search');

  return (
    <Island region="tools" label="Tools" className="top-3 right-3">
      <ToolButton
        label="Deck settings"
        tip="Deck settings"
        pressed={deckSettingsOpen}
        onClick={() => {
          if (deckSettingsOpen) closeDrawer();
          else openDrawer('deck');
        }}
      >
        <Settings2 />
      </ToolButton>
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
      <ToolsMoreMenu />
    </Island>
  );
}
