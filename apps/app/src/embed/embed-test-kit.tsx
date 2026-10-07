import {
  createFakeHost,
  memoryTransportPair,
  type FakeHost,
  type FakeHostOptions,
} from '@sododeck/host-protocol';
import { serializeDeck, type DeckEditor } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { TooltipProvider } from '@sododeck/ui/components/tooltip';
import { render } from '@testing-library/react';

import { useUiStore } from '../state/ui-store';
import { EmbedApp } from './embed-app';
import { useEmbedStore } from './embed-store';

/** A deck file with two connected cards, as a host would hold it. */
export const SAMPLE: SododeckFile = {
  $schema: 'https://sododeck.com/schema/v1.json',
  version: 1,
  name: 'Shop',
  nodes: [
    { id: 'api', type: 'service', title: 'Billing API', position: { x: 0, y: 0 } },
    { id: 'db', type: 'database', title: 'Orders DB', position: { x: 320, y: 0 } },
  ],
  groups: [],
  edges: [{ id: 'e1', from: 'api', to: 'db' }],
  views: [],
  features: [],
  flows: [],
  rules: {},
  stickies: [],
};

export const sampleText = (patch: Partial<SododeckFile> = {}) =>
  serializeDeck({ ...SAMPLE, ...patch });

/** The editor the embed's provider created (set by the test file's mocked `EditorProvider`). */
export const opened = { editor: undefined as DeckEditor | undefined };

/**
 * Renders the embed against a scripted host over an in-memory transport (067 FR-025). Resets the
 * stores a previous test left behind.
 */
export function mountEmbed(options: FakeHostOptions = {}, props: { waitMs?: number } = {}) {
  useEmbedStore.getState().reset();
  useUiStore.setState(useUiStore.getInitialState(), true);
  opened.editor = undefined;
  const pair = memoryTransportPair();
  const host: FakeHost = createFakeHost(pair.host, { text: sampleText(), ...options });
  const view = render(
    <TooltipProvider>
      <EmbedApp transport={pair.editor} {...props} />
    </TooltipProvider>,
  );
  return { host, view, pair };
}

/** The `change` messages the editor sent, in order. */
export function changes(host: FakeHost) {
  return host.log.flatMap((entry) =>
    entry.dir === 'in' && entry.message.type === 'change' ? [entry.message] : [],
  );
}
