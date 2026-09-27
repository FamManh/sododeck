/** The connection choices shared by the connection popover and the connection inspector (FR-009). */
import type { Edge } from '@sododeck/schema';
import { ArrowLeftRight, ArrowRight, Minus } from 'lucide-react';

export const PROTOCOLS: readonly { value: NonNullable<Edge['protocol']>; label: string }[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'grpc', label: 'gRPC' },
  { value: 'event', label: 'Event' },
  { value: 'sql', label: 'SQL' },
  { value: 'websocket', label: 'WebSocket' },
  { value: 'other', label: 'Other' },
];

export const DIRECTIONS = [
  { value: 'forward', label: 'Forward', Icon: ArrowRight },
  { value: 'both', label: 'Both', Icon: ArrowLeftRight },
  { value: 'none', label: 'None', Icon: Minus },
] as const;

export type Direction = (typeof DIRECTIONS)[number]['value'];

export const protocolLabel = (value: Edge['protocol']): string | undefined =>
  PROTOCOLS.find((p) => p.value === value)?.label;
