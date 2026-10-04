/**
 * Card style board (020 T041, design 107): a design-gallery section, rendered from real
 * `DeckNode`s with static data (no doc writes) inside a minimal editor + React Flow context.
 * `DeckNode` reads `data.look`/`data.problems` from props, so no Yjs edits are needed to preview
 * every state.
 */
import { fromJSON } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import type { NodeProps } from '@xyflow/react';
import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';

import { EMPTY_FIELD_VIEW } from '../editor/card-fields';
import { cardLayout } from '../editor/card-layout';
import { DeckNode } from '../editor/deck-node';
import type { DeckFlowNode, DeckNodeData } from '../editor/deck-to-flow';
import { NODE_SIZE } from '../editor/deck-to-flow';
import { CARD_COLORS, resolveLook } from '../editor/style/card-style';
import { EditorProvider } from '../model/editor-context';
import { GallerySection } from './gallery-section';

const CUSTOM_FILLS = ['#1f2a44', '#e8d5b7', '#c9e7dc'] as const;

/** A `DeckNode` at fixed size, for a grid of static samples. */
function Sample({
  id,
  selected = false,
  ...data
}: { id: string; selected?: boolean } & Partial<DeckNodeData> & Pick<DeckNodeData, 'title'>) {
  const props = {
    id,
    type: 'deck',
    selected,
    width: NODE_SIZE.width,
    height: NODE_SIZE.height,
    data: {
      kind: 'service',
      subtitle: undefined,
      owner: undefined,
      tagLooks: [],
      fields: EMPTY_FIELD_VIEW,
      hasRules: true,
      childCount: 0,
      dimmed: false,
      level: 'component',
      focused: false,
      // The box the card draws (029 R7): the samples sit at the default size.
      layout: cardLayout({ title: data.title, size: NODE_SIZE }),
      ...data,
    },
  } as unknown as NodeProps<DeckFlowNode>;
  // A real `.react-flow__node` wrapper (outside `DeckNode`), so the view-dimmed opacity rule in
  // `index.css` (scoped to that class) renders the same as on the canvas.
  const wrapperClass = props.data.viewDimmed === true ? 'react-flow__node view-dimmed' : undefined;
  return (
    <div style={{ width: NODE_SIZE.width, height: NODE_SIZE.height }} className={wrapperClass}>
      <DeckNode {...props} />
    </div>
  );
}

function StyleSamplesInner() {
  return (
    <GallerySection
      id="style"
      title="Card style"
      description="Every fill and stroke (020, design 107), plus selected, flow step, error, dimmed and pinned on colour."
    >
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="mb-2 text-micro text-ink-muted uppercase">Fills</h3>
          <div className="flex flex-wrap gap-3">
            {CARD_COLORS.map((colour) => (
              <Sample
                key={colour}
                id={`fill-${colour}`}
                title={`${colour[0]?.toUpperCase() ?? ''}${colour.slice(1)} card`}
                subtitle="orders.svc"
                look={resolveLook({ fill: colour })}
              />
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-micro text-ink-muted uppercase">Strokes</h3>
          <div className="flex flex-wrap gap-3">
            {CARD_COLORS.map((colour) => (
              <Sample
                key={colour}
                id={`stroke-${colour}`}
                title={`${colour[0]?.toUpperCase() ?? ''}${colour.slice(1)} stroke`}
                subtitle="orders.svc"
                look={resolveLook({ stroke: colour })}
              />
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-micro text-ink-muted uppercase">Custom fills</h3>
          <div className="flex flex-wrap gap-3">
            {CUSTOM_FILLS.map((hex) => (
              <Sample
                key={hex}
                id={`custom-${hex}`}
                title="Payment service"
                subtitle="payments.svc"
                look={resolveLook({ fill: hex })}
              />
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-micro text-ink-muted uppercase">States on colour</h3>
          <div className="flex flex-wrap gap-3">
            <Sample
              id="state-selected"
              title="Selected"
              subtitle="orders.svc"
              look={resolveLook({ fill: 'green' })}
              selected
            />
            <Sample
              id="state-step"
              title="Flow step"
              subtitle="orders.svc"
              look={resolveLook({ fill: 'green', stroke: 'blue' })}
              currentStep
            />
            <Sample
              id="state-error"
              title="Problem"
              subtitle="orders.svc"
              look={resolveLook({ fill: 'violet' })}
              problems={{
                count: 1,
                titles: 'Duplicate connection',
                label: '1 problem',
                severity: 'warning',
                rows: new Map(),
                rowText: new Map(),
              }}
            />
            <Sample
              id="state-dimmed"
              title="Dimmed"
              subtitle="orders.svc"
              look={resolveLook({ fill: 'green' })}
              dimmed
              viewDimmed
            />
            <Sample
              id="state-pinned"
              title="Pinned"
              subtitle="orders.svc"
              look={resolveLook({ fill: 'green' })}
              pinned
            />
          </div>
        </div>
      </div>
    </GallerySection>
  );
}

/** Its own `EditorProvider`/`ReactFlowProvider` (`DeckNode`'s hooks need both; the doc is unused). */
export function StyleSamples() {
  const [doc] = useState(() => fromJSON(emptySododeckFile()));
  return (
    <EditorProvider doc={doc}>
      <ReactFlowProvider>
        <StyleSamplesInner />
      </ReactFlowProvider>
    </EditorProvider>
  );
}
