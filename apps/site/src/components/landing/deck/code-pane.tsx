import type { ReactNode } from 'react';

import { C, FLOAT_SHADOW } from '../../../lib/landing/tokens';
import { CodeLines, type CodePanelData } from './code-lines';
import { CodeTabs } from './code-tabs';
import { Segmented } from './segmented';

interface CodePaneProps {
  /** Prefix for the tab and panel ids; unique on the page. */
  id: string;
  width: number | string;
  height: number;
  /** One panel per tab. With more than one, the tabs switch (`landing-controls.ts`). */
  panels: readonly CodePanelData[];
  /** The tab shown first (and without JS). */
  active?: number;
  /** The picked card whose lines are highlighted (Code section), see `CodePanelData.refs`. */
  selected?: string;
  /** Hides the file name in the footer. */
  narrow?: boolean;
  chip?: ReactNode;
  /** Takes the free width of a flex row instead of `width`. */
  grow?: boolean;
}

/** The code panel (004, 046): tabs, line-numbered code, a sync footer. */
export function CodePane({
  id,
  width,
  height,
  panels,
  active = 0,
  selected,
  narrow = false,
  chip,
  grow = false,
}: CodePaneProps) {
  const tabs = panels.map((p) => p.tab);
  const switching = panels.length > 1;
  return (
    <div
      data-tabs={switching ? '' : undefined}
      style={{
        position: 'relative',
        width,
        height,
        flex: grow ? '1 1 0' : 'none',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        boxShadow: FLOAT_SHADOW,
        boxSizing: 'border-box',
        color: C.ink,
        maxWidth: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 48,
          padding: '0 10px',
          borderBottom: `1px solid ${C.border}`,
          flex: 'none',
        }}
      >
        {switching ? (
          <CodeTabs id={id} items={tabs} active={active} />
        ) : (
          <Segmented items={tabs} active={active} />
        )}
        <span style={{ flex: 1 }} />
        {chip}
      </div>
      {panels.map((panel, i) => (
        <div
          key={panel.tab}
          {...(switching
            ? {
                role: 'tabpanel',
                id: `${id}-panel-${String(i)}`,
                'aria-labelledby': `${id}-tab-${String(i)}`,
                hidden: i !== active,
              }
            : {})}
          className="ld-code-panel"
        >
          <CodeLines
            panel={panel}
            narrow={narrow}
            {...(selected === undefined ? {} : { selected })}
          />
        </div>
      ))}
    </div>
  );
}
