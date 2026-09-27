import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FeatureGroup } from './feature-group';
import { filterFlows } from './filter-flows';
import { FlowFilter } from './flow-filter';
import { featureOf, flowsIn } from './flow-order';
import { startNewFlow } from './flow-session';
import { NewFlowDialog, type NewFlowTarget } from './new-flow-dialog';
import { useSortableList } from './use-sortable-list';

/**
 * Features and their flows in the left panel (FR-001–005, FR-034–036, designs 03, 47, 48):
 * new, rename, reorder and delete features and flows, the filter and its empty state.
 */
export function FlowList({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const filterText = useUiStore((s) => s.flowFilter);
  const activeFlowId = useUiStore((s) => s.activeFlow?.flowId ?? null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newFlow, setNewFlow] = useState<NewFlowTarget | null>(null);
  const result = useMemo(() => filterFlows(deck, filterText), [deck, filterText]);
  const filtering = filterText.trim() !== '';

  const featureSort = useSortableList({
    ids: deck.features.map((f) => f.id),
    group: 'features',
    onMove: (id, position) => {
      editor.reorder('features', id, position);
    },
  });

  const unassigned = flowsIn(deck, null);
  const groups = [
    ...deck.features.map((f) => ({ featureId: f.id, title: f.title })),
    // "No feature" only when needed; with no features at all it holds "+ New flow".
    ...(unassigned.length > 0 || deck.features.length === 0
      ? [{ featureId: null, title: 'No feature' }]
      : []),
  ].filter(
    ({ featureId }) => !filtering || flowsIn(deck, featureId).some((f) => result.matches.has(f.id)),
  );

  const addFeature = () => {
    const id = editor.add('features', { title: 'New feature' });
    setRenamingId(id);
    useUiStore.getState().announce('Added feature ‘New feature’. Type its name.');
  };

  /** The feature "New flow '<text>'" records into: the shown flow's, else the first one. */
  const currentFeature = () => {
    const active = deck.flows.find((f) => f.id === activeFlowId);
    return (active === undefined ? null : featureOf(deck, active)) ?? deck.features[0]?.id ?? null;
  };

  return (
    <div className="flex flex-col gap-2">
      <FlowFilter count={result.count} total={result.total} />
      {filtering && result.count === 0 ? (
        <div className="flex flex-col items-start gap-2 py-2">
          <p className="text-body-sm text-ink-secondary">
            No flows match &ldquo;{filterText.trim()}&rdquo;
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              onClick={() => {
                useUiStore.getState().setFlowFilter('');
              }}
            >
              Clear filter
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const name = filterText.trim();
                useUiStore.getState().setFlowFilter('');
                startNewFlow(name, currentFeature());
              }}
            >
              <Plus />
              New flow ‘{filterText.trim()}’
            </Button>
          </div>
        </div>
      ) : (
        <ul aria-label="Features" className="flex flex-col gap-1">
          {groups.map(({ featureId, title }) => (
            <FeatureGroup
              key={featureId ?? ''}
              deck={deck}
              featureId={featureId}
              title={title}
              flows={flowsIn(deck, featureId)}
              matches={result.matches}
              filtering={filtering}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
              onNewFlow={() => {
                setNewFlow({ featureId, featureName: title });
              }}
              sortable={
                featureId === null || filtering
                  ? null
                  : {
                      row: featureSort.rowProps(featureId),
                      grip: featureSort.gripProps(featureId),
                      dragging: featureSort.drag?.id === featureId,
                    }
              }
            />
          ))}
        </ul>
      )}
      {!filtering && (
        <Button variant="ghost" size="sm" className="self-start" onClick={addFeature}>
          <Plus />
          New feature
        </Button>
      )}
      <NewFlowDialog
        target={newFlow}
        onClose={() => {
          setNewFlow(null);
        }}
      />
    </div>
  );
}
