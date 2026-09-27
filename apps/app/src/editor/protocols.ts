import type { SododeckFile } from '@sododeck/schema';

type Protocol = NonNullable<SododeckFile['edges'][number]['protocol']>;

/** Schema enum `Protocol`, with display names. */
export const PROTOCOLS: readonly { value: Protocol; label: string }[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'grpc', label: 'gRPC' },
  { value: 'event', label: 'Event' },
  { value: 'sql', label: 'SQL' },
  { value: 'websocket', label: 'WebSocket' },
  { value: 'other', label: 'Other' },
];

export function protocolLabel(protocol: Protocol | undefined): string | undefined {
  return PROTOCOLS.find((p) => p.value === protocol)?.label;
}
