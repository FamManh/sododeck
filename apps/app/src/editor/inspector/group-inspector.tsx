import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { Switch } from '@sododeck/ui/components/switch';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { ChevronUp, Layers } from 'lucide-react';
import { useId, useMemo } from 'react';

import { useUiStore } from '../../state/ui-store';
import { COLLAPSED_NODE_PREFIX } from '../deck-to-flow';
import { scopeOf, visibleGraph } from '../visible-graph';
import { viewStateOf } from '../views/view-state';
import { InspectorFrame } from './inspector-frame';

export function GroupInspector({
  deck,
  group,
}: {
  deck: SododeckFile;
  group: SododeckFile['groups'][number];
}) {
  const drill = useUiStore((state) => state.drill);
  const collapsed = useUiStore((state) => state.collapsed);
  const toggleCollapsed = useUiStore((state) => state.toggleCollapsed);
  const setCollapsed = useUiStore((state) => state.setCollapsed);
  const switchId = useId();
  const currentViewId = useUiStore((state) => state.currentViewId);
  const revealed = useUiStore((state) => state.revealed);
  const canvasDeck = viewStateOf(deck, currentViewId, revealed).deck;
  const graph = useMemo(
    () => visibleGraph(canvasDeck, scopeOf(drill), collapsed),
    [canvasDeck, drill, collapsed],
  );
  const rows = graph.merged.filter(
    (edge) =>
      edge.a === `${COLLAPSED_NODE_PREFIX}${group.id}` ||
      edge.b === `${COLLAPSED_NODE_PREFIX}${group.id}`,
  );

  return (
    <InspectorFrame
      icon={<Layers aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={group.title}
      subtitle="Group"
    >
      <PanelSection>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <label htmlFor={switchId} className="text-body text-ink">
              Collapsed
            </label>
            <span id={`${switchId}-description`} className="text-caption text-ink-secondary">
              Collapse this group into one summary card on the canvas
            </span>
          </div>
          <Switch
            id={switchId}
            checked={collapsed.has(group.id)}
            aria-label="Collapsed"
            aria-describedby={`${switchId}-description`}
            onCheckedChange={() => {
              toggleCollapsed(group.id);
            }}
          />
        </div>
      </PanelSection>
      <PanelSection label="Merged connections">
        {rows.length === 0 ? (
          <p className="text-body-sm text-ink-secondary">No merged connections.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between rounded-row bg-surface-2 px-2 py-1.5 text-body-sm"
              >
                <span>{row.id.replace(/^merged:/, '')}</span>
                <span className="font-mono text-caption text-ink-secondary">
                  ×{row.edgeIds.length}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
      <PanelSection>
        <Button
          variant="secondary"
          disabled={!collapsed.has(group.id)}
          onClick={() => {
            setCollapsed(group.id, false);
          }}
        >
          <ChevronUp />
          Expand group
        </Button>
      </PanelSection>
    </InspectorFrame>
  );
}
