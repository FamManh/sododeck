import { fromJSON } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import type { NodeProps } from '@xyflow/react';
import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';

import { cardFieldView } from '../editor/card-fields';
import { cardLayoutOf } from '../editor/canvas-geometry';
import { DeckNode } from '../editor/deck-node';
import type { DeckFlowNode } from '../editor/deck-to-flow';
import type { Level } from '../editor/levels';
import { EditorProvider } from '../model/editor-context';
import { GallerySection } from './gallery-section';

const year = String(new Date().getFullYear());

/** Frames 120 / 124: Task, Warehouse and Issue cards with their default fields filled in. */
const deck: SododeckFile = {
  ...emptySododeckFile(),
  fields: [
    {
      id: 'warehouse.capacity',
      name: 'Capacity',
      kind: 'progress',
      types: ['warehouse'],
      onCard: true,
    },
    {
      id: 'warehouse.sla',
      name: 'SLA',
      kind: 'number',
      unit: 'h',
      types: ['warehouse'],
      onCard: true,
    },
    {
      id: 'warehouse.region',
      name: 'Region',
      kind: 'select',
      types: ['warehouse'],
      onCard: true,
      options: [{ id: 'south', label: 'South', color: 'amber' }],
    },
    {
      id: 'stage',
      name: 'Status',
      kind: 'status',
      types: ['warehouse'],
      onCard: true,
      options: [{ id: 'open', label: 'Open', color: 'green', icon: 'door-open' }],
    },
    { id: 'manager', name: 'Manager', kind: 'person', types: ['warehouse'] },
    { id: 'docks', name: 'Docks', kind: 'number', types: ['warehouse'] },
    { id: 'site', name: 'Site', kind: 'link', types: ['warehouse'] },
  ],
  fieldDefaults: ['warehouse'],
  nodes: [
    {
      id: 'task',
      type: 'task',
      title: 'Write the onboarding guide',
      values: { 'task.status': 'doing', 'task.assignee': 'Lan', 'task.due': `${year}-10-14` },
    },
    {
      id: 'wh',
      type: 'warehouse',
      title: 'Warehouse HCM',
      values: {
        'warehouse.capacity': 82,
        'warehouse.sla': 24,
        'warehouse.region': 'south',
        stage: 'open',
        manager: 'Minh Tran',
        docks: 12,
        site: { url: 'https://maps.example.com/hcm-d9' },
      },
    },
    {
      id: 'issue',
      type: 'issue',
      title: 'Checkout times out on retry',
      values: {
        'issue.status': 'todo',
        'issue.assignee': 'Bao Nguyen',
        'issue.dates': { from: `${year}-10-06`, to: `${year}-10-17` },
        'issue.estimate': 5,
      },
    },
  ],
};

function Card({ index, level }: { index: number; level: Level }) {
  const node = deck.nodes[index];
  if (node === undefined) return null;
  const fields = cardFieldView(deck, node);
  const layout = cardLayoutOf(node, { description: undefined, fields });
  const props = {
    id: `${node.id}-${level}`,
    type: 'deck',
    selected: false,
    width: layout.width,
    height: layout.height,
    data: {
      title: node.title,
      kind: node.type,
      subtitle: undefined,
      owner: undefined,
      tagLooks: [],
      fields,
      hasRules: false,
      childCount: 0,
      dimmed: false,
      level,
      focused: false,
      layout,
    },
  } as unknown as NodeProps<DeckFlowNode>;
  return (
    <div style={{ width: layout.width, height: layout.height }}>
      <DeckNode {...props} />
    </div>
  );
}

export function TypedFieldSamples() {
  const [doc] = useState(() => fromJSON(deck));
  return (
    <EditorProvider doc={doc}>
      <ReactFlowProvider>
        <GallerySection
          id="typed-fields"
          title="Typed fields"
          description="Frames 120 and 124 (032): header status, chip shelf, rows and +N fields, at Component and System."
        >
          <div data-testid="typed-field-samples" className="flex flex-col gap-6">
            {(['component', 'system'] as const).map((level) => (
              <div key={level} className="flex flex-wrap items-start gap-4">
                {deck.nodes.map((node, index) => (
                  <Card key={node.id} index={index} level={level} />
                ))}
              </div>
            ))}
          </div>
        </GallerySection>
      </ReactFlowProvider>
    </EditorProvider>
  );
}
